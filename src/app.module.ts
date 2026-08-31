import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './app.controller';
import { AuthService } from './app.service';
import { PrismaModule } from './PrismaService/prismaservice.module';
import { RedisService } from './redis.service';
import { AuthGuard } from './auth.guard';
import { TraceIdMiddleware } from 'nest-common-utilities';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PolicyClientService } from './policy-client.service';
import { NotificationPocPublisher } from './notification-poc.publisher';
import { NotificationPocConsumer } from './NotificationPoc.Consumer';
import { existsSync } from 'fs';
import { join } from 'path';

const protoFilePath = existsSync(join(process.cwd(), 'src', 'proto', 'policy.proto'))
  ? join(process.cwd(), 'src', 'proto', 'policy.proto')
  : join(process.cwd(), 'dist', 'src', 'proto', 'policy.proto');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    JwtModule.register({}),
    ClientsModule.register([
      {
        name: 'POLICY_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'policy',
          protoPath: protoFilePath,
          url: 'localhost:4000',
        },
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RedisService,
    PolicyClientService,
    NotificationPocPublisher,
    NotificationPocConsumer,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configures middleware for the application.
   *
   * @param {MiddlewareConsumer} consumer - Provides
   * methods to apply middleware
   * to controllers or routes.
   */
  configure(consumer: MiddlewareConsumer) {
    // Apply the logger middleware globally (to all routes)
    consumer.apply(TraceIdMiddleware).forRoutes('*');
  }
}
