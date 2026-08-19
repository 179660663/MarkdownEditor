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

// Store original fence rule
const originalFenceRule = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
  const token = tokens[idx]
  const info = token.info ? md.utils.escapeHtml(token.info) : ''
  const langName = info.split(/\s+/g)[0]
  const highlighted = options.highlight ? options.highlight(token.content, langName || '') : md.utils.escapeHtml(token.content)
  
  return `<pre><code${langName ? ` class="language-${langName}"` : ''}>${highlighted}</code></pre>\n`
}

// Override fence rule to handle mermaid
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info ? token.info.trim().toLowerCase() : ''
  
  // Check if this is a mermaid block
  if (info === 'mermaid') {
    const content = token.content.trim()
    // Return a div with mermaid class and content - mermaid will render it later
    return `<div class="mermaid" data-line="${token.map ? token.map[0] + 1 : 1}">${md.utils.escapeHtml(content)}</div>\n`
  }
  
  // Use original fence rule for other code blocks
  return originalFenceRule(tokens, idx, options, env, self)
}

export function renderMarkdown(content: string, basePath?: string): string {
  const tokens = md.parse(content, {})
  const env: any = {}
  let html = md.renderer.render(tokens, md.options, env)
  
  // Add data-line attributes
  html = addSourceLineAttributes(html, tokens)
  
  // Resolve image paths if basePath is provided
  if (basePath) {
    html = resolveMarkdownImages(html, basePath)
  }
  
  return html
}

/**
 * Resolve relative image paths to md-local:// protocol URLs
 */
function resolveMarkdownImages(html: string, basePath: string): string {
  if (typeof window === 'undefined' || !window.DOMParser) {
    return html
  }
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="md-root">${html}</div>`, 'text/html')
    const container = doc.getElementById('md-root')
    
    if (!container) return html
    
    const images = container.querySelectorAll('img')
    
    for (const img of Array.from(images)) {
      const src = img.getAttribute('src')
      if (!src) continue
      
      // Skip external URLs, data URIs, and already processed md-local URLs
      if (src.startsWith('http://') || 
          src.startsWith('https://') || 
          src.startsWith('data:') || 
          src.startsWith('md-local://')) {
        continue
      }
      
      // Resolve relative path against basePath
      const resolvedPath = resolveImagePath(src, basePath)
      if (resolvedPath) {
        // Encode the entire path as a query parameter to avoid Windows path issues
        const encodedPath = encodeURIComponent(resolvedPath)
        img.setAttribute('src', `md-local://local?path=${encodedPath}`)
        console.log('[Image] Resolved:', decodeURIComponent(src), '->', `md-local://local?path=${decodeURIComponent(encodedPath)}`)
      }
    }
    
    return container.innerHTML
  } catch (err) {
    console.error('[Image] Failed to resolve images:', err)
    return html
  }
}

/**
 * Resolve a relative image path against the markdown file's directory
 */
function resolveImagePath(relPath: string, basePath: string): string | null {
  try {
    // First decode URL-encoded characters (markdown-it encodes non-ASCII chars)
    let decodedRel = relPath
    try {
      decodedRel = decodeURIComponent(relPath)
    } catch (e) {
      // If decoding fails, use original path
      console.log('[Image] Decode failed, using original:', relPath)
    }
    
    // Normalize path separators - convert all to forward slashes first
    let normalizedBase = basePath.replace(/\\/g, '/').replace(/\/+$/, '')
    let normalizedRel = decodedRel.replace(/\\/g, '/')
    
    // Remove leading ./ or .\
    normalizedRel = normalizedRel.replace(/^\.\//, '')
    normalizedRel = normalizedRel.replace(/^\/+/, '')
    
    // 调试日志在需要时取消注释
    // console.log('[Image] Path parts - base:', normalizedBase, 'rel:', normalizedRel)
    
    // Handle ./ and ../ paths
    const fullPath = joinPaths(normalizedBase, normalizedRel)
    console.log('[Image] Resolved:', decodeURIComponent(relPath), '-> decoded:', decodedRel, '->', fullPath)
    return fullPath
  } catch (err) {
    console.error('[Image] Path resolution error:', err)
    return null
  }
}

/**
 * Join paths (handles both Windows and Unix separators)
 */
function joinPaths(base: string, rel: string): string {
  // Split by forward slashes (we already normalized to forward slashes)
  const baseParts = base.split('/').filter(p => p !== '')
  const relParts = rel.split('/').filter(p => p !== '')
  
  const result: string[] = []
  
  // Add base parts, handling drive letters specially for Windows
  for (const part of baseParts) {
    // Drive letter (like "C:") should be preserved as-is
    if (/^[a-zA-Z]:$/.test(part)) {
      result.push(part)
    } else {
      result.push(part)
    }
  }
  
  for (const part of relParts) {
    if (part === '..') {
      if (result.length > 0) {
        // Don't pop the drive letter
        const lastPart = result[result.length - 1]
        if (!/^[a-zA-Z]:$/.test(lastPart)) {
          result.pop()
        }
      }
    } else if (part !== '.') {
      result.push(part)
    }
  }
  
  // Reconstruct path with forward slashes
  let joined = result.join('/')
  
  // If it starts with a drive letter, keep it as is; otherwise ensure no leading slash issues
  if (/^[a-zA-Z]:\//.test(joined)) {
    return joined
  }
  
  return joined
}

/**
 * URL-encode a file path, preserving separators and encoding special characters (including Chinese)
 */
function encodeImagePath(filePath: string): string {
  // First, normalize to forward slashes
  let normalizedPath = filePath.replace(/\\/g, '/')
  
  // On Windows, handle drive letter (e.g., C:/ -> C|/ to avoid issues with URL parsing)
  // Actually, we'll just encode each path segment properly
  const parts = normalizedPath.split('/')
  const encodedParts = parts.map((part, index) => {
    if (part === '') return part
    // Check if this is a drive letter (e.g., "C:") - don't encode the colon
    if (index === 0 && /^[a-zA-Z]:$/.test(part)) {
      return part
    }
    // Encode each segment using encodeURIComponent (handles Chinese, spaces, etc.)
    return encodeURIComponent(part)
  })
  
  let encoded = encodedParts.join('/')
  
  // Ensure leading slash for the protocol URL
  if (!encoded.startsWith('/')) {
    // On Windows, add leading slash before drive letter (e.g., C:/path -> /C:/path)
    encoded = '/' + encoded
  }
  
  return encoded
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
  
  // 收集所有 heading token 的行号信息
  const headingLineMap = new Map<number, number>() // index -> line number
  let headingIndex = 0
  for (const token of tokens) {
    if (token.type === 'heading_open' && /^h[1-6]$/.test(token.tag)) {
      const line = token.map ? token.map[0] + 1 : 1
      headingLineMap.set(headingIndex, line)
      headingIndex++
    }
  }
  
  // 为所有标题元素添加 data-heading-id 和 data-line
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'))
  headings.forEach((heading, index) => {
    heading.setAttribute('data-heading-id', String(index))
    const line = headingLineMap.get(index)
    if (line) {
      heading.setAttribute('data-line', String(line))
    }
  })
  
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