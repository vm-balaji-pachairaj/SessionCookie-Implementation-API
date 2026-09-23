import 'dotenv/config';
import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function resolvePort(): number {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if ((arg === '--port' || arg === '-p') && process.argv[i + 1]) {
      const p = parseInt(process.argv[i + 1], 10);
      if (!isNaN(p)) return p;
    }
    if (arg.startsWith('--port=')) {
      const p = parseInt(arg.split('=')[1], 10);
      if (!isNaN(p)) return p;
    }
    if (arg.startsWith('-p=')) {
      const p = parseInt(arg.split('=')[1], 10);
      if (!isNaN(p)) return p;
    }
  }
  if (process.env.PORT) {
    const rawPort = process.env.PORT.trim().replace(/^["']|["']$/g, '');
    const p = parseInt(rawPort, 10);
    if (!isNaN(p)) return p;
  }
  return 5000;
}

function getCorsOriginValidator() {
  const envOrigins =
    process.env.FRONTEND_URL ||
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URLS;

  const configuredList = envOrigins
    ? envOrigins
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, ''))
        .filter(Boolean)
    : [];

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Allow non-browser requests (Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.replace(/\/+$/, '');

    // Allow explicitly configured frontend URL(s) from environment
    if (configuredList.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // Automatically allow any localhost / 127.0.0.1 port for multiple local instances
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };
}

// Bootstraps the Nest application and applies the global HTTP middleware used by
// the session/auth flow, including cookie parsing, cache-control headers, CORS,
// and Swagger generation for the API surface.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Prevent browser/proxy caching of API responses, especially auth/session flows.
  app.use((request: Request, response: Response, next: NextFunction) => {
    void request;

    response.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.setHeader('Surrogate-Control', 'no-store');

    next();
  });

  // Enable CORS: configurable via FRONTEND_URL or any local instance port
  app.enableCors({
    origin: getCorsOriginValidator(),
    credentials: true,
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('POC API')
    .setDescription('API documentation for the POC')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);

  const port = resolvePort();
  await app.listen(port);
  console.log(`[Bootstrap] NestJS application running on: http://localhost:${port}`);
  console.log(`[Bootstrap] Swagger documentation: http://localhost:${port}/api`);
}

bootstrap();
