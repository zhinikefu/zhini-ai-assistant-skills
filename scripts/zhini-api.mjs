#!/usr/bin/env node

import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { exec } from "node:child_process";
import { once } from "node:events";

const DEFAULT_API_BASE = "https://mcp.h5bqb.top/api/v1/tools";
const API_BASE = String(process.env.ZHINI_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, "");
const KEY_FILE = process.env.ZHINI_API_KEY_FILE || join(homedir(), ".zhini-ai-assistant", "api-key");
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const CREATE_KEY_URL = "https://ai.zhinikefu.com/api-key/";
const REQUEST_TIMEOUT_MS = 30000;

const TOOL_NAMES = new Set([
  "zhini_get_current_kefu",
  "zhini_list_active_sessions",
  "zhini_get_customer_profile",
  "zhini_list_tag_groups",
  "zhini_list_tags",
  "zhini_search_tags",
  "zhini_fetch_messages",
  "zhini_list_kefu",
  "zhini_list_channels",
  "zhini_search_customers",
  "zhini_search_sessions",
  "zhini_get_apikey_usage",
  "zhini_open_sessions",
  "zhini_upload_image_for_message_sending",
  "zhini_create_message_sending_task",
  "zhini_get_message_sending_task_status",
  "zhini_list_message_sending_tasks",
  "zhini_delete_message_sending_task",
]);

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function exitWithError(code, message, extra = {}, exitCode = 1) {
  printJson({
    ok: false,
    error: { code, message },
    ...extra,
  });
  process.exitCode = exitCode;
}

async function readStoredKey() {
  try {
    return String(await readFile(KEY_FILE, "utf8")).trim();
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}

async function resolveApiKey() {
  const environmentKey = String(process.env.ZHINI_API_KEY || "").trim();
  if (environmentKey) return { key: environmentKey, source: "environment" };
  const storedKey = await readStoredKey();
  if (storedKey) return { key: storedKey, source: "credential-file" };
  return { key: "", source: "none" };
}

function credentialSetup() {
  return {
    create_key_url: CREATE_KEY_URL,
    login_command: `node "${SCRIPT_PATH}" auth login`,
    oauth_login_command: `node "${SCRIPT_PATH}" auth oauth`,
    credential_file: KEY_FILE,
    environment_variable: "ZHINI_API_KEY",
  };
}

// ==================== OAuth 通道（未配置静态 Key 时的替代鉴权） ====================

async function fetchJson(url, init) {
  const response = await request(url, init);
  const body = await parseResponse(response);
  if (!response.ok) {
    throw new Error(`${url} -> HTTP ${response.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}
// 完整实现规范 OAuth 客户端流程：401 挑战 → PRM 发现 → AS 元数据 → DCR →
// PKCE 浏览器授权 → 本地回调接 code → 令牌缓存（~/.zhini-ai-assistant/oauth-tokens.json）→ 过期自动刷新。

const OAUTH_TOKENS_FILE = process.env.ZHINI_OAUTH_TOKENS_FILE || join(homedir(), ".zhini-ai-assistant", "oauth-tokens.json");
const OAUTH_SCOPE = "zhini:read";
const OAUTH_CLIENT_NAME = "知你AI助手 Skills";
const OAUTH_AUTH_WAIT_MS = Number(process.env.ZHINI_OAUTH_AUTH_WAIT_MS || 5 * 60 * 1000);
const OAUTH_NO_OPEN = Boolean(process.env.ZHINI_OAUTH_NO_OPEN);

const oauthTokens = {
  apiBase: API_BASE,
  issuer: "",
  clientId: "",
  redirectUri: "",
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
};

function resourceFromApiBase() {
  // HTTP API 与 MCP 共用同一资源指示（issuer + /mcp），audience 校验按此对齐。
  return `${new URL(API_BASE).origin}/mcp`;
}

function loadOAuthTokens() {
  try {
    const cached = JSON.parse(readFileSync(OAUTH_TOKENS_FILE, "utf8"));
    if (cached.apiBase !== API_BASE) return; // API 地址变化后缓存作废。
    Object.assign(oauthTokens, {
      issuer: String(cached.issuer || ""),
      clientId: String(cached.clientId || ""),
      redirectUri: String(cached.redirectUri || ""),
      accessToken: String(cached.accessToken || ""),
      refreshToken: String(cached.refreshToken || ""),
      expiresAt: Number(cached.expiresAt || 0),
    });
  } catch {
    // 无缓存或缓存损坏：走全新授权。
  }
}

async function saveOAuthTokens() {
  await mkdir(dirname(OAUTH_TOKENS_FILE), { recursive: true, mode: 0o700 });
  const temporaryFile = `${OAUTH_TOKENS_FILE}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(oauthTokens, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporaryFile, OAUTH_TOKENS_FILE);
}

function oauthTokenValid() {
  return Boolean(oauthTokens.accessToken) && Date.now() < oauthTokens.expiresAt - 30_000;
}

function parseWwwAuthenticate(header) {
  const params = {};
  const pattern = /(\w+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = pattern.exec(header || ""))) params[match[1]] = match[2];
  return params;
}

function openBrowser(url) {
  try {
    if (process.platform === "win32") exec(`start "" "${url}"`);
    else if (process.platform === "darwin") exec(`open "${url}"`);
    else exec(`xdg-open "${url}"`);
  } catch {
    // 打不开时 URL 已打印，手动访问即可。
  }
}

async function getFreePort() {
  const server = createTcpServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  server.close();
  await once(server, "close");
  return port;
}

// 步骤 1：401 挑战 → PRM（resource_metadata）→ 授权服务器元数据（AS）。
async function discoverAuthorizationServer(challengeHeader) {
  const challengeParams = parseWwwAuthenticate(challengeHeader);
  const prmUrl =
    challengeParams.resource_metadata ||
    `${new URL(API_BASE).origin}/.well-known/oauth-protected-resource`;
  const prm = await fetchJson(prmUrl, { headers: { Accept: "application/json" } });
  const issuer = String((prm.authorization_servers || [])[0] || "").replace(/\/+$/, "");
  if (!issuer) throw new Error("资源元数据未声明 authorization_servers，无法继续 OAuth 授权。");
  const as = await fetchJson(`${issuer}/.well-known/oauth-authorization-server`, {
    headers: { Accept: "application/json" },
  });
  return { prm, issuer, as };
}

// 步骤 2：DCR 动态注册客户端（redirect_uri 指向本脚本临时回调端口）。
async function registerOAuthClient(discovered, redirectUri) {
  if (oauthTokens.clientId && oauthTokens.issuer === discovered.issuer && oauthTokens.redirectUri === redirectUri) {
    return oauthTokens.clientId; // 缓存的注册信息仍然匹配，直接复用。
  }
  const record = await fetchJson(discovered.as.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: OAUTH_CLIENT_NAME,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: OAUTH_SCOPE,
    }),
  });
  if (!record.client_id) throw new Error("动态注册未返回 client_id。");
  oauthTokens.clientId = record.client_id;
  oauthTokens.issuer = discovered.issuer;
  oauthTokens.redirectUri = redirectUri;
  await saveOAuthTokens();
  return oauthTokens.clientId;
}

// 步骤 3：PKCE + state → 弹浏览器授权 → 本地回调接 code。
async function waitForAuthorizationCode(callbackPort, state) {
  let resolveCode;
  const codePromise = new Promise((resolve) => {
    resolveCode = resolve;
  });
  const timeout = setTimeout(() => resolveCode(""), OAUTH_AUTH_WAIT_MS);
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", `http://127.0.0.1:${callbackPort}`);
    if (requestUrl.pathname !== "/callback") {
      res.statusCode = 404;
      res.end();
      return;
    }
    const code = requestUrl.searchParams.get("code") || "";
    const returnedState = requestUrl.searchParams.get("state") || "";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (returnedState === state && code) {
      resolveCode(code);
      res.end("<meta charset='utf-8'><h2>授权成功，可关闭此页面回到终端。</h2>");
    } else {
      res.end("<meta charset='utf-8'><h2>回调参数异常（state 不匹配或缺少 code），请重试。</h2>");
    }
  });
  server.listen(callbackPort, "127.0.0.1");
  await once(server, "listening");
  try {
    return await codePromise;
  } finally {
    clearTimeout(timeout);
    server.close();
  }
}

// 步骤 4：交互式授权全流程（发现 → 注册 → 浏览器 → 换令牌）。
async function runInteractiveAuthorization(challengeHeader) {
  process.stderr.write("▶ 未配置静态 API Key，开始 OAuth 浏览器授权流程。\n");
  const discovered = await discoverAuthorizationServer(challengeHeader);
  const redirectUri = `http://127.0.0.1:${await getFreePort()}/callback`;
  const clientId = await registerOAuthClient(discovered, redirectUri);
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier, "ascii").digest("base64url");
  const state = randomBytes(16).toString("hex");
  const resource = String(discovered.prm.resource || resourceFromApiBase());
  const authorizeUrl = new URL(discovered.as.authorization_endpoint);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", OAUTH_SCOPE);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("resource", resource);
  process.stderr.write(
    `请在浏览器完成登录授权（${OAUTH_NO_OPEN ? "已禁用自动打开，请手动访问" : "自动打开浏览器"}）：\n${authorizeUrl.toString()}\n`,
  );
  if (!OAUTH_NO_OPEN) openBrowser(authorizeUrl.toString());
  const code = await waitForAuthorizationCode(new URL(redirectUri).port, state);
  if (!code) throw new Error(`等待浏览器授权超时（${Math.round(OAUTH_AUTH_WAIT_MS / 1000)} 秒），请重新执行。`);
  const tokenBody = await fetchJson(discovered.as.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource,
    }),
  });
  oauthTokens.accessToken = String(tokenBody.access_token || "");
  oauthTokens.refreshToken = String(tokenBody.refresh_token || "");
  oauthTokens.expiresAt = Date.now() + Number(tokenBody.expires_in || 3600) * 1000;
  await saveOAuthTokens();
  process.stderr.write("✅ OAuth 授权完成，令牌已缓存，过期将自动刷新。\n");
  return oauthTokens.accessToken;
}

async function refreshOAuthTokens() {
  if (!oauthTokens.refreshToken || !oauthTokens.issuer) return false;
  try {
    const as = await fetchJson(`${oauthTokens.issuer}/.well-known/oauth-authorization-server`, {
      headers: { Accept: "application/json" },
    });
    const tokenBody = await fetchJson(as.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: oauthTokens.refreshToken,
        client_id: oauthTokens.clientId,
        resource: resourceFromApiBase(),
      }),
    });
    oauthTokens.accessToken = String(tokenBody.access_token || "");
    if (tokenBody.refresh_token) oauthTokens.refreshToken = String(tokenBody.refresh_token);
    oauthTokens.expiresAt = Date.now() + Number(tokenBody.expires_in || 3600) * 1000;
    await saveOAuthTokens();
    return true;
  } catch {
    oauthTokens.refreshToken = "";
    saveOAuthTokens().catch(() => {});
    return false;
  }
}

async function ensureOAuthAccessToken(challengeHeader) {
  loadOAuthTokens();
  if (oauthTokenValid()) return oauthTokens.accessToken;
  if (oauthTokens.refreshToken && (await refreshOAuthTokens())) return oauthTokens.accessToken;
  return runInteractiveAuthorization(challengeHeader);
}

async function authOauth() {
  loadOAuthTokens();
  await runInteractiveAuthorization(null);
  printJson({
    ok: true,
    oauth: true,
    issuer: oauthTokens.issuer,
    client_id: oauthTokens.clientId,
    tokens_file: OAUTH_TOKENS_FILE,
    expires_at: new Date(oauthTokens.expiresAt).toISOString(),
  });
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: { code: "ZHINI_INVALID_RESPONSE", message: text } };
  }
}

async function request(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyApiKey(apiKey) {
  const response = await request(API_BASE, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  const result = await parseResponse(response);
  if (!response.ok || result.ok === false) {
    const message = result && result.error && result.error.message
      ? result.error.message
      : `API Key 校验失败，HTTP ${response.status}`;
    throw new Error(message);
  }
}

function readHiddenLine(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
      reject(new Error("请在本机交互式终端中执行 auth login。"));
      return;
    }

    let value = "";
    process.stdout.write(promptText);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("已取消 API Key 配置。"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    };

    process.stdin.on("data", onData);
  });
}

async function authStatus() {
  loadOAuthTokens();
  const credential = await resolveApiKey();
  printJson({
    ok: true,
    configured: Boolean(credential.key),
    source: credential.source,
    credential_file: KEY_FILE,
    create_key_url: CREATE_KEY_URL,
    oauth: {
      available: Boolean(oauthTokens.accessToken || oauthTokens.refreshToken),
      issuer: oauthTokens.issuer || null,
      expires_at: oauthTokens.expiresAt ? new Date(oauthTokens.expiresAt).toISOString() : null,
      tokens_file: OAUTH_TOKENS_FILE,
      login_command: `node "${SCRIPT_PATH}" auth oauth`,
    },
  });
}

async function authLogin() {
  const apiKey = await readHiddenLine("请粘贴知你 API Key（输入不回显）：");
  if (!apiKey) throw new Error("API Key 为空。请重新执行 auth login。");

  await verifyApiKey(apiKey);
  await mkdir(dirname(KEY_FILE), { recursive: true, mode: 0o700 });
  const temporaryFile = `${KEY_FILE}.${process.pid}.tmp`;
  await writeFile(temporaryFile, apiKey + "\n", { encoding: "utf8", mode: 0o600 });
  await rename(temporaryFile, KEY_FILE);
  try {
    await chmod(KEY_FILE, 0o600);
  } catch {
    // Windows may not apply POSIX file modes; the file remains under the current user profile.
  }

  printJson({
    ok: true,
    configured: true,
    source: "credential-file",
    credential_file: KEY_FILE,
  });
}

async function authLogout() {
  await rm(KEY_FILE, { force: true });
  await rm(OAUTH_TOKENS_FILE, { force: true });
  printJson({
    ok: true,
    removed: true,
    credential_file: KEY_FILE,
    oauth_tokens_file: OAUTH_TOKENS_FILE,
    environment_key_present: Boolean(String(process.env.ZHINI_API_KEY || "").trim()),
  });
}

function parseArguments(rawArguments) {
  const raw = rawArguments || "{}";
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON_ARGUMENTS 解析失败：${error.message}`);
  }
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("JSON_ARGUMENTS 必须是 JSON 对象。");
  }
  return value;
}

async function callTool(toolName, rawArguments) {
  if (!TOOL_NAMES.has(toolName)) {
    exitWithError("ZHINI_UNKNOWN_TOOL", `未知工具：${toolName}`, { tools: [...TOOL_NAMES] }, 2);
    return;
  }

  const args = parseArguments(rawArguments);
  const credential = await resolveApiKey();
  const url = `${API_BASE}/${encodeURIComponent(toolName)}`;
  const send = (authorization) =>
    request(url, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(args),
    });

  let response;
  if (credential.key) {
    // 既有行为：静态 Key 优先（环境变量 / 凭据文件）。
    response = await send(`Bearer ${credential.key}`);
  } else {
    // 未配置静态 Key：走 OAuth 通道（缓存令牌 → 静默刷新 → 浏览器授权）。
    let accessToken = await ensureOAuthAccessToken(null);
    response = await send(`Bearer ${accessToken}`);
    if (response.status === 401) {
      const challenge = response.headers.get("www-authenticate") || "";
      if (await refreshOAuthTokens()) {
        response = await send(`Bearer ${oauthTokens.accessToken}`);
      } else {
        accessToken = await runInteractiveAuthorization(challenge);
        response = await send(`Bearer ${accessToken}`);
      }
    }
  }

  const result = await parseResponse(response);
  printJson(result);
  if (!response.ok || result.ok === false) process.exitCode = 1;
}

function printHelp() {
  printJson({
    ok: true,
    usage: [
      `node "${SCRIPT_PATH}" auth status`,
      `node "${SCRIPT_PATH}" auth login`,
      `node "${SCRIPT_PATH}" auth oauth`,
      `node "${SCRIPT_PATH}" auth logout`,
      `node "${SCRIPT_PATH}" call TOOL_NAME 'JSON_ARGUMENTS'`,
      `node "${SCRIPT_PATH}" tools`,
    ],
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "tools") {
    printJson({ ok: true, tools: [...TOOL_NAMES] });
    return;
  }

  if (command === "auth") {
    const action = args[0] || "status";
    if (action === "status") return authStatus();
    if (action === "login") return authLogin();
    if (action === "oauth") return authOauth();
    if (action === "logout") return authLogout();
    exitWithError("ZHINI_INVALID_COMMAND", `未知认证命令：${action}`, {}, 2);
    return;
  }

  if (command === "call") {
    await callTool(args[0] || "", args[1] || "{}");
    return;
  }

  if (TOOL_NAMES.has(command)) {
    await callTool(command, args[0] || "{}");
    return;
  }

  exitWithError("ZHINI_INVALID_COMMAND", `未知命令：${command}`, {}, 2);
}

main().catch((error) => {
  const isAbort = error && error.name === "AbortError";
  exitWithError(
    isAbort ? "ZHINI_TIMEOUT" : "ZHINI_CLIENT_ERROR",
    isAbort ? `请求超过 ${REQUEST_TIMEOUT_MS}ms。` : String(error && error.message ? error.message : error),
    isAbort ? { timeout_ms: REQUEST_TIMEOUT_MS } : {},
  );
});
