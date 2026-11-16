import { GaizExecutorService } from './gaiz-executor.service';
import { Module } from '@nestjs/common';
import { GaizController } from './gaiz.controller';
import { GaizStagingService } from './gaiz-staging.service';
import { GaizCustodyAttemptsService } from './gaiz-custody-attempts.service';
import { GaizCustodyHandoffService } from './gaiz-custody-handoff.service';
import { GaizImportAuthorizationService } from './gaiz-import-authorization.service';
import { GaizSnapshotService } from './gaiz-snapshot.service';
import { GaizMappingRegistryService } from './gaiz-mapping-registry.service';
import { GaizCommitReadinessService } from './gaiz-commit-readiness.service';
import { GaizTrustDirectoryService } from './gaiz-trust-directory.service';

@Module({
  exports: [GaizExecutorService],
  controllers: [GaizController],
  providers: [GaizExecutorService,GaizStagingService,GaizCustodyAttemptsService,GaizCustodyHandoffService,GaizImportAuthorizationService,GaizSnapshotService,GaizMappingRegistryService,GaizCommitReadinessService,GaizTrustDirectoryService],
})
export class GaizModule {}
