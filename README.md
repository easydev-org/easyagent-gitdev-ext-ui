# easyagent-gitdev-ext-ui

The gitdev extension's panel: browse the mirror, read pull requests, follow CI runs.

**A separate project, deployed separately.** It was `ui/` inside the extension's Go repository; it
lives here now because the two have different release cadences and different toolchains, and neither
needs the other's build.

## The contract

`proto/ui/v1/ui.proto` defines the API. The Go backend generates its server from the same file, and
`src/gen/` here is generated from it — so a field the panel reads but the server does not send is a
compile error rather than an empty page. That is not hypothetical: two hand-written JSON routes
disagreed with what the panel read (`Path` vs `path`), and the file tree rendered empty against data
that was correct and present.

`proto/ui/v1/ui.proto` is a **copy** of the backend's. CI compares it with the backend on every push and
on a nightly schedule, and opens a pull request when they differ. A drifted copy is the failure the
whole arrangement exists to remove, so it is verified rather than trusted.

## Development

```sh
npm install
cd proto && buf generate && cd ..   # regenerate src/gen from the proto
npm run check                       # svelte-check
npm run build                       # emits dist/, which the extension embeds
```

Running `npm run dev` in a browser works standalone: without a host frame, requests go straight to the
same origin, so a broken page is debuggable without the console.

## How it is served

The extension's Go binary embeds `dist/` and serves it under `/ext/gitdev/`, which the console
reverse-proxies — so an iframe embedding the panel is **same-origin** with the console, and the bearer
token is the one already in `localStorage`. No token ever travels in a URL.
