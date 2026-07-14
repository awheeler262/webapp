import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { Callback, Handler } from 'aws-lambda';
import { AppModule } from './app.module';
import { configureHelmet, configureSecurityHeaders, configureCors, configureCookies, configureBodyParser, configureValidation } from './app.config';

let cachedHandler: Handler;

async function bootstrap(): Promise<Handler> {
  const expressApp = express();
  // bodyParser:false so only configureBodyParser's JSON-only parser is registered --
  // see its own comment in app.config.ts.
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });

  configureHelmet(app);
  configureSecurityHeaders(app);
  app.setGlobalPrefix('api');
  configureCors(app);
  configureCookies(app);
  configureBodyParser(app);
  configureValidation(app);

  await app.init();
  return serverlessExpress({ app: expressApp });
}

// no-op: resolutionMode defaults to 'PROMISE', so serverless-express resolves via the
// returned promise below rather than invoking this.
const noopCallback: Callback = () => {};

export const handler: Handler = async (event, context) => {
  cachedHandler ??= await bootstrap();
  return cachedHandler(event, context, noopCallback);
};
