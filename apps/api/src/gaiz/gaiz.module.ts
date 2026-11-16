import { Module } from '@nestjs/common';
import { GaizController } from './gaiz.controller';
import { GaizStagingService } from './gaiz-staging.service';
import { GaizCustodyAttemptsService } from './gaiz-custody-attempts.service';
import { GaizCustodyHandoffService } from './gaiz-custody-handoff.service';
import { GaizImportAuthorizationService } from './gaiz-import-authorization.service';
import { GaizSnapshotService } from './gaiz-snapshot.service';
import { GaizMappingRegistryService } from './gaiz-mapping-registry.service';
import { GaizCommitReadinessService } from './gaiz-commit-readiness.service';

@Module({
  controllers: [GaizController],
  providers: [GaizStagingService,GaizCustodyAttemptsService,GaizCustodyHandoffService,GaizImportAuthorizationService,GaizSnapshotService,GaizMappingRegistryService,GaizCommitReadinessService],
})
export class GaizModule {}
