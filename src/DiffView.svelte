<script lang="ts">
  // One unified diff, rendered as a diff rather than as text that happens to contain `+` and `-`.
  //
  // WHY THIS EXISTS: every place that showed a diff showed `{patch}` inside a `<pre>`. A unified diff
  // is a FORMAT — the leading character of each line is a TYPE — and printing it verbatim throws that
  // away: an added line and a removed line look the same, so the reader has to parse `+`/`-` per line
  // and trust their eyes across a scroll. Colour and a gutter make the shape of the change visible
  // before any of it is read.
  //
  // NO SHIKI HERE, deliberately. A patch's lines are fragments of a file, not a file: highlighting
  // each hunk would need the surrounding context to tokenise correctly, and every one of those lines
  // is already carrying the colour that matters — the one that says whether it exists in the result.
  // Stacking syntax colours on a green background makes neither readable.

  let {
    patch,
    /** Cap the height, in CSS pixels. 0 means "as tall as the content". */
    maxHeight = 0,
  }: {
    patch: string
    maxHeight?: number
  } = $props()

  type Kind = 'add' | 'del' | 'ctx' | 'hunk' | 'meta'

  interface Row {
    kind: Kind
    /** The line's digit gutter: from the hunk header, or synthesized when the patch has none. */
    oldNo: string
    newNo: string
    text: string
  }

  /**
   * Split a unified diff into rows, tracking both line numbers as they advance.
   *
   * THE HUNK HEADER IS THE ONLY PLACE THE NUMBERS COME FROM — `@@ -a,b +c,d @@` — so a hunk that
   * starts at line 400 is numbered from 400. A patch with no header at all (some tools send a bare
   * fragment) falls back to counting from 1 rather than showing a column of nothing.
   */
  const rows = $derived.by((): Row[] => {
    const out: Row[] = []
    const lines = patch.replace(/\n$/, '').split('\n')

    let oldNo = 0
    let newNo = 0
    let counted = false

    for (const line of lines) {
      const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (hunk) {
        oldNo = Number(hunk[1])
        newNo = Number(hunk[2])
        counted = true
        out.push({ kind: 'hunk', oldNo: '', newNo: '', text: line })
        continue
      }

      // The file headers git writes before the first hunk. Styled as metadata, not as content: they
      // are the tool's framing, not part of the change.
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ') ||
        line.startsWith('new file') ||
        line.startsWith('deleted file') ||
        line.startsWith('old mode') ||
        line.startsWith('new mode') ||
        line.startsWith('similarity index') ||
        line.startsWith('rename ') ||
        line.startsWith('\\ No newline')
      ) {
        out.push({ kind: 'meta', oldNo: '', newNo: '', text: line })
        continue
      }

      // A BARE FRAGMENT has no hunk header, so there are no numbers to show. Count from 1 so the
      // gutter is at least a guide, but do not pretend it is the file's real numbering.
      if (!counted) {
        oldNo += 1
        newNo += 1
        const kind: Kind = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx'
        out.push({
          kind,
          oldNo: kind === 'add' ? '' : String(oldNo - 1),
          newNo: kind === 'del' ? '' : String(newNo - 1),
          text: line,
        })
        continue
      }

      // `\ No newline at end of file` follows the line it belongs to and gets no number of its own.
      if (line.startsWith('\\')) {
        out.push({ kind: 'meta', oldNo: '', newNo: '', text: line })
        continue
      }

      if (line.startsWith('+')) {
        out.push({ kind: 'add', oldNo: '', newNo: String(newNo), text: line.slice(1) })
        newNo += 1
      } else if (line.startsWith('-')) {
        out.push({ kind: 'del', oldNo: String(oldNo), newNo: '', text: line.slice(1) })
        oldNo += 1
      } else {
        // A context line starts with a space; some tools strip it, so anything else that is not a
        // `+`/`-` is treated as context rather than dropped.
        const text = line.startsWith(' ') ? line.slice(1) : line
        out.push({ kind: 'ctx', oldNo: String(oldNo), newNo: String(newNo), text })
        oldNo += 1
        newNo += 1
      }
    }
    return out
  })

  /** The widest number either side will need, so the two gutters line up. */
  const gutter = $derived(
    `${Math.max(
      2,
      ...rows.map(r => r.oldNo.length),
      ...rows.map(r => r.newNo.length),
    )}ch`,
  )

  const adds = $derived(rows.filter(r => r.kind === 'add').length)
  const dels = $derived(rows.filter(r => r.kind === 'del').length)
</script>

<div class="diffbox" style={maxHeight > 0 ? `max-height:${maxHeight}px` : ''}>
  {#each rows as r, i (i)}
    {#if r.kind === 'hunk'}
      <!-- The hunk header keeps its `@@` framing but is not a line of the file, so it spans the
           gutters instead of being numbered by them. -->
      <div class="row hunk"><span class="mark"></span><span class="text">{r.text}</span></div>
    {:else if r.kind === 'meta'}
      <div class="row meta"><span class="mark"></span><span class="text">{r.text}</span></div>
    {:else}
      <div class="row {r.kind}">
        <span class="no" style={`min-width:${gutter}`}>{r.oldNo}</span>
        <span class="no" style={`min-width:${gutter}`}>{r.newNo}</span>
        <!-- The sign is the NON-COLOUR channel: it survives a monochrome palette and a reader who
             cannot distinguish the two background hues. -->
        <span class="mark">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</span>
        <span class="text">{r.text}</span>
      </div>
    {/if}
  {/each}
</div>

{#if adds > 0 || dels > 0}
  <div class="summary muted"><span class="adds">+{adds}</span> <span class="dels">−{dels}</span></div>
{/if}

<style>
  .diffbox {
    overflow: auto;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-family: 'NotoSansMono', ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.5;
    tab-size: 4;
  }
  .row {
    display: flex;
    align-items: baseline;
    white-space: pre;
    /* A line is as wide as its content; the box scrolls sideways. */
    min-width: max-content;
  }
  .no {
    flex: 0 0 auto;
    padding: 0 0.5em;
    text-align: right;
    color: var(--muted-foreground);
    opacity: 0.5;
    user-select: none;
    /* A hairline between the two number columns, so a reader can tell which one they are in. */
    border-right: 1px solid var(--border);
  }
  .mark {
    flex: 0 0 auto;
    width: 1.5em;
    text-align: center;
    user-select: none;
  }
  .text {
    flex: 1 1 auto;
    padding-right: var(--sp-sm);
  }

  /* THE COLOURS. Backgrounds, not just foregrounds, because a line is a span of the page and the eye
     locates it faster than it reads a glyph. Both are low-contrast so the text on top stays legible
     in either theme: a saturated green with black text is unreadable. */
  .row.add { background: color-mix(in srgb, var(--success, #1a7f37) 12%, transparent); }
  .row.add .mark { color: var(--success, #1a7f37); }
  .row.del { background: color-mix(in srgb, var(--destructive, #cf222e) 12%, transparent); }
  .row.del .mark { color: var(--destructive, #cf222e); }

  .row.hunk {
    background: color-mix(in srgb, var(--primary, #0969da) 8%, transparent);
    color: var(--muted-foreground);
    padding: 2px 0;
    margin-top: 2px;
  }
  .row.hunk .text { padding-left: 0.5em; }

  .row.meta {
    color: var(--muted-foreground);
    opacity: 0.75;
  }
  .row.meta .text { padding-left: 0.5em; }

  .summary {
    padding: 2px 0 0;
    font-size: var(--text-micro, 10px);
  }
  .adds { color: var(--success, #1a7f37); }
  .dels { color: var(--destructive, #cf222e); }
</style>
