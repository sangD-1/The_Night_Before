import React, { useState } from 'react'
import {
  BookOpen,
  Lightbulb,
  Copy,
  Check,
  Terminal,
} from 'lucide-react'

/**
 * Strips internal retrieval tokens, raw chunk markers, and slide boilerplates.
 */
function sanitizeRawTokens(text) {
  if (!text) return ''
  return text
    // Remove internal chunk/source markers like [SOURCE 1], [SOURCE 2], [CHUNK 12], etc.
    .replace(/\[(?:SOURCE|CHUNK)\s*\d+(?:,\s*\d+)*\]:?/gi, '')
    // Remove raw source chunk headers
    .replace(/^#+\s*Course Material Synthesis\s*$/gim, '')
    // Remove raw slide footer/header boilerplates
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/Slide \d+ of \d+/gi, '')
    // Clean multiple consecutive blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Normalizes ALL-CAPS headings like "DEFINITIONS OF SOFTWARE RELIABILITY"
 * or "KEY POINTS & OPERATIONS:" into markdown headers.
 */
function normalizeAllCapsHeadings(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const normalized = lines.map((line) => {
    const trimmed = line.trim()
    // Check if line is ALL CAPS with at least 2 words and not a bullet/code/table
    if (
      trimmed.length > 5 &&
      trimmed.length < 80 &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('|') &&
      !trimmed.startsWith('`') &&
      /^[A-Z0-9\s,&:\-–—]+$/.test(trimmed)
    ) {
      // Convert to Title Case
      const cleanTitle = trimmed
        .replace(/:\s*$/, '')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
      return `### ${cleanTitle}`
    }
    return line
  })
  return normalized.join('\n')
}

/**
 * Detects if a sentence or line is essentially identical to another
 * to prevent repetitive display from multi-source synthesis.
 */
function isDuplicateText(textA, textB) {
  const normA = textA.toLowerCase().replace(/[^a-z0-9]/g, '')
  const normB = textB.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normA || !normB) return false
  if (normA === normB) return true
  // Check substring containment if length is significant (> 35 chars)
  if (normA.length > 35 && normB.length > 35) {
    if (normA.includes(normB) || normB.includes(normA)) return true
  }
  return false
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and mathematical formulas.
 */
function renderInlineContent(text) {
  if (!text) return null

  // Split by inline code first
  const parts = []
  const codeRegex = /`([^`]+)`/g
  let lastIndex = 0
  let match

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) })
    }
    parts.push({ type: 'code', content: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) })
  }

  return parts.map((part, pIdx) => {
    if (part.type === 'code') {
      const codeVal = part.content
      // Detect if it's a boundary condition or formula like Top == MAXSTK - 1 or O(V + E)
      const isFormula =
        codeVal.includes('==') ||
        codeVal.includes('!=') ||
        codeVal.includes('<=') ||
        codeVal.includes('>=') ||
        codeVal.startsWith('O(') ||
        codeVal.includes('MAXSTK')
      return (
        <code
          key={pIdx}
          className={`px-1.5 py-0.5 rounded font-mono text-[12px] ${
            isFormula
              ? 'bg-indigo-50/80 text-indigo-800 border border-indigo-200/80 font-semibold'
              : 'bg-slate-100 text-slate-800 border border-slate-200'
          }`}
        >
          {codeVal}
        </code>
      )
    }

    // Process bold (**...**) and italic (*...* or _..._)
    const textVal = part.content
    const formattedParts = []
    const formatRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/g
    let fLast = 0
    let fMatch

    while ((fMatch = formatRegex.exec(textVal)) !== null) {
      if (fMatch.index > fLast) {
        formattedParts.push({ type: 'plain', content: textVal.substring(fLast, fMatch.index) })
      }

      if (fMatch[2]) {
        // Bold
        formattedParts.push({ type: 'bold', content: fMatch[2] })
      } else if (fMatch[3]) {
        // Italic with *
        formattedParts.push({ type: 'italic', content: fMatch[3] })
      } else if (fMatch[4]) {
        // Italic with _
        formattedParts.push({ type: 'italic', content: fMatch[4] })
      }
      fLast = fMatch.index + fMatch[0].length
    }
    if (fLast < textVal.length) {
      formattedParts.push({ type: 'plain', content: textVal.substring(fLast) })
    }

    return (
      <React.Fragment key={pIdx}>
        {formattedParts.map((fp, fpIdx) => {
          if (fp.type === 'bold') {
            return (
              <strong key={fpIdx} className="font-semibold text-slate-900">
                {fp.content}
              </strong>
            )
          }
          if (fp.type === 'italic') {
            return (
              <em key={fpIdx} className="italic text-slate-800">
                {fp.content}
              </em>
            )
          }
          return fp.content
        })}
      </React.Fragment>
    )
  })
}

/**
 * Code Block with copy functionality
 */
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-3.5 rounded-xl border border-slate-700/80 bg-slate-900 overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span>{language || 'code'}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors p-1 rounded"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 text-[10px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/**
 * GFM Markdown Table
 */
function TableBlock({ rows }) {
  if (!rows || rows.length < 2) return null

  const parseRow = (line) =>
    line
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)

  const headers = parseRow(rows[0])
  // Skip separator line (e.g. |:---|:---|)
  const dataRows = rows.slice(2).map(parseRow)

  return (
    <div className="my-3.5 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3.5 py-2.5 font-semibold text-slate-800">
                {renderInlineContent(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {dataRows.map((r, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
              {r.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2.5 text-slate-700">
                  {renderInlineContent(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Example Callout Card
 */
function ExampleCallout({ title, content }) {
  return (
    <div className="my-3.5 rounded-xl border-l-4 border-l-sky-500 border border-sky-100 bg-sky-50/50 p-3.5 space-y-1.5 shadow-2xs">
      <div className="flex items-center gap-1.5 text-sky-900 font-bold text-xs uppercase tracking-wider">
        <Lightbulb className="w-3.5 h-3.5 text-sky-600 shrink-0" />
        <span>{title || 'Example'}</span>
      </div>
      <div className="text-xs sm:text-sm text-slate-800 leading-relaxed pl-5">
        {renderInlineContent(content)}
      </div>
    </div>
  )
}

/**
 * Definition Callout Card
 */
function DefinitionCallout({ term, definition }) {
  return (
    <div className="my-3.5 rounded-xl border-l-4 border-l-indigo-500 border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-1 shadow-2xs">
      <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-xs">
        <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <span>Definition: {term}</span>
      </div>
      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed pl-5">
        {renderInlineContent(definition)}
      </p>
    </div>
  )
}

/**
 * Primary Study Answer Renderer
 */
export default function StudyAnswerRenderer({ content }) {
  if (!content) return null

  // 1. Sanitize raw tokens and clean boilerplates
  const cleaned = sanitizeRawTokens(content)
  // 2. Normalize all-caps headings
  const normalized = normalizeAllCapsHeadings(cleaned)

  // 3. Break into blocks (paragraphs, lists, code blocks, tables, headers)
  const lines = normalized.split('\n')
  const blocks = []
  let currentList = null
  let inCodeBlock = false
  let codeBuffer = []
  let codeLang = ''
  let tableBuffer = []
  const seenSentences = new Set()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Handle code fence
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: 'code_block',
          code: codeBuffer.join('\n'),
          language: codeLang,
        })
        codeBuffer = []
        codeLang = ''
        inCodeBlock = false
      } else {
        if (currentList) {
          blocks.push(currentList)
          currentList = null
        }
        if (tableBuffer.length > 0) {
          blocks.push({ type: 'table', rows: tableBuffer })
          tableBuffer = []
        }
        inCodeBlock = true
        codeLang = trimmed.replace(/^```/, '').trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    // Handle table lines
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (currentList) {
        blocks.push(currentList)
        currentList = null
      }
      tableBuffer.push(trimmed)
      continue
    } else if (tableBuffer.length > 0) {
      blocks.push({ type: 'table', rows: tableBuffer })
      tableBuffer = []
    }

    // Handle blank lines
    if (!trimmed) {
      if (currentList) {
        blocks.push(currentList)
        currentList = null
      }
      continue
    }

    // Handle Headings
    if (trimmed.startsWith('#')) {
      if (currentList) {
        blocks.push(currentList)
        currentList = null
      }

      const match = trimmed.match(/^(#{1,6})\s*(.*)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        blocks.push({ type: 'heading', level, text })
        continue
      }
    }

    // Handle Unordered Lists (* or -)
    const bulletMatch = trimmed.match(/^[*•-]\s+(.*)$/)
    if (bulletMatch) {
      const itemText = bulletMatch[1].trim()
      // Deduplicate identical bullet points
      const isDup = Array.from(seenSentences).some((seen) => isDuplicateText(seen, itemText))
      if (!isDup) {
        seenSentences.add(itemText)
        if (!currentList || currentList.listType !== 'unordered') {
          if (currentList) blocks.push(currentList)
          currentList = { type: 'list', listType: 'unordered', items: [] }
        }
        currentList.items.push(itemText)
      }
      continue
    }

    // Handle Ordered Lists (1. 2.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (numMatch) {
      const itemText = numMatch[2].trim()
      const isDup = Array.from(seenSentences).some((seen) => isDuplicateText(seen, itemText))
      if (!isDup) {
        seenSentences.add(itemText)
        if (!currentList || currentList.listType !== 'ordered') {
          if (currentList) blocks.push(currentList)
          currentList = { type: 'list', listType: 'ordered', items: [] }
        }
        currentList.items.push(itemText)
      }
      continue
    }

    // Not a list item
    if (currentList) {
      blocks.push(currentList)
      currentList = null
    }

    // Handle Example Callout: lines starting with "Example:" or "**Example:**"
    const exampleMatch = trimmed.match(/^(?:\*\*)?Example(?:\*\*)?:\s*(.*)$/i)
    if (exampleMatch) {
      blocks.push({ type: 'example', content: exampleMatch[1] })
      continue
    }

    // Handle Definition Callout: e.g. "**Definition:** ..." or "Definition: ..."
    const defMatch = trimmed.match(/^(?:\*\*)?Definition(?:\*\*)?:\s*(.*)$/i)
    if (defMatch) {
      blocks.push({ type: 'definition', content: defMatch[1] })
      continue
    }

    // Check for standalone formula line e.g. "Top == MAXSTK - 1" or "Top == -1"
    if (
      (trimmed.includes('==') || trimmed.includes('!=') || trimmed.includes('MAXSTK')) &&
      trimmed.length < 60 &&
      !trimmed.includes(' ') &&
      !trimmed.endsWith('.')
    ) {
      blocks.push({ type: 'formula', formula: trimmed })
      continue
    }

    // Normal Paragraph with sentence deduplication
    // Check if the entire paragraph is a duplicate of a previously shown paragraph
    const isDupPara = Array.from(seenSentences).some((seen) => isDuplicateText(seen, trimmed))
    if (!isDupPara) {
      seenSentences.add(trimmed)
      blocks.push({ type: 'paragraph', text: trimmed })
    }
  }

  // Push lingering list or table
  if (currentList) blocks.push(currentList)
  if (tableBuffer.length > 0) blocks.push({ type: 'table', rows: tableBuffer })
  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({ type: 'code_block', code: codeBuffer.join('\n'), language: codeLang })
  }

  return (
    <div className="study-answer-content space-y-3.5 text-slate-800 text-xs sm:text-sm leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          if (block.level === 1 || block.level === 2) {
            return (
              <h2
                key={idx}
                className="text-base sm:text-lg font-bold text-slate-900 tracking-tight pt-2 pb-1 border-b border-slate-100 flex items-center gap-2"
              >
                {renderInlineContent(block.text)}
              </h2>
            )
          }
          if (block.level === 3) {
            return (
              <h3
                key={idx}
                className="text-sm sm:text-base font-bold text-slate-900 pt-2 pb-0.5 tracking-tight"
              >
                {renderInlineContent(block.text)}
              </h3>
            )
          }
          return (
            <h4 key={idx} className="text-xs sm:text-sm font-semibold text-slate-800 pt-1">
              {renderInlineContent(block.text)}
            </h4>
          )
        }

        if (block.type === 'list') {
          if (block.listType === 'ordered') {
            return (
              <ol
                key={idx}
                className="space-y-2 pl-5 list-decimal marker:font-semibold marker:text-indigo-600 text-slate-700"
              >
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="leading-relaxed">
                    {renderInlineContent(item)}
                  </li>
                ))}
              </ol>
            )
          }

          return (
            <ul key={idx} className="space-y-2 pl-4 list-disc marker:text-indigo-500 text-slate-700">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="leading-relaxed">
                  {renderInlineContent(item)}
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === 'example') {
          return <ExampleCallout key={idx} content={block.content} />
        }

        if (block.type === 'definition') {
          return <DefinitionCallout key={idx} term="" definition={block.content} />
        }

        if (block.type === 'code_block') {
          return <CodeBlock key={idx} code={block.code} language={block.language} />
        }

        if (block.type === 'table') {
          return <TableBlock key={idx} rows={block.rows} />
        }

        if (block.type === 'formula') {
          return (
            <div key={idx} className="my-2 p-2.5 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs sm:text-sm text-slate-900 font-semibold inline-block shadow-2xs">
              {block.formula}
            </div>
          )
        }

        // Standard Paragraph
        return (
          <p key={idx} className="text-slate-700 leading-relaxed">
            {renderInlineContent(block.text)}
          </p>
        )
      })}
    </div>
  )
}
