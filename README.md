# 知你AI助手 Skills｜让 AI 完成客户查询、会话研判、客户分群与客户触达

> 将知你 MCP 的客户、会话、消息、标签、渠道、客服查询与受确认的消息发送能力组合成 6 项可直接触发的业务工作流。

[知你AI助手官网](https://ai.zhinikefu.com/) · [MCP 服务地址](https://mcp.h5bqb.top/mcp) · npm：`@zhiniai/zhini-skills`

## 产品介绍

知你AI助手 Skills 是面向客户服务、销售、客户运营、质检和产品团队的 Agent Skills 工作流包。它基于知你 MCP，将客户搜索、资料查询、历史会话召回、聊天消息读取、标签与渠道解析、客户触达与消息发送等能力组合成可直接通过自然语言触发的业务任务。

数据渠道覆盖已接入知你客服的 **个微/企微/视频号/微信小程序/公众号/服务号/微信客服/微信小店/抖音号/小红书/微博/网站及H5客服等平台渠道**。

用户只需描述要查的客户、问题、平台渠道或时间范围，AI 即可按照对应 Skill 的流程定位客户或会话、读取消息上下文，并整理为客户摘要、会话依据、目标人群或问题线索；需要触达客户时，AI 会在用户明确确认后批量打开选定对话、发送文本或图片消息并跟踪发送进度。

## 6 项 Skills

### 1. `zhini-live-session-triage`｜知你当前会话分诊

查看个微、企微、微信客服、微信小程序、公众号、服务号、网站及 H5 客服等渠道的当前队列，区分我的会话、同事会话、等待接待和 AI 会话。

典型需求：

- 当前有哪些客户等待接待？
- 我正在接待哪些客户？
- 查看当前会话的最新消息。

### 2. `zhini-customer-lookup`｜知你客户查询与画像

按姓名、手机号、微信号、渠道、客服、标签或时间，定位个微、企微、视频号、抖音号、小红书、微博等渠道客户，并补充客户资料和消息上下文。

典型需求：

- 查找某位客户并整理基本资料。
- 回复客户前先了解历史沟通。
- 按手机号、微信号或渠道定位客户。

### 3. `zhini-history-investigation`｜知你历史会话研判

检索微信客服、微信小店、抖音号、小红书、微博、网站及 H5 客服等渠道的历史会话，读取完整上下文后辅助复盘和分析。

典型需求：

- 找出近 7 天提到退款的历史会话。
- 调查某客户过去的投诉和处理过程。
- 汇总订单、故障或历史咨询线索。

### 4. `zhini-customer-segmentation`｜知你客户分群筛选

组合个微、企微、视频号、微信小程序、公众号、服务号、微信客服、微信小店、抖音号、小红书、微博、网站及 H5 客服等渠道与标签、客服、联系人类型和时间条件，构建可核对的客户或会话分群。

典型需求：

- 查找某标签下的客户。
- 筛选某渠道或某客服负责的客户。
- 找出近期新增或长期未联系的客户。

### 5. `zhini-message-sending`｜知你客户触达与消息发送

在用户明确确认后批量打开选定客户对话（每次最多 20 个），创建最多 100 个 UID、最多 2 条文本/图片消息的异步群发任务，并跟踪发送进度、查询历史任务。

典型需求：

- 把这些已选客户的对话打开到我的对话。
- 向已确认的客户批量发送跟进文本或图片，并查看发送进度。
- 查询最近的历史群发任务。

### 6. `zhini-api-usage`｜知你 API Key 用量

查询当前连接 API Key 的总额度、已使用量和剩余额度，辅助连接巡检。

典型需求：

- 当前 API Key 还有多少额度？
- 查询已用次数和剩余次数。

## 安装方法

### 安装全部 Skills

```bash
npx -y @zhiniai/zhini-skills@latest install --target codex
```

### 安装单个 Skill

```bash
npx -y --package @zhiniai/zhini-skills@latest zhini-skills install zhini-message-sending --target codex
```

将 `zhini-message-sending` 替换为其他 Skill 名称即可选择安装。

## 连接方式

MCP 服务支持两种认证方式，二选一：

**方式一：OAuth 2.1 浏览器授权（推荐）**——连接时不配置任何静态认证字段，客户端发起请求后按服务端 OAuth 挑战打开浏览器完成知你账号授权，无需 API Key；授权可随时在官网吊销。

```json
{
  "mcpServers": {
    "zhini": {
      "type": "http",
      "url": "https://mcp.h5bqb.top/mcp"
    }
  }
}
```

**方式二：静态 API Key**——访问[知你AI助手官网](https://ai.zhinikefu.com/)注册或登录后创建 API Key，保存到客户端环境变量 `ZHINI_API_KEY`：

```json
{
  "mcpServers": {
    "zhini": {
      "type": "http",
      "url": "https://mcp.h5bqb.top/mcp",
      "headers": {
        "Authorization": "Bearer ${ZHINI_API_KEY}"
      }
    }
  }
}
```

## 使用步骤

1. 在 AI 客户端中连接知你 MCP：`https://mcp.h5bqb.top/mcp`（OAuth 浏览器授权，或配置 `ZHINI_API_KEY`）。
2. 安装所需 Skills 并重新加载客户端。
3. 直接用自然语言描述客户查询、会话研判、客户分群或消息触达需求。
4. 消息发送类操作必须经过用户明确确认：首次创建任务只准备并返回确认凭证，用户确认后才会真正发送。

## 适用的 AI 工具

- Codex
- Claude Code
- WorkBuddy
- Cursor
- OpenClaw
- 其他支持 Agent Skills 与 Streamable HTTP MCP 的 AI 工具

## 数据与权限说明

- Skills 调用知你 MCP 的查询能力与受控触达能力：查询保持只读；批量打开对话与消息发送仅在用户明确确认后执行，不修改客户资料、不修改标签、不接待/转接/关闭会话。
- 查询结果受当前凭据对应的数据权限约束。
- API Key 应保存在客户端环境变量或安全配置中；OAuth 授权可随时在官网吊销。
- “微信”“抖音”“小红书”“微博”等名称用于说明已接入的数据来源渠道，不代表相关平台对本产品的官方背书。

## 关键词

Agent Skills、客户查询、客户画像、当前会话分诊、客服会话研判、历史聊天记录、客户分群、消息群发、客户触达、批量发送、多平台客服、customer lookup、live session triage、conversation investigation、customer segmentation、message sending、Codex Skills、WorkBuddy Skills。
