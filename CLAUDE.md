# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

pnpm workspace monorepo (`pnpm-workspace.yaml`: `apps/*`, `packages/*`):
- `apps/web` — Nuxt 4 / Vue 3 frontend, statically generated (SSG), deployed to S3/CloudFront.
- `apps/api` — NestJS backend, deployed as a Lambda function behind API Gateway.
- `packages/validation` (`@my-app/validation`) — shared DTOs/schemas, actually consumed by `apps/api`.
- `packages/types` (`@my-app/types`) — shared plain TS interfaces, not currently imported by either app.

Package manager is pinned via `devEngines.packageManager` in the root `package.json` (pnpm 11.9.0) — use `corepack enable && corepack prepare pnpm@11.9.0 --activate` if your local pnpm doesn't match.

## Commands

Run from repo root unless noted. Use `pnpm --filter <name> ...` to scope a command to one workspace package (package names: `web`, `api`, `@my-app/validation`, `@my-app/types`).

```bash
pnpm install                 # install all workspace deps

pnpm dev:web                 # nuxt dev, http://localhost:3000
pnpm dev:api                 # nest start --watch, http://localhost:3001

pnpm build:web               # nuxt generate -> apps/web/.output/public
pnpm build:api               # nest build -> apps/api/dist

pnpm --filter api lint       # eslint --fix (only apps/api defines a lint script today)

pnpm --filter api test                    # jest unit tests (apps/api/src/**/*.spec.ts)
pnpm --filter api test -- auth.service    # run spec files matching a pattern
pnpm --filter api test:cov                # coverage (output: apps/api/coverage)
pnpm --filter api test:e2e                # supertest e2e tests in apps/api/test/

pnpm exec playwright test    # root-level Playwright browser tests (tests/*.spec.ts, playwright.config.ts)
```

Note: `apps/api`'s jest config sets `rootDir: "src"`, so `--testPathPatterns`/`--collectCoverageFrom` globs are relative to `apps/api/src`, not the package root.

## Architecture

### apps/web (Nuxt 4 / Vue 3)

- SSG only: `nuxt generate` prerenders and outputs to `.output/public`. Nitro's server build exists solely to drive the prerender step — there's no running Nuxt server in production.
- Auth is entirely client-side: `useAuth()` (`app/composables/useAuth.ts`) stores the API's JWT in a cookie (`auth_token`) and decodes its payload client-side purely for display (no signature verification happens in the browser — the API is the source of truth). There's no `/login` route; login is a dropdown form in `AppNavbar.vue`.
- `useApi()` / `app/plugins/api.ts` wrap `$fetch`, attaching the bearer token and using `runtimeConfig.public.apiBaseUrl` (from `NUXT_PUBLIC_API_BASE_URL`).
- `/fair` is a real feature, not dead code — see root `README.md`: it's currently switched off because the backend analysis step calls the Claude API per-request and that costs tokens.
- `nuxt.config.ts`'s `$production` block strips `console.log`/`console.error` calls from production builds via esbuild's `pure` option — this happens at build time, not in source.

### apps/api (NestJS)

- Feature modules live under `src/modules/<name>/` (currently `auth`, `users`): a `.module.ts`, `.service.ts`, optional `.controller.ts`, colocated `*.spec.ts`, and an `entities/` folder for TypeORM entities.
- Persistence: TypeORM against Postgres, wired in `app.module.ts` via `TypeOrmModule.forRootAsync`. `synchronize` is on whenever `NODE_ENV !== 'production'` — there is no migration system yet. `src/database/assert-database-reachable.ts` probes the DB with a small bounded retry *before* TypeORM's own connection setup, so a bad `DATABASE_URL` fails fast with one clear log line instead of TypeORM's noisy default 10-attempt retry loop.
- Auth: `passport-jwt` strategy (`modules/auth/jwt.strategy.ts`) backing a guard (`modules/auth/jwt-auth.guard.ts`) that's a bare `AuthGuard('jwt')` subclass with no constructor dependencies — other modules can import the guard class directly without pulling in all of `AuthModule`. `JWT_EXPIRY` is a plain seconds count (e.g. `"3600"`), not a duration string — it's parsed with `Number.parseInt`, never cast.
- Cross-cutting bootstrap concerns (helmet, security headers, CORS, the global `ValidationPipe`) are factored out of `main.ts` into named functions in `app.config.ts`; `main.ts` just calls them in sequence.
- Global route prefix is `api` (set in `main.ts`) — every route is under `/api/...`.
- Required env vars live in `apps/api/.env` (gitignored): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRY`, `CORS_ORIGIN`, `PORT`, `NODE_ENV`.

### Shared packages

- `packages/validation`: exports `CreateUserDto` (class-validator, used by Nest's global `ValidationPipe`) and a parallel `CreateUserSchema`/`CreateUserInput` (zod, for frontend-side validation) — both hand-derived from the same field rules, so keep them in sync manually when either changes.

## Gotchas specific to this repo

- **Stale incremental build cache**: `apps/api/tsconfig.build.tsbuildinfo` survives `rm -rf dist`. If you delete `dist/` to force a clean rebuild, delete this file too — otherwise TypeScript's incremental cache can skip re-emitting changed files and `nest start --watch` fails with `MODULE_NOT_FOUND`.
- **`bcrypt`** is a native addon; `pnpm-workspace.yaml`'s `allowBuilds` must list it (it does) or its native binding won't get compiled on install.
- pnpm's strict `node_modules` means every package imported directly by `apps/api` source must be a direct dependency in `apps/api/package.json` — a package that only arrives transitively (e.g. via `@nestjs/platform-express`) can't be `import`ed directly even though it resolves under a plain hoisted install.
- **Running `pnpm --filter api deploy --prod ...` (used by `apps/api/buildspec.yaml` to build the Lambda artifact) poisons the whole workspace for subsequent `pnpm run <script>` commands.** It leaves `node_modules/.pnpm-workspace-state-v1.json`'s `dev` flag set to `false`. Every later `pnpm run` (in *any* workspace package — `dev:web`, `dev:api`, etc.) reads that cached state before running and "reconciles" by silently re-running `pnpm install --production`, which strips devDependencies workspace-wide and breaks `packages/validation`'s `prepare` script (`tsc: not recognized`) and `apps/web`'s `postinstall` (`nuxt prepare`). If you hit that failure, it's not a real dependency problem — run a plain `pnpm install` at the repo root (a full `rm -rf node_modules` first if a plain install refuses with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`) to reset the state file back to a normal dev install.
