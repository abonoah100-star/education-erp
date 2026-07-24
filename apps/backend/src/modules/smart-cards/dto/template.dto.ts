import { CardCodeFormat, CardType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateCardTemplateDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @Length(2, 32)
  code!: string;

  @IsEnum(CardType)
  cardType!: CardType;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsHexColor()
  backgroundColor!: string;

  @IsHexColor()
  accentColor!: string;

  @IsHexColor()
  textColor!: string;

  @IsHexColor()
  mutedTextColor!: string;

  @IsEnum(CardCodeFormat)
  defaultCodeFormat!: CardCodeFormat;

  @IsBoolean()
  showPhoto!: boolean;

  @IsBoolean()
  showBranch!: boolean;

  @IsBoolean()
  showExpiry!: boolean;
}

export class SetCardTemplateStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
