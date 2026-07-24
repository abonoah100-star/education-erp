import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService, PermissionsGuard],
})
export class WorkspaceModule {}
