# Sprint 2B.1 — Students & Guardians Domain Foundation

## Objective

Establish the permanent data model and domain invariants for students, guardians,
authorized pickup contacts, profile documents, notes, lifecycle history, and smart-card links.

This sprint deliberately does **not** expose incomplete CRUD screens. API workflows start in
Sprint 2B.2 after the database constraints and permission boundaries are accepted.

## Added database models

- `ProfileSequence`
- `PersonPhotoAsset`
- `Student`
- `Guardian`
- `StudentGuardian`
- `AuthorizedPickup`
- `AuthorizedPickupStudent`
- `StudentDocument`
- `StudentNote`
- `StudentStatusHistory`

`QrCard` now has optional, explicit foreign keys to a student, guardian, or authorized pickup.
A database check constraint prevents a single card from being linked to multiple profile types.

## Profile numbering

Codes are generated from a transactional organization-scoped sequence:

- Student: `STU-000001`
- Guardian: `GDN-000001`
- Authorized pickup: `PUP-000001`

The formatter rejects zero, negative, fractional, and unsafe sequence values.
The transaction that increments the sequence will be implemented in Sprint 2B.2.

## Student lifecycle

Supported states:

- `DRAFT`
- `ACTIVE`
- `SUSPENDED`
- `WITHDRAWN`
- `GRADUATED`
- `ARCHIVED`

The domain policy prevents invalid transitions such as reopening an archived student.
Every future status change must create a `StudentStatusHistory` record in the same transaction.

## Guardian relationships

A guardian may be linked to multiple students, and a student may have multiple guardians.
The relationship stores:

- relationship type
- primary guardian flag
- financial responsibility flag
- notification preference
- pickup permission

PostgreSQL partial unique indexes enforce no more than one primary guardian and one financial
responsible guardian per student.

## Authorized pickup

An authorized pickup profile can be shared across siblings. It supports:

- optional link to a guardian
- start and end validity dates
- status and security notes
- per-student activation
- future smart-card linking

## Documents and notes

Documents are stored with MIME type, SHA-256 fingerprint, sensitivity flag, expiry date, and
uploader identity. Duplicate document bytes are blocked per student.

Notes are categorized and may be marked sensitive. Authors are retained through a nullable user
relation so audit history survives account removal.

## Permissions added

- `students.view`
- `students.create`
- `students.update`
- `students.change_status`
- `students.change_branch`
- `students.export`
- `students.manage_documents`
- `students.manage_notes`
- `guardians.view`
- `guardians.create`
- `guardians.update`
- `guardians.link_students`
- `authorized_pickups.view`
- `authorized_pickups.manage`
- `authorized_pickups.confirm_release`

## Migration

`20260724000700_students_guardians_domain`

The migration includes foreign keys, search indexes, sequence checks, date-range checks, partial
unique guardian-role indexes, and the single-profile-owner smart-card constraint.

## Next sprint

Sprint 2B.2 implements the backend application layer:

- transactional profile sequence allocation
- students and guardians repositories/services
- branch-scoped authorization
- duplicate candidate detection
- safe response DTOs
- card assignment workflows
- audit records
