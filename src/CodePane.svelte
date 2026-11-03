<script lang="ts">
  // One file as SOURCE, in a box.
  //
  // NOTHING IS RENDERED, Markdown included. This is a VIEWER of what is in the repository: a README
  // shows its `#` and its pipes because those are the bytes, and a reader looking at a file wants to
  // see the file. Rendering it turns a check of "what does the commit contain" into a display of
  // "what would this look like", which is a different question and answers none of the edits.
  //
  // THE HIGHLIGHTING AND THE GUTTER LIVE IN CodeView, so the card and this page cannot disagree about
  // either. This file keeps only what is unique to the page: the header and the back button.
  import CodeView from './CodeView.svelte'

  let {
    file,
    onback = null,
  }: {
    file: { path: string; size: number; binary?: boolean; content?: string } | null
    // Present on a narrow screen, where the file list and the file are separate pages.
    onback?: (() => void) | null
  } = $props()
</script>

{#if !file}
  <div class="state muted">Select a file.</div>
{:else}
  <div class="head">
    {#if onback}
      <button class="back" onclick={onback} aria-label="back to files">←</button>
    {/if}
    <span class="mono path">{file.path}</span>
    <span class="muted t-meta">{file.size} B</span>
  </div>

  {#if file.binary}
    <!-- A repository holds images and archives; rendering their bytes as text would be megabytes of
         replacement characters and no information. -->
    <div class="state muted">Binary file — not shown.</div>
  {:else if file.content == null}
    <div class="state muted">No content.</div>
  {:else}
    <CodeView code={file.content} lang={file.path} />
  {/if}
{/if}

<style>
  .head {
    display: flex;
    gap: var(--sp-sm);
    align-items: center;
    padding-bottom: var(--sp-sm);
    min-width: 0;
  }
  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .back {
    font: inherit;
    color: var(--primary);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }
  .back:hover {
    background: var(--secondary);
  }
  .state {
    padding: var(--sp-xl);
    text-align: center;
  }
</style>
