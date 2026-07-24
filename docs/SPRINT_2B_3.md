# Sprint 2B.3 — Students & Guardians Frontend

## Goal
Deliver the operational frontend for the students, guardians, authorized-pickup, documents, notes, and student smart-card workflows implemented by Sprint 2B.2.

## Delivered
- New navigation entry: Students & Guardians.
- Operational student directory with search, branch/status filters, pagination, file-health counters, and profile opening.
- Multi-step student registration flow:
  1. Student data and duplicate review.
  2. Optional guardian creation and relationship assignment.
  3. Optional authorized-pickup creation.
  4. Student photo, initial document, and smart-card choice.
  5. Review.
  6. Save and open the new profile.
- Student profile workspace:
  - Overview.
  - Guardians.
  - Authorized pickups.
  - Documents.
  - Notes.
  - Smart cards.
  - Student-status history.
- Protected student image loading through authenticated blob requests.
- Student image replacement with automatic card portrait synchronization.
- Document upload/download.
- Notes with sensitive flag.
- Status changes and branch transfers.
- Smart-card issuance or assignment from existing inventory.
- Guardians directory and guardian creation/details.
- Authorized-pickup directory.
- Responsive layouts for desktop, tablet, and mobile.

## Architecture notes
- The frontend never accesses database structures directly.
- Every write uses the existing authenticated Sprint 2B.2 API.
- Sensitive document/note visibility remains enforced by the backend.
- Branch isolation remains authoritative in the backend.
- Student photos are not embedded as public URLs; the UI requests protected blobs with the session token.

## Database
No new migration is required for Sprint 2B.3.

## Release
- Project version: 2.6.0
- Suggested tag: `v0.2.6-sprint2b3`
