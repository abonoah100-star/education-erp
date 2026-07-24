# EduCore ERP — Project Status and Handover

## Current release
**2.6.0 — Sprint 2B.3 Students & Guardians Frontend**

## Non-negotiable engineering rules
1. No patches, forced overrides, hidden bypasses, or temporary production fixes.
2. Fix root causes and protect every regression with validation or tests.
3. Database changes only through versioned Prisma migrations.
4. Backend permissions and branch scoping are authoritative.
5. API responses must never expose password hashes, refresh-token hashes, QR secrets, signing secrets, or raw stored file bytes in lists.
6. Operational records are deactivated, ended, reversed, or archived; they are not silently deleted.
7. Every completed stage must update this handover document.

## Completed stages
### Sprint 1 — Platform foundation
- Monorepo, Next.js, NestJS, PostgreSQL, Redis, Docker, Nginx.
- Authentication, JWT, users, roles, permissions.
- Organizations, branches, separate branch cashboxes.
- Audit foundation and responsive Arabic workspace.

### Sprint 1.1 — Security and operational UI
- Safe response DTOs.
- Backend permission enforcement.
- Operational branches/users/roles/QR/audit screens.
- Sensitive-field leak prevention.

### Sprint 2A — Smart-card management
- Card templates for students, guardians, teachers, and staff.
- QR and Code 128 barcode generation.
- Card inventory and preprinted batches.
- Individual and batch print jobs.
- PNG/image download and sharing.
- Front/back selection.
- CR80 printing workflow.
- Sequential card identifiers.
- Student portrait upload and default student avatar.
- Organization branding/logo and editable back-card text.
- Stable card grid and improved Arabic card rendering.

### Sprint 2B.1 — Students and guardians domain
- Students, guardians, student-guardian relations.
- Authorized pickups.
- Student documents, notes, status history.
- Profile sequences and branch-aware relations.
- Smart-card foreign-key links to real profiles.

### Sprint 2B.2 — Students and guardians backend
- Student create/read/update/status/transfer flows.
- Duplicate-candidate detection.
- Guardian create/update/link/end-relation flows.
- Authorized-pickup create/update/link/end flows.
- Protected photos, documents, notes.
- Student smart-card issue and inventory assignment.
- Audit logs, DTO validation, and branch isolation.

### Sprint 2B.3 — Students and guardians frontend
- Student directory with filters, pagination, and profile-health indicators.
- Multi-step student registration.
- Duplicate review before save.
- Optional guardian, pickup, photo, document, and card during registration.
- Student profile tabs for overview, guardians, pickups, documents, notes, cards, and history.
- Guardian directory and details.
- Authorized-pickup directory.
- Protected image handling and responsive UX.

## Current operational modules
- Authentication and access control.
- Branches and cashboxes.
- Users, roles, and permissions.
- Audit log.
- Organization branding/settings.
- Smart cards, inventory, templates, images, and printing.
- Students, guardians, authorized pickups, documents, notes, and student cards.

## Planned next stage
# Sprint 2B.4 — Quality, integration tests, and release closure

### Scope
- Full student-registration integration tests.
- Branch isolation tests for students, guardians, pickups, photos, documents, and cards.
- Permission tests for every new action.
- Duplicate detection tests.
- Upload size/type validation tests.
- Smart-card issue/assign integration tests.
- Empty/loading/error/mobile UX review.
- Migration-on-empty-database verification.
- Seed idempotency verification.
- Production build and release tag.

## Future roadmap
### Sprint 3 — Academic management
#### Sprint 3.1: Academic settings/domain
- Academic years and terms.
- Stages and grades.
- Subjects and courses.
- Required/optional subject matrix per grade.
- Rooms and session-duration rules.
- Academic settings tab.

#### Sprint 3.2: Teachers, groups, and scheduling
- Teacher profiles and assignments.
- Groups/classes.
- Teacher/room/group timetable.
- Teacher draft schedule and administrator approval.
- Conflict prevention.

#### Sprint 3.3: Student academic assignment
- Assign student to grade for a specific academic year/term.
- Automatically add required grade subjects.
- Select optional subjects.
- Add individual subject/course exceptions with permission and audit.
- Preserve previous-year history.

### Sprint 4 — Enrollment, pricing, and finance
- Per-session, monthly, and full-course payment models.
- Subject/course/grade/branch price lists.
- Price snapshot on enrollment.
- Invoices, payments, discounts, debt, refunds, and cashbox posting.
- Teacher compensation rules.
- Revenue, cost, and profit reports.

### Sprint 5 — Attendance and guardian follow-up
- Student/guardian/staff smart-card scanning.
- Session attendance.
- Pickup authorization confirmation.
- Parent portal/follow-up.
- Notifications and absence alerts.

### Sprint 6 — Reports and production hardening
- Advanced dashboards and exports.
- Backup/restore procedures.
- Performance review.
- Monitoring and alerting.
- Domain, HTTPS, secure cookies, and production security closure.

## Handover instructions for a new conversation
Continue from:
- Project: EduCore ERP.
- Current completed stage: Sprint 2B.3.
- Current version: 2.6.0.
- Next stage: Sprint 2B.4 quality and release closure.
- Academic subjects, grades, schedules, courses, and payment models are planned for Sprints 3 and 4 and must not be forced into the student-profile schema as temporary text fields.
