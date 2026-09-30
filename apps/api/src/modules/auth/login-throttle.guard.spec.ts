import { ExecutionContext, HttpException } from '@nestjs/common';
import { LoginThrottleGuard } from './login-throttle.guard';
import { LoginAttemptsService } from './login-attempts.service';

function contextFor(request: {
  body?: unknown;
  ip?: string;
  socket?: { remoteAddress?: string };
}) {
  const req = {
    body: request.body ?? {},
    ip: request.ip,
    socket: request.socket ?? {},
  };
  const res = { setHeader: jest.fn() };
  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext,
    res,
  };
}

describe('LoginThrottleGuard', () => {
  let guard: LoginThrottleGuard;
  let loginAttempts: jest.Mocked<LoginAttemptsService>;

  beforeEach(() => {
    loginAttempts = {
      isBlocked: jest.fn(),
    } as unknown as jest.Mocked<LoginAttemptsService>;
    guard = new LoginThrottleGuard(loginAttempts);
  });

  it('allows the request through when under threshold', async () => {
    loginAttempts.isBlocked.mockResolvedValue(false);
    const { context } = contextFor({
      body: { email: 'a@b.com' },
      ip: '203.0.113.1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(loginAttempts.isBlocked).toHaveBeenCalledWith(
      'a@b.com',
      '203.0.113.1',
    );
  });

  it('throws a 429 with Retry-After when over threshold', async () => {
    loginAttempts.isBlocked.mockResolvedValue(true);
    const { context, res } = contextFor({
      body: { email: 'a@b.com' },
      ip: '203.0.113.1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '900');
  });

  it('passes null for email when the body has no usable email, but still checks the IP dimension', async () => {
    loginAttempts.isBlocked.mockResolvedValue(false);
    const { context } = contextFor({
      body: { email: 12345 },
      ip: '203.0.113.1',
    });

    await guard.canActivate(context);

    expect(loginAttempts.isBlocked).toHaveBeenCalledWith(null, '203.0.113.1');
  });

  it('falls back to the socket remote address when req.ip is unset', async () => {
    loginAttempts.isBlocked.mockResolvedValue(false);
    const { context } = contextFor({
      body: { email: 'a@b.com' },
      socket: { remoteAddress: '198.51.100.7' },
    });

    await guard.canActivate(context);

    expect(loginAttempts.isBlocked).toHaveBeenCalledWith(
      'a@b.com',
      '198.51.100.7',
    );
  });
});
