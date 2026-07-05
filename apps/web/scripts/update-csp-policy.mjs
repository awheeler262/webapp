import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const POLICY_NAME = process.env.CLOUDFRONT_RESPONSE_HEADERS_POLICY_NAME || 'webapp-response-headers'
const HASHES_FILE = join(import.meta.dirname, '..', '.output', 'csp-hashes.json')

function aws(args) {
  return JSON.parse(execFileSync('aws', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }))
}

function replaceDirectiveSources(csp, directive, hashes) {
  const parts = csp.split(';').map(p => p.trim()).filter(Boolean)
  let found = false
  const updated = parts.map(part => {
    const [name, ...values] = part.split(/\s+/)
    if (name !== directive) return part
    found = true
    const kept = values.filter(v => v !== "'unsafe-inline'")
    return [name, ...kept, ...hashes].join(' ')
  })
  if (!found) updated.push([directive, "'self'", ...hashes].join(' '))
  return updated.join('; ') + ';'
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

let csp = cspConfig.ContentSecurityPolicy
csp = replaceDirectiveSources(csp, 'script-src', hashes['script-src'])
csp = replaceDirectiveSources(csp, 'style-src', hashes['style-src'])
cspConfig.ContentSecurityPolicy = csp

const tmpDir = mkdtempSync(join(tmpdir(), 'csp-policy-'))
const configFile = join(tmpDir, 'response-headers-policy-config.json')
writeFileSync(configFile, JSON.stringify(config))

execFileSync('aws', [
  'cloudfront', 'update-response-headers-policy',
  '--id', policyId,
  '--if-match', etag,
  '--response-headers-policy-config', `file://${configFile}`
], { stdio: 'inherit' })

console.log(`Updated CloudFront response headers policy "${POLICY_NAME}" (${policyId}) with:`)
console.log(csp)
