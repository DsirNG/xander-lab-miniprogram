# DinQorAI 小程序

## 个人设置与对话语言

“我的”保留积分、博客数量、会员和工作台入口；账户、安全、语言、帮助等归入设置。
界面语言支持中文 / English；Agent 回复语言支持自动 / 中文 / English，按设备保存。
自动模式参考当前提问和上下文，无法判断时使用界面语言；明确的语言或翻译要求优先。
语言偏好通过新消息的 `locale` 和 `replyLanguage` 字段传递，不修改原始消息。
切换语言不会翻译历史消息、清空草稿或重启正在进行的对话。

聊天 WebSocket 与普通 API 共用 `src/api/http.ts` 中的 `API_SERVER_ORIGIN`。
新消息 SSE 连续 45 秒没有事件时，读取一次会话快照；仍在运行则通过 WebSocket 接续，不重发消息，也不中断原生成请求。WebSocket 建连或接收（含心跳回执）超过 45 秒无响应时，关闭失活连接并按指数退避重连。
微信正式环境的 socket 合法域名需包含 `wss://api.xiaodongding.dpdns.org`。
这是统一客户端连接入口，并未关闭旧域名，也未改变 WebSocket 协议。

基于 Taro 4、React 18 和 TypeScript 的微信/支付宝小程序，功能对齐 PC 端 DinQorAI 平台。同一套代码构建双端：`@tarojs/plugin-platform-weapp` + `@tarojs/plugin-platform-alipay`。

## 开发

```bash
pnpm install
pnpm dev:weapp     # 微信小程序（微信开发者工具导入本目录或 dist）
```

支付宝小程序：

```bash
pnpm dev:alipay    # 支付宝开发者工具导入 dist（构建输出 mini.project.json）
```

H5 开发预览：

```bash
pnpm dev:h5
```

浏览器访问 `http://127.0.0.1:10086`。生产构建使用 `pnpm build:h5`。

注意：weapp 与 alipay 的构建输出共用 `dist/` 目录，两端互覆盖；同一时间只保持一个端的产物，发布前用对应命令重新构建。

## 后端接口

数据与 PC 端共用同一后端（默认 `https://api.dinqor.cn`，可在 `src/api/http.ts` 调整）。H5 开发环境通过本地代理访问后端；微信/支付宝小程序直接请求线上域名，发布前需在微信公众平台 / 支付宝开放平台把该域名加入 request 合法域名。

## 登录（微信一键登录）

- 个人中心/对话页点击「微信一键登录」，`Taro.login()` 拿 code 调 `POST /api/auth/wechat-login`，后端 `jscode2session` 换 openid 并自动注册/绑定账号（未注册自动注册并赠送积分）。
- 也支持账号密码登录/邮箱注册（`/api/auth/login`、`/api/auth/register`）。
- `src/api/http.ts` 统一处理 token 存取（本地缓存）、Authorization 头与 401 无感刷新（accessToken 失效时用 refreshToken 换新并重试原请求），与 PC 端 `http.js` 语义一致。

## 页面

主页面（底部 TabBar，4 个）：

- **对话** `pages/chat`：博客智能体聊天。HTTP 接口触发执行后，通过 `/ws/agent` 按 SSE 事件语义接收思考过程、工具步骤和流式回答；WebSocket 断线自动重连并按事件 ID 去重重放，终态只读取一次 `/api/agent/conversations/{id}` 快照归并持久化消息，支持停止与断线续收。
- **计划** `pages/plans`：定时发文计划列表（状态徽标、暂停/恢复/取消/删除/立即执行），支持自定义创建与 AI 生成。
- **博客** `pages/blog`：文章列表（搜索、分类、热门标签筛选、分页加载）。
- **我的** `pages/profile`：用户信息、积分卡片、功能入口与退出登录。

子页面：

- 登录/注册 `pages/login`
- 文章详情 `pages/blog-detail`（自研轻量 Markdown 渲染）
- 计划详情 `pages/plan-detail`（执行记录、手动触发、状态操作）
- 新建计划 `pages/plan-create`（自定义 + AI 生成）
- 发文/编辑 `pages/publish`
- 我的博客 `pages/blog-manage`（草稿/发布/回收站管理）
- 积分明细 `pages/points`

## 平台差异说明

- 登录渠道：微信用 `Taro.login`（后端换取 openid）；支付宝渠道后端尚未接入，支付宝端登录入口待支付宝 AppID 配置后实现。
- 新消息统一 POST `/messages/stream` 并直接消费 SSE：微信使用 `enableChunked` + `onChunkReceived`，H5 使用 Fetch ReadableStream。首条 `accepted` / `started` 提供 runVersion，不再等待同步 `/messages` 的整轮结果。首段正文立即展示，后续增量按 100ms 合并。
- 恢复已有 running 轮次、SSE 异常中断时，通过一次会话快照接续 WebSocket；不重发原消息、不做周期快照轮询。原始 SSE 请求在切换页面后保留至本轮结束，避免切 tab 中断服务端执行。WebSocket 非终态断线按指数退避重连，按持久化事件 ID 去重重放；终态只归并一次快照。
# API 提示语言

普通请求、文件上传和登录刷新自动携带当前界面语言的 `Accept-Language`
（`zh-CN` / `en`），由公共 API Gateway 返回对应语言的 `message`。
前端优先使用后端提示，缺失时使用本地翻译。Agent 回复语言独立设置，
界面语言切换仅影响后续请求，不改写既有文章、聊天记录或业务数据。

## 开发环境接口耗时日志

运行 `npm run dev:weapp`，在微信开发者工具 Console 过滤 `[HTTP timing]`，
再进入积分明细页。微信开发版（`develop`）即使使用普通 `build:weapp` 构建也会输出；生产构建在体验版（`trial`）和正式版（`release`）中关闭。

- `start`：请求 ID、方法、去掉参数的接口路径、开始时间；可对比两个积分接口是否重叠执行。
- `attempt-start` / `attempt-end`：同一 ID 下每次网络尝试的序号、相对开始时间、耗时、HTTP 状态。
- `authMs` / `upstreamMs` / `gatewayMs`：服务端 `Server-Timing` 中的阶段耗时；彼此有包含关系，不能相加。
- 微信返回网络 profile 时，附带 `dnsMs`、`connectMs`、`tlsMs`、`requestToFirstByteMs`、`downloadMs`；缺失表示平台未提供，并非耗时为零。连接与 TLS 阶段可能重叠。
- `complete`：包含鉴权刷新等待、重试和业务响应处理的总耗时、尝试次数、失败状态，以及 `over100ms`。
- `attempt-error`：网络失败或超时的尝试耗时，不复制可能含敏感信息的错误内容。

积分页的 `/api/points` 和 `/api/points/ledger` 应分别出现开始记录；
若出现 `/api/auth/refresh` 且 `attempts` 为 2，表示包含刷新后重试。
客户端总耗时和服务端阶段耗时的差值还包含网络传输、调度和内部路由，不能直接解释为纯网络 RTT。
日志不记录参数、请求体、响应正文、令牌、文件路径或 IP。长连接 SSE 暂不使用该耗时统计，避免把生成持续时间误作普通接口耗时。

## 文章列表刷新策略

每次返回列表、切回文章 Tab 或主动刷新都重新请求第一页，并独立刷新分类和热门标签。
刷新期间保留旧内容；成功后整体替换为新第一页并重置分页，不拼接旧的后续页。
失败保留旧内容并提示错误，不将缓存视为已校验的新数据。相同进行中请求去重，过期响应丢弃。
公开列表和分类标签不发送令牌；个人文章管理及写入继续鉴权。

## 我的订单与退款

“我的 → 我的订单”查看微信虚拟支付订单、退款记录与状态。套餐/积分卡购买页同时标注：支付后7天内按实际未使用积分比例退款，超过7天不允许新申请；Apple 支付由 Apple 决定。提交前展示金额及会员终止说明。后端部署需要 Core 0011、Payment 0005 迁移及 Payment 定时查单任务。

订阅页直接渲染商品目录中的套餐与积分卡，不在前端补造商品或通过数量加减替代固定卡片。积分卡使用各自的商品编号和服务端价格，每次购买一张。订阅轮播包含跟随拖动的透视旋转、轻微扭转和缩放，松手后由原生 Swiper 完成吸附；减少动态效果设置下关闭卡片变形。

微信构建同时检查入口、WXML/WXS 和全部 WXSS（本机需安装微信开发者工具，或设置 `WECHAT_WCC` / `WECHAT_WCSC`）。上传时必须核对工具日志中的成功标志，不能只依赖 CLI 退出码；开发者工具可能以 0 退出码返回上传错误。
