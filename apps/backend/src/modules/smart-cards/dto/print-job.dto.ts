import { CardPrintLayout, CardPrintSide } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreatePrintJobDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  cardIds!: string[];

  @IsEnum(CardPrintLayout)
  layout!: CardPrintLayout;

  @IsEnum(CardPrintSide)
  sideSelection!: CardPrintSide;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}
