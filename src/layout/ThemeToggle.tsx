import { useEffect, useState } from 'react'
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from '../components/icons'
import { Menu, MenuItem } from './Menu'
import { applyTheme, readTheme, type ThemeChoice } from './theme'

const options: { value: ThemeChoice; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'Match system', icon: MonitorIcon },
]

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readTheme())

  useEffect(() => {
    applyTheme(choice)
  }, [choice])

  const active = options.find((option) => option.value === choice) ?? options[2]
  const ActiveIcon = active.icon

  return (
    <Menu
      label={`Appearance: ${active.label.toLowerCase()}`}
      triggerClassName="h-10 w-10 justify-center text-ink-muted hover:text-ink md:h-9 md:w-9"
      trigger={<ActiveIcon size={18} />}
    >
      {(close) => (
        <>
          <p className="px-2.5 py-1.5 text-xs text-ink-muted">Appearance</p>
          {options.map((option) => {
            const OptionIcon = option.icon
            return (
              <MenuItem
                key={option.value}
                icon={<OptionIcon size={16} />}
                selected={option.value === choice}
                onClick={() => {
                  setChoice(option.value)
                  close()
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  {option.label}
                  {option.value === choice && <CheckIcon size={14} />}
                </span>
              </MenuItem>
            )
          })}
        </>
      )}
    </Menu>
  )
}
