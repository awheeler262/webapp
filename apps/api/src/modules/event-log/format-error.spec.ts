import { ServiceUnavailableException } from '@nestjs/common';
import { formatError } from './format-error';

describe('formatError', () => {
  it('formats a plain Error as name: message', () => {
    expect(formatError(new Error('boom'))).toBe('Error: boom');
  });

  it('appends the cause chain', () => {
    const err = new ServiceUnavailableException(
      'Boost function invoke failed',
      {
        cause: new Error('connect ETIMEDOUT'),
      },
    );

    expect(formatError(err)).toBe(
      'ServiceUnavailableException: Boost function invoke failed <- Error: connect ETIMEDOUT',
    );
  });

  it('handles non-Error values', () => {
    expect(formatError('just a string')).toBe('just a string');
    expect(formatError({ code: 1 })).toBe('{"code":1}');
  });

  it('redacts connection URLs', () => {
    const err = new Error(
      'connect failed for postgres://user:secret@db.internal:5432/app',
    );

    const result = formatError(err);

    expect(result).toBe('Error: connect failed for [redacted-url]');
    expect(result).not.toContain('secret');
  });

  it('truncates very long messages', () => {
    const result = formatError(new Error('x'.repeat(5000)));

    expect(result.length).toBeLessThanOrEqual(2003);
    expect(result.endsWith('...')).toBe(true);
  });

  it('stops following a cyclic cause chain', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    a.cause = b;

    expect(formatError(a).split(' <- ')).toHaveLength(5);
  });
});
