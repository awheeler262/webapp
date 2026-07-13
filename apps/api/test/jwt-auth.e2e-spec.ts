import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureCookies } from './../src/app.config';
import { JwtAuthGuard } from './../src/modules/auth/jwt-auth.guard';
import { UsersService } from './../src/modules/users/users.service';
import { User } from './../src/modules/users/entities/user.entity';
import { DATA_SOURCE } from './../src/database/database.module';

// Temporary until the app has actual endpoint to guard.
@Controller('test-protected')
class TestProtectedController {
  @Get()
  @UseGuards(JwtAuthGuard)
  get() {
    return { ok: true };
  }
}

describe('JwtAuthGuard (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let usersService: UsersService;
  let dataSource: DataSource;
  let realUserId: string;
  const email = `jwt-e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestProtectedController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureCookies(app);
    await app.init();

    jwtService = app.get(JwtService);
    usersService = app.get(UsersService);
    dataSource = app.get(DATA_SOURCE);

    const user = await usersService.create({
      email,
      name: 'JWT E2E',
      password: 'plaintext-password-123',
    } as any);
    realUserId = user.id;
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ email });
    await app.close();
    // AppDataSource is a manually-provided value, not a TypeOrmModule-managed
    // connection -- app.close() doesn't know to tear it down, so the open pg
    // pool would otherwise keep this Jest worker from exiting cleanly.
    await dataSource.destroy();
  });

  it('rejects a request with no auth_token cookie', () => {
    return request(app.getHttpServer()).get('/test-protected').expect(401);
  });

  it('rejects a request with an expired token', () => {
    // A negative expiresIn back-dates the computed `exp` claim -- jsonwebtoken
    // rejects passing `expiresIn` alongside a payload that already sets `exp`
    // directly (and rejects an explicit `undefined` override too), so let it
    // compute `exp` itself from this negative offset instead.
    const expiredToken = jwtService.sign(
      { sub: realUserId, email },
      { expiresIn: -60 },
    );

    return request(app.getHttpServer())
      .get('/test-protected')
      .set('Cookie', [`auth_token=${expiredToken}`])
      .expect(401);
  });

  it('accepts a request with a valid token for a real user', () => {
    const validToken = jwtService.sign({ sub: realUserId, email });

    return request(app.getHttpServer())
      .get('/test-protected')
      .set('Cookie', [`auth_token=${validToken}`])
      .expect(200)
      .expect({ ok: true });
  });
});
