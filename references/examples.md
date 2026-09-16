# 常用调用链示例

以下示例展示意图识别、工具顺序和结果组织方式。示例中的 `USER_UID`、`SESSION_ID`、`CHANNEL_ID`、`TAG_ID`、`KF_ID`、`START_TS`、`END_TS` 均为占位符。

示例中的 `zhini_xxx({...})` 表示通过 Skill 内置脚本执行：

```bash
node "<SKILL_ROOT>/scripts/zhini-api.mjs" call zhini_xxx '{...}'
```

所有请求直接访问知你 HTTP 工具 API，不经过 MCP 连接器。

## 1. 查看当前等待接待队列

用户：`看看现在排队等待接待的客户。`

```text
1. zhini_list_active_sessions({})
2. 从返回的 sessions 中筛选 queue_type=waiting
3. 对用户点名的 SESSION_ID 调用 zhini_fetch_messages({sid: "SESSION_ID", size: 20})
4. 如需客户资料，调用 zhini_get_customer_profile({uid: "USER_UID"})
```

输出等待数量、会话 ID、最近消息时间和截断提示；把结果标注为当前队列快照。

## 2. 查看我的会话

用户：`列出我正在处理的会话。`

```text
1. zhini_get_current_kefu({}) -> {kfid: "KF_ID"}
2. zhini_list_active_sessions({kfid: "KF_ID"})
3. 对重点会话使用 zhini_fetch_messages({sid: "SESSION_ID"})
```

只把 queue_type=mine 的结果归入“我的会话”，并报告同事/等待/AI 分类数量。

## 3. 按手机号定位客户并核对画像

用户：`查手机号 138****0000 的客户资料。`

```text
1. zhini_search_customers({phone: "138****0000", page: 0, page_size: 20})
2. 若有多个候选，列出 uid、名称、渠道，让用户选择 USER_UID
3. zhini_get_customer_profile({uid: "USER_UID"})
```

手机号等敏感值在输出中按最小必要范围展示；结果中保留候选 UID 便于后续核对。

## 4. 调查投诉或退款关键词

用户：`找最近三个月提到退款的历史会话，并给出上下文。`

```text
1. zhini_search_sessions({msg: "退款", msg_stime: ["START_TS", "END_TS"], page: 0})
2. 对每个命中的 SESSION_ID 调用 zhini_fetch_messages({sid: "SESSION_ID", size: 20})
3. 需要客户信息时调用 zhini_get_customer_profile({uid: "USER_UID"})
4. 按 sid、消息时间、命中片段和上下文归纳问题类型
```

关键词命中是召回信号；完整消息上下文读取后，再归纳投诉原因、订单状态或下一步跟进点。

## 5. 按标签和渠道构建人群

用户：`筛选小红书渠道中带高意向标签的客户。`

```text
1. zhini_list_channels({type: "xiaohongshu", group_by_type: true}) -> CHANNEL_ID
2. zhini_search_tags({search_keyword: "高意向", include_grouped: true}) -> TAG_ID
3. 若同名候选较多，先让用户确认目标 TAG_ID 和 CHANNEL_ID
4. zhini_search_customers({channel_id: ["CHANNEL_ID"], tag_id: ["TAG_ID"], page: 0, page_size: 20})
```

输出真实命中的客户数、当前页数量、筛选 ID 和后续页码；人群结论以标签与客户资料为依据。

## 6. 查询指定时间段的全部咨询记录

用户：`统计 2026-08-01 到 2026-08-07 的咨询会话。`

```text
1. 将日期转换为秒级 Unix 时间戳 START_TS、END_TS
2. zhini_search_sessions({msg_stime: ["START_TS", "END_TS"], page: 0})
3. 读取 data.count，并递增 page 直到覆盖目标结果
4. 需要消息内容时，对指定 SESSION_ID 调用 zhini_fetch_messages({sid: "SESSION_ID"})
```

仅提供时间范围时覆盖当前授权账号关联的渠道；输出总数、页码、会话时间和渠道分布。

## 7. 查询 API Key 用量

用户：`看一下 API Key 用量。`

```text
1. zhini_get_apikey_usage({})
2. 读取 total、used、remaining 作为账号整体数据
3. 单独展示 current_api_key_used 作为当前请求 API Key 实时用量
4. 校验账号层 total == used + remaining，并在摘要中标注一致性
```

推荐输出：`账号总额度 / 账号已使用 / 账号剩余 / 当前请求 API Key 实时已使用`，不展示完整密钥。
