import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Traps Tab focus inside `ref` while `active`, and restores focus to the
// previously-focused element on deactivate. Respects an existing autoFocus
// inside the container (won't steal it). Escape is left to the caller.
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)

    // Only move focus in if it isn't already inside (preserves autoFocus).
    if (!node.contains(document.activeElement)) {
      (focusables()[0] ?? node).focus?.()
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const f = focusables()
      if (f.length === 0) { e.preventDefault(); return }
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    node.addEventListener('keydown', onKey)
    return () => {
      node.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [active, ref])
}
