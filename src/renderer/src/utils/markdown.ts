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

export function renderMarkdown(content: string): string {
  return md.render(content)
}