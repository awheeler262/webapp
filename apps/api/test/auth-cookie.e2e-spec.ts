import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureCookies } from './../src/app.config';
import { CognitoService } from './../src/modules/auth/cognito.service';
import { DATA_SOURCE } from './../src/database/database.module';
import { cleanupTestUser } from './utils/cleanup-test-user';

describe('Auth cookie flow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const email = `auth-cookie-e2e-${Date.now()}@example.com`;
  const password = 'plaintext-password-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureCookies(app);
    await app.init();

    dataSource = app.get(DATA_SOURCE);
    await app.get(CognitoService).createIdentity({
      email,
      name: 'Auth Cookie E2E',
      passwordPlain: password,
    });
  });

  afterAll(async () => {
    await cleanupTestUser(dataSource, email, app);
  });

  it('login sets an httpOnly, secure, sameSite=lax auth_token cookie and returns no token in the body', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body).toEqual({
      user: { id: expect.any(String), email },
      expiresAt: expect.any(Number),
      tenants: [],
    });
    expect(res.body).not.toHaveProperty('accessToken');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toBeDefined();
    const authCookie = setCookie.find((c) => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();
    expect(authCookie!.toLowerCase()).toContain('httponly');
    expect(authCookie!.toLowerCase()).toContain('secure');
    expect(authCookie!.toLowerCase()).toContain('samesite=lax');
  });

  it('/auth/me works with the cookie from login and 401s without one', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const setCookie = (
      loginRes.headers['set-cookie'] as unknown as string[]
    ).find((c) => c.startsWith('auth_token='))!;
    // The request Cookie header only takes name=value pairs -- strip the
    // Path/HttpOnly/Secure/SameSite/Expires attributes Set-Cookie appends.
    const cookie = setCookie.split(';')[0];

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', [cookie])
      .expect(200);
    // /me's user comes from UsersService.findById() (the full record), unlike
    // login()'s response which only carries the minimal {id, email} it signed.
    expect(meRes.body).toEqual({
      user: {
        id: expect.any(String),
        email,
        name: 'Auth Cookie E2E',
        createdAt: expect.any(String),
      },
      expiresAt: expect.any(Number),
    });

    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('logout clears the cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .expect(200);

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const authCookie = setCookie.find((c) => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();
    // Express's res.clearCookie() sets an already-expired Max-Age/Expires so the
    // browser drops it -- confirm the cookie value is emptied out, not just resent.
    expect(authCookie).toMatch(/^auth_token=;/);
  });
});
