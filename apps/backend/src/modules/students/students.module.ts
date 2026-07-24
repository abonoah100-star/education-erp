import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import { SmartCardsModule } from '../smart-cards/smart-cards.module';
import { AuthorizedPickupsController } from './authorized-pickups.controller';
import { AuthorizedPickupsService } from './authorized-pickups.service';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';
import { PersonAssetsService } from './person-assets.service';
import { ProfileSequenceService } from './profile-sequence.service';
import { StudentsController } from './students.controller';
import { StudentAccessService } from './student-access.service';
import { StudentContentService } from './student-content.service';
import { StudentsCommandService } from './students-command.service';
import { StudentsQueryService } from './students-query.service';

@Module({
  imports: [SmartCardsModule],
  controllers: [StudentsController, GuardiansController, AuthorizedPickupsController],
  providers: [
    StudentAccessService,
    StudentsQueryService,
    StudentsCommandService,
    StudentContentService,
    GuardiansService,
    AuthorizedPickupsService,
    PersonAssetsService,
    ProfileSequenceService,
    PermissionsGuard,
  ],
  exports: [StudentsQueryService, StudentsCommandService, GuardiansService, AuthorizedPickupsService],
})
export class StudentsModule {}
