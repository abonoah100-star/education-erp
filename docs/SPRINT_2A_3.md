# Sprint 2A.3 — Card Layout & Organization Branding

## Completed scope

- Added an organization logo asset stored in PostgreSQL.
- Added authenticated logo upload and reset endpoints under organization settings.
- Added a public branding logo endpoint with a safe generated default logo.
- Connected the logo to login, navigation, settings, card front, and card back.
- Redesigned the card front so the owner name, subject/card code, and branch are positioned to the left of the portrait with a clear hierarchy.
- Preserved QR, Code 128 barcode, portrait upload, sequential identifiers, image export, sharing, and printing.
- Added an official Prisma migration for the organization brand asset.

## Security and data rules

- Only JPG, PNG, and WebP logo uploads are accepted.
- Uploaded logos are decoded and normalized to PNG by Sharp before storage.
- Raw uploaded bytes are not served directly.
- The organization logo can be reset without deleting organization data.
- The public endpoint exposes only the rendered logo image, never database metadata or binary hashes.

## Verification checklist

1. Open organization settings and upload a square logo.
2. Save settings and verify the logo in the navigation rail.
3. Log out and verify the logo on the login screen.
4. Open an existing smart card and verify the logo on front and back.
5. Verify the owner name, code, and branch are placed left of the portrait.
6. Export and print front, back, and both sides.
7. Reset the logo and verify the default logo appears everywhere.
