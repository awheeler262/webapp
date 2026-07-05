import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC_DIR = join(import.meta.dirname, '..', '.output', 'public')
const OUT_FILE = join(import.meta.dirname, '..', '.output', 'csp-hashes.json')

function findHtmlFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...findHtmlFiles(full))
    } else if (entry.endsWith('.html')) {
      files.push(full)
    }
  }
  return files
}

function sha256(content) {
  return `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`
}

// Only tags a browser actually executes/applies count toward script-src/style-src:
// external <script src="..."> is already covered by 'self', and
// <script type="application/json"> data islands are never executed as script.
const scriptTagRe = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi
const styleTagRe = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi

// Nuxt's built-in 404/error page injects these via document.createElement() at
// runtime (Vite's modulepreload feature-detection script, and a UnoCSS reset style
// bundled with the error page component) — they never appear in the static HTML, so
// no amount of scanning this build's output can produce them. They're framework
// internals tied to the Nuxt/Vite version, not this app's code, so they're stable
// across our own deploys — but re-verify these two after any Nuxt/Vite upgrade
// (re-run this script's Playwright check against a 404 route and diff the hashes).
const KNOWN_FRAMEWORK_HASHES = {
  'script-src': ["'sha256-s+zA9mKyopxQu/Us+dc0tKhbE5VK02XMJVXvYdLRznA='"],
  'style-src': ["'sha256-WYQhhdXYfyRyeyXXSQd8eaSUXRB0j5KlIv3d61H+QCQ='"]
}

const scriptHashes = new Set(KNOWN_FRAMEWORK_HASHES['script-src'])
const styleHashes = new Set(KNOWN_FRAMEWORK_HASHES['style-src'])

for (const file of findHtmlFiles(PUBLIC_DIR)) {
  const html = readFileSync(file, 'utf8')

  for (const match of html.matchAll(scriptTagRe)) {
    const attrs = match[1] || ''
    const content = match[2]
    if (/\bsrc\s*=/i.test(attrs)) continue
    if (/type\s*=\s*["']application\/json["']/i.test(attrs)) continue
    if (!content.trim()) continue
    scriptHashes.add(sha256(content))
  }

  for (const match of html.matchAll(styleTagRe)) {
    const content = match[2]
    if (!content.trim()) continue
    styleHashes.add(sha256(content))
  }
}

const result = {
  'script-src': [...scriptHashes].sort(),
  'style-src': [...styleHashes].sort()
}

writeFileSync(OUT_FILE, JSON.stringify(result, null, 2))
console.log(`Wrote ${OUT_FILE}`)
console.log(JSON.stringify(result, null, 2))
