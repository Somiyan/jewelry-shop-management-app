import type { InputHTMLAttributes } from 'react'
import { cx } from '../utils/cx'
import { controlClass, controlHeight } from './control-styles'
import { CloseIcon, SearchIcon } from './icons'

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  /** Called with the raw string on every keystroke and on clear. */
  onValueChange: (value: string) => void
  /** Defaults to "Search". Also used as the accessible name when no label wraps it. */
  placeholder?: string
}

export function SearchInput({
  value,
  onValueChange,
  placeholder = 'Search',
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className={cx('relative', className)}>
      <SearchIcon
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        {...props}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={props['aria-label'] ?? placeholder}
        className={cx(
          controlClass(false),
          controlHeight,
          'pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
      {value !== '' && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  )
}
