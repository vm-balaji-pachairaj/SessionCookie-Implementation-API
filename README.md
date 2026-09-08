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

## Casbin Implementation

### Overview

This repository implements Casbin as a custom role-and-policy-bundle authorization layer rather than a simple one-to-one role-to-policy mapping. The core idea is:

- a role is mapped to one or more policy bundles through `g3`
- each bundle contains many policy names through `g`
- policies themselves are stored as `p`, `p2`, and `p3` rules
- menu, section, and field checks are all performed through the same Casbin enforcer and custom matchers

This is not a default Casbin starter setup. The implementation is designed around a resource hierarchy and a policy-bundle admin model that lets a role inherit access through bundles instead of being directly tied to each permission string.

### Architecture

The authorization flow in this project is split across several layers:

1. `AuthGuard` validates the JWT and Redis-backed session before a route runs.
2. `CasbinGuard` inspects metadata such as `@CheckPolicy` or `@usePolicyNeeded` and decides whether the authenticated role is allowed to proceed.
3. `CasbinService` loads the model and policy store, builds the in-memory bundle index, and executes enforcement through the Casbin enforcer.
4. `PrismaCasbinAdapter` reads and writes Casbin rules in the PostgreSQL `casbin.casbin_rule` table.
5. `ensureCasbinTablesAndSeed` creates the schema and seeds canonical rules, bundles, and role mappings if the database is empty.
6. `AdminService` exposes policy bundle management routes for roles, bundles, and policy assignment.

The end-to-end model is:

```text
User / Token role
        |
        v
AuthGuard (JWT + Redis validation)
        |
        v
CasbinGuard (@CheckPolicy / @usePolicyNeeded)
        |
        v
CasbinService.enforce(...)
        |
        +--> g3_has_policy(role, bundle)
        +--> g(bundle, policy)
        +--> p / p2 / p3 matcher logic in rbac.conf
        |
        v
Allow or ForbiddenException
```

### Casbin Configuration

Casbin is configured in the Nest application through `CasbinModule`.

Relevant wiring:

- `src/app.module.ts` imports `CasbinModule`
- `src/casbin/casbin.module.ts` registers `CasbinService` and installs `CasbinGuard` as a global `APP_GUARD`

That means the guard is active for all routes, but it only enforces routes that are decorated with Casbin metadata. Other routes pass through without an authorization decision.

This module does the following:

- creates the Casbin enforcer on startup
- loads the model file from `src/casbin/model/rbac.conf`
- uses `PrismaCasbinAdapter` to read/write policy data from PostgreSQL
- registers the custom function `g3_has_policy`
- rebuilds the in-memory bundle cache after policy reloads

### Model and Matchers

The Casbin model is defined in `src/casbin/model/rbac.conf`.

The model defines the following request and policy structures:

```ini
[request_definition]
r = sub, key
r2 = sub, lob, page, mod, sec, access
r3 = sub, lob, page, mod, sec, field, access

[policy_definition]
p = key, lob, page, meta
p2 = perm, lob, page, mod, sec, access
p3 = perm, lob, page, mod, sec, field, access

[role_definition]
g = _, _
g2 = _, _, _
g3 = _, _
```

The important thing in this repository is that the model is intentionally expressive enough to represent three permission levels:

- `p`: menu-level access (for example `dashboard`, `sales`, `reports`)
- `p2`: section-level access (for example `sec_orders`, `sec_dashboard_overview`)
- `p3`: field-level access (for example `field_orders_amount`, `field_users_add`)

The matchers are also custom to this project:

```ini
m = g3_has_policy(r.sub, p.key) && r.key == p.key
m2 = g3_has_policy(r2.sub, p2.perm) && r2.lob == p2.lob && r2.page == p2.page && (r2.mod == p2.mod || p2.mod == 'main') && (r2.sec == p2.sec || p2.sec == 'main') && r2.access == p2.access
m3 = g3_has_policy(r3.sub, p3.perm) && r3.lob == p3.lob && r3.page == p3.page && (r3.mod == p3.mod || p3.mod == 'main' || r3.mod == p3.sec) && r3.sec == p3.sec && r3.field == p3.field && r3.access == p3.access
```

These matchers encode the actual repository behavior:

- a user does not hold direct policy strings in its identity
- the user must belong to a role that is connected to a policy bundle
- the bundle resolves to `p`, `p2`, or `p3` policies
- the resource match is checked using `lob`, `page`, `mod`, `sec`, `field`, and `access`

### Roles and Permissions

The project uses a bundle-based RBAC model.

The actual relationship model is:

- `role -> g3 -> bundle`
- `bundle -> g -> policy`
- `policy -> p / p2 / p3`

This is implemented in `CasbinService` with these in-memory indexes:

- `roleBundles`: `Map<string, Set<string>>` built from `g3`
- `bundlePolicies`: `Map<string, Set<string>>` built from `g`

The custom function `g3_has_policy(sub, perm)` in `src/casbin/casbin.service.ts` is the key to this design:

```ts
g3_has_policy(sub: string, perm: string): boolean {
  if (!sub || !perm) return false;
  const bundles = this.roleBundles.get(sub);
  if (!bundles || bundles.size === 0) return false;

  for (const bundle of bundles) {
    const policies = this.bundlePolicies.get(bundle);
    if (policies && policies.has(perm)) {
      return true;
    }
  }
  return false;
}
```

This means a role is not directly assigned individual permission names. Instead, the role is assigned a bundle, and that bundle resolves to the relevant policies.

### Policy Storage and Database Integration

The actual policy rules are stored in PostgreSQL tables under the `casbin` schema.

The table definitions are created by `ensureCasbinTablesAndSeed`:

- `casbin.casbin_rule`
- `casbin.policy_bundle`
- `casbin.policy_bundle_policy`

The custom adapter `src/casbin/prisma-casbin.adapter.ts` maps the database rows to the Casbin rule model.

Key implementation details:

- `loadPolicy(model)` reads all rows from `casbin.casbin_rule`
- `savePolicy(model)` writes the entire set of `p`, `p2`, `p3`, and `g` rules back to the table
- `addPolicy`, `addPolicies`, `removePolicy`, `removeFilteredPolicy` mirror Casbin CRUD operations against the database
- the adapter explicitly handles the repository's actual Prisma table name `casbin_rule`, since the generated Prisma client exposes it with underscore naming rather than camelCase

Because the app uses a custom adapter, the Casbin enforcer is not using a generic file-based policy store. It is using the database as the source of truth.

### Policy Files and Seed Data

The project also includes a resource hierarchy definition in:

- `src/casbin/casbin-resources.ts`
- `src/casbin/casbin-seeder.ts`

The hierarchy data defines resource menus, sections, and fields such as:

- `dashboard`
- `sales`
- `reports`
- `user_management`
- `audit`

Each menu contains sections and fields. Each section/field carries its own policy name and access value. For example, in the resource hierarchy:

- `sec_orders` is the section policy for the sales orders section
- `field_orders_amount` is the field policy for the `amount` column
- `field_orders_actions` is the field policy for action operations

`ensureCasbinTablesAndSeed` is idempotent and runs on startup. If the Casbin tables are empty, it:

- creates the schema and tables
- seeds canonical menu/section/field policies
- creates several canonical bundles such as:
  - `Full Administrator Bundle`
  - `Sales Manager Bundle`
  - `Sales Agent Bundle`
  - `User Access Support Bundle`
  - `Auditor Bundle`
- assigns those bundles to role names via `g3`
- stores landing pages via `g2`

This is why a role like `System Admin` or `Sales Manager` can resolve into an authorization set without needing explicit `p` or `p2` entries for every user.

### Enforcer Initialization

The Casbin enforcer is initialized in `src/casbin/casbin.service.ts` inside `onModuleInit()`.

The sequence is:

1. `createPolicyBundleTables()` ensures the supporting tables exist
2. `ensureCasbinTablesAndSeed(this.logger)` loads the canonical data if needed
3. the model is read from `src/casbin/model/rbac.conf`
4. `newEnforcer(model, new PrismaCasbinAdapter(this.prisma))` creates the enforcer
5. `g3_has_policy` is registered as a custom function
6. `rebuildCacheFromEnforcer()` computes the `roleBundles` and `bundlePolicies` indexes

This is the actual startup path used by the application when the service boots.

### Policy Management

Policy management is exposed through the admin API in `src/admin/admin.controller.ts` and `src/admin/admin.service.ts`.

The admin console supports:

- listing roles
- listing bundles assigned to roles
- assigning or removing bundles from a role
- creating or updating a policy bundle
- adding or removing policies from a bundle
- listing all policy definitions and resource hierarchy
- checking a centralized enforcer decision

The admin controller is intentionally marked `@Public()` in this project, which is an implementation detail worth noting: the admin console is not protected by the same auth flow at the route level.

The bundle semantics are explicitly encoded in comments in the controller:

```ts
// Role -> (g3) -> Policy Bundle -> (g) -> Policies (P, P2, P3).
```

### Authorization and Enforcement Flow

The actual enforcement path is implemented in `CasbinService.enforce()`.

The overloads support three major types of checks:

- `enforce(sub, menuKey)` for menu (`p`) checks
- `enforce(sub, lob, page, mod, sec, access)` for section (`p2`) checks
- `enforce(sub, lob, page, mod, sec, field, access)` for field (`p3`) checks

Internally the service uses the matcher stored on the model:

- `m` for menu decisions
- `m2` for section decisions
- `m3` for field decisions

It executes the matcher via `enforceWithMatcher(...)`:

```ts
const matcher = this.enforcer.getModel().model.get('m')?.get('m2')?.value;
return this.enforcer.enforceWithMatcher(
  matcher,
  new EnforceContext('r2', 'p2', 'e', 'm2'),
  sub,
  lob,
  page,
  mod,
  sec,
  access,
);
```

The enforcement path uses the role name from the authenticated token, then checks whether that role belongs to a bundle that contains the relevant `p`, `p2`, or `p3` policy.

### Request-to-Authorization Flow

A normalized request flow in this repository looks like this:

```text
GET /api/sales/orders
        |
        v
AuthGuard validates JWT + Redis cookie session
        |
        v
request.user contains userDetails.role_name
        |
        v
@usePolicyNeeded({ section: 'sales', menu: 'orders', access: 'read' })
        |
        v
CasbinGuard reads metadata
        |
        v
CasbinService.enforce(roleName, 'hcp', 'sales', 'orders', 'orders', 'read')
        |
        v
matcher m2 checks:
  g3_has_policy(role, p2.perm)
  lob matches
  page matches
  mod matches
  sec matches
  access matches
        |
        v
Allow route or throw ForbiddenException
```

Once a route is allowed, the application may still perform additional field-level checks. For example, in `src/resources/resources.controller.ts`, the `amount` column is masked when `canReadAmount` is false even though the list endpoint itself is allowed.

### Relevant Files

The actual Casbin implementation is spread across these files:

- `src/casbin/casbin.module.ts` — registers the service and global guard
- `src/casbin/casbin.service.ts` — enforcer lifecycle, bundle cache, enforcement, role resolution
- `src/casbin/casbin.guard.ts` — enforces route-level policy metadata after JWT validation
- `src/casbin/casbin.decorator.ts` — `@CheckPolicy` / `@usePolicyNeeded` metadata builder
- `src/casbin/model/rbac.conf` — Casbin model and matcher definitions
- `src/casbin/prisma-casbin.adapter.ts` — Prisma-backed policy adapter
- `src/casbin/casbin-seeder.ts` — idempotent schema creation and seed logic
- `src/casbin/casbin-resources.ts` — canonical resource hierarchy
- `src/admin/admin.service.ts` — bundle CRUD and role-to-bundle logic
- `src/admin/admin.controller.ts` — admin policy management routes
- `src/resources/resources.controller.ts` — example protected API endpoints
- `src/users/users.controller.ts` — user management routes guarded by policy metadata
- `src/app.module.ts` — global app wiring
- `src/auth.guard.ts` — JWT + Redis session validation performed before Casbin checks

### Adding a New Role

A new role is created in the application data model outside the Casbin layer itself. Once the role exists in the database, the role can be connected to a bundle using `g3` semantics.

In practice, the flow is:

1. add the role to the relevant role table or master data if needed
2. create or choose an existing policy bundle in the admin console or through the admin service
3. assign the role to the bundle using the admin route `POST /api/admin/roles/:role/bundles`
4. reload the policy in the enforcer via the admin service logic (`reloadPolicy()`)

The application stores those assignments as `g3` rows in `casbin.casbin_rule`.

### Adding or Modifying Permissions and Policies

Permissions are created as entries in the canonical hierarchy and stored as rules:

- `p` for menu policies
- `p2` for section policies
- `p3` for field policies

A new permission is typically added by:

1. defining the menu/section/field in `src/casbin/casbin-resources.ts` or the canonical hierarchy data
2. letting the seeder insert the policy into `casbin.casbin_rule`
3. attaching that policy to a bundle in the admin flow
4. assigning the bundle to a role

The `AdminService` methods are the actual implementation used for this workflow:

- `createPolicyBundle()`
- `addPolicyToBundle()`
- `removePolicyFromBundle()`
- `setBundlePolicies()`
- `assignRoleToBundle()`

### Protecting a New API or Resource

The repository uses route metadata, not a custom interceptor, to trigger the Casbin check.

Examples from the codebase:

- `@CheckPolicy({ menu: 'user_management', section: 'users', access: 'read' })`
- `@usePolicyNeeded({ menu: 'sales', section: 'orders', field: 'actions', access: 'edit' })`

The decorator builds a requirement object and stores it in metadata. `CasbinGuard` reads that metadata on every request and translates it to the correct `p`, `p2`, or `p3` enforcement call.

To protect a new route in this repository, the usual pattern is:

```ts
@UseGuards(AuthGuard)
@CheckPolicy({ menu: 'sales', section: 'orders', access: 'read' })
```

or:

```ts
@usePolicyNeeded({ section: 'sales', menu: 'orders', access: 'read' })
```

The route will then be checked against the relevant Casbin matcher and rejected with `ForbiddenException` if not allowed.

### Error Handling

Authorization failures are converted into `ForbiddenException` by `CasbinGuard`.

The code path is:

```ts
if (!allowed) {
  const details = ...;
  throw new ForbiddenException(
    `Role "${roleName}" is not allowed access to: ${details}`,
  );
}
```

This is how the system reports a missing permission. A route can also fail earlier if:

- the JWT is invalid or expired in `AuthGuard`
- the Redis session is missing or stale
- the token has no `userDetails.role_name`

In those cases, the request is rejected before the Casbin decision is reached.

### Debugging and Troubleshooting

A developer can debug the authorization flow by checking the following layers:

1. Route metadata: is the route decorated with `@CheckPolicy` / `@usePolicyNeeded`?
2. Token payload: does `request.user.userDetails.role_name` exist?
3. Casbin role mapping: does the role have a bundle via `g3`?
4. Bundle contents: does the bundle include the expected policy via `g`?
5. Policy definitions: does the relevant `p`, `p2`, or `p3` row exist in `casbin.casbin_rule`?
6. Matcher logic: do the `lob`, `page`, `mod`, `sec`, `field`, and `access` values match the rule?

The most useful server-side entry points are:

- `CasbinService.getBundlesForRole(roleName)`
- `CasbinService.getPoliciesForBundle(bundleName)`
- `CasbinService.getPermissionsForRole(roleName)`
- `CasbinService.getFieldPermissionsForRole(roleName)`
- `CasbinService.getMenusForRole(roleName)`
- `AdminController` `POST /api/admin/enforcer/check`

This last endpoint runs the centralized check and returns whether a given role is allowed for the supplied parameters.

### End-to-End Example

A concrete example from the repository is the orders screen:

- `GET /api/sales/orders` is protected by:
  - `@usePolicyNeeded({ section: 'sales', menu: 'orders', access: 'read' })`
  - `@usePolicyNeeded({ menu: 'sales', section: 'orders', access: 'read' })`
- the route calls `this.casbinService.enforce(...)` for `amount` visibility
- a `Sales Agent` role may be allowed to view the list but not the `amount` field if the `field_orders_amount` permission is absent
- in that case, `getOrders()` masks the `amount` property even though the route itself remains accessible

This demonstrates the repository’s real behavior: the app separates route access from field-level visibility and enforces both layers independently.

### Important Implementation Notes

- There is no direct user-to-policy mapping in the normal permission flow; the mapping is mediated by bundles and `g3`.
- The `CasbinService` intentionally caches `g3` and `g` relationships in memory for faster permission checks.
- The authorization model is not a generic role-permission model; it is a bundle-centric resource model built around pages, sections, and fields.
- `DATABASE_URL` is the real environment dependency for Casbin data loading because the enforcer reads and writes to PostgreSQL.
- The admin policy-console routes are intentionally public in the current implementation, which is a project-specific design choice rather than a general Casbin requirement.
- The route guard order matters: `AuthGuard` runs before `CasbinGuard`, so the Casbin decision is only made for an already-authenticated request.

### Summary

The Casbin implementation in this repository is a custom, PostgreSQL-backed bundle-based RBAC system. It couples a Casbin model (`rbac.conf`) to a Prisma adapter (`PrismaCasbinAdapter`) and a service layer (`CasbinService`) that interprets menu, section, and field policies through `p`, `p2`, and `p3` rules.

The real architectural pattern is:

- roles belong to bundles via `g3`
- bundles contain policies via `g`
- permissions are evaluated through custom `m`, `m2`, and `m3` matchers
- route metadata decides which permission check to execute
- failures are surfaced as `ForbiddenException`

That is the actual Casbin system this project uses, and it is the model a new developer should understand when extending authorization in this codebase.

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
