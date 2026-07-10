import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { Handler } from 'aws-lambda';
import { AppModule } from './app.module';
import { configureHelmet, configureSecurityHeaders, configureCors, configureCookies, configureValidation } from './app.config';

let cachedHandler: Handler;

async function bootstrap(): Promise<Handler> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  configureHelmet(app);
  configureSecurityHeaders(app);
  app.setGlobalPrefix('api');
  configureCors(app);
  configureCookies(app);
  configureValidation(app);

  await app.init();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  cachedHandler ??= await bootstrap();
  return cachedHandler(event, context, callback);
};
