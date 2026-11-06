// The host's theme, as Svelte state.
//
// WHY A WRAPPER AND NOT THE SDK DIRECTLY: `@easydev-org/ext-ui` is a plain module, because it has to be
// usable from a non-Svelte frame as well. Svelte 5 needs `$state` to re-render, and `onThemeChange` is
// a callback — so this file is the few lines that turn one into the other. Everything else about the
// theme (the two channels, the validation, the readiness announcement) is the SDK's.
//
// THE ONLY LOCAL DECISION: `theme.mode` is a getter over a `$state` box rather than a `$state` object,
// so callers keep reading `theme.mode` — every existing `theme.mode === 'dark'` in a `$derived` keeps
// working, and a dependency on it is still tracked.

import { currentTheme, onThemeChange, type ThemeMode } from '@easydev-org/ext-ui'

const mode = $state<{ current: ThemeMode }>({ current: currentTheme() })

/** The host's current theme. Reading `.mode` inside a `$derived` subscribes to it. */
export const theme = {
  get mode(): ThemeMode {
    return mode.current
  },
}

// ONE SUBSCRIPTION FOR THE PROCESS. `onThemeChange` fires immediately with the current value, so a
// module that loads late is not stuck on the default — and subscribing per component would mean N
// listeners for one document's theme.
//
// IT MUST NOT CALL `applyTheme`. The SDK already applies the palette to `<html>` when it receives a
// theme message, and `applyTheme` notifies every listener — so calling it from inside a listener
// re-enters this callback forever, and the panel dies on a stack overflow the first time the theme
// arrives. The only thing missing here is the Svelte side of the value.
onThemeChange(m => {
  mode.current = m
})
