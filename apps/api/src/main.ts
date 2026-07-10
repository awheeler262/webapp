import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHelmet, configureSecurityHeaders, configureCors, configureCookies, configureBodyParser, configureValidation } from './app.config';

async function bootstrap() {
  // bodyParser:false so only configureBodyParser's JSON-only parser is registered --
  // Nest's default also adds a urlencoded parser, which is what configureBodyParser
  // exists specifically to not have (see its own comment in app.config.ts).
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  configureHelmet(app);
  configureSecurityHeaders(app);
  app.setGlobalPrefix('api');
  configureCors(app);
  configureCookies(app);
  configureBodyParser(app);
  configureValidation(app);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
