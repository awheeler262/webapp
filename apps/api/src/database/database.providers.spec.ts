import { isConnectivityError } from './database.providers';

describe('isConnectivityError', () => {
  it('recognizes a raw Node connection-refused error', () => {
    expect(isConnectivityError({ code: 'ECONNREFUSED' })).toBe(true);
  });

  it('recognizes a raw Node connection-timed-out error', () => {
    expect(isConnectivityError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('recognizes a TypeORM QueryFailedError wrapping a driver connectivity error', () => {
    expect(isConnectivityError({ driverError: { code: 'ECONNRESET' } })).toBe(
      true,
    );
  });

  it('recognizes a Postgres SQLSTATE class 08 (connection exception) code', () => {
    expect(isConnectivityError({ code: '08006' })).toBe(true);
  });

  it('does not misreport a Postgres unique-constraint violation as connectivity', () => {
    expect(isConnectivityError({ code: '23505' })).toBe(false);
  });

  it('does not misreport a plain Error with no code', () => {
    expect(isConnectivityError(new Error('something else went wrong'))).toBe(
      false,
    );
  });

  it('does not throw on non-object input', () => {
    expect(isConnectivityError(null)).toBe(false);
    expect(isConnectivityError(undefined)).toBe(false);
    expect(isConnectivityError('a string')).toBe(false);
  });
});
