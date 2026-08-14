# Markdown 编辑器 (Typora 风格桌面应用) - Product Requirement Document

## Overview
- **Summary**: 基于 Electron + Vue 3 + TypeScript 构建的桌面端 Markdown 编辑器，采用 Typora 式的极简"所见即所得"编辑体验。支持内联预览、实时渲染、多主题切换、代码高亮、数学公式、文件系统操作（打开/保存 .md 文件）、图片插入、文档导出等核心功能。
- **Purpose**: 为桌面用户提供一个轻量、高效、美观的 Markdown 写作工具，实现 Typora 风格的沉浸式写作体验——编辑即预览，无干扰的极简界面。
- **Target Users**: 技术写作者、博客作者、开发者、学生以及任何需要在桌面上进行 Markdown 文档创作的用户。

## Goals
- 实现 Typora 式的所见即所得（WYSIWYG）内联编辑体验（源码即预览，编辑时即时渲染格式化）
- 支持完整的 CommonMark Markdown 语法
- 提供 Typora 风格的极简界面（隐藏式工具栏、专注模式、打字机模式）
- 实现本地文件系统操作（打开 .md 文件、保存、另存为）
- 提供优雅的默认主题和多种可选主题（至少包含明亮/深色/Obsidian 风格）
- 支持代码块语法高亮
- 支持 LaTeX 数学公式渲染
- 支持图片粘贴与拖拽上传
- 支持导出为 HTML、PDF 格式
- 实现侧边栏大纲（TOC）导航
- 提供最近打开文件列表

## Non-Goals (Out of Scope)
- 不实现多人协作编辑（Yjs/WebSocket 等）
- 不实现云存储与账号系统
- 不实现全文搜索功能
- 不实现本地化多语言支持（仅中文界面）
- 不实现 Vim/Emacs 等模态编辑器键位绑定
- 不实现 Mermaid 图表渲染（可后续扩展）

## Background & Context
- 项目基于 Electron + Vue 3 + TypeScript 技术栈
- 构建工具：Vite（渲染进程）+ electron-builder（打包）
- Markdown 解析库：Markdown-it（业界主流选择）
- 代码高亮：Highlight.js
- 数学公式：KaTeX
- 目标运行环境：Windows 10+、macOS 11+、主流 Linux 发行版
- Typora 核心风格特征：
  - 单窗口无分隔，编辑区直接渲染格式化效果
  - 源码标记在编辑时以轻量提示形式显示（如 `#` 变为主标题样式但保留可编辑性）
  - 极简 UI：默认隐藏工具栏，通过顶部边缘悬停或快捷键唤起
  - 专注模式（Focus Mode）：当前段落高亮，其余段落半透明
  - 打字机模式（Typewriter Mode）：当前编辑行始终保持在屏幕中间

## Functional Requirements
- **FR-1**: 编辑器支持所有 CommonMark 标准语法（标题、段落、列表、链接、图片、粗体、斜体、代码、引用、分割线、表格、任务列表、脚注等）
- **FR-2**: 实现 Typora 风格的内联编辑：源码标记实时渲染为格式化效果，用户仍可在渲染后的文本上直接编辑
- **FR-3**: 提供文件操作功能：新建空白文档、打开本地 .md 文件、保存当前文档、另存为新文件
- **FR-4**: 提供最近打开文件列表，可快速重新打开历史文件
- **FR-5**: 支持通过拖拽和剪贴板粘贴插入图片，图片以 base64 或文件路径方式存储
- **FR-6**: 支持 Markdown 表格的可视化编辑（工具栏插入表格、行列操作）
- **FR-7**: 支持代码块的语法高亮，覆盖主流编程语言
- **FR-8**: 支持 LaTeX 数学公式的渲染（行内公式 `$...$` 和块级公式 `$$...$$`）
- **FR-9**: 支持文档大纲（TOC）侧边栏，展示文档结构，点击可跳转
- **FR-10**: 支持文档导出为 HTML、PDF 格式
- **FR-11**: 支持多主题切换（至少提供明亮/深色两套主题）
- **FR-12**: 提供隐藏式工具栏（窗口顶部边缘悬停显示），包含常用格式快捷按钮
- **FR-13**: 支持键盘快捷键（加粗 Ctrl+B、斜体 Ctrl+I、链接 Ctrl+K、保存 Ctrl+S 等）
- **FR-14**: 支持专注模式（Focus Mode）和打字机模式（Typewriter Mode）
- **FR-15**: 支持字数统计与阅读时长预估
- **FR-16**: 支持窗口标题栏显示当前文件名和未保存状态

## Non-Functional Requirements
- **NFR-1**: 编辑器冷启动时间 < 3 秒（打包后）
- **NFR-2**: 10000 字符文档的渲染响应时间 < 200ms
- **NFR-3**: 内存占用 < 200MB（单文档模式）
- **NFR-4**: 代码结构清晰，组件化良好，Electron 主进程/渲染进程通信规范
- **NFR-5**: 支持 Windows 10+、macOS 11+、主流 Linux 发行版（Ubuntu 20+ 等）
- **NFR-6**: 打包体积合理（Windows 版 < 120MB）

## Constraints
- **Technical**: 必须使用 Electron + Vue 3 + TypeScript 技术栈
- **Business**: 无外部依赖约束
- **Dependencies**: 
  - Electron（桌面框架）
  - markdown-it（Markdown 解析与渲染）
  - highlight.js（代码高亮）
  - KaTeX（数学公式）
  - Node.js fs API（本地文件操作，通过 Electron IPC）
  - electron-store（应用配置持久化）
  - electron-builder（打包分发）

## Assumptions
- 用户具备基本的 Markdown 语法知识
- 用户使用支持的桌面操作系统（Windows/macOS/Linux）
- 图片以 base64 内嵌或本地路径引用方式处理，不涉及云端存储
- 用户理解内联编辑模式下的编辑交互（区别于传统分屏编辑器）

## Acceptance Criteria

### AC-1: Typora 风格内联编辑
- **Given**: 用户打开编辑器进入写作状态
- **When**: 用户输入 Markdown 语法（如 `# 标题`、`**粗体**`、`- 列表项`）
- **Then**: 输入内容立即渲染为格式化视觉效果，用户可直接在渲染后的文本上继续编辑，无需切换模式
- **Verification**: `human-judgment`

### AC-2: Markdown 语法完整性
- **Given**: 用户在编辑器中输入合法的 CommonMark 语法
- **When**: 渲染完成后
- **Then**: 所有标准 Markdown 元素（标题、列表、代码块、表格、引用、图片、链接、任务列表、脚注等）在编辑区内正确显示
- **Verification**: `programmatic`

### AC-3: 文件系统操作
- **Given**: 用户启动应用
- **When**: 用户执行新建/打开/保存/另存为操作
- **Then**: 应用通过系统对话框选择文件，正确读取 .md 文件内容，并将编辑内容写回本地文件
- **Verification**: `programmatic`

### AC-4: 主题切换
- **Given**: 编辑器已加载完成
- **When**: 用户切换主题（明亮/深色）
- **Then**: 编辑器界面同步切换到对应主题样式，无明显视觉闪烁
- **Verification**: `human-judgment`

### AC-5: 代码高亮
- **Given**: 用户在 Markdown 中插入代码块并指定语言
- **When**: 代码块渲染完成
- **Then**: 代码块根据指定语言正确显示语法高亮
- **Verification**: `programmatic`

### AC-6: 数学公式渲染
- **Given**: 用户在编辑区输入 LaTeX 数学公式
- **When**: 预览区渲染完成
- **Then**: 公式正确渲染为数学符号
- **Verification**: `programmatic`

### AC-7: 图片插入
- **Given**: 用户点击图片按钮或在编辑区粘贴/拖拽图片
- **When**: 用户选择本地图片或粘贴剪贴板图片
- **Then**: 图片插入到文档正确位置，以 Markdown 图片语法存储
- **Verification**: `programmatic`

### AC-8: 文档大纲
- **Given**: 当前文档包含多级标题
- **When**: 用户打开大纲侧边栏
- **Then**: 大纲正确展示文档的标题层级结构，点击条目可跳转到对应位置
- **Verification**: `programmatic`

### AC-9: 导出功能
- **Given**: 用户已打开一个文档
- **When**: 用户选择导出为 HTML 或 PDF
- **Then**: 系统成功生成并下载对应格式的文件
- **Verification**: `programmatic`

### AC-10: 专注模式与打字机模式
- **Given**: 用户在编辑状态下
- **When**: 用户切换到专注模式或打字机模式
- **Then**: 专注模式下当前段落高亮突出，其余段落半透明；打字机模式下光标始终保持在屏幕中间位置
- **Verification**: `human-judgment`

### AC-11: 最近打开文件
- **Given**: 用户已打开过至少一个文件
- **When**: 用户重新打开应用
- **Then**: 最近打开文件列表中显示历史文件，可一键打开
- **Verification**: `programmatic`

### AC-12: 快捷键支持
- **Given**: 编辑器处于活动状态
- **When**: 用户按下快捷键
- **Then**: Ctrl+B（加粗）、Ctrl+I（斜体）、Ctrl+K（链接）、Ctrl+S（保存）、Ctrl+Shift+S（另存为）等快捷键正确响应
- **Verification**: `programmatic`

### AC-13: 性能与流畅度
- **Given**: 用户编辑 10000 字符的文档
- **When**: 用户进行常规操作（输入、滚动、切换主题）
- **Then**: 所有操作响应流畅，渲染延迟 < 200ms
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要支持 Mermaid 图表渲染？
- [ ] 是否需要支持 Vim/Emacs 等编辑器模式？
- [ ] 是否需要支持 PWA 离线使用？
- [ ] PDF 导出是通过 Electron 原生打印还是 html2canvas + jsPDF？
- [ ] 是否支持多窗口/多实例编辑？
