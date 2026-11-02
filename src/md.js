// ============================================================
//  Tiny, safe Markdown renderer for custom pages (also used by /admin).
//  HTML in the source is escaped. Supported:
//    # .. ####  headings        - item / 1. item   lists
//    **bold**  *italic*  `code`  [text](url)  ![alt](image-url)
//    > quote     ---  rule       blank line = new paragraph
// ============================================================

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|#|\.\/|\/|[\w-]+\/)/i;

function inline(text) {
  let s = esc(text);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) =>
    SAFE_URL.test(url) ? `<img src="${url}" alt="${alt}" loading="lazy" decoding="async" />` : alt
  );
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    if (!SAFE_URL.test(url)) return label;
    const ext = /^https?:/i.test(url);
    return `<a href="${url}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?!\w)/g, '$1<em>$2</em>');
  return s;
}

export function md(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // { tag, items }
  let quote = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) {
      flushAll();
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flushAll();
      const level = Math.min(m[1].length + 1, 5); // # -> h2 (the page title is the h1/h2)
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushAll();
      out.push('<hr />');
    } else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) {
      flushPara();
      flushQuote();
      if (list?.tag !== 'ul') flushList();
      (list ||= { tag: 'ul', items: [] }).items.push(m[1]);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      flushQuote();
      if (list?.tag !== 'ol') flushList();
      (list ||= { tag: 'ol', items: [] }).items.push(m[1]);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flushPara();
      flushList();
      quote.push(m[1]);
    } else if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`; // continuation of a list item
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  flushAll();
  return out.join('\n');
}
