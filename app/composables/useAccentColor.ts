import { useSupabase } from '~~/lib/supabase'

export const ACCENT_COLORS = [
  { id: 'blue',    label: 'Blue',    hex: '#207afc', hsl: '215 97% 56%', darkHsl: '215 97% 62%' },
  { id: 'violet',  label: 'Violet',  hex: '#7c3aed', hsl: '263 83% 58%', darkHsl: '263 83% 65%' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981', hsl: '160 84% 39%', darkHsl: '160 84% 47%' },
  { id: 'red',     label: 'Red',     hex: '#ef4444', hsl: '0 91% 59%',   darkHsl: '0 91% 65%'   },
  { id: 'amber',   label: 'Amber',   hex: '#f59e0b', hsl: '38 92% 50%',  darkHsl: '38 92% 55%'  },
]

const _colorId = ref<string | null>(null)

function _inject(colorId: string) {
  if (!import.meta.client) return
  const color = ACCENT_COLORS.find(c => c.id === colorId)
  if (!color) return
  let el = document.getElementById('kc-accent') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'kc-accent'
    document.head.appendChild(el)
  }
  el.textContent = [
    `:root{--primary:${color.hsl};--primary-foreground:0 0% 100%;--ring:${color.hsl};--sidebar-primary:${color.hsl};--sidebar-primary-foreground:0 0% 100%}`,
    `.dark{--primary:${color.darkHsl};--primary-foreground:0 0% 100%;--ring:${color.darkHsl};--sidebar-primary:${color.darkHsl};--sidebar-primary-foreground:0 0% 100%}`,
  ].join('')
}

function _removeInject() {
  if (!import.meta.client) return
  document.getElementById('kc-accent')?.remove()
}

export function useAccentColor() {
  const supabase = useSupabase()

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    const id = user?.user_metadata?.accent_color as string | undefined
    if (id) {
      _colorId.value = id
      _inject(id)
    }
  }

  async function select(id: string) {
    _colorId.value = id
    _inject(id)
    await supabase.auth.updateUser({ data: { accent_color: id } })
  }

  async function clear() {
    _colorId.value = null
    _removeInject()
    await supabase.auth.updateUser({ data: { accent_color: null } })
  }

  return { colorId: readonly(_colorId), init, select, clear }
}
