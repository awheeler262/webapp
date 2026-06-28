# Web Application

## Run the apps

```bash
# In one terminal
pnpm dev:api    # NestJS on :3001

# In another terminal
pnpm dev:web    # Nuxt on :3000
```

## Playwright

### florida_mayors.spec.ts

```bash
npx playwright codegen https://www.floridamayors.org/member-directory/
npx playwright test florida_mayors.spec.ts
```

### utils/florida_mayors.ts

```bash
# package.json -- "type": "module"
# tsconfig.json -- compilerOptions "node"
npx tsx utils/florida_mayors.ts
```

## Design Decisions

**Summary**

* Monorepo
* NuxtJS frontend
* NestJS backend

### Monorepo

```text
We have a web application to develop that will have both a frontend and backend.
Should the frontend and backend have separate git repositories or should the
frontend and backend belong to the same repository?
```

Code sharing and version management.

### Frameworks

```text
Why use a backend framework like NestJS instead of plain NodeJS with minimal
packages?
```

Plain Node.js suits micro-services.
Frameworks have lots of build-in luxuries that applications often end up needing.

```text
Does it make sense to use NestJS or NuxtJS for both the frontend and backend?
```

Better to use NestJs for frontend and Nuxt for backend then share packages
between them.
The monorepo design works well for this.

```text
What framework pairings other than NestJS and Nuxt get used often?
```

NuxtJS + NestJS arguably the best.

```text
What does a monorepo layout look like with a NuxtJS frontend and a NestJS backend?
```
`<snip></snip>`

```text
Can we use Nuxt to generate a static javascript bundle that we serve from S3?
```

## Initialize Project

```text
We want to create a single page application (SPA) with NuxtJS as a frontend and NestJS as a backend.

Describe how to create and initialize the project folder hierarchy.

```
