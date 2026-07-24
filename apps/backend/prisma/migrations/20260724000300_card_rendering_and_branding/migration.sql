-- Sprint 2A.1: organization branding and completed print side selection.
ALTER TABLE "Organization"
  ADD COLUMN "systemName" TEXT NOT NULL DEFAULT 'EduCore ERP',
  ADD COLUMN "cardSubtitle" TEXT;

CREATE TYPE "CardPrintSide" AS ENUM ('FRONT', 'BACK', 'BOTH');

ALTER TABLE "CardPrintJob"
  ADD COLUMN "sideSelection" "CardPrintSide" NOT NULL DEFAULT 'FRONT';
