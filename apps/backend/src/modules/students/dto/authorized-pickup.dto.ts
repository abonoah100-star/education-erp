import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthorizedPickupStatus, GuardianRelationship } from '@prisma/client';

export class CreateAuthorizedPickupDto {
  @IsOptional()
  @IsUUID()
  guardianId?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  nameArabic!: string;

  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customRelationship?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nationalId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  securityNotes?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  studentIds!: string[];
}

export class UpdateAuthorizedPickupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameArabic?: string;

  @IsOptional()
  @IsEnum(GuardianRelationship)
  relationship?: GuardianRelationship;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customRelationship?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nationalId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  securityNotes?: string;

  @IsOptional()
  @IsEnum(AuthorizedPickupStatus)
  status?: AuthorizedPickupStatus;
}

export class AuthorizedPickupListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsEnum(AuthorizedPickupStatus)
  status?: AuthorizedPickupStatus;
}

export class LinkAuthorizedPickupStudentDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
