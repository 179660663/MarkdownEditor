# Markdown 编辑器 (Typora 风格桌面应用) - Verification Checklist

## Electron 基础架构
- [x] Checkpoint 1: Electron + Vue 项目初始化成功，`npm run dev` 启动后桌面窗口正常打开
- [x] Checkpoint 2: `npm run build` 可成功构建 Windows 桌面安装包
- [x] Checkpoint 3: 渲染进程可通过 IPC 与主进程安全通信（preload 脚本配置正确）
- [x] Checkpoint 4: 核心依赖（markdown-it、highlight.js、KaTeX、electron-store）正确安装

## 文件系统操作
- [x] Checkpoint 5: 新建空白文档功能正常
- [x] Checkpoint 6: 打开本地 .md 文件对话框正常，文件内容正确加载
- [x] Checkpoint 7: 保存操作将编辑内容正确写回原文件
- [x] Checkpoint 8: 另存为可选择新路径并创建文件
- [x] Checkpoint 9: 最近打开文件列表正确保存和恢复
- [x] Checkpoint 10: 未保存文件关闭时提示用户保存

## Typora 风格内联编辑（核心）
- [x] Checkpoint 11: 输入 `# 标题` 立即渲染为 H1 样式（内联渲染，非分屏）
- [x] Checkpoint 12: 输入 `##`、`###` 正确渲染为 H2、H3
- [x] Checkpoint 13: 输入 `**粗体**` 立即渲染为粗体文本
- [x] Checkpoint 14: 输入 `*斜体*` 立即渲染为斜体文本
- [x] Checkpoint 15: 输入 `` `代码` `` 渲染为行内代码样式
- [x] Checkpoint 16: 链接 `[文本](url)` 正确渲染为可点击链接
- [x] Checkpoint 17: 有序/无序列表正确渲染
- [x] Checkpoint 18: 引用 `> 文本` 正确渲染为引用块
- [x] Checkpoint 19: 代码块（```）正确渲染并支持语法高亮
- [x] Checkpoint 20: 表格语法正确渲染为可编辑表格
- [x] Checkpoint 21: 任务列表 `- [ ]` 和 `- [x]` 正确渲染为复选框
- [x] Checkpoint 22: 分割线 `---` 正确渲染
- [x] Checkpoint 23: 脚注语法正确渲染
- [x] Checkpoint 24: 编辑位置在渲染后保持正确（光标不跳动）

## 主题与 Typora 风格 UI
- [x] Checkpoint 25: 提供明亮和深色两套主题
- [x] Checkpoint 26: 主题切换无明显视觉闪烁
- [x] Checkpoint 27: 整体界面极简美观，符合 Typora 风格（无多余边框、紧凑间距）
- [x] Checkpoint 28: 排版样式精致（字体、行高、间距、代码块样式、引用样式）

## 专注模式与打字机模式
- [x] Checkpoint 29: 专注模式下当前段落高亮突出，其余段落半透明
- [x] Checkpoint 30: 打字机模式下当前编辑行保持在屏幕中间

## 工具栏与快捷键
- [x] Checkpoint 31: 工具栏悬停显示、离开自动隐藏
- [x] Checkpoint 32: 工具栏按钮功能正确（加粗、斜体、代码、链接、列表、表格、引用、标题）
- [x] Checkpoint 33: 快捷键 Ctrl+B、Ctrl+I、Ctrl+K、Ctrl+S、Ctrl+Shift+S 正确响应
- [x] Checkpoint 34: 表格插入对话框可生成 N×M Markdown 表格语法

## 标签页
- [x] Checkpoint 35: 多标签页新建、切换、关闭操作正确
- [x] Checkpoint 36: 各标签页内容独立保存，切换后不丢失
- [x] Checkpoint 37: 未保存标签页有小圆点指示

## 大纲导航
- [x] Checkpoint 38: 文档大纲正确展示标题层级结构
- [x] Checkpoint 39: 点击大纲条目跳转到对应标题位置
- [x] Checkpoint 40: 编辑区滚动时当前章节在大纲中高亮

## 图片功能
- [x] Checkpoint 41: 点击图片按钮可选择本地文件并插入
- [x] Checkpoint 42: 剪贴板图片粘贴正常
- [x] Checkpoint 43: 拖拽图片到编辑区可正确处理

## 代码高亮与数学公式
- [x] Checkpoint 44: 代码块支持 JavaScript、Python、TypeScript、CSS、HTML、JSON 语法高亮
- [x] Checkpoint 45: LaTeX 数学公式（行内 `$...$` 和块级 `$$...$$`）正确渲染

## 导出功能
- [x] Checkpoint 46: 导出 HTML 文件可独立打开正确渲染
- [x] Checkpoint 47: 导出 PDF 内容与编辑区视觉一致，中文显示正常

## 标题栏与状态栏
- [x] Checkpoint 48: 标题栏显示当前文件名和未保存状态
- [x] Checkpoint 49: 字数统计准确，阅读时长估算合理

## 性能与整体体验
- [x] Checkpoint 50: 冷启动时间 < 3 秒
- [x] Checkpoint 51: 10000 字符文档编辑流畅，渲染延迟 < 200ms
- [x] Checkpoint 52: 内存占用 < 200MB（单文档）
- [x] Checkpoint 53: 打包体积 < 120MB（Windows 版）
- [x] Checkpoint 54: 整体应用体验流畅，符合 Typora 极简风格
