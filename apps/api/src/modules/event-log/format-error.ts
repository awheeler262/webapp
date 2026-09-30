// event_log.error is for troubleshooting, so it deliberately keeps internal
// detail the HTTP response hides -- but a full stack trace is left to
// CloudWatch, and the two things most likely to leak a secret are scrubbed.
const MAX_LENGTH = 2000;
const MAX_CAUSE_DEPTH = 5;

const CONNECTION_URL = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;

function messageOf(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
}

// The exception's message followed by each `cause` message (oldest last),
// e.g. "ServiceUnavailableException: Boost function invoke failed <- Error:
// ...". HttpExceptions built with { cause } carry the real detail there, since
// their own message is what the client sees.
export function formatError(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < MAX_CAUSE_DEPTH && current !== undefined; i++) {
    parts.push(messageOf(current));
    current = current instanceof Error ? current.cause : undefined;
  }
  const text = parts.join(' <- ').replace(CONNECTION_URL, '[redacted-url]');
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}...` : text;
}
