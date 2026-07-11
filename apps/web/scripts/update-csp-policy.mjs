import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCsp } from '../csp-policy.mjs'

const POLICY_NAME = process.env.CLOUDFRONT_RESPONSE_HEADERS_POLICY_NAME || 'webapp-response-headers'
const HASHES_FILE = join(import.meta.dirname, '..', '.output', 'csp-hashes.json')

function aws(args) {
  return JSON.parse(execFileSync('aws', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }))
}

// get-response-headers-policy represents optional security-header blocks that
// have never been configured (e.g. XSSProtection, FrameOptions) as `null` rather
// than omitting the key. update-response-headers-policy's param validator rejects
// `null` there -- it wants the block fully populated or absent -- so round-tripping
// the GET response straight into UPDATE fails on any policy that doesn't configure
// every optional block. Stripping nulls restores "absent", matching what was
// actually live before this script touched it.
function stripNulls(value) {
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value !== null && typeof value === 'object') {
    const result = {}
    for (const [key, val] of Object.entries(value)) {
      if (val === null) continue
      result[key] = stripNulls(val)
    }
    return result
  }
  return value
}

const hashes = JSON.parse(readFileSync(HASHES_FILE, 'utf8'))

const listing = aws(['cloudfront', 'list-response-headers-policies', '--type', 'custom'])
const match = listing.ResponseHeadersPolicyList.Items.find(
  item => item.ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name === POLICY_NAME
)
if (!match) {
  throw new Error(`No CloudFront response headers policy named "${POLICY_NAME}" found`)
}
const policyId = match.ResponseHeadersPolicy.Id

const current = aws(['cloudfront', 'get-response-headers-policy', '--id', policyId])
const etag = current.ETag
const config = current.ResponseHeadersPolicy.ResponseHeadersPolicyConfig

const cspConfig = config.SecurityHeadersConfig?.ContentSecurityPolicy
if (!cspConfig) {
  throw new Error(`Policy "${POLICY_NAME}" has no SecurityHeadersConfig.ContentSecurityPolicy to update`)
}

// Full overwrite -- csp-policy.mjs is the only source of truth for the policy's
// content now, not whatever happens to already be live on this CloudFront policy.
const csp = buildCsp({
  scriptSrcHashes: hashes['script-src'],
  styleSrcHashes: hashes['style-src']
})
cspConfig.ContentSecurityPolicy = csp

const tmpDir = mkdtempSync(join(tmpdir(), 'csp-policy-'))
const configFile = join(tmpDir, 'response-headers-policy-config.json')
writeFileSync(configFile, JSON.stringify(stripNulls(config)))

execFileSync('aws', [
  'cloudfront', 'update-response-headers-policy',
  '--id', policyId,
  '--if-match', etag,
  '--response-headers-policy-config', `file://${configFile}`
], { stdio: 'inherit' })

console.log(`Updated CloudFront response headers policy "${POLICY_NAME}" (${policyId}) with:`)
console.log(csp)
