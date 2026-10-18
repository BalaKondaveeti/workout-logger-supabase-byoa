import { useState } from 'react'
import { ChevronIcon, CloseIcon } from './Icons'

export type Option = { id: string; label: string; color?: string; sub?: string }

// A dropdown that opens inline with a search box. The optional last option adds a new item
// (it receives what was typed).
export function SearchSelect({
  options,
  value,
  placeholder,
  onPick,
  addLabel,
  onAdd,
  startOpen = false,
  onClose,
}: {
  options: Option[]
  value?: string | null
  placeholder: string
  onPick: (id: string) => void
  addLabel?: string
  onAdd?: (query: string) => void
  startOpen?: boolean
  onClose?: () => void // full-screen use: closing leaves the screen
}) {
  const [open, setOpen] = useState(startOpen)
  const [query, setQuery] = useState('')
  const selected = options.find((o) => o.id === value)

  if (!open) {
    return (
      <button type="button" className="select-button" onClick={() => setOpen(true)}>
        {selected?.color && <span className="dot" style={{ background: selected.color }} />}
        <span className={`grow${selected ? '' : ' muted'}`}>{selected?.label ?? placeholder}</span>
        <ChevronIcon />
      </button>
    )
  }

  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  // after a pick: collapse (inline use only; a full screen navigates in onPick)
  const close = () => {
    if (onClose) return
    setOpen(false)
    setQuery('')
  }
  // X / Escape: leave the full screen, or collapse
  const dismiss = () => (onClose ? onClose() : close())

  return (
    <div className="select-open">
      <div className="inline">
        <input
          className="input grow"
          autoFocus
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') dismiss()
            if (e.key === 'Enter' && shown.length === 1) {
              e.preventDefault()
              onPick(shown[0].id)
              close()
            }
          }}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button type="button" className="icon-btn" aria-label="Close" onClick={dismiss}>
          <CloseIcon />
        </button>
      </div>
      <div className={`select-list${onClose ? ' full' : ''}`} role="listbox">
        {shown.map((o) => (
          <button
            key={o.id}
            type="button"
            role="option"
            aria-selected={o.id === value}
            className="select-option"
            onClick={() => {
              onPick(o.id)
              close()
            }}
          >
            {o.color && <span className="dot" style={{ background: o.color }} />}
            <span className="grow">{o.label}</span>
            {o.sub && <span className="muted small">{o.sub}</span>}
          </button>
        ))}
        {!shown.length && !onAdd && <p className="hint pad">No matches</p>}
        {onAdd && (
          <button
            type="button"
            className="select-option add"
            onClick={() => {
              onAdd(query.trim())
              close()
            }}
          >
            + {addLabel ?? 'Add new'}
            {query.trim() && <span className="muted">&nbsp;“{query.trim()}”</span>}
          </button>
        )}
      </div>
    </div>
  )
}
