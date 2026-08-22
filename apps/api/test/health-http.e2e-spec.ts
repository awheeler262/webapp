import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureValidation } from './../src/app.config';

describe('POST /health (e2e)', () => {
  let app: INestApplication<App>;

  const validPayload = {
    service: 'heart',
    timestamp: new Date().toISOString(),
    count: 3,
    hash: 'a'.repeat(64),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureValidation(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a well-formed payload and echoes it back with status: submitted', () => {
    return request(app.getHttpServer())
      .post('/health')
      .send(validPayload)
      .expect(201)
      .expect({ ...validPayload, status: 'submitted' });
  });

  it('rejects a service not in the known category list', () => {
    return request(app.getHttpServer())
      .post('/health')
      .send({ ...validPayload, service: 'not-a-real-category' })
      .expect(400);
  });

  it('rejects a hash that is not a 64-character lowercase hex string', () => {
    return request(app.getHttpServer())
      .post('/health')
      .send({ ...validPayload, hash: 'too-short' })
      .expect(400);
  });

  it('rejects an uppercase hash', () => {
    return request(app.getHttpServer())
      .post('/health')
      .send({ ...validPayload, hash: 'A'.repeat(64) })
      .expect(400);
  });
});
