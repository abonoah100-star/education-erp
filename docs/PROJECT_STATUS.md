# EduCore ERP — Project Status

## Current stage
- Sprint 1: Foundation — completed
- Sprint 1.1: Security and operational UI — completed
- Sprint 2A: Smart card management — completed
- Sprint 2A.1–2A.3.1.1: Card rendering, printing, branding, and layout — completed
- Sprint 2B.1: Students and guardians domain — installed with seed hotfix
- Current release: **Sprint 2B.1.1**

## Sprint 2B.1.1 hotfix
The Sprint 2B.1 migration was applied successfully, but the seed command failed because `prisma/seed.ts` imported a TypeScript source module from `src/`. The production backend image intentionally contains the compiled application and Prisma files, not the full source tree. Therefore the runtime seed could not resolve that module.

### Root-cause correction
- Removed the runtime dependency from Prisma seed to application source files.
- Seed data now stores its explicit normalized demo values directly.
- No production source-tree copy, path alias workaround, or TypeScript bypass was added.
- No new database migration is required.

## Current completed student-domain foundation
- Students
- Guardians
- Student-guardian links
- Authorized pickup people
- Student photos and documents
- Student notes
- Student status history
- Smart-card links to student, guardian, or authorized pickup
- Organization-level sequential profile codes
- Permissions and initial domain constraints

## Next implementation stage
### Sprint 2B.2 — Students and Guardians Backend
- Transactional student creation and sequential code generation
- Search, filtering, pagination, and branch isolation
- Duplicate-candidate detection
- Student updates, branch transfer, and status changes
- Guardian creation and linking
- Authorized pickup management
- Documents and photos
- Smart-card assignment/issuance during student onboarding
- Safe response DTOs, audit logs, and permission tests

## Confirmed later roadmap additions
### Sprint 3 — Academic management
- Academic years and terms
- Stages and grades
- Subjects and courses
- Automatic subject assignment by grade
- Optional student-specific subjects
- Teachers, groups, rooms, schedules, and collision prevention

### Sprint 4 — Enrollment and finance
- Per-session payment
- Monthly subscription
- Full-course payment
- Subject/course prices by branch and grade
- Invoices, payments, cashboxes, debts, and teacher entitlements

## Handover note
Continue from **Sprint 2B.2** after confirming Sprint 2B.1.1 seed and application health on the VPS.
