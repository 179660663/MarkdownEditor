import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import container from 'markdown-it-container'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import hljs from 'highlight.js'
import katex from 'katex'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      } catch {
        // ignore
      }
    }
    try {
      return hljs.highlightAuto(str).value
    } catch {
      return ''
    }
  }
})

// sourcePos 在 markdown-it v8+ 中默认启用，无需手动 enable

md.use(anchor, {
  permalink: anchor.permalink.headerLink()
})

md.use(container, 'warning', {
  validate: (params: string) => params.trim().match(/^warning\s+(.*)$/),
  render: (tokens: any[], idx: number) => {
    const m = tokens[idx].info.trim().match(/^warning\s+(.*)$/)
    if (tokens[idx].nesting === 1) {
      return `<div class="custom-container warning"><p class="container-title">⚠ ${m ? m[1] || '警告' : '警告'}</p>`
    } else {
      return '</div>'
    }
  }
})

md.use(container, 'tip', {
  validate: (params: string) => params.trim().match(/^tip\s+(.*)$/),
  render: (tokens: any[], idx: number) => {
    const m = tokens[idx].info.trim().match(/^tip\s+(.*)$/)
    if (tokens[idx].nesting === 1) {
      return `<div class="custom-container tip"><p class="container-title">💡 ${m ? m[1] || '提示' : '提示'}</p>`
    } else {
      return '</div>'
    }
  }
})

md.use(container, 'info', {
  validate: (params: string) => params.trim().match(/^info\s+(.*)$/),
  render: (tokens: any[], idx: number) => {
    const m = tokens[idx].info.trim().match(/^info\s+(.*)$/)
    if (tokens[idx].nesting === 1) {
      return `<div class="custom-container info"><p class="container-title">ℹ ${m ? m[1] || '信息' : '信息'}</p>`
    } else {
      return '</div>'
    }
  }
})

md.use(container, 'danger', {
  validate: (params: string) => params.trim().match(/^danger\s+(.*)$/),
  render: (tokens: any[], idx: number) => {
    const m = tokens[idx].info.trim().match(/^danger\s+(.*)$/)
    if (tokens[idx].nesting === 1) {
      return `<div class="custom-container danger"><p class="container-title">⛔ ${m ? m[1] || '危险' : '危险'}</p>`
    } else {
      return '</div>'
    }
  }
})

md.use(taskLists)
md.use(footnote)

md.renderer.rules.math_block = (tokens, idx) => {
  const content = tokens[idx].content
  try {
    return katex.renderToString(content, { throwOnError: false, displayMode: true })
  } catch {
    return `<pre>${content}</pre>`
  }
}

md.renderer.rules.math_inline = (tokens, idx) => {
  const content = tokens[idx].content
  try {
    return katex.renderToString(content, { throwOnError: false })
  } catch {
    return `<code>${content}</code>`
  }
}

md.renderer.rules.footnote_ref = (tokens, idx, options, env, self) => {
  const id = self.escape(tokens[idx].meta.id)
  const caption = tokens[idx].meta.caption

  if (!env.footnotes) {
    env.footnotes = { list: [] }
  }
  env.footnotes.list.push({ id, caption })

  return `<sup class="footnote-ref"><a href="#fn${id}" id="fnref${id}">${caption}</a></sup>`
}

md.renderer.rules.footnote_block = (tokens, idx, options, env, self) => {
  if (!env.footnotes || env.footnotes.list.length === 0) {
    return ''
  }

  let text = '<hr class="footnotes-sep" />\n'
  text += '<section class="footnotes">\n'
  text += '<ol class="footnotes-list">\n'

  for (const fn of env.footnotes.list) {
    text += `<li id="fn${fn.id}" class="footnote-item"><p>${fn.caption} <a href="#fnref${fn.id}" class="footnote-backref">↩</a></p></li>\n`
  }

  text += '</ol>\n'
  text += '</section>\n'

  return text
}

export function renderMarkdown(content: string): string {
  const tokens = md.parse(content, {})
  const env: any = {}
  const html = md.renderer.render(tokens, md.options, env)
  
  // 为块级元素添加 data-line 属性
  return addSourceLineAttributes(html, tokens)
}

function addSourceLineAttributes(html: string, tokens: any[]): string {
  // 在 Node.js 环境下使用正则替换，在浏览器环境下使用 DOMParser
  if (typeof window !== 'undefined' && window.DOMParser) {
    return addSourceLineAttributesBrowser(html, tokens)
  }
  return html
}

function addSourceLineAttributesBrowser(html: string, tokens: any[]): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="md-root">${html}</div>`, 'text/html')
  const container = doc.getElementById('md-root')
  
  if (!container) return html
  
  // 收集 token 的行号信息
  const lineMap: Array<{ tag: string; line: number }> = []
  
  for (const token of tokens) {
    if (token.map && token.map[0] !== undefined) {
      const tag = getBlockTagName(token)
      if (tag) {
        lineMap.push({ tag, line: token.map[0] })
      }
    }
  }
  
  // 为元素添加 data-line 属性
  const selectors = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, table, hr, ul, ol, .custom-container'
  const elements = container.querySelectorAll(selectors)
  
  // 使用索引匹配（假设元素顺序与 token 顺序一致）
  let tokenIndex = 0
  const usedLines = new Set<number>()
  
  for (const el of Array.from(elements)) {
    const tagName = el.tagName?.toLowerCase()
    const className = el.className || ''
    
    // 查找匹配的行号
    let found = false
    for (let i = 0; i < lineMap.length && tokenIndex < lineMap.length; i++) {
      const info = lineMap[i]
      if (usedLines.has(info.line)) continue
      
      // 匹配标签或特殊容器
      if (matchesSelector(info.tag, tagName, className)) {
        el.setAttribute('data-line', String(info.line))
        usedLines.add(info.line)
        found = true
        break
      }
    }
    
    if (!found && tokenIndex < lineMap.length) {
      // 如果没找到匹配，尝试使用下一个可用的行号
      for (const info of lineMap) {
        if (!usedLines.has(info.line)) {
          el.setAttribute('data-line', String(info.line))
          usedLines.add(info.line)
          break
        }
      }
    }
  }
  
  return container.innerHTML
}

function getBlockTagName(token: any): string {
  const type = token.type
  
  if (type === 'heading_open') return 'heading'
  if (type === 'paragraph_open') return 'p'
  if (type === 'blockquote_open') return 'blockquote'
  if (type === 'bullet_list_open') return 'ul'
  if (type === 'ordered_list_open') return 'ol'
  if (type === 'list_item_open') return 'li'
  if (type === 'table_open') return 'table'
  if (type === 'hr') return 'hr'
  if (type === 'fence' || type === 'code_block') return 'pre'
  if (type.startsWith('container_')) return 'container'
  
  return ''
}

function matchesSelector(tokenTag: string, elementTag: string, className: string): boolean {
  // 简单匹配
  if (tokenTag === elementTag) return true
  
  // heading 匹配 h1-h6
  if (tokenTag === 'heading' && elementTag?.startsWith('h')) return true
  
  // container 匹配 custom-container
  if (tokenTag === 'container' && className.includes('custom-container')) return true
  
  // pre 匹配 pre 和 code
  if (tokenTag === 'pre' && (elementTag === 'pre' || elementTag === 'code')) return true
  
  return false
}