-- Sprint 2B.1: students, guardians, authorized pickups, documents and profile sequences.

CREATE TYPE "StudentStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'WITHDRAWN',
  'GRADUATED',
  'ARCHIVED'
);

CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "GuardianStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "GuardianRelationship" AS ENUM (
  'FATHER',
  'MOTHER',
  'LEGAL_GUARDIAN',
  'GRANDFATHER',
  'GRANDMOTHER',
  'SIBLING',
  'OTHER'
);
CREATE TYPE "AuthorizedPickupStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');
CREATE TYPE "StudentDocumentType" AS ENUM (
  'BIRTH_CERTIFICATE',
  'GUARDIAN_ID',
  'STUDENT_PHOTO',
  'MEDICAL_REPORT',
  'ENROLLMENT_FORM',
  'OTHER'
);
CREATE TYPE "StudentNoteCategory" AS ENUM (
  'GENERAL',
  'ADMINISTRATIVE',
  'ACADEMIC',
  'HEALTH',
  'BEHAVIORAL'
);
CREATE TYPE "ProfileSequenceType" AS ENUM ('STUDENT', 'GUARDIAN', 'AUTHORIZED_PICKUP');

CREATE TABLE "ProfileSequence" (
  "organizationId" TEXT NOT NULL,
  "profileType" "ProfileSequenceType" NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileSequence_pkey" PRIMARY KEY ("organizationId", "profileType"),
  CONSTRAINT "ProfileSequence_lastNumber_check" CHECK ("lastNumber" >= 0)
);

INSERT INTO "ProfileSequence" ("organizationId", "profileType", "lastNumber", "updatedAt")
SELECT
  organization."id",
  'STUDENT'::"ProfileSequenceType",
  COALESCE(card_sequence."lastSubjectNumber", 0),
  CURRENT_TIMESTAMP
FROM "Organization" AS organization
LEFT JOIN "CardSequence" AS card_sequence
  ON card_sequence."organizationId" = organization."id"
  AND card_sequence."cardType" = 'STUDENT'::"CardType";

INSERT INTO "ProfileSequence" ("organizationId", "profileType", "lastNumber", "updatedAt")
SELECT
  organization."id",
  'GUARDIAN'::"ProfileSequenceType",
  COALESCE(card_sequence."lastSubjectNumber", 0),
  CURRENT_TIMESTAMP
FROM "Organization" AS organization
LEFT JOIN "CardSequence" AS card_sequence
  ON card_sequence."organizationId" = organization."id"
  AND card_sequence."cardType" = 'GUARDIAN'::"CardType";

INSERT INTO "ProfileSequence" ("organizationId", "profileType", "lastNumber", "updatedAt")
SELECT
  organization."id",
  'AUTHORIZED_PICKUP'::"ProfileSequenceType",
  0,
  CURRENT_TIMESTAMP
FROM "Organization" AS organization;

CREATE TABLE "PersonPhotoAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersonPhotoAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonPhotoAsset_byteSize_check" CHECK ("byteSize" > 0)
);

CREATE TABLE "Student" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "nameArabic" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "nameEnglish" TEXT,
  "gender" "StudentGender",
  "birthDate" DATE,
  "nationalId" TEXT,
  "schoolName" TEXT,
  "gradeLevel" TEXT,
  "phone" TEXT,
  "whatsappPhone" TEXT,
  "address" TEXT,
  "healthNotes" TEXT,
  "adminNotes" TEXT,
  "referralSource" TEXT,
  "profilePhotoAssetId" TEXT,
  "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Student_sequenceNumber_check" CHECK ("sequenceNumber" > 0),
  CONSTRAINT "Student_nameArabic_not_blank" CHECK (length(btrim("nameArabic")) > 0),
  CONSTRAINT "Student_normalizedName_not_blank" CHECK (length(btrim("normalizedName")) > 0)
);

CREATE TABLE "Guardian" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "nameArabic" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "nameEnglish" TEXT,
  "nationalId" TEXT,
  "primaryPhone" TEXT NOT NULL,
  "whatsappPhone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "profilePhotoAssetId" TEXT,
  "status" "GuardianStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Guardian_sequenceNumber_check" CHECK ("sequenceNumber" > 0),
  CONSTRAINT "Guardian_nameArabic_not_blank" CHECK (length(btrim("nameArabic")) > 0),
  CONSTRAINT "Guardian_primaryPhone_not_blank" CHECK (length(btrim("primaryPhone")) > 0)
);

CREATE TABLE "StudentGuardian" (
  "studentId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "relationship" "GuardianRelationship" NOT NULL,
  "customRelationship" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isFinancialResponsible" BOOLEAN NOT NULL DEFAULT false,
  "receivesNotifications" BOOLEAN NOT NULL DEFAULT true,
  "canPickup" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("studentId", "guardianId"),
  CONSTRAINT "StudentGuardian_custom_relationship_check" CHECK (
    "relationship" <> 'OTHER' OR length(btrim(COALESCE("customRelationship", ''))) > 0
  )
);

CREATE TABLE "AuthorizedPickup" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "guardianId" TEXT,
  "nameArabic" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "relationship" "GuardianRelationship" NOT NULL,
  "customRelationship" TEXT,
  "phone" TEXT NOT NULL,
  "nationalId" TEXT,
  "profilePhotoAssetId" TEXT,
  "status" "AuthorizedPickupStatus" NOT NULL DEFAULT 'ACTIVE',
  "validFrom" DATE,
  "validUntil" DATE,
  "securityNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthorizedPickup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthorizedPickup_sequenceNumber_check" CHECK ("sequenceNumber" > 0),
  CONSTRAINT "AuthorizedPickup_phone_not_blank" CHECK (length(btrim("phone")) > 0),
  CONSTRAINT "AuthorizedPickup_date_range_check" CHECK (
    "validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" >= "validFrom"
  ),
  CONSTRAINT "AuthorizedPickup_custom_relationship_check" CHECK (
    "relationship" <> 'OTHER' OR length(btrim(COALESCE("customRelationship", ''))) > 0
  )
);

CREATE TABLE "AuthorizedPickupStudent" (
  "authorizedPickupId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthorizedPickupStudent_pkey" PRIMARY KEY ("authorizedPickupId", "studentId")
);

CREATE TABLE "StudentDocument" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "documentType" "StudentDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "expiresAt" DATE,
  "isSensitive" BOOLEAN NOT NULL DEFAULT false,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentDocument_byteSize_check" CHECK ("byteSize" > 0)
);

CREATE TABLE "StudentNote" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "category" "StudentNoteCategory" NOT NULL DEFAULT 'GENERAL',
  "content" TEXT NOT NULL,
  "isSensitive" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentNote_content_not_blank" CHECK (length(btrim("content")) > 0)
);

CREATE TABLE "StudentStatusHistory" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "fromStatus" "StudentStatus",
  "toStatus" "StudentStatus" NOT NULL,
  "reason" TEXT,
  "changedById" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentStatusHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QrCard"
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "guardianId" TEXT,
  ADD COLUMN "authorizedPickupId" TEXT,
  ADD CONSTRAINT "QrCard_single_profile_owner_check" CHECK (
    num_nonnulls("studentId", "guardianId", "authorizedPickupId") <= 1
  );

CREATE UNIQUE INDEX "PersonPhotoAsset_organizationId_sha256_key"
  ON "PersonPhotoAsset"("organizationId", "sha256");
CREATE INDEX "PersonPhotoAsset_organizationId_createdAt_idx"
  ON "PersonPhotoAsset"("organizationId", "createdAt");

CREATE UNIQUE INDEX "Student_organizationId_code_key" ON "Student"("organizationId", "code");
CREATE UNIQUE INDEX "Student_organizationId_sequenceNumber_key" ON "Student"("organizationId", "sequenceNumber");
CREATE UNIQUE INDEX "Student_organizationId_nationalId_key" ON "Student"("organizationId", "nationalId");
CREATE INDEX "Student_organizationId_branchId_status_idx" ON "Student"("organizationId", "branchId", "status");
CREATE INDEX "Student_organizationId_normalizedName_idx" ON "Student"("organizationId", "normalizedName");
CREATE INDEX "Student_organizationId_schoolName_gradeLevel_idx" ON "Student"("organizationId", "schoolName", "gradeLevel");
CREATE INDEX "Student_organizationId_phone_idx" ON "Student"("organizationId", "phone");
CREATE INDEX "Student_organizationId_whatsappPhone_idx" ON "Student"("organizationId", "whatsappPhone");
CREATE INDEX "Student_profilePhotoAssetId_idx" ON "Student"("profilePhotoAssetId");

CREATE UNIQUE INDEX "Guardian_organizationId_code_key" ON "Guardian"("organizationId", "code");
CREATE UNIQUE INDEX "Guardian_organizationId_sequenceNumber_key" ON "Guardian"("organizationId", "sequenceNumber");
CREATE UNIQUE INDEX "Guardian_organizationId_nationalId_key" ON "Guardian"("organizationId", "nationalId");
CREATE INDEX "Guardian_organizationId_normalizedName_idx" ON "Guardian"("organizationId", "normalizedName");
CREATE INDEX "Guardian_organizationId_primaryPhone_idx" ON "Guardian"("organizationId", "primaryPhone");
CREATE INDEX "Guardian_organizationId_whatsappPhone_idx" ON "Guardian"("organizationId", "whatsappPhone");
CREATE INDEX "Guardian_profilePhotoAssetId_idx" ON "Guardian"("profilePhotoAssetId");

CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");
CREATE UNIQUE INDEX "StudentGuardian_one_primary_per_student_key"
  ON "StudentGuardian"("studentId") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX "StudentGuardian_one_financial_per_student_key"
  ON "StudentGuardian"("studentId") WHERE "isFinancialResponsible" = true;

CREATE UNIQUE INDEX "AuthorizedPickup_organizationId_code_key" ON "AuthorizedPickup"("organizationId", "code");
CREATE UNIQUE INDEX "AuthorizedPickup_organizationId_sequenceNumber_key" ON "AuthorizedPickup"("organizationId", "sequenceNumber");
CREATE UNIQUE INDEX "AuthorizedPickup_organizationId_nationalId_key" ON "AuthorizedPickup"("organizationId", "nationalId");
CREATE INDEX "AuthorizedPickup_organizationId_normalizedName_idx" ON "AuthorizedPickup"("organizationId", "normalizedName");
CREATE INDEX "AuthorizedPickup_organizationId_phone_idx" ON "AuthorizedPickup"("organizationId", "phone");
CREATE INDEX "AuthorizedPickup_guardianId_idx" ON "AuthorizedPickup"("guardianId");
CREATE INDEX "AuthorizedPickup_profilePhotoAssetId_idx" ON "AuthorizedPickup"("profilePhotoAssetId");
CREATE INDEX "AuthorizedPickupStudent_studentId_isActive_idx" ON "AuthorizedPickupStudent"("studentId", "isActive");

CREATE UNIQUE INDEX "StudentDocument_studentId_sha256_key" ON "StudentDocument"("studentId", "sha256");
CREATE INDEX "StudentDocument_studentId_documentType_idx" ON "StudentDocument"("studentId", "documentType");
CREATE INDEX "StudentDocument_expiresAt_idx" ON "StudentDocument"("expiresAt");
CREATE INDEX "StudentDocument_uploadedById_idx" ON "StudentDocument"("uploadedById");
CREATE INDEX "StudentNote_studentId_category_createdAt_idx" ON "StudentNote"("studentId", "category", "createdAt");
CREATE INDEX "StudentNote_createdById_idx" ON "StudentNote"("createdById");
CREATE INDEX "StudentStatusHistory_studentId_changedAt_idx" ON "StudentStatusHistory"("studentId", "changedAt");
CREATE INDEX "StudentStatusHistory_changedById_idx" ON "StudentStatusHistory"("changedById");
CREATE INDEX "QrCard_studentId_idx" ON "QrCard"("studentId");
CREATE INDEX "QrCard_guardianId_idx" ON "QrCard"("guardianId");
CREATE INDEX "QrCard_authorizedPickupId_idx" ON "QrCard"("authorizedPickupId");

ALTER TABLE "ProfileSequence" ADD CONSTRAINT "ProfileSequence_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonPhotoAsset" ADD CONSTRAINT "PersonPhotoAsset_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_profilePhotoAssetId_fkey"
  FOREIGN KEY ("profilePhotoAssetId") REFERENCES "PersonPhotoAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_profilePhotoAssetId_fkey"
  FOREIGN KEY ("profilePhotoAssetId") REFERENCES "PersonPhotoAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey"
  FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthorizedPickup" ADD CONSTRAINT "AuthorizedPickup_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizedPickup" ADD CONSTRAINT "AuthorizedPickup_guardianId_fkey"
  FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthorizedPickup" ADD CONSTRAINT "AuthorizedPickup_profilePhotoAssetId_fkey"
  FOREIGN KEY ("profilePhotoAssetId") REFERENCES "PersonPhotoAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthorizedPickupStudent" ADD CONSTRAINT "AuthorizedPickupStudent_authorizedPickupId_fkey"
  FOREIGN KEY ("authorizedPickupId") REFERENCES "AuthorizedPickup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthorizedPickupStudent" ADD CONSTRAINT "AuthorizedPickupStudent_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentStatusHistory" ADD CONSTRAINT "StudentStatusHistory_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentStatusHistory" ADD CONSTRAINT "StudentStatusHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QrCard" ADD CONSTRAINT "QrCard_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QrCard" ADD CONSTRAINT "QrCard_guardianId_fkey"
  FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QrCard" ADD CONSTRAINT "QrCard_authorizedPickupId_fkey"
  FOREIGN KEY ("authorizedPickupId") REFERENCES "AuthorizedPickup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
