---
name: zhini-ai-assistant
display_name: 知你AI助手-个微企微抖音各平台账号连接器
display_name_en: Zhini AI Assistant
description: "汇聚微信、抖音、小红书、微博及网站客服的客户资料与聊天记录，让 AI 帮你找客户、查会话、识别商机、分析服务问题，并在用户确认后批量触达客户。"
description_zh: "汇聚个微、企微、视频号、微信小程序、公众号、服务号、微信客服、微信小店、抖音号、小红书、微博、网站及H5客服的客户资料与聊天记录，让 AI 帮你找客户、查会话、识别商机并分析服务问题；支持用户确认后批量打开选定客户对话，发送文本或图片消息，并查询发送进度和历史群发任务。"
description_en: "Connect customer profiles and conversations from WeChat, Douyin, Xiaohongshu, Weibo, websites, and H5 support to AI for customer discovery, conversation analysis, lead identification, service insights, and user-confirmed follow-up messaging."
examples_zh:
  - 查看今天个微中正在排队或长时间未回复的客户会话，按等待时长排序，并列出客户名称、负责人和最近一条消息。
  - 查找最近30天在企微咨询过价格的客户，结合客户标签和聊天记录筛选高意向客户，并整理后续跟进重点。
  - 汇总最近90天抖音账号中涉及投诉、退款或售后的历史会话，读取消息上下文，并按问题类型整理关键证据。
  - 把我选定的这些客户对话批量打开到我的对话，并发送跟进文本；完成后查看发送进度。
examples_en:
  - Review today's queued or long-unanswered customer conversations on personal WeChat, sort them by waiting time, and list each customer, owner, and latest message.
  - Find customers who asked about pricing on WeCom in the last 30 days, use tags and conversation history to identify high-intent customers, and summarize follow-up priorities.
  - Summarize Douyin conversations from the last 90 days involving complaints, refunds, or after-sales service, read the message context, and organize the supporting evidence by issue type.
  - Open the selected customer conversations in bulk and send follow-up texts after confirmation, then review delivery progress.
allowed-tools: "Bash"
version: 1.0.9
author: 知你客服
disable-model-invocation: false
user-invocable: true
---

# 知你AI助手-个微企微抖音各平台账号连接器

通过 Skill 内置脚本直接调用知你 HTTP 工具 API，查询多平台客户、会话和消息数据，并在用户明确确认后批量打开选定对话、发送文本或图片消息。此 Skill 独立运行，不检查、不安装也不依赖 WorkBuddy MCP 连接器。

推荐触发词：客户查询、当前会话、历史会话、聊天记录、客户分群、消息发送、群发任务、API Key 用量。

## 脚本调用

将当前 `SKILL.md` 所在目录记为 `SKILL_ROOT`。所有知你查询统一通过以下命令执行：

```bash
node "<SKILL_ROOT>/scripts/zhini-api.mjs" call TOOL_NAME 'JSON_ARGUMENTS'
```

例如：

```bash
node "<SKILL_ROOT>/scripts/zhini-api.mjs" call zhini_search_customers '{"name":"张三","page":0,"page_size":20}'
```

下文提到“调用 `zhini_xxx`”均表示通过该脚本执行对应 HTTP API，而不是调用 MCP Tool。脚本仅使用 Node.js 内置能力，无第三方依赖。

## 授权引导（首次使用或授权失效时）

发起真实数据查询前执行 `auth status` 检查凭据状态；未配置静态 API Key 时，**优先引导用户走浏览器授权**：

**请先完成授权，否则无法查询数据。** 按下面 3 步操作：

1. 让用户在本机终端执行：

```bash
node "<SKILL_ROOT>/scripts/zhini-api.mjs" auth oauth
```

2. 浏览器会自动打开知你登录页，用户**登录知你账号**（手机号 + 密码）
3. 页面显示「授权成功」后，让用户回我**「已完成」**，我立即重新发起原查询

授权完成后令牌自动缓存与刷新，后续查询无需再次授权；用户回复授权失败时，读取终端里的具体报错并引导重试。

**备选：静态 API Key**（用户明确希望使用 Key 时）：

1. 打开[知你AI助手 API Key 管理页](https://ai.zhinikefu.com/api-key/)。页面要求登录时，使用知你账号登录；新用户切换到“注册”，通过手机号和验证码完成注册。
2. 进入“API Key”页面。已有可用 Key 时点击“复制”；列表为空时点击“新增 API Key”，名称填写 `WorkBuddy`，再点击“创建”并复制完整 Key。
3. 在本机终端运行下面的命令，按提示粘贴 Key。输入过程不回显，凭证保存在当前用户目录的 `.zhini-ai-assistant/api-key` 文件中：

```bash
node "<SKILL_ROOT>/scripts/zhini-api.mjs" auth login
```

也支持由 WorkBuddy 启动环境提供 `ZHINI_API_KEY`；环境变量优先于本地凭证文件。完成任一方式授权后重新执行用户原来的查询。面向用户省略 MCP、连接器、信任操作、本地 MCP 配置和其他服务状态。

## 能力范围

- 客户查询：姓名、手机号、微信号、客服/负责人、渠道、标签、性别、联系人类型和时间范围。
- 当前队列：等待接待、我的会话、同事会话和 AI 会话的实时快照。
- 历史研判：按客户、消息关键词、消息发送时间、客服、渠道、标签和联系人类型检索历史会话。
- 消息上下文：按会话、客户或消息游标读取消息，并支持时间范围和前后翻页。
- 客户分群：通过标签、渠道、客服、联系人类型、性别或时间条件组合筛选。
- 客户触达与消息发送：在用户明确确认后，批量打开选定对话（每次最多 20 个），上传图片并创建最多 100 个 UID、最多 2 条文本/图片消息的异步群发任务，跟踪发送进度并管理历史任务。
- API Key 用量：同时展示账号整体配额和当前请求 API Key 的实时用量。

详细参数、返回字段和错误处理见 `@references/api-spec.md`；常用调用链和结果组织方式见 `@references/examples.md`。

## 意图路由

### 当前会话分诊

1. 用户提到“我的会话、我接待过、我回复过、归属于我”等第一人称归属条件时，先调用 `zhini_get_current_kefu` 获取 `kfid`。
2. 调用 `zhini_list_active_sessions` 获取当前队列快照；该快照用于此刻状态，不承担历史统计。
3. 选定会话后，用 `sid` 调用 `zhini_fetch_messages`，用 `uid` 调用 `zhini_get_customer_profile`。

### 客户查询与画像

1. 客户名、渠道名、客服名或标签名先分别解析为稳定 ID：`zhini_list_channels`、`zhini_list_kefu`、`zhini_search_tags`。
2. 将明确的结构化条件交给 `zhini_search_customers`。至少带一个筛选条件，并从 `page=0` 开始分页。
3. 已知 `uid` 时直接调用 `zhini_get_customer_profile`；需要聊天内容时再调用 `zhini_fetch_messages`。
4. 返回多个候选时保留 `uid`、名称、渠道等核对信息，让用户选择后再深入查询。

### 历史会话研判

1. 按客户、消息关键词或 `msg_stime` 调用 `zhini_search_sessions`。
2. `msg` 只用于召回候选；使用 `zhini_fetch_messages` 读取上下文后再判断诉求、投诉、订单或退款主题。
3. `msg_stime` 表示消息发送时间范围。与非空 `msg` 组合时，关键词历史检索覆盖最近半年；仅使用其他条件时按接口返回范围处理。
4. 需要更多结果时按 `page` 翻页，并输出会话 ID、时间范围和关键证据。

### 客户分群

1. 用户明确提到标签、渠道或客服名称时，先解析为 `tag_id`、`channel_id` 或 `kfid`。
2. 结构化人群使用 `zhini_search_customers`；必须根据聊天内容判断的人群，组合 `zhini_search_sessions` 与 `zhini_fetch_messages`。
3. 标签代表已标注客户，是筛选信号之一；关键词命中也需结合消息上下文确认。
4. 分页查询并记录实际条件、页码和返回数量，避免把单页结果当成完整分群。

### API Key 用量

1. 通过内置脚本调用无参接口 `zhini_get_apikey_usage`。
2. `total`、`used`、`remaining` 表示当前 API Key 所属账号整体数据；`current_api_key_used` 表示当前请求 API Key 的实时已使用量。
3. 仅在账号层校验 `total = used + remaining`，不要把 `current_api_key_used` 纳入该等式。
4. 输出额度摘要和数据范围，不展示完整 API Key 或内部鉴权细节。

### 客户触达与消息发送

1. 收件客户必须来自用户明确选定的结果或其他查询路由已核对候选后的确认结果；不要把整批搜索结果或分群直接当作收件人。
2. 用户要集中处理对话时，先展示目标客户清单并确认，再调用 `zhini_open_sessions`（`uids`，每次最多 20 个）把对话打开到当前客服的“我的对话”。
3. 用户要发送图片时，先调用 `zhini_upload_image_for_message_sending` 上传（Base64 解码后不超过 10 MiB，支持 PNG/JPEG/GIF），用返回的 `url` 作为图片消息内容。
4. 首次调用 `zhini_create_message_sending_task` 只准备任务并返回 `confirmation_token`，**不会创建或发送**；向用户完整展示收件客户、任务标题和最终消息内容，确认后用完全相同的内容加 `confirmation_token` 与 `user_confirmed: true` 再次调用才会创建任务。
5. 创建成功后保存 `task_id`，用 `zhini_get_message_sending_task_status` 跟踪进度和逐客户结果；需要查历史群发任务时用 `zhini_list_message_sending_tasks`（支持标题、发送时间范围和分页）；删除前先核对任务并保存所需明细，再用 `zhini_delete_message_sending_task`。
6. 单任务最多 100 个 UID、最多 2 条消息；任务删除不可逆，已发送的消息不会撤回。

## 输出规范

- 说明本次查询覆盖的账号、渠道、时间范围、筛选条件、页码和返回数量。
- 对候选结果保留 `uid`、`sid`、`mid`、`kfid`、`channel_id`、`tag_id` 等证据 ID，区分事实、命中信号与模型归纳。
- 当前队列结果标注为实时快照；历史结果标注消息时间范围和分页信息。
- 查询保持只读；批量打开对话与消息发送必须在用户明确确认后执行，输出时保留 `task_id`、任务标题、UID 总数和逐客户发送结果。
- 依据工具实际返回组织答案，不虚构客户身份、消息证据或筛选结果。
