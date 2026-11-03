import { mount } from 'svelte'
import App from './App.svelte'
// The palette, spacing, type scale and element defaults come from the shared package, so this panel
// and the console cannot disagree about `--primary`. `./theme.css` after it holds only what is this
// panel's own: how `#app` fills the page.
import '@easydev-org/ext-ui/styles'
import './theme.css'

mount(App, { target: document.getElementById('app')! })
