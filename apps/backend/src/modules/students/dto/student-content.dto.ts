import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { StudentDocumentType, StudentNoteCategory } from '@prisma/client';

export class UploadStudentDocumentDto {
  @IsEnum(StudentDocumentType)
  documentType!: StudentDocumentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isSensitive?: boolean;
}

export class CreateStudentNoteDto {
  @IsOptional()
  @IsEnum(StudentNoteCategory)
  category?: StudentNoteCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isSensitive?: boolean;
}
