import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(2, 80)
  systemName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  cardSubtitle?: string;

  @IsOptional()
  @IsString()
  @Length(0, 180)
  cardBackTitle?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  cardBackInstruction?: string;

  @IsOptional()
  @IsString()
  @Length(0, 180)
  cardBackFooter?: string;
}
