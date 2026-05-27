# Module Boundaries

This directory contains the Super-App platform modules. Each module is a self-contained vertical slice.

## Structure

```
src/modules/
  <module-name>/
    api/      — Route handler logic (called from src/app/api/)
    db/       — Database queries (Prisma + Supabase)
    types/    — TypeScript types and enums local to this module
```

## Import Rules

1. **No cross-module relative imports.** A file inside `src/modules/dispatch/` must never do `../../ridesharing/...`. Use the path alias instead: `@/modules/ridesharing/...`.
2. **`src/app/` imports modules, not the reverse.** Modules never import from `src/app/` or `src/components/`.
3. **Shared primitives** live in `src/modules/platform/`. All other modules may import from `platform/`.
4. **No module exports Prisma model types directly.** Wrap them in local types defined in `types/`.

ESLint enforces rule 1 via `no-restricted-imports` in `eslint.config.mjs`.

## Modules

| Module | Scope |
|--------|-------|
| `platform` | Shared enums, remote config, analytics stubs |
| `ridesharing` | On-demand cab booking, dispatch, trip lifecycle |
| `dispatch` | Driver dispatch queue, accept/reject, cascade logic |
| `assets` | Polymorphic asset registry (cabs, rentals, cargo vans) |
| `auth` | Test-login helpers, session utilities |
