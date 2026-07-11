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
// have never been configured (e.g. XSSProtection, FrameOptions) as either `null`
// or an empty `{}` (CloudFront's API is XML-derived under the hood, and an unset
// nested struct can come back as an empty element rather than an absent one).
// update-response-headers-policy's param validator rejects both -- it wants the
// block fully populated or the key absent entirely -- so round-tripping the GET
// response straight into UPDATE fails on any policy that doesn't configure every
// optional block. Pruning both forms restores "absent", matching what was
// actually live before this script touched it.
function pruneUnset(value) {
  if (Array.isArray(value)) return value.map(pruneUnset)
  if (value !== null && typeof value === 'object') {
    const result = {}
    for (const [key, val] of Object.entries(value)) {
      if (val === null) continue
      const cleaned = pruneUnset(val)
      const isEmptyObject = cleaned !== null && typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0
      if (isEmptyObject) continue
      result[key] = cleaned
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

// Temporary diagnostic -- if update-response-headers-policy still rejects the
// payload after pruneUnset, this shows exactly what shape SecurityHeadersConfig's
// unconfigured blocks actually have in this account, instead of guessing again.
console.log('SecurityHeadersConfig as fetched:', JSON.stringify(config.SecurityHeadersConfig))

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
const cleanConfig = pruneUnset(config)
console.log('SecurityHeadersConfig after pruning:', JSON.stringify(cleanConfig.SecurityHeadersConfig))
writeFileSync(configFile, JSON.stringify(cleanConfig))

execFileSync('aws', [
  'cloudfront', 'update-response-headers-policy',
  '--id', policyId,
  '--if-match', etag,
  '--response-headers-policy-config', `file://${configFile}`
], { stdio: 'inherit' })

console.log(`Updated CloudFront response headers policy "${POLICY_NAME}" (${policyId}) with:`)
console.log(csp)
