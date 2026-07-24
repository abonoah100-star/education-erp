-- Sprint 2A.2: deterministic card numbering and managed portrait assets.

CREATE TABLE "CardSequence" (
  "organizationId" TEXT NOT NULL,
  "cardType" "CardType" NOT NULL,
  "lastCardNumber" INTEGER NOT NULL DEFAULT 0,
  "lastSubjectNumber" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CardSequence_pkey" PRIMARY KEY ("organizationId", "cardType")
);

CREATE TABLE "CardPortraitAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CardPortraitAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QrCard" ADD COLUMN "portraitAssetId" TEXT;

CREATE UNIQUE INDEX "CardPortraitAsset_organizationId_sha256_key"
  ON "CardPortraitAsset"("organizationId", "sha256");

CREATE INDEX "CardPortraitAsset_organizationId_createdAt_idx"
  ON "CardPortraitAsset"("organizationId", "createdAt");

CREATE INDEX "QrCard_portraitAssetId_idx"
  ON "QrCard"("portraitAssetId");

ALTER TABLE "CardSequence"
  ADD CONSTRAINT "CardSequence_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CardPortraitAsset"
  ADD CONSTRAINT "CardPortraitAsset_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QrCard"
  ADD CONSTRAINT "QrCard_portraitAssetId_fkey"
  FOREIGN KEY ("portraitAssetId") REFERENCES "CardPortraitAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
