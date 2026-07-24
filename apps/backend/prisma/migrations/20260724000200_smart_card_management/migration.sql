ALTER TYPE "CardType" ADD VALUE IF NOT EXISTS 'TEACHER';

CREATE TYPE "SmartCardStatus" AS ENUM (
  'DRAFT',
  'IN_STOCK',
  'ASSIGNED',
  'ACTIVE',
  'SUSPENDED',
  'LOST',
  'DAMAGED',
  'REPLACED',
  'EXPIRED',
  'REVOKED'
);

CREATE TYPE "CardCodeFormat" AS ENUM ('QR', 'BARCODE', 'QR_AND_BARCODE');
CREATE TYPE "BarcodeType" AS ENUM ('CODE128');
CREATE TYPE "CardBatchStatus" AS ENUM ('DRAFT', 'GENERATED', 'PARTIALLY_ASSIGNED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "CardPrintStatus" AS ENUM ('DRAFT', 'GENERATED', 'PRINTED', 'FAILED');
CREATE TYPE "CardPrintLayout" AS ENUM ('SINGLE', 'A4_8_UP', 'A4_10_UP');
CREATE TYPE "CardEventType" AS ENUM (
  'CREATED',
  'STOCKED',
  'ASSIGNED',
  'ACTIVATED',
  'IMAGE_GENERATED',
  'PRINTED',
  'SUSPENDED',
  'REVOKED',
  'REPLACED',
  'MARKED_LOST',
  'MARKED_DAMAGED',
  'EXPIRED'
);

CREATE TABLE "CardTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "cardType" "CardType" NOT NULL,
  "description" TEXT,
  "backgroundColor" TEXT NOT NULL DEFAULT '#0F3D32',
  "accentColor" TEXT NOT NULL DEFAULT '#D9B56D',
  "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
  "mutedTextColor" TEXT NOT NULL DEFAULT '#DDE8E4',
  "widthMm" DECIMAL(6,2) NOT NULL DEFAULT 85.60,
  "heightMm" DECIMAL(6,2) NOT NULL DEFAULT 53.98,
  "defaultCodeFormat" "CardCodeFormat" NOT NULL DEFAULT 'QR_AND_BARCODE',
  "defaultBarcodeType" "BarcodeType" NOT NULL DEFAULT 'CODE128',
  "showPhoto" BOOLEAN NOT NULL DEFAULT true,
  "showBranch" BOOLEAN NOT NULL DEFAULT true,
  "showExpiry" BOOLEAN NOT NULL DEFAULT false,
  "frontLayout" JSONB NOT NULL,
  "backLayout" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardBatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "cardType" "CardType" NOT NULL,
  "status" "CardBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "prefix" TEXT NOT NULL,
  "startNumber" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QrCard"
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "ownerName" TEXT,
  ADD COLUMN "codeFormat" "CardCodeFormat" NOT NULL DEFAULT 'QR_AND_BARCODE',
  ADD COLUMN "barcodeType" "BarcodeType" NOT NULL DEFAULT 'CODE128',
  ADD COLUMN "status" "SmartCardStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "replacesCardId" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "printedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "QrCard"
SET
  "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"SmartCardStatus" ELSE 'REVOKED'::"SmartCardStatus" END,
  "ownerName" = COALESCE("ownerName", 'بطاقة تجريبية'),
  "assignedAt" = COALESCE("assignedAt", "createdAt"),
  "activatedAt" = CASE WHEN "isActive" THEN COALESCE("activatedAt", "createdAt") ELSE NULL END;

ALTER TABLE "QrCard" ALTER COLUMN "subjectId" DROP NOT NULL;
ALTER TABLE "QrCard" DROP COLUMN "isActive";

CREATE TABLE "CardEvent" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "actorId" TEXT,
  "eventType" "CardEventType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardPrintJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "templateId" TEXT,
  "name" TEXT NOT NULL,
  "status" "CardPrintStatus" NOT NULL DEFAULT 'DRAFT',
  "layout" "CardPrintLayout" NOT NULL DEFAULT 'A4_8_UP',
  "pageCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "printedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardPrintJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardPrintJobItem" (
  "printJobId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "CardPrintJobItem_pkey" PRIMARY KEY ("printJobId", "cardId")
);

CREATE UNIQUE INDEX "CardTemplate_organizationId_code_key" ON "CardTemplate"("organizationId", "code");
CREATE INDEX "CardTemplate_organizationId_cardType_isActive_idx" ON "CardTemplate"("organizationId", "cardType", "isActive");
CREATE UNIQUE INDEX "CardBatch_organizationId_code_key" ON "CardBatch"("organizationId", "code");
CREATE INDEX "CardBatch_organizationId_branchId_status_idx" ON "CardBatch"("organizationId", "branchId", "status");
CREATE UNIQUE INDEX "QrCard_replacesCardId_key" ON "QrCard"("replacesCardId");
CREATE INDEX "QrCard_organizationId_branchId_cardType_status_idx" ON "QrCard"("organizationId", "branchId", "cardType", "status");
CREATE INDEX "QrCard_organizationId_subjectId_idx" ON "QrCard"("organizationId", "subjectId");
CREATE INDEX "QrCard_batchId_status_idx" ON "QrCard"("batchId", "status");
CREATE INDEX "CardEvent_cardId_createdAt_idx" ON "CardEvent"("cardId", "createdAt");
CREATE INDEX "CardPrintJob_organizationId_createdAt_idx" ON "CardPrintJob"("organizationId", "createdAt");
CREATE UNIQUE INDEX "CardPrintJobItem_printJobId_position_key" ON "CardPrintJobItem"("printJobId", "position");

ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardBatch" ADD CONSTRAINT "CardBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardBatch" ADD CONSTRAINT "CardBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardBatch" ADD CONSTRAINT "CardBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrCard" ADD CONSTRAINT "QrCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrCard" ADD CONSTRAINT "QrCard_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrCard" ADD CONSTRAINT "QrCard_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrCard" ADD CONSTRAINT "QrCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CardBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QrCard" ADD CONSTRAINT "QrCard_replacesCardId_fkey" FOREIGN KEY ("replacesCardId") REFERENCES "QrCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CardEvent" ADD CONSTRAINT "CardEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "QrCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardEvent" ADD CONSTRAINT "CardEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CardPrintJob" ADD CONSTRAINT "CardPrintJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardPrintJob" ADD CONSTRAINT "CardPrintJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardPrintJob" ADD CONSTRAINT "CardPrintJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardPrintJobItem" ADD CONSTRAINT "CardPrintJobItem_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "CardPrintJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardPrintJobItem" ADD CONSTRAINT "CardPrintJobItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "QrCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
