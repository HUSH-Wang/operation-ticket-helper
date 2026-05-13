# 操作票助手独立子网页集成说明

## 集成结论

操作票助手当前是一个基于 Vue 3 + Vite 的纯前端 SPA，没有后端依赖。推荐先保持独立前端项目形态，将构建产物作为大项目下的独立子网页部署，例如：

```text
https://example.com/operation-ticket-helper/
```

这种方式改造成本低，和大项目主前端的路由、状态、依赖版本隔离清晰，也能保留当前离线单文件分发能力。

## 构建期配置

项目通过 Vite 环境变量配置部署路径、存储命名空间和页面标题。复制 `.env.example` 为 `.env.production.local`，按实际部署环境调整：

```env
VITE_APP_PUBLIC_BASE=/operation-ticket-helper/
VITE_APP_STORAGE_PREFIX=operationTicketHelper
VITE_APP_TITLE=操作票助手
```

配置项说明：

| 配置项 | 作用 | 默认值 |
| --- | --- | --- |
| `VITE_APP_PUBLIC_BASE` | 标准 Web 构建的资源公共路径，用于子路径部署 | `./` |
| `VITE_APP_STORAGE_PREFIX` | localStorage 键名前缀，避免和同域名下其他页面冲突 | `operationTicketHelper` |
| `VITE_APP_TITLE` | 浏览器标题和应用左上角标题 | `操作票助手` |

当前 localStorage 使用的新键名格式为：

```text
${VITE_APP_STORAGE_PREFIX}.ticketEditorContent
${VITE_APP_STORAGE_PREFIX}.ticketPlatTemplates
${VITE_APP_STORAGE_PREFIX}.ticketTasks
```

本次改造不读取旧版裸 key，也不迁移旧数据。

## 构建与部署

用于大项目子网页部署：

```bash
npm run build
```

产物输出到 `dist/`，适合交给 Nginx、主项目前端静态目录或独立前端 Docker 容器托管。

用于离线分发：

```bash
npm run build:single
```

`singlefile` 模式会固定使用相对路径，继续生成可直接双击打开的单文件版本，不受 `VITE_APP_PUBLIC_BASE` 影响。构建完成后，产物会自动重命名为带版本号的 HTML 文件，例如：

```text
dist/操作票助手v0.5.html
```

## Nginx 集成示例

### 静态目录方式

将 `dist/` 内容放到服务器的子目录下，例如 `/usr/share/nginx/html/operation-ticket-helper/`：

```nginx
location /operation-ticket-helper/ {
    alias /usr/share/nginx/html/operation-ticket-helper/;
    try_files $uri $uri/ /operation-ticket-helper/index.html;
}
```

### 独立前端容器反向代理

如果操作票助手继续作为独立前端 Docker 容器运行，可以由大项目网关代理：

```nginx
location /operation-ticket-helper/ {
    proxy_pass http://operation-ticket-helper-frontend/;
}
```

该方式下仍建议构建时设置：

```env
VITE_APP_PUBLIC_BASE=/operation-ticket-helper/
```

## 后续深度集成预留

如果未来需要把操作票助手直接作为大项目 Vue 页面的一部分，而不是独立子网页，建议再做下一阶段改造：

- 将当前业务根组件抽成可导出的 `OperationTicketHelper.vue`。
- 将全局样式逐步收口到固定根 class 下，减少对大项目页面的样式影响。
- 由大项目路由接管页面入口，操作票助手内部只保留业务视图切换。
- 根据大项目规范决定 Ant Design Vue、图标库、存储和接口调用由谁统一提供。

当前阶段不做微前端、组件库打包或后端接口接入。
