# DinQorAI 小程序

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
- 流式 AI 对话采用「HTTP 触发 + WebSocket 事件流」而非 SSE（原生小程序无流式读取能力）；WebSocket 非终态断线按指数退避重连，服务端持久化事件负责重放，客户端按事件 ID 去重。会话快照（`{conversation, messages}`）仅用于进入/恢复会话及终态归并，不使用周期轮询兜底。
