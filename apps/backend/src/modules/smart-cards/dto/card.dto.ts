import { CardCodeFormat, CardType, SmartCardStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class IssueSmartCardDto {
  @IsEnum(CardType)
  cardType!: CardType;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  templateId!: string;

  @IsString()
  @Length(2, 120)
  ownerName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  portraitAssetId?: string;

  @IsOptional()
  @IsEnum(CardCodeFormat)
  codeFormat?: CardCodeFormat;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class AssignInventoryCardDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  templateId!: string;

  @IsEnum(CardType)
  cardType!: CardType;

  @IsString()
  @Length(2, 120)
  ownerName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  portraitAssetId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class SetSmartCardStatusDto {
  @IsEnum(SmartCardStatus)
  status!: SmartCardStatus;
}

export class SmartCardListQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(CardType)
  cardType?: CardType;

  @IsOptional()
  @IsEnum(SmartCardStatus)
  status?: SmartCardStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
