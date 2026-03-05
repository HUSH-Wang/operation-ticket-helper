# ⚡ 操作票辅助工具 (Operation Ticket Helper)

> 面向电力系统运维人员的操作票文本生成与转换工具，纯前端离线运行，即开即用。

---

## 📌 项目简介

**操作票辅助工具**是一个基于 Vue 3 + Vite 的单页面应用（SPA），专为电力系统运维场景设计。它提供两大核心功能模块：

- **压板文本生成器**：根据模板快速批量生成或逆向解析压板操作步骤文本
- **任务状态转换器**：将已有操作步骤（无论来自哪种状态）智能转换为目标状态格式

整个应用无需服务器，可构建为单一 `index.html` 文件，双击即可在浏览器中离线使用。

---

## 🚀 功能详解

### 功能一：压板文本生成（PlatGenerator）

#### 1.1 基础输入模式（正向生成）

- **操作类型切换**：提供 4 种操作类型单选按钮快速切换：
  - 投入 / 退出 / 检查投入 / 检查退出
- **保护屏名输入**：对应模板占位符 `{screen}`，支持一行文本填写
- **压板名称批量录入**：多行文本域，每行一个压板名称（对应占位符 `{plat}`）
  - 自动过滤空行及首尾空格
  - 提供"**去除行内空格**"按钮，一键清除行内所有空白字符（含全角空格、零宽空格等）
- **实时预览**：输入即时更新生成结果（300ms 防抖）
- **一键复制**：将所有生成行以换行符连接后写入剪贴板

#### 1.2 解析模式（逆向工程）

- 将已有操作步骤文本（任意模板格式）粘贴至解析区
- 系统基于所有 4 条压板模板构建正则表达式，自动逆向提取纯压板名称
- **未匹配的行**：标黄显示，并在输入区下方计数报错
- 切换操作类型后，可立即用提取出的压板集重新生成新格式文本，实现**无缝模式重组**

#### 1.3 模板配置

点击右上角 ⚙️ 图标打开设置弹窗：

| 占位符 | 含义 |
|--------|------|
| `{screen}` | 保护屏名（对应输入框内容） |
| `{plat}` | 逐行压板名称 |
| `{n}` | 数值通配符：生成时渲染为空，解析时匹配任意数字序列 |

- 支持**实时可视化编辑** 4 条模板字符串
- 配置自动持久化至浏览器 `localStorage`（键名：`ticketPlatTemplates`）
- 支持**导出 JSON**与**导入 JSON**进行备份和跨设备同步

**默认模板（来自 `src/templates/ticket_template.json`）**：
```
投入：投入{screen}{plat}压板
退出：退出{screen}{plat}压板
检查投入：检查{screen}{plat}压板确已投入
检查退出：检查{screen}{plat}压板确已退出
```

---

### 功能二：任务状态转换（TaskConverter）

#### 2.1 核心能力

- 支持将**任意状态**的操作步骤文本批量转换为**指定目标状态**
- 系统内置多种操作任务类型：开关、刀闸、空开、远方/就地、压板等
- 每个任务对应 4 种状态模板（合上/投入、拉开/退出、检查合上/投入、检查拉开/退出）
- 支持**多任务混合粘贴**，系统自动识别每行所属任务类型和来源状态

#### 2.2 正则匹配引擎

- 使用**命名捕获组**正则自动提取设备名称（支持 `{deviceName}`、`{a}`、`{b}` 等任意命名占位符）
- 匹配前自动去除文本中所有空白字符，避免因格式差异导致匹配失败
- `{n}` 为数值通配符，生成时留空，解析时匹配 `\d*`

#### 2.3 匹配日志

转换完成后，可展开"**识别详情**"折叠面板，查看每一行的：
- 识别到的任务类型（如：开关、刀闸）
- 来源状态 → 目标状态
- 原始输入内容

#### 2.4 任务模板配置

点击右上角 ⚙️ 图标打开任务配置弹窗：

- **状态名称**：可自定义所有状态的显示名称（全局生效）
- **任务列表**：可视化折叠面板，支持逐项编辑每个任务的名称和各状态模板
- 支持**新增任务**（PlusOutlined 按钮）和**删除任务**（带二次确认）
- 支持**导出/导入 JSON**，保存格式为 `{ stateNames: [], tasks: [] }`
- 配置持久化至 `localStorage`（键名：`ticketTasks`），兼容新旧两种存储格式

**内置任务类型及默认模板**：

| 任务 | 合上/投入 | 拉开/退出 | 检查合上/投入 | 检查拉开/退出 |
|------|-----------|-----------|----------------|----------------|
| 开关 | `合上{deviceName}开关` | `拉开{deviceName}开关` | `检查...三相确在合闸位置（Ia：{n}A...）` | `检查...三相确在分闸位置（Ia：{n}A...）` |
| 刀闸 | `合上{deviceName}刀闸` | `拉开{deviceName}刀闸` | `检查...三相确已合上` | `检查...三相确已拉开` |
| 空开 | `合上{deviceName}空开` | `分开{deviceName}空开` | `检查...确已合上` | `检查...确已分开` |
| 远方/就地 | 切至"就地"位置 | 切至"远方"位置 | 检查确已切至"就地" | 检查确已切至"远方" |
| 压板 | `投入{deviceName}压板` | `退出{deviceName}压板` | `检查...确已投入` | `检查...确已退出` |

---

## 🛠️ 技术架构

### 技术栈

| 层次 | 技术 |
|------|------|
| 核心框架 | [Vue 3](https://vuejs.org/)，Composition API + `<script setup>` 语法 |
| 构建工具 | [Vite](https://vitejs.dev/)（支持 `singlefile` 构建模式） |
| UI 组件库 | [Ant Design Vue 4.x](https://antdv.com/) |
| 图标库 | `@ant-design/icons-vue` |
| 离线打包 | [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) |
| 样式方案 | 原生 CSS + CSS Variables，毛玻璃效果（`backdrop-filter`）、渐变、微动画 |

### 数据流架构

```
App.vue（根组件）
├── 读取 ticket_template.json 初始化 tasks 数据
├── 从 localStorage 恢复 tasks 和 stateNames
├── handleSaveTasks() → 写入 localStorage
│
├── <PlatGenerator>（独立管理自身模板）
│   ├── 从 localStorage 恢复 platTemplates
│   ├── inputMode: 'basic' | 'parse'
│   ├── generateText() → 正向生成 / 逆向解析
│   └── outputLines: [{text, matched}]
│
└── <TaskConverter>（接受 tasks prop，通过 onSaveTasks 回调更新）
    ├── buildParseRegex(template) → 命名捕获组正则
    ├── renderTemplate(template, captures) → 文本渲染
    ├── convert() → 逐行匹配所有 task×stateIdx 组合
    └── outputLines: [{text, matched}] + matchLog
```

### 正则引擎机制（TaskConverter）

```
模板字符串
  ↓ 1. 保护 {n} 和命名占位符（替换为 \x00 哨兵）
  ↓ 2. 去除所有空白字符
  ↓ 3. 对剩余字符进行正则转义
  ↓ 4. 还原：{n} → \d*，{name} → (?<name>.+?)
  ↓ 5. 包裹为 ^...$，编译为 RegExp
输入行（去空白）→ 全量匹配 → 提取命名分组 → 填入目标模板
```

---

## 📂 目录结构

```
operation-ticket-helper/
├── src/
│   ├── assets/                   # 静态资产
│   ├── components/
│   │   ├── PlatGenerator.vue     # 压板文本生成器（411 行）
│   │   └── TaskConverter.vue     # 任务状态转换器（526 行）
│   ├── templates/
│   │   ├── ticket_template.json  # 应用默认数据（platTemplates + stateNames + tasks）
│   │   └── plat_templates.json   # 压板模板的独立备份（仅包含 4 条模板）
│   ├── App.vue                   # 根组件，Tab 布局 + 全局状态管理
│   ├── main.js                   # 入口文件，挂载 Vue + Ant Design
│   └── style.css                 # 全局基础样式覆盖
├── dist/                         # 构建产物目录
│   └── index.html                # 单文件构建产物（离线可用）
├── index.html                    # Vite 开发服务器入口壳
├── vite.config.js                # Vite 配置（按 mode 条件加载 singlefile 插件）
└── package.json                  # 依赖声明
```

---

## 💾 本地存储说明

| 键名 | 存储内容 | 格式 |
|------|----------|------|
| `ticketPlatTemplates` | 压板模板配置 | `{ input, exit, checkInput, checkExit }` |
| `ticketTasks` | 任务列表和状态名称 | `{ tasks: [...], stateNames: [...] }` |

> 所有配置在关闭浏览器后仍然保留，再次打开时自动恢复。若需重置，清除对应网站的 localStorage 即可。

---

## 🧑‍💻 开发与构建

### 前置要求

- Node.js **18+**
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

启动后访问 `http://localhost:5173`，支持热更新。

### 构建标准 Web 产物

```bash
npm run build
```

产物输出至 `dist/`，包含 `index.html` 和 `assets/` 子目录，适合部署至 HTTP 静态服务。

### 构建离线单文件版本（推荐）

```bash
npm run build:single
```

所有 JS、CSS、图标字体内联压缩至唯一的 `dist/index.html`。该文件可**直接双击在浏览器中打开**，无需任何网络连接或服务器环境，适合在内网隔离环境中分发使用。

---

## 🎨 界面设计

- **整体背景**：蓝绿渐变（`#e0f2fe → #f0f9ff → #e8f5e9`），营造清新专业的视觉氛围
- **卡片面板**：半透明白色（`rgba(255,255,255,0.95)`）+ 毛玻璃（`backdrop-filter: blur(10px)`）+ 大投影
- **标题文字**：压板生成器使用蓝色渐变，任务转换器使用绿色渐变
- **字体**：优先使用 Inter、PingFang SC、Microsoft YaHei 等现代字体
- **结果区域**：使用等宽字体（Consolas / monospace），黄色高亮未匹配行
- **交互反馈**：所有操作通过 Ant Design `message` 组件给出即时 Toast 提示

