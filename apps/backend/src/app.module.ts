import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './core/audit/audit.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { SmartCardsModule } from './modules/smart-cards/smart-cards.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    WorkspaceModule,
    AccessModule,
    SmartCardsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
