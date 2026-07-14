'use client'

import * as React from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Visualiseur JSON collapsible — un niveau de profondeur = une indentation.
// Coloration syntaxique via spans (clés teal, strings emerald, numbers amber).

interface JsonNodeProps {
  value: unknown
  keyName?: string
  defaultOpen?: boolean
  depth?: number
}

function typeColor(v: unknown): string {
  if (typeof v === 'string') return 'text-emerald-600 dark:text-emerald-400'
  if (typeof v === 'number') return 'text-amber-600 dark:text-amber-400'
  if (typeof v === 'boolean') return 'text-violet-600 dark:text-violet-400'
  if (v === null) return 'text-rose-500 italic'
  return 'text-slate-700 dark:text-slate-200'
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v)
}

function JsonNode({ value, keyName, defaultOpen = false, depth = 0 }: JsonNodeProps) {
  const [open, setOpen] = React.useState(defaultOpen || depth < 1)

  if (isObject(value) || isArray(value)) {
    const entries = isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value)
    const isEmpty = entries.length === 0
    const opener = isArray(value) ? '[' : '{'
    const closer = isArray(value) ? ']' : '}'

    if (isEmpty) {
      return (
        <div className="font-mono text-xs">
          {keyName !== undefined && <span className="text-teal-600 dark:text-teal-400">"{keyName}"</span>}
          {keyName !== undefined && <span className="text-slate-400">: </span>}
          <span className="text-slate-500">
            {opener}
            {closer}
          </span>
        </div>
      )
    }

    return (
      <div className="font-mono text-xs">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded px-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/60"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="size-3 text-slate-400" /> : <ChevronRight className="size-3 text-slate-400" />}
          {keyName !== undefined && <span className="text-teal-600 dark:text-teal-400">"{keyName}"</span>}
          {keyName !== undefined && <span className="text-slate-400">: </span>}
          <span className="text-slate-500">{opener}</span>
          {!open && (
            <span className="text-slate-400">
              {closer}
              <span className="ml-1 text-slate-400">
                {isArray(value) ? `${value.length} items` : `${entries.length} keys`}
              </span>
            </span>
          )}
        </button>
        {open && (
          <div className="ml-3.5 border-l border-slate-200 pl-3 dark:border-slate-700">
            {entries.map(([k, v]) => (
              <JsonNode key={k} value={v} keyName={isArray(value) ? undefined : k} depth={depth + 1} />
            ))}
            <div className="text-slate-500">{closer}</div>
          </div>
        )}
      </div>
    )
  }

  // Primitive
  return (
    <div className="font-mono text-xs">
      {keyName !== undefined && <span className="text-teal-600 dark:text-teal-400">"{keyName}"</span>}
      {keyName !== undefined && <span className="text-slate-400">: </span>}
      <span className={typeColor(value)}>
        {typeof value === 'string' ? `"${value}"` : value === null ? 'null' : String(value)}
      </span>
    </div>
  )
}

export function JsonViewer({
  value,
  defaultOpen = false,
  className,
}: {
  value: unknown
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <div className={cn('rounded-md bg-slate-50 p-3 dark:bg-slate-950/40', className)}>
      <JsonNode value={value} defaultOpen={defaultOpen} />
    </div>
  )
}
