# 知你AI助手 HTTP 工具 API 参考

## 调用与返回约定

- HTTP API Base URL：`https://mcp.h5bqb.top/api/v1/tools`
- Skill 通过 `scripts/zhini-api.mjs` 发起请求，不依赖 MCP 连接器。
- 凭证支持两种方式：静态 API Key（`ZHINI_API_KEY` 或 `.zhini-ai-assistant/api-key`）或 MCP 原生 OAuth 2.1 浏览器授权（未配置静态 Key 时自动触发，也可手动执行 `auth oauth`）；令牌缓存在 `.zhini-ai-assistant/oauth-tokens.json` 并自动刷新。工具参数中不传任何凭据。
- 成功返回通常包含 `ok: true`、`summary` 和 `data`；列表接口可能附带 `meta` 分页信息。
- 业务结果以工具实际返回为准。下文列出常用字段和参数语义，字段缺失时按错误信息处理。

统一命令格式：

```bash
node "<SKILL_ROOT>/scripts/zhini-api.mjs" call TOOL_NAME 'JSON_ARGUMENTS'
```

## 工具清单

### `zhini_get_current_kefu`

**参数**：无。

**用途**：获取当前调用者的客服 ID。

**返回重点**：`data.kfid`。

**常用后续**：把 `kfid` 传给 `zhini_list_active_sessions`，区分我的会话和同事会话；第一人称归属查询也可用于 `zhini_search_customers`、`zhini_search_sessions`。

### `zhini_list_active_sessions`

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `kfid` | string | 否 | — | 当前调用者客服 ID；传入后可标记 `mine`、`colleague`、`waiting`、`ai`。 |

**返回重点**：`data.sessions`、`data.counts` 或摘要中的队列计数；每项通常含 `sid`、`uid`、`kfid`、`queue_type`、`lasttime` 等。

**范围提示**：这是当前未结束队列的快照。我的会话全部返回，同事会话最多 250 条，等待接待最多 100 条；达到上限时结果可能截断。

### `zhini_get_customer_profile`

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `uid` | string | 是 | 知你侧客户 UID，通常来自客户搜索或会话数据。 |

**返回重点**：`data.uid`、`data.profile`，包括名称、联系方式、来源、负责人、备注和标签等标准化资料。

### `zhini_list_tag_groups`

**参数**：无。

**返回重点**：`data.groups`；每项提供标签分组 ID 和名称，可用于后续标签列表查询。

### `zhini_list_tags`

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `tag_group_id` | string | 否 | — | 标签分组 ID；缺省时查询默认标签范围。 |
| `page` | integer | 否 | `1` | 页码，从 1 开始。 |
| `page_size` | integer | 否 | `20` | 每页数量，范围 1–20。 |

**返回重点**：`data.tags`、`data.totalCount`、`data.page`、`data.page_size`。

### `zhini_search_tags`

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `search_keyword` | string | 是 | — | 标签名称关键词，需为非空文本。 |
| `include_grouped` | boolean | 否 | `true` | 是否在 `data.groups` 中按 `tag_group_id` 聚合候选。 |

**返回重点**：`data.tags`、可选的 `data.groups`、`data.requires_confirmation`。同名或相似标签较多时，保留候选 ID 供核对。

### `zhini_fetch_messages`

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `sid` | string | 三选一 | — | 会话 ID，首次加载会话消息时使用。 |
| `mid` | string | 三选一 | — | 消息 ID，按游标翻页时使用。 |
| `uid` | string | 三选一 | — | 客户 UID，按客户查询消息时使用。 |
| `direction` | `backward\|forward` | 否 | — | 翻页方向；`backward` 更早，`forward` 更新。 |
| `start_time` | number | 否 | — | 消息发生时间起点，秒级 Unix 时间戳。 |
| `end_time` | number | 否 | — | 消息发生时间终点，秒级 Unix 时间戳。 |
| `size` | integer | 否 | `20` | 返回数量，范围 1–20。 |
| `include_mid` | `0\|1` | 否 | — | 为 `1` 时包含指定 `mid`，适合查看目标消息前后文。 |

**返回重点**：`data.messages`、`data.indicator`、`data.has_older`、`data.has_newer`、`data.scene`。

**组合规则**：`sid`、`mid`、`uid` 至少传一个；按 `uid` 查询时可叠加时间范围。时间参数筛选消息发生时间，不代表会话开启时间。

### `zhini_list_kefu`

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `scene` | string 或 number | 否 | — | 业务场景；客户/历史筛选通常使用场景值 `1`。 |
| `only_active` | boolean | 否 | `true` | 是否过滤 `status=0` 的客服。 |

**返回重点**：`data.kefus`、`data.requires_confirmation`；每项含 `kfid`、名称和状态。

### `zhini_list_channels`

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `type` | string | 否 | `all` | `all` 或具体渠道类型，如 `miniapp`、`pubapp`、`douyin`、`xiaohongshu`。 |
| `group_by_type` | boolean | 否 | `true` | 是否在 `data.groups` 中按类型聚合。 |

**返回重点**：`data.channels`、可选的 `data.groups`、`data.requires_confirmation`；每项含 `channel_id`、名称和类型。

### `zhini_search_customers`

**筛选参数**（至少提供一个）：

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 客户名称或昵称关键词。 |
| `phone` | string | 手机号关键词。 |
| `user_wechat_id` | string | 微信号关键词。 |
| `kfid` | string[] | 归属客服 ID 列表。 |
| `pic_kfids` | string[] | 负责人 ID 列表。 |
| `channel_id` | string[] | 渠道 ID 列表。 |
| `tag_id` | string[] | 标签 ID 列表。 |
| `sex` | `0[]\|1[]\|2[]` | 性别枚举：0 未知、1 男、2 女。 |
| `wx_contact_type` | `0[]\|1[]` | 联系人类型：0 联系人、1 群组。 |
| `add_friend_time` | `[number, number]` | 添加好友时间范围，秒级 Unix 时间戳。 |
| `last_contact_time` | `[number, number]` | 最后联系时间范围，秒级 Unix 时间戳。 |
| `page` | integer | 页码，从 0 开始，默认 `0`。 |
| `page_size` | integer | 每页 1–20 条，默认 `20`。 |

**返回重点**：`data.customers`、`data.count`、`data.page`、`data.page_size`、`data.requires_confirmation`。需要完整时间范围时逐页读取，拿到 `uid` 后再补充画像或消息。

### `zhini_search_sessions`

**筛选参数**（至少提供一个）：

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 客户名称关键词。 |
| `msg` | string | 消息内容关键词；非空时关键词历史检索覆盖最近半年。 |
| `msg_stime` | `[number, number]` | 消息发送时间范围，秒级 Unix 时间戳。 |
| `kfid` | string[] | 客服 ID 列表。 |
| `channel_id` | string[] | 渠道 ID 列表。 |
| `tag_id` | string[] | 标签 ID 列表。 |
| `wx_contact_type` | `0[]\|1[]` | 联系人类型数组：0 联系人、1 群组。 |
| `page` | integer | 页码，从 0 开始，默认 `0`。 |

**返回重点**：`data.sessions`、`data.count`、`data.page`。该工具不接收数量参数，底层默认每页约 30 条；继续查询时递增 `page`。`msg_stime` 按消息发送时间筛选，不代表会话开启时间。

### `zhini_get_apikey_usage`

**参数**：无。

**返回重点**：

| 字段 | 数据范围 | 语义 |
|---|---|---|
| `total` | 当前 API Key 所属账号 | 账号整体总额度。 |
| `used` | 当前 API Key 所属账号 | 账号整体已使用量。 |
| `remaining` | 当前 API Key 所属账号 | 账号整体剩余量。 |
| `current_api_key_used` | 当前请求 API Key | 当前请求 API Key 的实时已使用量。 |

其中 `total`、`used`、`remaining` 三个字段共同构成当前 API Key 所属账号的整体数据；`current_api_key_used` 记录单个请求 API Key 的独立用量。

账号字段满足 `total = used + remaining` 时表示账号级数据一致；`current_api_key_used` 属于独立维度，不参与该等式。

### `zhini_open_sessions`

**参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `uids` | string[] | 要打开对话的客户 UID 列表，必填，1–20 个；UID 应来自用户明确选定的客户或会话结果。 |

**用途**：使用当前客服账号身份批量打开选定用户对话，使其进入知你客服的“我的对话”。

**返回重点**：`data` 中逐 UID 的处理结果；已被其他客服接待的用户不会转接到当前客服。

**常用后续**：对打开成功的客户发送跟进消息（`zhini_create_message_sending_task`），或读取其资料与消息上下文。

### `zhini_upload_image_for_message_sending`

**参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `image.data` / `image.base64` 或顶层 `base64` | string | 图片 Base64 数据或 Base64 data URL，必填（二选一）；不接受远程 URL。 |
| `filename` | string | 可选，上传文件名；未传时按 MIME 类型生成。 |
| `mime_type` | string | 可选，声明的 MIME 类型，需与实际内容一致。 |

**用途**：上传消息发送用图片，返回 CDN 地址。

**返回重点**：`data.url`——图片消息 content 必须使用本次调用上传返回的地址（服务端校验来源，30 分钟内有效）。

**限制**：PNG/JPEG/GIF，解码后不超过 10 MiB。

### `zhini_create_message_sending_task`

**参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `title` | string | 任务标题，必填，用于任务列表筛选。 |
| `uids` | string[] | 收件客户 UID 列表，必填，去重后最多 100 个。 |
| `messages` | object[] | 消息列表，必填，最多 2 条；每条含 `msgtype`（`text`/`image`）、`content`（文本或已上传图片 URL），图片可附 `width`/`height`（整数，未传时使用 400）。 |
| `user_confirmed` | `true` | 第二阶段必填：用户已明确确认收件 UID、任务标题和最终消息内容。 |
| `confirmation_token` | string | 第二阶段必填：首次调用返回的短时一次性确认凭证（长度 ≥ 32）。 |
| `idempotency_key` | string | 可选，客户端重试时复用的幂等键（8–200 字符）；同键同任务在 10 分钟内只创建一次。 |

**用途**：创建异步批量消息发送任务。**两阶段执行**：首次调用只准备任务并返回 `confirmation_token`，不创建不发送；用户确认后用完全相同的内容加令牌与 `user_confirmed: true` 再次调用才会真正创建。

**返回重点**：第一阶段 `data.confirmation_token` 与任务预览；第二阶段 `data.task_id`。

**限制**：单任务最多 100 个 UID、最多 2 条消息；图片消息 content 必须是本连接上传返回的 CDN URL。

### `zhini_get_message_sending_task_status`

**参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `task_id` | string | 必填，创建任务接口返回的任务 ID。 |

**用途**：查询消息发送任务状态及完成后的逐 UID/逐消息明细。

**返回重点**：`data` 中的任务状态、进度和逐客户发送结果；明细区分开启会话通知（`open_push`）和挂载最近关闭会话后推送（`history_attach_push`）。

### `zhini_list_message_sending_tasks`

**参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `title` | string | 可选，任务标题模糊筛选。 |
| `send_time_start` / `send_time_end` | string | 可选，发送时间范围，`YYYY-MM-DD` 或 `YYYY-MM-DD HH:MM:SS`。 |
| `page` | integer | 页码，从 1 开始，默认 `1`。 |
| `page_size` | integer | 每页 1–100 条，默认 `20`。 |

**用途**：分页查询历史消息发送任务。

**返回重点**：`data.list`、分页信息；删除任务前应先通过本工具或状态查询核对任务归属、标题和状态。

### `zhini_delete_message_sending_task`

**参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `task_id` | string | 必填，要逻辑删除的任务 ID；删除前必须核对任务。 |

**用途**：逻辑删除消息发送任务并取消尚未消费的发送明细。

**注意**：删除不可逆，已发送的消息不会撤回；上游删除后可能无法再查询该 `task_id`，删除前保存所需状态和明细。

## 错误处理

| 错误码 | 处理方式 |
|---|---|
| `ZHINI_AUTH_REQUIRED` / `ZHINI_AUTH_EXPIRED`（HTTP 401 或 502） | 优先引导用户执行 `node "<SKILL_ROOT>/scripts/zhini-api.mjs" auth oauth` 完成浏览器授权；用户明确使用静态 Key 时，引导前往 `https://ai.zhinikefu.com/api-key/` 创建或复制 API Key 后执行 `auth login`。完成后重新发起原查询。 |
| `ZHINI_INVALID_ARGUMENT` | 根据错误详情补齐必填参数、修正类型、范围或时间二元组。 |
| `ZHINI_RATE_LIMITED` | 按返回的等待窗口延迟后重试，保留原筛选条件和页码。 |
| `ZHINI_HTTP_ERROR` | 稍后重试；若仍失败，输出接口错误摘要和原查询条件。 |
