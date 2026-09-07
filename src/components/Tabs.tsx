import type { KeyboardEvent, ReactNode } from 'react'
import { cx } from '../utils/cx'

export interface TabItem<Id extends string = string> {
  id: Id
  label: string
  /** Right-hand count chip, e.g. number of rows behind the tab. */
  count?: number
  icon?: ReactNode
  disabled?: boolean
  /** id of the panel this tab controls, when panels are rendered. */
  controls?: string
}

export interface TabsProps<Id extends string = string> {
  items: TabItem<Id>[]
  value: Id
  onChange: (id: Id) => void
  /** Accessible name for the tablist. */
  label?: string
  className?: string
}

/** Underlined tab strip. Scrolls horizontally on narrow screens rather than wrapping. */
export function Tabs<Id extends string = string>({
  items,
  value,
  onChange,
  label = 'Sections',
  className,
}: TabsProps<Id>) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.filter((item) => !item.disabled)
    const index = enabled.findIndex((item) => item.id === value)
    if (index < 0) return
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % enabled.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + enabled.length) % enabled.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = enabled.length - 1
    else return
    event.preventDefault()
    onChange(enabled[next].id)
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx(
        'flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={item.controls}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={cx(
              '-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              selected
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:border-line hover:text-ink',
              item.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cx(
                  'rounded-pill px-1.5 py-0.5 font-mono text-xs',
                  selected ? 'bg-accent-soft text-accent' : 'bg-sunken text-ink-muted',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
