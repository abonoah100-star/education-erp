import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './core/audit/audit.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { BrandingController } from './modules/branding/branding.controller';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { SmartCardsModule } from './modules/smart-cards/smart-cards.module';
import { StudentsModule } from './modules/students/students.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    WorkspaceModule,
    AccessModule,
    SmartCardsModule,
    StudentsModule,
  ],
  controllers: [HealthController, BrandingController],
})
export class AppModule {}
