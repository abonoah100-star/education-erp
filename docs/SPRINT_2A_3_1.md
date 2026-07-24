# Sprint 2A.3.1 — Stable Card Layout and Editable Back Text

## Goal
Eliminate all text/portrait overlap and make the back-card copy configurable from organization settings.

## Delivered
- Fixed front-card zones for branding, owner data, portrait, QR, and barcode.
- Name wrapping and width constraints inside a dedicated data panel.
- Editable back title, return instruction, and footer.
- New Prisma migration: `20260724000600_card_back_text_settings`.
- Frontend settings fields and API contract updates.
- Rendering regression tests.

## Acceptance
- Long names never enter the portrait area.
- QR and barcode never enter the data panel.
- Back text edits appear in all generated outputs.
