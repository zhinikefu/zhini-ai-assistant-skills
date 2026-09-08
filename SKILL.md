---
name: "zhini-ai-assistant"
description: "使用知你AI助手查询多平台客户资料、当前与历史客服会话、聊天记录、客户分群及 API Key 用量。适用于个微、企微、视频号、微信小程序、公众号、服务号、微信客服、微信小店、抖音号、小红书、微博、网站及 H5 客服等渠道。"
---

# 知你AI助手

通过只读的知你客服 MCP 服务，将多平台客户资料、会话及聊天记录连接到 Codex、WorkBuddy 等 AI 工具。

## Connection

- 官网：https://ai.zhinikefu.com/
- MCP endpoint：https://mcp.h5bqb.top/mcp
- Bearer API key environment variable：ZHINI_API_KEY
- API Key 由客户端 Secret 或运行时环境提供，不作为提示词或工具参数传入。

## Channel coverage

支持个微、企微、视频号、微信小程序、公众号、服务号、微信客服、微信小店、抖音号、小红书、微博、网站及 H5 客服等平台渠道。

## Capability routing

根据用户意图选择对应流程；一个请求涉及多项能力时，可在保持证据链清晰的前提下组合调用。

### 当前会话分诊

1. 需要区分“我的会话”时，先调用 zhini_get_current_kefu 获取 kfid。
2. 调用 zhini_list_active_sessions 获取实时队列，不把当前快照当作历史统计。
3. 选定会话后，用 sid 调用 zhini_fetch_messages，用 uid 调用 zhini_get_customer_profile。

### 客户查询与画像

1. 客户名、渠道名、客服名或标签名先通过 zhini_list_channels、zhini_list_kefu 或 zhini_search_tags 解析为稳定 ID。
2. 将明确的结构化条件交给 zhini_search_customers，避免空条件查询。
3. 已知 uid 时直接调用 zhini_get_customer_profile；需要聊天内容时再调用 zhini_fetch_messages。
4. 多个候选时保留 uid 供核对，不把推断当成客户身份事实。

### 历史会话研判

1. 按客户、消息关键词或 msg_stime 调用 zhini_search_sessions。
2. 关键词只用于召回候选；调用 zhini_fetch_messages 读取上下文后再总结。
3. 需要更多结果时按 page 翻页；输出会话 ID、时间范围和关键证据。
4. 已知 uid 时可调用 zhini_get_customer_profile 补充资料。

### 客户分群

1. 先将用户明确提到的标签、渠道和客服名称解析为稳定 ID。
2. 结构化条件使用 zhini_search_customers；必须按消息内容判断时使用 zhini_search_sessions 和 zhini_fetch_messages。
3. 多个相似标签或候选需要保留核对点。
4. 分页查询并记录实际条件、页码和返回数量，避免把单页结果当成完整分群。

### API Key 用量

1. 调用 zhini_get_apikey_usage。
2. 汇总总配额、已使用量和剩余额度，并标记数据是否一致。
3. 仅展示额度摘要，不输出完整 API Key 或内部鉴权细节。

## Available tools

- zhini_get_current_kefu
- zhini_list_active_sessions
- zhini_search_customers
- zhini_get_customer_profile
- zhini_search_sessions
- zhini_fetch_messages
- zhini_search_tags
- zhini_list_channels
- zhini_list_kefu
- zhini_get_apikey_usage

## Boundary

只查询当前 API Key 可访问的数据。保持只读，不虚构工具、客户身份、消息证据或筛选结果；不执行发送消息、修改资料、批量修改或导出操作。
