import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyResultV2,
  Callback,
} from 'aws-lambda';
import { AppModule } from './app.module';
import {
  configureHelmet,
  configureSecurityHeaders,
  configureCors,
  configureCookies,
  configureBodyParser,
  configureValidation,
} from './app.config';

let cachedHandler: APIGatewayProxyHandlerV2;

async function bootstrap(): Promise<APIGatewayProxyHandlerV2> {
  const expressApp = express();
  // bodyParser:false so only configureBodyParser's JSON-only parser is registered --
  // see its own comment in app.config.ts.
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bodyParser: false },
  );

  configureHelmet(app);
  configureSecurityHeaders(app);
  app.setGlobalPrefix('api');
  configureCors(app);
  configureCookies(app);
  configureBodyParser(app);
  configureValidation(app);

  await app.init();
  return serverlessExpress<APIGatewayProxyEventV2, APIGatewayProxyResultV2>({
    app: expressApp,
  });
}

// no-op: resolutionMode defaults to 'PROMISE', so serverless-express resolves via the
// returned promise below rather than invoking this.
const noopCallback: Callback = () => {};

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  cachedHandler ??= await bootstrap();
  const result = await cachedHandler(event, context, noopCallback);
  // aws-lambda's Handler type allows resolving via the callback instead of the
  // returned promise (result === undefined in that case), but serverless-express's
  // resolutionMode defaults to 'PROMISE' -- see noopCallback's comment above --
  // so that path is never actually exercised here.
  if (result === undefined) {
    throw new Error('serverless-express handler resolved with no result');
  }
  return result;
};
