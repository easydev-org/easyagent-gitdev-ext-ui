<script lang="ts">
  // A boxed, numbered, syntax-highlighted view of one piece of source.
  //
  // WHY THIS IS A COMPONENT AND NOT A `<pre>`: two places render source — the full view's file page
  // (CodePane) and the tool card (ToolCard) — and they must agree. They did not: CodePane went through
  // Shiki and ToolCard printed `payload.output` into a bare `<pre>`, so the same file was highlighted
  // in one place and grey in the other, while a comment in ToolCard claimed it was "line-numbered".
  //
  // THE FALLBACK IS NOT A FAILURE MODE, it is the first frame. Shiki ships a grammar per language and
  // they are hundreds of KB, so the engine is loaded on first use (see highlight.ts) — that is a round
  // trip. Until it lands, and forever for a language we have no grammar for, the content is drawn with
  // line numbers done by hand. Doing it this way keeps the height stable instead of jumping when the
  // highlight arrives, which matters twice over in a card: it is measured by its host.
  import { highlight, langOf } from './highlight'
  import { theme } from './theme.svelte'

  let {
    code,
    /** A file path, for language detection, or an explicit Shiki id. */
    lang = '',
    /** Wrap long lines instead of scrolling sideways. Cards want this; a file page does not. */
    wrap = false,
    /** Cap the height, in CSS pixels. 0 means "as tall as the content". */
    maxHeight = 0,
  }: {
    code: string
    lang?: string
    wrap?: boolean
    maxHeight?: number
  } = $props()

  /** The Shiki language id: an explicit one wins, otherwise infer from the path. */
  const language = $derived(lang.includes('/') || lang.includes('.') ? langOf(lang) : lang)

  let html = $state<string | null>(null)

  // Re-render on every change of code, language or theme. `theme.mode` is a dependency on purpose:
  // Shiki bakes colours INTO the HTML, so a theme switch has to re-render rather than restyle.
  $effect(() => {
    const src = code
    const l = language
    const dark = theme.mode === 'dark'
    html = null
    if (src === '') return

    let stale = false
    void highlight(src, l, dark).then(out => {
      // Guard against a slow render for content the reader has already scrolled past: without this
      // the PREVIOUS highlight can land after the new one and overwrite it.
      if (stale) return
      html = out
    })
    return () => {
      stale = true
    }
  })

  /** Lines for the unhighlighted fallback, split without inventing a trailing empty line. */
  const plainLines = $derived(code.replace(/\n$/, '').split('\n'))

  /** The gutter width, so the numbers line up whatever the file's length. */
  const gutter = $derived(`${String(plainLines.length).length}ch`)
</script>

<div
  class="codebox"
  class:wrap
  style={maxHeight > 0 ? `max-height:${maxHeight}px` : ''}
>
  {#if html}
    <!-- Shiki escapes the source, so this is not an injection point for file content. It is the only
         consumer of `{@html}` in this app. -->
    <div class="shiki">{@html html}</div>
  {:else}
    <div class="plain">
      {#each plainLines as line, i}
        <div class="plain-line">
          <span class="plain-n" style={`min-width:${gutter}`}>{i + 1}</span><span class="plain-t"
            >{line}</span
          >
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* THE BOX. One frame for every file, highlighted or not: it is what says "this is a file, not the
     page", gives the content an edge to scroll against, and gives a reader somewhere to select from
     without dragging across the layout. */
  .codebox {
    position: relative;
    min-height: 0;
    overflow: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  /* Shiki emits its own `<pre class="shiki">` with inline colours and, via the line-number
     transformer, a gutter of numbered spans. These rules only fit it into the box: the box owns the
     border and the scroll, so the pre must not draw a second one. */
  .shiki :global(pre.shiki) {
    margin: 0;
    padding: var(--sp-sm) var(--sp-sm) var(--sp-sm) 0;
    background: none;
    border: 0;
    font-family: 'NotoSansMono', ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.45;
    tab-size: 4;
  }
  /* The gutter. The transformer emits a real `<span class="line-number">` at the start of each line,
     so the styling targets it rather than a ::before with a data attribute. Right-aligned so the
     numbers form a column, dimmed so they are findable but not read, and unselectable so a copy of
     the file does not begin with a column of digits. */
  .shiki :global(pre.shiki .line-number) {
    display: inline-block;
    min-width: 3.5em;
    padding-right: 0.8em;
    text-align: right;
    color: var(--muted-foreground);
    opacity: 0.55;
    user-select: none;
  }

  /* The unhighlighted fallback: numbered by hand so the content does not jump when Shiki lands. */
  .plain {
    padding: var(--sp-sm) 0;
    font-family: 'NotoSansMono', ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.45;
    tab-size: 4;
  }
  .plain-line {
    display: flex;
    white-space: pre;
  }
  .wrap .plain-line {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .plain-n {
    flex: 0 0 auto;
    padding-right: 0.8em;
    text-align: right;
    color: var(--muted-foreground);
    opacity: 0.6;
    user-select: none;
  }
  .plain-t {
    flex: 1 1 auto;
    min-width: 0;
    padding-right: var(--sp-sm);
  }

  /* Wrapping, for a card a few hundred pixels wide. A horizontal scrollbar inside a card that itself
     scrolls vertically is a control the reader has to hunt for. */
  .wrap .shiki :global(pre.shiki) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
