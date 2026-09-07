import { useRef, type KeyboardEvent } from 'react'
import { cx } from '../../utils/cx'

interface TabOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  options: TabOption<T>[]
  onChange: (value: T) => void
  /** Names the group for screen readers, e.g. "Product source". */
  label: string
  className?: string
}

/**
 * Segmented control for the two-way "existing / new" choice. Real radio
 * semantics: one tab stop, arrow keys move the selection, the checked segment
 * carries the accent fill so the mode is unmistakable at a glance.
 */
export default function TabToggle<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: Props<T>) {
  const groupRef = useRef<HTMLDivElement>(null)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = options.findIndex((option) => option.value === value)
    if (index < 0) return
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + options.length) % options.length
    else return
    event.preventDefault()
    onChange(options[next].value)
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[next]?.focus()
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx(
        'inline-flex w-full gap-1 rounded-control border border-line bg-sunken p-1 sm:w-auto',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cx(
              'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors duration-150 sm:h-9 sm:flex-none',
              selected
                ? 'bg-accent text-accent-ink'
                : 'text-ink-muted hover:bg-surface hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
