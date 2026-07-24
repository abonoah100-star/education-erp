import { CashboxStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCashboxDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9_-]{2,30}$/)
  code!: string;
}

export class SetCashboxStatusDto {
  @IsEnum(CashboxStatus)
  status!: CashboxStatus;
}
