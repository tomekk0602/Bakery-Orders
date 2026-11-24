---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0015: The staff app has two roles — owner and employee — expressed as permissions checked on the server; it is built feature-first on Expo Router with TanStack Query, shared zod contracts and enforced code hygiene

## Context and Problem Statement

ADR-0009 made the staff app also the panel, and ADR-0014 gave the demo one login with no roles. The
owner decided (2026-11-24) that the app needs roles: the person at the counter and the owner do
different things. The owner also asked for clean code and good practice from the start, using an
earlier Expo app of the owner's as a reference, "though it is not ideal there". How are roles
modelled, and how is the app structured so it stays clean as it grows?

## Decision Drivers

- The owner: roles `owner` and `employee` in code, Czech names in the UI ("Majitel", "Prodavač");
  employees see the baking plan read-only.
- Authorisation must hold on the server; the app only hides what a role cannot use (Expo Router docs:
  protected routes control navigation, not data access).
- Lessons from the reference app (read 2026-11-24): files of 2,000–5,600 lines; navigation by state
  and `switch` instead of routes; per-role copies of the same services; a hand-written HTTP client
  without shared types; the user's password stored on the device for silent re-login; token refresh
  in two places; ~2,300 `any` and ~5,900 `console.*`; tests that read source text. Worth keeping: one
  module owns the session and its refresh, pure policy modules with tests, one guard for routes, one
  translation source.
- Standard over invention; free licences (constitution).

## Considered Options

Roles:

- R1 — permissions per role in one map in `packages/core`, enforced by the server, used by the app to
  show or hide; Better Auth `admin` plugin with access control stores the role
- R2 — role checks (`if role === "owner"`) scattered in routes and screens
- R3 — a separate app or route tree per role (the reference app's approach)

Architecture:

- A1 — Expo Router routes as thin files; feature folders; TanStack Query; one HTTP client typed and
  validated by the shared zod contracts; react-hook-form with the same schemas; i18next with one
  Czech file; no global state library; ESLint rules that forbid `any`, `console` and files over 300
  lines
- A2 — the reference app's layout (role trees, Zustand + contexts, hand-written client)

## Decision Outcome

Chosen: **R1 + A1** (owner, 2026-11-24).

**Roles and permissions**

| Permission                                                                 | owner | employee |
| -------------------------------------------------------------------------- | ----- | -------- |
| `order:create` (voice or form, cut-off override)                           | ✓     | ✓        |
| `order:view`, `order:pickup`                                               | ✓     | ✓        |
| `order:edit`, `order:cancel`                                               | ✓     | ✓        |
| `plan:view`                                                                | ✓     | ✓        |
| `request:view`, `request:resolve`                                          | ✓     | ✓        |
| `settings:edit` (catalogue, prices, limits, buffers, cut-off, closed days) | ✓     | —        |
| `ops:view` ("Provoz")                                                      | ✓     | —        |
| `demo:reset`                                                               | ✓     | —        |
| `eval:create` (turn a call into a test case)                               | ✓     | —        |

- The map lives in `packages/core/src/permissions.ts`; Better Auth's access control is built from it.
- Every staff route calls `requirePermission(request, permission)` before anything else; a missing
  session is 401, a missing permission 403.
- The app hides tabs and actions with `Tabs.Protected` / a `can()` helper from the same map.
- UI names: owner → "Majitel", employee → "Prodavač".
- Demo: two accounts, one per role, created by the seed with passwords from environment variables;
  the credentials go to the reviewers in the reply, never into the repository.

**App structure**

```
apps/staff/app/            routes only — each file renders a screen from src/features
apps/staff/src/features/   orders, plan, requests, settings, ops, auth — api.ts (query/mutation hooks), components
apps/staff/src/shared/     api (the one HTTP client), auth (the one session module), i18n (cs.json), ui (tokens, a few components)
```

- **Routes**: real Expo Router routes, `Stack.Protected` for signed-in, `Tabs.Protected` per
  permission; deep links and back navigation work.
- **Server state**: TanStack Query with query-key factories per feature; no hand-written caching.
- **Contracts**: request and response schemas from `@bakery/core/contracts`, shared with the server;
  responses are validated at the boundary.
- **Forms**: react-hook-form with the zod resolver and the same schemas.
- **Session**: Better Auth's Expo client, session in SecureStore; one module handles sign-in,
  sign-out and expiry; **no password is stored on the device**.
- **No global state library**: server state is in Query, the rest is component state (add one only
  with a reason).
- **i18n**: i18next, one `cs.json`; keys in English, text in Czech.
- **Server side**: `/api/staff/*` routes are thin — parse with the contract, `requirePermission`, call
  a use case in `apps/web/server/staff/`, return the contract shape. No business rule in a route file.
- **Hygiene, enforced by tooling**: typescript-eslint strict; `no-explicit-any` and `no-console` as
  errors; `max-lines` 300 per file; Prettier; strict TypeScript.
- **Tests**: jest-expo + React Native Testing Library for screen behaviour, MSW for the API in
  component tests; server permission tests on real PostgreSQL ("employee → 403 on settings").

### Consequences

- Good, because a role change is one line in one map, checked in one place on the server.
- Good, because the problems measured in the reference app are blocked by lint rules and structure,
  not by memory.
- Bad, because two demo accounts and a permission layer to explain; the README walkthrough shows both.
- Bad, because the 300-line limit forces splitting early; that is the intent.

### Confirmation

- Server tests: each staff route returns 401 without a session; `settings`, `ops`, `demo:reset` and
  `eval:create` routes return 403 for an employee; the employee can create an order after the cut-off.
- A component test: an employee does not see the "Nastavení" and "Provoz" tabs; an owner does.
- `npm run lint` fails on `any`, `console` or a file over 300 lines.

## Pros and Cons of the Options

### R1 — Permission map, server-enforced

- Good, because one source of truth for server and app.
- Bad, because a small layer to build.

### R2 — Scattered role checks

- Bad, because adding a role means finding every `if`; a missed server check is a hole.

### R3 — A tree per role

- Bad, because it produced copies of the same code in the reference app.

### A2 — Reference layout

- Bad, because of the problems listed in the drivers.

## More Information

- Better Auth admin plugin and access control: https://www.better-auth.com/docs/plugins/admin
- Expo Router protected routes: https://docs.expo.dev/router/advanced/protected/
- Amends ADR-0009 (adds roles to the staff app) and ADR-0014 (two demo logins instead of one).
