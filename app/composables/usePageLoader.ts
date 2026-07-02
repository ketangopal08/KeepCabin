const visible = ref(false)
const message = ref('Getting things ready…')

export function usePageLoader() {
  function show(msg?: string) {
    message.value = msg ?? 'Getting things ready…'
    visible.value = true
  }

  function hide() {
    visible.value = false
  }

  return { visible: readonly(visible), message: readonly(message), show, hide }
}
