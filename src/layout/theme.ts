export type ThemeChoice = 'light' | 'dark' | 'system'

const THEME_KEY = 'jewelry_shop_theme'

export function readTheme(): ThemeChoice {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/** Writes `data-theme` on <html>; `system` removes it so the OS preference wins. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') {
    root.removeAttribute('data-theme')
    localStorage.removeItem(THEME_KEY)
  } else {
    root.setAttribute('data-theme', choice)
    localStorage.setItem(THEME_KEY, choice)
  }
}
