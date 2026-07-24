import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import { CardRendererService } from './card-renderer.service';
import { CardSigningService } from './card-signing.service';
import { SmartCardsController } from './smart-cards.controller';
import { SmartCardsService } from './smart-cards.service';

@Module({
  controllers: [SmartCardsController],
  providers: [SmartCardsService, CardSigningService, CardRendererService, PermissionsGuard],
  exports: [SmartCardsService],
})
export class SmartCardsModule {}
