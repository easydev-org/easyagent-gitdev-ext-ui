// The typed client for this extension's own API.
//
// THE CONTRACT IS A .PROTO FILE, SHARED WITH THE GO BACKEND. What this replaces was a set of
// hand-written JSON calls whose response shapes were `map[string]any` literals on the server — so the
// panel's contract was a side effect of whatever the handler happened to emit, and twice it disagreed
// with what the panel read (`Path` vs `path`), which rendered an EMPTY file tree against data that was
// correct and present.
//
// Now a field the panel reads but the server does not send is a compile error in one repository and a
// test failure in the other, rather than an empty page nobody can explain.

import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

// THE SERVICE DESCRIPTOR COMES FROM ui_pb.ts, not ui_connect.ts. protoc-gen-es v2 emits the service
// alongside its messages, and protoc-gen-connect-es's output is the older object-literal shape that
// createClient's DescService constraint rejects.
import { UiService } from './gen/ui/v1/ui_pb.js'

// Requests carry the host's bearer token, read from localStorage.
//
// WHY THIS AND NOT THE postMessage BRIDGE: this UI is served from /ext/<id>/ behind the host's own
// reverse proxy, so it is SAME-ORIGIN with the host — and same-origin documents share localStorage.
// The host already keeps its token there (`agent.token`), so this UI can read it directly.
//
// The trust boundary is unchanged in the way that matters: the token is never put in a URL, and the
// server still resolves the tenant FROM the token, so a client cannot name its own tenant.
const TOKEN_KEY = 'agent.token'

/**
 * Where the API lives, derived from where this document is MOUNTED.
 *
 * A relative path resolves against the current URL, and this UI is opened at `/ext/gitdev/#/ws/...` —
 * the directory part is right by luck, and the same code served from `/ext/gitdev` with no trailing
 * slash would resolve to `/ext/api/...` and 404. Taking the mount point from the document URL removes
 * the guess.
 *
 * THE `api/` SEGMENT IS NOT DECORATION: the extension's HTTP surface serves the SPA bundle for
 * everything under its base, and `/api` is the one prefix it hands to the handlers instead. A Connect
 * procedure path has no file extension, so without this prefix the SPA fallback would answer it with
 * index.html and the client would fail parsing HTML as protobuf, with no failing URL to point at.
 */
const API_BASE = (() => {
  const p = location.pathname.replace(/\/+$/, '') // /ext/gitdev
  return `${p}/api`
})()

function bearer(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    // A sandboxed frame without allow-same-origin throws on access. Report it as "no token" so the
    // API answers 401 with a message, rather than crashing the whole panel on load.
    return ''
  }
}

const transport = createConnectTransport({
  baseUrl: API_BASE,
  // Read at CALL time, not at construction: a re-login in the host changes the stored token, and a
  // client that captured it once would keep presenting the old one until the panel was reloaded.
  interceptors: [
    next => async req => {
      const tok = bearer()
      if (tok !== '') req.header.set('Authorization', `Bearer ${tok}`)
      return next(req)
    },
  ],
})

export const client = createClient(UiService, transport)
