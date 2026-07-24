import { CardType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class CreateInventoryBatchDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  templateId!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,24}$/)
  code!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,18}$/)
  prefix!: string;

  @IsInt()
  @Min(1)
  startNumber!: number;

  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number;

  @IsEnum(CardType)
  cardType!: CardType;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}
