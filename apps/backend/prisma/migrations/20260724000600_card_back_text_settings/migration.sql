-- Sprint 2A.3.1: editable back-card copy.
ALTER TABLE "Organization"
  ADD COLUMN "cardBackTitle" TEXT,
  ADD COLUMN "cardBackInstruction" TEXT,
  ADD COLUMN "cardBackFooter" TEXT;
