import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  controllers: [AccessController],
  providers: [AccessService, PermissionsGuard],
})
export class AccessModule {}
