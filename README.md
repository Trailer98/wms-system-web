# WMS 前端启动说明

这是 WMS（仓储管理系统）前端，Vue 3 单页应用。开发环境下由 Vite 将 `/api` 请求代理到本地后端。

> 技术栈、页面模块等背景说明见文末 [附录：技术栈说明](#9-附录技术栈说明)。本文重点是"如何在本地把它跑起来"。

## 1. 前端定位

- 框架：Vue 3 + Vite，纯 JavaScript（无 TypeScript）
- 开发模式下，浏览器实际访问的是 Vite 开发服务器；页面里请求的 `/api/**` 会被 Vite 代理转发到后端

## 2. 启动前置条件

- **后端必须先启动**：`/api` 请求是通过 Vite 代理转发的，后端不启动前端登录/所有业务页面都无法工作。后端启动方式见 [`wms-system/README.md`](../wms-system/README.md)
- 后端默认地址：`http://localhost:8081`（`vite.config.js` 中 `server.proxy['/api'].target`，未见 `.env` 覆盖此地址）
- Node.js：仓库未提供 `.nvmrc` / `.node-version` 锁定版本，按 `devDependencies` 中 `vite: ^5.4.0` 的官方要求，建议使用 **Node.js 18+ 或 20+**
- 包管理器：仓库只有 `package-lock.json`，没有 `pnpm-lock.yaml` / `yarn.lock`，请使用 **npm**

## 3. 安装依赖

```bash
cd wms-system-web
npm install
```

## 4. 启动开发环境

`package.json` 中的真实 script：

```bash
npm run dev
```

浏览器访问地址以终端输出为准（Vite 默认监听 `5173` 端口，若被占用会自动顺延到下一个可用端口；`vite.config.js` 中未对 `server.port` 做覆盖）。

## 5. 前端代理说明

`vite.config.js` 中的真实配置：

```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8081',
      changeOrigin: true,
      rewrite: (path) => path   // 不改写路径，原样转发
    }
  }
}
```

- 前端所有接口调用都以 `/api` 开头，开发环境下由 Vite 转发到 `http://localhost:8081`，路径不做 rewrite（即请求 `/api/auth/login` 会原样转发到后端 `http://localhost:8081/api/auth/login`，与后端 `context-path=/api` 对应）
- 如果你的后端不是跑在 `localhost:8081`（比如改了端口），需要直接修改 `vite.config.js` 里的 `target`；**当前项目没有 `.env` 文件、也没有读取环境变量来配置代理地址**，不要假设存在 `.env` 支持

## 6. 登录说明

后端首次启动（空库）会通过 Flyway 自动插入默认账号（见 [`wms-system/README.md` 第 8 节](../wms-system/README.md#8-默认账号)）：

- 用户名：`admin`
- 密码：`admin123`

## 7. 构建生产包

`package.json` 中的真实 script：

```bash
npm run build
```

输出目录：`dist/`（Vite 默认构建输出目录，仓库中已存在一份历史构建产物）。

## 8. 常见问题

**1. `npm install` 失败**
- 可能原因：Node 版本过低（Vite 5 要求 Node 18+/20+）、网络无法访问 npm registry
- 排查：`node -v` 确认版本；必要时切换 npm registry 或使用代理

**2. `npm run dev` 端口被占用**
- 现象：Vite 提示端口被占用并自动切换到其他端口
- 处理：按终端实际输出的地址访问即可；如需固定端口，可在启动时加 `--port`，例如 `npm run dev -- --port 5173`

**3. 页面能打开，但接口报 404**
- 可能原因：后端未启动，或后端端口不是 `8081`
- 排查：确认后端已启动且监听 `8081`（见 [`wms-system/README.md`](../wms-system/README.md)）；否则修改 `vite.config.js` 中的代理 `target`

**4. 登录报 401**
- 可能原因：账号密码错误，或后端数据库还未初始化（Flyway 未成功跑完，默认账号不存在）
- 排查：确认后端启动日志中 Flyway 迁移是否成功；用 `curl` 直接测试后端登录接口（见后端 README 第 7 节）

**5. 操作页面报 403（权限不足）**
- 可能原因：当前登录账号对应角色没有该操作的权限点
- 处理：用 `admin`（`ADMIN` 角色，拥有全部权限）登录测试；或到系统管理 - 角色管理里检查权限分配

**6. AI 知识库 / RAG 问答页面不可用**
- 可能原因：后端 AI 相关依赖（PostgreSQL+pgvector / Ollama / DeepSeek Key）未配置或未启动 —— 这些是**可选依赖**，不影响基础 WMS 功能
- 处理：按 [`wms-system/README.md` 第 3、4 节](../wms-system/README.md#3-本地数据库准备) 准备 AI 相关依赖

**7. RAG 问答流式（SSE）请求失败**
- 可能原因：后端 SSE 接口异常，或浏览器控制台有跨域/网络错误
- 排查：打开浏览器开发者工具查看 Network/Console 报错；直接用非流式的 RAG 问答接口验证后端本身是否可用

## 9. 附录：技术栈说明

- **框架**：Vue 3（`<script setup>` Composition API），纯 JavaScript
- **UI 组件库**：Element Plus + `@element-plus/icons-vue`
- **构建工具**：Vite 5
- **状态管理**：Pinia（仅一个 `auth` store）
- **路由**：Vue Router 4，全局前置守卫做登录与权限校验
- **HTTP 客户端**：Axios（封装为插件，统一注入 Bearer Token）
- **样式**：原生 CSS（Vue SFC `scoped`），未使用 Sass/Less/Tailwind
- **其他**：`markdown-it` + `dompurify`（安全渲染 AI 回答的 Markdown）、手写 SSE 解析器（`fetch` + `ReadableStream` 实现流式问答）
- 未引入图表库、i18n 国际化库；无单元测试配置

已实现页面模块（登录、基础信息管理、库存管理、入库/出库、系统管理、AI 能力等）与具体功能清单见根目录 [`WMS-README.md`](../WMS-README.md)。
