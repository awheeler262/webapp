import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DevopsGuard } from './devops.guard';

function contextWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('DevopsGuard', () => {
  let guard: DevopsGuard;

  beforeEach(() => {
    guard = new DevopsGuard();
  });

  it('allows a request from a devops user', () => {
    expect(guard.canActivate(contextWithUser({ isDevops: true }))).toBe(true);
  });

  it('throws ForbiddenException for a non-devops user', () => {
    expect(() =>
      guard.canActivate(contextWithUser({ isDevops: false })),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user on the request', () => {
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
