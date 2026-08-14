# Markdown 编辑器 (Typora 风格桌面应用) - The Implementation Plan

## [x] Task 1: Electron + Vue 项目初始化
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 使用 Vite + Vue 3 + TypeScript 初始化渲染进程项目
  - 集成 Electron 主进程（main process）与预加载脚本（preload）
  - 配置 Electron-Vite 开发环境（自动重启主进程 + 渲染进程热更新）
  - 配置项目目录结构（main/、renderer/、shared/ 等）
  - 安装核心依赖：markdown-it、highlight.js、KaTeX、electron-store
  - 配置 ESLint + Prettier 代码规范
  - 配置 electron-builder 打包流程
  - 搭建基础窗口（无边框/自定义标题栏可选，先使用原生标题栏）
- **Acceptance Criteria Addressed**: AC-13
- **Test Requirements**:
  - `programmatic` TR-1.1: `npm run dev` 启动后 Electron 窗口正常打开
  - `programmatic` TR-1.2: `npm run build` 可成功构建桌面应用（Windows .exe）
  - `programmatic` TR-1.3: 渲染进程可通过 IPC 与主进程通信
- **Notes**: 使用 electron-vite 或手动配置 Vite + Electron 集成

## [x] Task 2: Electron IPC 与文件系统操作
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 配置 preload.js 暴露安全的 IPC API
  - 实现文件对话框（打开/保存/另存为）
  - 实现文件读取（读取 .md 文件内容）
  - 实现文件写入（保存到 .md 文件）
  - 实现最近打开文件列表的持久化（electron-store）
  - 实现新建/打开/保存/另存为的 IPC 通道
  - 处理文件关联（双击 .md 文件用本应用打开）
- **Acceptance Criteria Addressed**: AC-3, AC-11
- **Test Requirements**:
  - `programmatic` TR-2.1: 打开文件对话框可正确选择 .md 文件并读取内容
  - `programmatic` TR-2.2: 保存操作将编辑内容正确写入文件
  - `programmatic` TR-2.3: 另存为可选择新路径并创建文件
  - `programmatic` TR-2.4: 最近文件列表在应用重启后正确恢复

## [x] Task 3: Markdown 解析与 Typora 风格内联编辑引擎
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 封装 markdown-it 解析器，配置 Typora 风格渲染选项
  - 集成 highlight.js 代码高亮
  - 集成 KaTeX 数学公式
  - 实现基于 ContentEditable 的内联编辑器（核心难点）
  - 编写自定义 Markdown-it 规则，实现"源码标记 → 格式化"的即时渲染
  - 实现编辑操作与 Markdown 源码的双向同步
  - 创建 TyporaEditor 组件（单区编辑，无分屏）
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-3.1: 输入 `# 标题` 立即渲染为 H1 标题样式
  - `programmatic` TR-3.2: 输入 `**粗体**` 立即渲染为粗体
  - `programmatic` TR-3.3: 代码块指定语言后显示语法高亮
  - `programmatic` TR-3.4: `$...$` 和 `$$...$$` 公式正确渲染
  - `human-judgement` TR-3.5: 内联编辑体验流畅，编辑位置与渲染效果一致
- **Notes**: 这是项目核心难点，需仔细设计 ContentEditable 与 Markdown 的映射方案

## [x] Task 4: Typora 风格主题系统
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 设计 CSS 变量主题系统（明亮/深色/Obsidian 风格）
  - 创建主题切换逻辑（Pinia store）
  - 定义 Typora 风格的排版样式（字体、间距、行高、配色）
  - 为内联编辑器编写主题样式
  - 为代码块、引用、表格等元素编写精致样式
  - 实现专注模式和打字机模式的样式切换
- **Acceptance Criteria Addressed**: AC-4, AC-10
- **Test Requirements**:
  - `programmatic` TR-4.1: 主题切换后 CSS class 正确应用
  - `human-judgement` TR-4.2: 两种主题下排版美观、对比度适中
  - `human-judgement` TR-4.3: 专注模式下当前段落突出，其余半透明
  - `human-judgement` TR-4.4: 打字机模式下光标居中效果正常

## [x] Task 5: 隐藏式工具栏与快捷键
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**: 
  - 创建顶部隐藏式工具栏组件（鼠标悬停顶部边缘显示）
  - 实现常用格式按钮（加粗、斜体、代码、链接、图片、列表、表格、引用、分割线、标题）
  - 实现按钮点击对选中文本的包裹/替换逻辑
  - 实现全局键盘快捷键（Ctrl+B、Ctrl+I、Ctrl+K、Ctrl+S、Ctrl+Shift+S 等）
  - 实现表格插入对话框
  - 实现图片插入对话框
  - 实现专注模式/打字机模式切换按钮
- **Acceptance Criteria Addressed**: AC-12, AC-7
- **Test Requirements**:
  - `programmatic` TR-5.1: 点击加粗按钮选中文本被 `**` 包裹
  - `programmatic` TR-5.2: Ctrl+B 快捷键与按钮功能一致
  - `programmatic` TR-5.3: 插入 N×M 表格生成正确 Markdown 语法
  - `programmatic` TR-5.4: 工具栏鼠标离开后自动隐藏

## [x] Task 6: 文件标签页（多文档）管理
- **Priority**: medium
- **Depends On**: Task 2, Task 3
- **Description**: 
  - 创建标签页管理组件
  - 实现多文档切换、新建、关闭功能
  - 使用 Pinia store 管理标签页状态
  - 标签页内容独立维护
  - 标签页支持未保存状态指示（小圆点）
  - 实现标签栏自动隐藏（无标签时不显示，或合并到标题栏）
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-6.1: 新建标签页创建新文档不影响其他
  - `programmatic` TR-6.2: 切换标签页内容同步切换
  - `programmatic` TR-6.3: 关闭标签页仅关闭当前标签
  - `programmatic` TR-6.4: 未保存标签页显示小圆点指示器

## [x] Task 7: 侧边栏大纲导航
- **Priority**: medium
- **Depends On**: Task 3
- **Description**: 
  - 解析文档标题结构，生成文档大纲树
  - 创建可折叠的大纲侧边栏组件
  - 实现点击大纲条目跳转到对应标题位置
  - 高亮当前编辑位置对应的大纲节点
  - 实现侧边栏的显示/隐藏切换
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `programmatic` TR-7.1: 大纲正确展示所有标题层级
  - `programmatic` TR-7.2: 点击大纲条目跳转到对应位置
  - `programmatic` TR-7.3: 编辑区滚动时当前章节在大纲中高亮

## [x] Task 8: 图片插入与粘贴
- **Priority**: medium
- **Depends On**: Task 3, Task 5
- **Description**: 
  - 实现点击按钮选择本地图片并插入
  - 实现剪贴板图片粘贴功能（监听 paste 事件）
  - 使用 FileReader 将图片转为 base64
  - 自动生成 Markdown 图片语法插入到光标位置
  - 实现拖拽图片到编辑区上传
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-8.1: 选择图片后编辑器插入 `![](...)` 语法
  - `programmatic` TR-8.2: 粘贴剪贴板图片正常工作
  - `programmatic` TR-8.3: 拖拽图片到编辑区可正确处理

## [x] Task 9: 文档导出功能
- **Priority**: medium
- **Depends On**: Task 3, Task 4
- **Description**: 
  - 实现导出为 HTML 文件（含内嵌样式）
  - 使用 Electron 原生 webContents.print() 或 html2canvas 实现导出 PDF
  - 创建导出对话框
  - 处理中文字体在 PDF 导出中的正确显示
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `programmatic` TR-9.1: 导出 HTML 文件可独立打开正确渲染
  - `programmatic` TR-9.2: 导出 PDF 内容与预览区视觉一致
  - `programmatic` TR-9.3: 中文在 PDF 中正确显示

## [x] Task 10: 标题栏与状态栏
- **Priority**: low
- **Depends On**: Task 3
- **Description**: 
  - 自定义窗口标题栏（文件名 + 未保存指示）
  - 实现字数统计（中文字符 + 英文单词）
  - 实现字符总数统计
  - 预估阅读时间计算
  - 创建底部/状态栏组件（可隐藏）
  - 窗口菜单集成（文件、编辑、视图、帮助）
- **Acceptance Criteria Addressed**: AC-13
- **Test Requirements**:
  - `programmatic` TR-10.1: 标题栏显示当前文件名和未保存标记
  - `programmatic` TR-10.2: 字数统计结果准确
  - `programmatic` TR-10.3: 阅读时长估算合理

## [x] Task 11: 整体布局集成与模式切换
- **Priority**: medium
- **Depends On**: Task 4, Task 5, Task 6, Task 7, Task 10
- **Description**: 
  - 整合所有组件到主布局（单区编辑 + 可选侧边栏 + 隐藏工具栏）
  - 实现专注模式、打字机模式的整体切换
  - 实现窗口最大化/最小化/关闭的自定义控制
  - 实现主题在整个应用内的一致性
  - 响应式适配（最小宽度限制 + 窗口缩放）
- **Acceptance Criteria Addressed**: AC-1, AC-10, AC-13
- **Test Requirements**:
  - `programmatic` TR-11.1: 所有组件在 1280×720 窗口大小下完整显示
  - `human-judgement` TR-11.2: 专注/打字机模式切换流畅
  - `human-judgement` TR-11.3: 整体界面极简美观，符合 Typora 风格

## [x] Task 12: 完善与打包优化
- **Priority**: medium
- **Depends On**: Task 1-11
- **Description**: 
  - 为核心逻辑编写单元测试（Vitest）
  - 配置 electron-builder 多平台打包（Windows/macOS/Linux）
  - 添加加载状态和错误边界
  - 添加应用图标（.ico/.icns）
  - 优化生产构建体积（代码分割、tree-shaking）
  - 配置 README（开发、构建、打包说明）
- **Acceptance Criteria Addressed**: AC-13
- **Test Requirements**:
  - `programmatic` TR-12.1: `npm run build` 成功生成 Windows 安装包
  - `programmatic` TR-12.2: 打包后应用可正常运行，冷启动 < 3s
  - `human-judgement` TR-12.3: 整体应用体验流畅，符合 Typora 风格
