import { Module } from '@nestjs/common';
import { GaizController } from './gaiz.controller';
import { GaizStagingService } from './gaiz-staging.service';
import { GaizCustodyAttemptsService } from './gaiz-custody-attempts.service';
import { GaizCustodyHandoffService } from './gaiz-custody-handoff.service';
import { GaizImportAuthorizationService } from './gaiz-import-authorization.service';
import { GaizSnapshotService } from './gaiz-snapshot.service';

@Module({
  controllers: [GaizController],
  providers: [GaizStagingService,GaizCustodyAttemptsService,GaizCustodyHandoffService,GaizImportAuthorizationService,GaizSnapshotService],
})
export class GaizModule {}
