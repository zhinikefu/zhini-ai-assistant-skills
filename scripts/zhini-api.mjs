#!/usr/bin/env node

import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

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
    credential_file: KEY_FILE,
    environment_variable: "ZHINI_API_KEY",
  };
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
  const credential = await resolveApiKey();
  printJson({
    ok: true,
    configured: Boolean(credential.key),
    source: credential.source,
    credential_file: KEY_FILE,
    create_key_url: CREATE_KEY_URL,
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
  printJson({
    ok: true,
    removed: true,
    credential_file: KEY_FILE,
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

  const credential = await resolveApiKey();
  if (!credential.key) {
    exitWithError(
      "ZHINI_API_KEY_REQUIRED",
      "请先创建并在本机配置知你 API Key。",
      { setup: credentialSetup() },
      3,
    );
    return;
  }

  const args = parseArguments(rawArguments);
  const response = await request(`${API_BASE}/${encodeURIComponent(toolName)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential.key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(args),
  });
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
