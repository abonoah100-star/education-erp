import { CardType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueQrCardDto {
  @IsEnum(CardType)
  cardType!: CardType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  subjectId!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
