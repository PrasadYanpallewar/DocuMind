import React from 'react';

/**
 * Safely parses inline markdown tokens (bold, italic, inline code) into React elements.
 *
 * @param {string} text - Raw inline text.
 * @returns {React.ReactNode} Parsed React elements.
 */
function parseInline(text) {
  if (!text) return null;

  // Match: `code`, ***bold italic***, **bold**, __bold__, *italic*, _italic_
  const tokenRegex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 font-mono text-cyan-300 text-[11px] sm:text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold + Italic: ***text***
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return (
        <strong key={index} className="font-bold text-white">
          <em className="italic">{part.slice(3, -3)}</em>
        </strong>
      );
    }

    // Bold: **text** or __text__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic: *text* or _text_
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic text-slate-300">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}

/**
 * Renders Markdown-formatted AI responses safely using React elements without innerHTML.
 * Supports bold, italic, headings (#-####), bullet lists (*, -), numbered lists (1.),
 * blockquotes (>), code blocks (```), and standard paragraphs.
 */
export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let index = 0;
  let listItems = [];
  let listType = null; // 'ul' | 'ol'
  let inCodeBlock = false;
  let codeBlockLines = [];

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      if (listType === 'ul') {
        elements.push(
          <ul
            key={`ul-${index++}`}
            className="list-disc list-outside pl-5 my-2 space-y-1 text-slate-200"
          >
            {listItems.map((item, i) => (
              <li key={i}>{parseInline(item)}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol
            key={`ol-${index++}`}
            className="list-decimal list-outside pl-5 my-2 space-y-1 text-slate-200"
          >
            {listItems.map((item, i) => (
              <li key={i}>{parseInline(item)}</li>
            ))}
          </ol>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced Code Block delimiter
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${index++}`}
            className="my-2 overflow-x-auto rounded-xl border border-slate-800 bg-[#090d16] p-3 text-xs font-mono text-cyan-300"
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Bullet List item (*, -, +)
    const bulletMatch = line.match(/^\s*[*+-]\s+(.+)$/);
    if (bulletMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(bulletMatch[1]);
      continue;
    }

    // Numbered List item (1., 2., etc.)
    const numberMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (numberMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(numberMatch[2]);
      continue;
    }

    // Not a list item -> flush open list
    flushList();

    // Headings
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${index++}`} className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-purple-300">
          {parseInline(trimmed.slice(5))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${index++}`} className="mt-3 mb-1.5 text-sm font-bold text-white">
          {parseInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${index++}`} className="mt-3.5 mb-1.5 text-base font-extrabold text-white">
          {parseInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${index++}`} className="mt-4 mb-2 text-lg font-black text-white">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Blockquote (> text)
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${index++}`}
          className="my-2 border-l-2 border-purple-500 pl-3 italic text-slate-300"
        >
          {parseInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${index++}`} className="my-1 leading-relaxed">
        {parseInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className={`space-y-1.5 text-slate-200 ${className}`}>{elements}</div>;
}
