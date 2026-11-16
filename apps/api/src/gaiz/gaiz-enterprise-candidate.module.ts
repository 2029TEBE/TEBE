import { Module } from '@nestjs/common';
import { GaizEnterpriseCandidateController } from './gaiz-enterprise-candidate.controller';
import { GaizOrchestrator } from './gaiz-orchestrator';

/**
 * Intentionally NOT imported by AppModule. Does not activate public routes.
 * Do not register until reviewed persistence, custody, trust and RLS are wired.
 */
@Module({
  controllers: [GaizEnterpriseCandidateController],
  providers: [GaizOrchestrator],
})
export class GaizEnterpriseCandidateModule {}
