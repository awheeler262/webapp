import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The bundle is a public trust anchor, not a secret -- what matters is that it
// only ever changes on purpose, since swapping it would change who the database
// connection trusts. To update it: re-download from
// https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem,
// review the certificates it contains, and update the hash below in the same
// commit. (A reviewer must still check that commit -- this only catches
// accidental or silent changes.)
const EXPECTED_SHA256 =
  'b1711d12bae51838581281e23b6cb97b1074016873b4dafc80ed14002462dd77';

describe('RDS CA bundle', () => {
  const pem = readFileSync(join(__dirname, 'us-east-1-bundle.pem'), 'utf8');

  it('matches the pinned SHA-256 (line endings normalized for Windows checkouts)', () => {
    const normalized = pem.replace(/\r\n/g, '\n');

    expect(createHash('sha256').update(normalized).digest('hex')).toBe(
      EXPECTED_SHA256,
    );
  });

  it('contains certificates', () => {
    expect(pem.match(/BEGIN CERTIFICATE/g)?.length).toBeGreaterThan(0);
  });
});
