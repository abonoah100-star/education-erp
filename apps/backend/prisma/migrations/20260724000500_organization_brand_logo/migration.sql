CREATE TABLE "OrganizationBrandAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBrandAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationBrandAsset_organizationId_key"
ON "OrganizationBrandAsset"("organizationId");

ALTER TABLE "OrganizationBrandAsset"
ADD CONSTRAINT "OrganizationBrandAsset_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
