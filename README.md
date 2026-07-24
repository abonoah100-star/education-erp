# EduCore ERP

Multi-branch education-center ERP built as a modular monolith with a Next.js frontend, NestJS API, Prisma, PostgreSQL, Redis, and Docker.

## Current release

`v1.1.0` — Sprint 1.1 Security and Operational UI.

## Core rules

- No patches or hidden workarounds.
- Root-cause fixes only.
- Backend-enforced authorization.
- Versioned database migrations.
- No database models returned directly from sensitive endpoints.
- Every sensitive mutation creates an audit record.
- Lint, type checks, tests, and builds are required before merging.

## Sprint 1.1 highlights

- Safe QR and user API responses.
- Branch-scoped access for non-owner accounts.
- Branches, cashboxes, users, roles, QR cards, and audit log operational screens.
- Create/activate/suspend/issue/revoke actions according to permissions.
- Responsive Arabic RTL workspace without raw JSON views.

See `docs/SPRINT_1_1.md` for the complete delivery scope.
