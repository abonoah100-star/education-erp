import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
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
import { GuardianRelationship, GuardianStatus } from '@prisma/client';

export class CreateGuardianDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  nameArabic!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEnglish?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nationalId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  primaryPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsappPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class UpdateGuardianDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  nameArabic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEnglish?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsappPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsEnum(GuardianStatus)
  status?: GuardianStatus;
}

export class GuardianListQueryDto {
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
  @IsEnum(GuardianStatus)
  status?: GuardianStatus;
}

export class LinkGuardianToStudentDto {
  @IsUUID()
  guardianId!: string;

  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customRelationship?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinancialResponsible?: boolean;

  @IsOptional()
  @IsBoolean()
  receivesNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  canPickup?: boolean;
}

export class UpdateStudentGuardianLinkDto {
  @IsOptional()
  @IsEnum(GuardianRelationship)
  relationship?: GuardianRelationship;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customRelationship?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinancialResponsible?: boolean;

  @IsOptional()
  @IsBoolean()
  receivesNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  canPickup?: boolean;
}

export class EndStudentGuardianLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
