# 知你AI助手 HTTP 工具 API 参考

## 调用与返回约定

- HTTP API Base URL：`https://mcp.h5bqb.top/api/v1/tools`
- Skill 通过 `scripts/zhini-api.mjs` 发起请求，不依赖 MCP 连接器。
- 脚本从 `ZHINI_API_KEY` 或当前用户目录下的 `.zhini-ai-assistant/api-key` 读取凭证，并通过 Bearer Header 鉴权；工具参数中不传 API Key。
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

## 错误处理

| 错误码 | 处理方式 |
|---|---|
| `ZHINI_API_KEY_REQUIRED` / `ZHINI_AUTH_REQUIRED` / `ZHINI_AUTH_EXPIRED` | 引导用户前往 `https://ai.zhinikefu.com/api-key/` 创建或复制 API Key，再在本机终端执行 `node "<SKILL_ROOT>/scripts/zhini-api.mjs" auth login`，完成后重新发起原查询。 |
| `ZHINI_INVALID_ARGUMENT` | 根据错误详情补齐必填参数、修正类型、范围或时间二元组。 |
| `ZHINI_RATE_LIMITED` | 按返回的等待窗口延迟后重试，保留原筛选条件和页码。 |
| `ZHINI_HTTP_ERROR` | 稍后重试；若仍失败，输出接口错误摘要和原查询条件。 |
