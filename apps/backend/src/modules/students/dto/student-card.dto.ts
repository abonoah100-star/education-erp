import { CardCodeFormat } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class IssueStudentCardDto {
  @IsUUID()
  templateId!: string;

  @IsOptional()
  @IsEnum(CardCodeFormat)
  codeFormat?: CardCodeFormat;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class AssignStudentInventoryCardDto {
  @IsUUID()
  cardId!: string;

  @IsUUID()
  templateId!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
