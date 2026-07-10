// Single source of truth for the site's Content-Security-Policy. This used to only
// exist as a value typed into the CloudFront response-headers-policy console (see
// CLAUDE.md's note on aws.md) -- scripts/update-csp-policy.mjs now pushes the exact
// string this produces, so the real policy is reviewable and versioned here instead.
//
// connect-src is 'self' only: apps/web/app/plugins/api.ts always issues client-side
// fetches against a relative/same-origin baseURL (CloudFront routes /api/* same-origin
// in production; the Vite dev proxy does the same trick locally), so the browser never
// needs to reach the API's real origin directly.
export function buildCsp({ scriptSrcHashes, styleSrcHashes }) {
  const directives = {
    'default-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'script-src': ["'self'", ...scriptSrcHashes],
    'style-src': ["'self'", ...styleSrcHashes],
    'font-src': ["'self'", 'https://myceliumdreams.net/_fonts/'],
    'connect-src': ["'self'"],
    'img-src': ["'self'"],
    'frame-ancestors': ["'self'"],
    'form-action': ["'self'"]
  }

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ') + ';'
}
