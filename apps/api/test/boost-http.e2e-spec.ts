import { LambdaClient } from '@aws-sdk/client-lambda';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureCookies } from './../src/app.config';
import { UsersService } from './../src/modules/users/users.service';
import { DATA_SOURCE } from './../src/database/database.module';
import { LAMBDA_CLIENT } from './../src/modules/boost/boost.constants';
import { cleanupTestUser } from './utils/cleanup-test-user';

// sam local start-lambda's emulated Invoke API, started manually beforehand.
// Deliberately not port 3001 -- that's this repo's `pnpm dev:api` port.
const SAM_LOCAL_LAMBDA_ENDPOINT = 'http://127.0.0.1:3002';

// Must match the logical ID in test/fixtures/boost-lambda/template.yaml --
// sam local start-lambda keys invocations on logical ID, not an ARN, when
// no FunctionName property is set in the template.
const BOOST_TEST_FUNCTION_LOGICAL_ID = 'BoostTestFunction';

// Cold-starting the Docker container for the first invocation of a function
// can take several seconds -- past Jest's default 5000ms per-test timeout.
const LAMBDA_COLD_START_TIMEOUT_MS = 20_000;

describe('POST /boost/query -> AppModule -> sam local start-lambda (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let usersService: UsersService;
  let dataSource: DataSource;
  let realUserId: string;
  const email = `boost-http-e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    // Read fresh on every BoostService.invoke() call via
    // ConfigService.getBoostFunctionName(), so setting it any time before the
    // request in each `it` is enough -- no DI override needed for this piece.
    process.env.BOOST_LAMBDA_FUNCTION_NAME = BOOST_TEST_FUNCTION_LOGICAL_ID;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LAMBDA_CLIENT)
      .useValue(
        new LambdaClient({
          endpoint: SAM_LOCAL_LAMBDA_ENDPOINT,
          region: 'us-east-1',
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        }),
      )
      .compile();

    app = moduleFixture.createNestApplication();
    configureCookies(app);
    await app.init();

    jwtService = app.get(JwtService);
    usersService = app.get(UsersService);
    dataSource = app.get(DATA_SOURCE);

    const user = await usersService.create({
      email,
      name: 'Boost HTTP E2E',
      password: 'plaintext-password-123',
    } as any);
    realUserId = user.id;
  });

  afterAll(async () => {
    await cleanupTestUser(dataSource, email, app);
  });

  it('rejects a request with no auth_token cookie', () => {
    return request(app.getHttpServer())
      .post('/boost/query')
      .send({ prompt: 'hello from boost http e2e test' })
      .expect(401);
  });

  it(
    'invokes the local Lambda over the real HTTP -> guard -> controller -> service path',
    () => {
      const validToken = jwtService.sign({ sub: realUserId, email });

      return request(app.getHttpServer())
        .post('/boost/query')
        .set('Cookie', [`auth_token=${validToken}`])
        .send({ prompt: 'hello from boost http e2e test' })
        .expect(201)
        .expect({
          message: 'boost-test-lambda received: hello from boost http e2e test',
        });
    },
    LAMBDA_COLD_START_TIMEOUT_MS,
  );
});

describe('GET /boost/status -> AppModule -> sam local start-lambda (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.BOOST_LAMBDA_FUNCTION_NAME = BOOST_TEST_FUNCTION_LOGICAL_ID;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LAMBDA_CLIENT)
      .useValue(
        new LambdaClient({
          endpoint: SAM_LOCAL_LAMBDA_ENDPOINT,
          region: 'us-east-1',
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        }),
      )
      .compile();

    app = moduleFixture.createNestApplication();
    configureCookies(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    'has no auth guard and proxies through to the local Lambda with a null body',
    () => {
      return request(app.getHttpServer())
        .get('/boost/status')
        .expect(200)
        .expect({ message: 'boost-test-lambda received: ' });
    },
    LAMBDA_COLD_START_TIMEOUT_MS,
  );
});
