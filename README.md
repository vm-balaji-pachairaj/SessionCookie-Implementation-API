# Session Cookie Implementation API

This repository is a NestJS TypeScript API focused on session-based authentication, cookie management, JWT token flow, Redis-backed session validation, Prisma/PostgreSQL access, Casbin role/permission enforcement, and Google Pub/Sub event integration.

The project is clearly a proof-of-concept / implementation exercise for a claims/HDFC-style permission model, with a custom authorization layer built around role-to-policy-bundle relationships.

## Project overview

The application exposes a protected API layer behind a custom AuthGuard and integrates with:

- PostgreSQL via Prisma
- Redis for active session token storage
- JWT for access and refresh tokens
- Casbin for RBAC / policy-bundle authorization
- Google Cloud Pub/Sub for session/event messaging
- Swagger UI for API documentation

The server boots in src/main.ts and wires AppModule in src/app.module.ts. The application is configured to run on port 5000 by default unless PORT is overridden.

## Key features

- Cookie-based access and refresh token handling
- API login and session continuation endpoints
- Role switching with token regeneration
- Redis session validation to enforce one active login/session state
- Prisma-based data access using a generated client
- Casbin RBAC using policy bundles and g3/g grouping rules
- Resource and permissions hierarchy for menu, section, and field access checks
- Policy management endpoints for admin configuration
- Pub/Sub publish/status/subscriber monitoring endpoints
- Swagger documentation at /api

## Tech stack

- NestJS 11
- TypeScript
- Prisma 7 with PostgreSQL adapter
- PostgreSQL
- Redis
- Casbin
- Google Cloud Pub/Sub
- JWT and cookie-based authentication
- Swagger
- Jest for tests

## Current repository state and important caveat

The repository contains a package manifest that is currently malformed:

- the scripts section includes a duplicate prisma:generate entry
- a comma is missing between the prisma:seed script and the next property

This is visible in the current package.json file and is a repository fact, not a change made by this README update. Because of that, npm commands may fail unless the manifest is corrected separately.

The README below documents the project as it is implemented in the source code, while calling out the manifest issue as a current repo limitation.

## Project structure

```text
.
├── .env                              # Local environment configuration
├── README.md                         # Project documentation
├── package.json                      # NestJS package manifest (currently malformed in repo state)
├── prisma/
│   ├── schema.prisma                 # Prisma schema for PostgreSQL + Casbin tables
│   ├── recreate-casbin-rule.ts
│   ├── recreate-casbin-rule.sql
│   ├── migrate-to-policy-bundles.ts
│   └── ...
├── generated/
│   └── prisma/                      # Generated Prisma client output
├── src/
│   ├── main.ts                      # Nest bootstrap, CORS, Swagger, cookie parser
│   ├── app.module.ts                # Global module wiring
│   ├── app.controller.ts            # Auth and session endpoints
│   ├── app.service.ts               # JWT, Redis, role switching, auth logic
│   ├── auth.guard.ts                # Auth enforcement for protected routes
│   ├── public.decorator.ts          # @Public metadata decorator
│   ├── redis.service.ts             # Redis client wrapper
│   ├── PrismaService/
│   │   ├── prisma.service.ts        # Prisma client configured from DATABASE_URL
│   │   └── prismaservice.module.ts
│   ├── casbin/
│   │   ├── casbin.service.ts        # Casbin enforcer initialization and policy resolution
│   │   ├── casbin.guard.ts          # Permission guard
│   │   ├── casbin.decorator.ts      # Policy decorators
│   │   ├── casbin-seeder.ts         # Auto-seed Casbin tables and policies
│   │   ├── casbin-resources.ts      # Resource hierarchy metadata
│   │   ├── model/rbac.conf          # Casbin RBAC model
│   │   └── ...
│   ├── admin/
│   │   ├── admin.controller.ts      # Policy bundle and role admin API
│   │   ├── admin.service.ts         # Bundle + policy admin logic
│   │   └── admin.module.ts
│   ├── resources/
│   │   ├── resources.controller.ts  # Sample protected resources with policy checks
│   │   └── resources.module.ts
│   ├── users/
│   │   ├── users.controller.ts      # User management API with policy checks
│   │   ├── users.service.ts         # User create/read/update/deactivate logic
│   │   └── ...
│   ├── pubsub/
│   │   ├── pubsub.controller.ts     # Publish/status/health endpoints
│   │   ├── pubsub.service.ts        # Google Pub/Sub integration
│   │   ├── pubsub.subscriber.service.ts
│   │   ├── pubsub.logger.ts
│   │   └── pubsub.module.ts
│   └── ...
├── test/
│   ├── app.e2e-spec.ts
│   ├── casbin-policy-bundle.spec.ts
│   └── pubsub.e2e-spec.ts
├── logs/
├── dist/
├── .env
├── prisma.config.ts
├── eslint.config.mjs
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── redisService.ts
├── redisService.js
└── ...
```

## Prerequisites

You need the following services and tools available locally or in the target environment:

- Node.js and npm
- PostgreSQL database instance
- Redis instance
- Google Cloud project with Pub/Sub enabled (if using Pub/Sub features)
- A valid service account JSON credential file for the Google Cloud project if the environment depends on Pub/Sub

## Installation and setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

> Note: This repository currently contains a malformed package.json. The installation step is the standard workflow, but the manifest itself may need to be corrected before npm scripts can run reliably.

3. Create or adjust the environment file (.env) with the required configuration values.
4. Ensure PostgreSQL is reachable and the DATABASE_URL points at the intended database.
5. Ensure Redis is reachable at the configured REDIS_URL.
6. Ensure the Google Cloud credential file path exists if Pub/Sub is enabled.

## Environment variables and configuration

The project reads environment variables via process.env and also includes a .env file in the repository root.

Current values present in the repo configuration include:

```env
DATABASE_URL="postgresql://postgres:...@localhost:5432/hdfcclaims"
SERVICE_NAME=session-cookie-api
LOG_LEVEL=debug
LOG_FILE=./logs/application.log
LOG_MAX_SIZE=100m
LOG_RETENTION_DAYS=30

GOOGLE_CLOUD_PROJECT_ID=sessioncookiepoc-hdfc
GOOGLE_APPLICATION_CREDENTIALS=./sessioncookiepoc-hdfc-22a0aac1430a.json
PUBSUB_TOPIC_NAME=projects/sessioncookiepoc-hdfc/topics/SessionCookiePOC
PUBSUB_SUBSCRIPTION_NAME=projects/sessioncookiepoc-hdfc/subscriptions/session-cookie-subscription
SERVICE_VERSION=1.0.0
```

Key environment variables used by the app:

- DATABASE_URL: Prisma/PostgreSQL connection string
- JWT_SECRET: JWT signing secret; defaults to my-secret-key if not set
- JWT_ACCESS_TOKEN_EXPIRES_IN: access token TTL; default is 1m in the auth config
- JWT_REFRESH_TOKEN_EXPIRES_IN: refresh token TTL; default is 7d in the auth config
- COOKIE_SAME_SITE: default is none in auth config
- REDIS_URL: default is redis://localhost:6379
- GOOGLE_CLOUD_PROJECT_ID: Google Cloud project ID for Pub/Sub
- GOOGLE_APPLICATION_CREDENTIALS: path to service account credentials JSON
- PUBSUB_TOPIC_NAME: topic name, default is session-cookie-topic
- PUBSUB_SUBSCRIPTION_NAME: subscription name, default is session-cookie-subscription
- PORT: server port, default is 5000

The app also reads config via ConfigModule.forRoot({ isGlobal: true }) in AppModule.

## Running the project

The package scripts present in the repository are the standard NestJS scripts, as visible in package.json:

```bash
npm run build
npm run start
npm run start:dev
npm run start:debug
npm run start:prod
npm run lint
npm run test
npm run test:watch
npm run test:cov
npm run test:debug
npm run test:e2e
npm run casbin:recreate-table
npm run prisma:generate
npm run prisma:seed
```

> The current package.json also contains a duplicate and malformed script declaration. This README reflects the script names actually present in the manifest, but their execution depends on the manifest being repaired.

### Development mode

```bash
npm run start:dev
```

This starts NestJS in watch mode.

### Production-like startup

```bash
npm run build
npm run start:prod
```

The production entrypoint is node dist/main.

## Application behavior and workflows

### Authentication and session flow

Protected routes are enforced by AuthGuard. Public routes are marked with @Public(). Public auth endpoints include:

- POST /api/login
- POST /api/continue-session
- POST /api/refresh

These endpoints set cookie-based tokens on the response:

- access_token
- refresh_token

The auth logic lives in src/app.service.ts and uses Redis to store active access and refresh tokens keyed by user ID.

### Role switching

The application supports switched roles through:

- POST /api/changerole

This endpoint validates a user_role_mapping_id and role_id against the database and issues new tokens with the selected role.

### Dashboard and user context

Authenticated users can access:

- GET /api/dashboard
- GET /api/thistoken
- POST /api/logout

The token payload contains userDetails, role_id, user_role_mapping_id, username, and type information.

### Casbin authorization model

This project uses a policy bundle architecture based on Casbin.

At a high level:

- Role -> Policy Bundle via g3 groupings
- Bundle -> Policies via g groupings
- Policy checks are performed for menu, section, and field permissions

The resource hierarchy is defined by data in src/casbin/casbin-resources.ts and the matcher model in src/casbin/model/rbac.conf.

The key authorization components are:

- src/casbin/casbin.service.ts
- src/casbin/casbin.guard.ts
- src/casbin/casbin.decorator.ts
- src/casbin/casbin-seeder.ts

### Admin policy management

The admin API is intentionally public in the controller and provides a policy-bundle console.

Routes under /api/admin include:

- GET /api/admin/resources
- GET /api/admin/roles
- GET /api/admin/roles/:role/bundles
- GET /api/admin/roles/:role/available-bundles
- POST /api/admin/roles/:role/bundles
- DELETE /api/admin/roles/:role/bundles/:bundleName
- GET /api/admin/policy-bundles
- POST /api/admin/policy-bundles
- PUT /api/admin/policy-bundles/:id
- DELETE /api/admin/policy-bundles/:id
- GET /api/admin/policies
- POST /api/admin/enforcer/check

This area is designed to manage policies, bundles, and role associations.

### Resource endpoints

The project includes sample protected resource routes under /api:

- GET /api/sales/overview
- GET /api/sales/orders
- POST /api/sales/orders
- PUT /api/sales/orders/:id
- DELETE /api/sales/orders/:id
- GET /api/customers
- POST /api/customers
- GET /api/reports/sales
- GET /api/reports/audit

These routes are protected by Casbin decorators and use section or field access requirements.

### User management endpoints

The controller at src/users/users.controller.ts exposes:

- GET /api/user-management/users
- GET /api/user-management/users/:id
- POST /api/user-management/users
- PUT /api/user-management/users/:id
- PATCH /api/user-management/users/:id/deactivate
- PATCH /api/user-management/users/:id/activate

These routes require the user role to satisfy policy checks defined in the Casbin permission model.

### Pub/Sub endpoints

Core Pub/Sub endpoints live under /api/pubsub:

- POST /api/pubsub/publish
- GET /api/pubsub/status
- GET /api/pubsub/subscriber/stats
- GET /api/pubsub/health
- GET /api/pubsub/messages

The service creates or reuses a Google Cloud topic and subscription at startup. It also listens for incoming messages and routes them through registered handlers.

## API documentation

Swagger is enabled in src/main.ts with:

- title: POC API
- description: API documentation for the POC
- version: 1.0

The Swagger UI is served at:

```text
http://localhost:5000/api
```

## Database and Prisma

The Prisma schema is in prisma/schema.prisma and includes PostgreSQL schemas such as:

- casbin
- doctors
- documents
- emails
- hcp_claims
- hospitals
- masters
- notifications
- public
- users

The Prisma client is generated under generated/prisma and is used via PrismaService.

A custom Prisma adapter is used for Casbin integration:

- src/casbin/prisma-casbin.adapter.ts

## Redis behavior

The Redis wrapper is implemented in src/redis.service.ts.

Defaults:

- REDIS_URL = redis://localhost:6379

Redis is used to store active token pairs with keys such as:

- ACCESS_<userId>
- REFRESH_<userId>

If Redis is unavailable, the service logs a warning and continues without it, but the auth workflow expects it to be present in normal operation.

## Security and assumptions in the code

The codebase documents a few important implementation caveats:

- AuthService.findUserOrThrow currently looks up a user only by username and ignores the password argument intentionally.
- The source comment states that real password verification is not implemented and would require a proper hash comparison strategy.
- AuthGuard validates the JWT and checks it against the Redis-backed session token before allowing access.
- Admin controller routes are marked public in the current implementation.
- Cookies are configured with secure: true and sameSite: none by default in AUTH_CONFIG.

These behaviors are present in the code and should be treated as current implementation details rather than assumptions.

## Testing

The project includes Jest tests and e2e tests.

Scripts present in the manifest:

```bash
npm run test
npm run test:watch
npm run test:cov
npm run test:debug
npm run test:e2e
```

The Casbin bundle architecture is also covered in src/casbin/casbin-policy-bundle.spec.ts.

## Build and deployment notes

- Build command: npm run build
- Production start: npm run start:prod
- Nest application boots on port 5000 unless overridden
- Prisma schema and generated client are used directly in the runtime app
- Pub/Sub support depends on Google Cloud credentials and project configuration

## Key limitations / notes

- The current package.json manifest is malformed and should be corrected before relying on the npm scripts in normal development.
- The login flow currently treats username as the user identity and does not perform password verification as implemented by the code comments.
- Pub/Sub integration requires a valid Google Cloud service account and project configuration.
- The project relies on external PostgreSQL and Redis services being available.
- The repository includes generated Prisma client files under generated/prisma and a schema under prisma/schema.prisma; do not assume the schema matches a generic Nest starter setup.

## Summary

This repository is not a generic starter app. It is a custom NestJS security and authorization service built around:

- JWT cookie auth
- session lifecycle management
- Prisma + PostgreSQL persistence
- Redis-backed session validation
- a Casbin policy bundle permission model
- Pub/Sub event handling for session/message workflows

It is best understood as a role-based API project with admin configuration capabilities and a domain-specific sample resource layer for access control demonstrations.
