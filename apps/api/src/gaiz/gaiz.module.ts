import { Module } from '@nestjs/common';
import { GaizController } from './gaiz.controller';
import { GaizOrchestrator } from './gaiz-orchestrator';

/**
 * Intentionally NOT imported by AppModule. Does not activate public routes.
 * Do not register until reviewed persistence, custody, trust and RLS are wired.
 */
@Module({
  controllers: [GaizController],
  providers: [GaizOrchestrator],
})
export class GaizModule {}
