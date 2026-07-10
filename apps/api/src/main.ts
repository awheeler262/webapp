import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHelmet, configureSecurityHeaders, configureCors, configureCookies, configureValidation } from './app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureHelmet(app);
  configureSecurityHeaders(app);
  app.setGlobalPrefix('api');
  configureCors(app);
  configureCookies(app);
  configureValidation(app);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
