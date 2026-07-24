-- Sprint 2B.2: preserve guardian relationship history without destructive unlinking.

ALTER TABLE "StudentGuardian"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "endedAt" TIMESTAMP(3),
  ADD COLUMN "endReason" TEXT;

DROP INDEX IF EXISTS "StudentGuardian_one_primary_per_student_key";
DROP INDEX IF EXISTS "StudentGuardian_one_financial_per_student_key";

CREATE UNIQUE INDEX "StudentGuardian_one_active_primary_per_student_key"
  ON "StudentGuardian"("studentId")
  WHERE "isPrimary" = true AND "isActive" = true;

CREATE UNIQUE INDEX "StudentGuardian_one_active_financial_per_student_key"
  ON "StudentGuardian"("studentId")
  WHERE "isFinancialResponsible" = true AND "isActive" = true;

CREATE INDEX "StudentGuardian_studentId_isActive_idx"
  ON "StudentGuardian"("studentId", "isActive");
