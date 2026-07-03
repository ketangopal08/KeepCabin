const _handler = ref<(() => Promise<void>) | null>(null)
const _saving  = ref(false)
const _saved   = ref(false)

export function useSettingsBar() {
  function register(fn: () => Promise<void>) {
    _handler.value = fn
  }

  function unregister() {
    _handler.value = null
    _saving.value  = false
    _saved.value   = false
  }

  async function triggerSave() {
    if (!_handler.value || _saving.value) return
    _saving.value = true
    try {
      await _handler.value()
      _saved.value = true
      setTimeout(() => { _saved.value = false }, 2500)
    } finally {
      _saving.value = false
    }
  }

  return {
    register,
    unregister,
    triggerSave,
    saving: readonly(_saving),
    saved:  readonly(_saved),
  }
}
