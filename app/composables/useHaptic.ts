// Haptic feedback for the mobile (PWA) screens.
//
// - Android / Chrome: Vibration API with a pattern per feedback type.
// - iOS Safari (18+): no Vibration API, but toggling a native `<input type="checkbox" switch>`
//   plays the system haptic tick. We keep one hidden switch and click its label.
//   iOS only plays it inside a user gesture (tap handlers) — async feedback stays silent there.
// - Everything else: no-op.

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error'

const VIBRATE: Record<HapticType, number | number[]> = {
  selection: 5,
  light: 8,
  medium: 15,
  heavy: 25,
  success: [10, 60, 14],
  warning: [20, 80, 20],
  error: [30, 50, 30, 50, 30],
}

// Number of iOS ticks per type (each tick is the same light system haptic)
const IOS_TICKS: Record<HapticType, number> = {
  selection: 1, light: 1, medium: 1, heavy: 1, success: 2, warning: 2, error: 3,
}

let iosSwitch: HTMLLabelElement | null = null

function isIOS() {
  return /iP(hone|od|ad)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function iosTick() {
  if (!iosSwitch) {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    iosSwitch = document.createElement('label')
    iosSwitch.setAttribute('aria-hidden', 'true')
    iosSwitch.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden'
    iosSwitch.appendChild(input)
    document.body.appendChild(iosSwitch)
  }
  iosSwitch.click()
}

export function haptic(type: HapticType | Event = 'light') {
  if (import.meta.server) return
  // Allows `@click="haptic"` in templates (receives the event) — treat as a light tap
  if (typeof type !== 'string' || !(type in VIBRATE)) type = 'light'
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(VIBRATE[type])
      return
    }
    if (isIOS()) {
      const ticks = IOS_TICKS[type]
      iosTick()
      for (let i = 1; i < ticks; i++) setTimeout(iosTick, i * 90)
    }
  } catch {
    // Haptics are best-effort
  }
}
