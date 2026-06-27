export const useLandingTheme = () => {
  const isDark = useState('lp-theme-dark', () => true)

  function apply(dark: boolean) {
    if (import.meta.client) {
      localStorage.setItem('lp-theme', dark ? 'dark' : 'light')
    }
  }

  function toggle() {
    isDark.value = !isDark.value
    apply(isDark.value)
  }

  function init() {
    if (!import.meta.client) return
    const saved = localStorage.getItem('lp-theme')
    if (saved) isDark.value = saved === 'dark'
  }

  return { isDark, toggle, init }
}
