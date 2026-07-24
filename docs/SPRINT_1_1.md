# Sprint 1.1 — Security and Operational UI

## Delivered

- Safe response contracts for users and QR cards.
- No password, refresh-token, or QR secret hashes in read APIs.
- Backend-enforced permission guard.
- Organization and branch scoping for every protected list.
- Audited login, logout, branch, cashbox, user, role, and QR mutations.
- Branch creation and activation controls.
- Independent cashbox creation and status controls.
- User creation and suspension controls.
- Custom role creation with permission selection.
- Secure QR issuing, revocation, and replacement.
- One-time QR payload returned only at issue/replace time.
- Operational tables, status indicators, responsive navigation, loading, empty, and error states.
- Standard API error response with a request ID.

## Security contract

Read endpoints must never contain:

- `passwordHash`
- `refreshTokenHash`
- `secretHash`
- environment secrets

The database remains the source of truth, while response fields are explicitly selected.

## Deployment note

This sprint contains no database-schema change. Run the seed again to add newly introduced permissions.
