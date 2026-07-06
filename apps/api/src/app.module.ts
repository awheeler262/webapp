import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PostsModule } from './modules/posts/posts.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),
    AuthModule,
    UsersModule,
    PostsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
