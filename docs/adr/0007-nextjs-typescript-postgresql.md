---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0007: TypeScript end to end on Next.js with one PostgreSQL database, hosted on a free tier

## Context and Problem Statement

The solution needs a public order form, a logged-in staff panel, a server for the agent's tools
and a database with transactional limits. The job ad is for "AI Fullstack Engineer (TypeScript,
React, Node.js)". What stack, and where does it run?

## Decision Drivers

- The role's stack is TypeScript, React, Node.js — the solution should show it.
- One person, a few evenings: one codebase, one deploy.
- Daily limits must hold under concurrent orders (ADR-0003) — a relational database with
  transactions.
- No spend without the owner's yes: hosting and database on free tiers.

## Considered Options

- A — Next.js (App Router) + TypeScript; PostgreSQL (Neon or Supabase free tier); hosted on Vercel
- B — React SPA + separate Node API (NestJS) + PostgreSQL
- C — .NET API + React (the owner's other production stack)

## Decision Outcome

Proposed option: **A**. One project holds the form, the panel and the server routes for the agent's
tools; PostgreSQL holds products, orders, callbacks and buffers; limits are enforced in a
transaction. Libraries are chosen in the feature plan with their reasons.

### Consequences

- Good, because it matches the role and deploys with one command.
- Bad, because serverless functions have time limits; long-lived voice connections are kept in the
  browser (ADR-0005) so the server only answers short tool calls.

### Confirmation

`plan.md` of each feature names the libraries; anything outside this stack needs an ADR.

## Pros and Cons of the Options

### A — Next.js + Postgres

- Good, because one codebase, free hosting, matches the ad.
- Bad, because serverless constraints for long connections.

### B — SPA + NestJS

- Good, because a clear API boundary; the owner knows NestJS.
- Bad, because two deploys for a small app.

### C — .NET + React

- Good, because the owner's strongest production back-end stack.
- Bad, because it does not show the stack the role asks for.

## More Information

Free-tier limits of the chosen hosting and database are checked and recorded in the plan before
deployment.

## Relations

- Amended by ADR-0009 (2026-11-24): the staff app is an Expo (React Native) app, built also for the web, next to the Next.js project; types are shared between them.
