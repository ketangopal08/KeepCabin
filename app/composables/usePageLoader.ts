const visible = ref(false)
const message = ref('Getting things ready…')

let _shownAt = 0
let _hideTimer: ReturnType<typeof setTimeout> | null = null
const MIN_VISIBLE_MS = 500

export function usePageLoader() {
  function show(msg?: string) {
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null }
    message.value = msg ?? 'Getting things ready…'
    visible.value = true
    _shownAt = Date.now()
  }

  function hide() {
    const elapsed = Date.now() - _shownAt
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
    _hideTimer = setTimeout(() => {
      visible.value = false
      _hideTimer = null
    }, remaining)
  }

  return { visible: readonly(visible), message: readonly(message), show, hide }
}
