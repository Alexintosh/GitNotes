import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Renders markdown content to sanitized HTML
 * @param markdown - The markdown content to render
 * @returns Sanitized HTML
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  // Parse markdown to HTML
  const html = marked.parse(markdown, {
    gfm: true, // GitHub flavored markdown
    breaks: true, // Convert line breaks to <br>
  }) as string; // Cast to string type
  
  // Sanitize HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
      'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
      'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'img', 'span',
      'del', 'input', 
    ],
    ALLOWED_ATTR: [
      'href', 'name', 'target', 'src', 'alt', 'class', 'id', 'style', 'type', 'checked', 'disabled'
    ],
  });
  
  return sanitizedHtml;
} 