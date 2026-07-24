import { UserStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
