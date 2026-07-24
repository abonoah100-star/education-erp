# Project Constitution

## Non-negotiable rule

This project does not accept patches, hidden workarounds, forced overrides,
temporary production fixes, duplicated business logic, or architecture bypasses.

Every defect must be resolved at its root cause.

## Engineering rules

1. Business logic must not be implemented inside UI components.
2. Controllers must not access the database directly.
3. Database changes require versioned migrations.
4. Financial records are reversed, never silently edited or deleted.
5. Authorization is always enforced by the backend.
6. Every bug fix requires a regression test.
7. Shared behavior must be implemented once.
8. TypeScript strict mode is mandatory.
9. Architectural decisions must be documented.
10. Code that fails lint, type checks, tests, or builds cannot be merged.
