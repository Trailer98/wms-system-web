import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

// RAG answers render as Markdown (headings, lists, inline code, code blocks, bold, paragraphs). html:false
// keeps the model's own output from injecting raw HTML; DOMPurify.sanitize is still the actual XSS
// guard applied to the rendered output before any v-html use, since markdown-it's HTML escaping alone
// doesn't cover every edge case DOMPurify does.
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

/**
 * Converts Markdown to sanitized HTML safe for v-html.
 * @param {string} markdown
 * @returns {string} sanitized HTML
 */
export function renderMarkdown(markdown) {
  if (!markdown) return ''
  const html = md.render(markdown)
  return DOMPurify.sanitize(html)
}
