export function useTheme() {
  const isDark = useState('theme-dark', () => false)

  function apply(dark: boolean) {
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', dark)
      localStorage.setItem('keepcabin-theme', dark ? 'dark' : 'light')
    }
  }

  function toggle() {
    isDark.value = !isDark.value
    apply(isDark.value)
  }

  function init() {
    if (!import.meta.client) return
    const saved = localStorage.getItem('keepcabin-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = saved ? saved === 'dark' : true
    isDark.value = dark
    apply(dark)
  }

  return { isDark, toggle, init }
}
