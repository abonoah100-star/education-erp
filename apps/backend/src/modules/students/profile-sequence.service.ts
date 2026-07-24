import { Injectable } from '@nestjs/common';
import type { Prisma, ProfileSequenceType } from '@prisma/client';
import { formatProfileCode } from './domain/profile-code';

interface SequenceRow {
  lastNumber: number;
}

@Injectable()
export class ProfileSequenceService {
  async next(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    profileType: ProfileSequenceType,
  ): Promise<{ sequenceNumber: number; code: string }> {
    const rows = await transaction.$queryRaw<SequenceRow[]>`
      INSERT INTO "ProfileSequence" (
        "organizationId",
        "profileType",
        "lastNumber",
        "updatedAt"
      )
      VALUES (
        ${organizationId},
        CAST(${profileType} AS "ProfileSequenceType"),
        1,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("organizationId", "profileType")
      DO UPDATE SET
        "lastNumber" = "ProfileSequence"."lastNumber" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "lastNumber"
    `;

    const sequenceNumber = rows[0]?.lastNumber;
    if (!sequenceNumber) throw new Error('Profile sequence could not be generated.');
    return {
      sequenceNumber,
      code: formatProfileCode(profileType, sequenceNumber),
    };
  }
}
