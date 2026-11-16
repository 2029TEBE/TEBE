import { Module } from '@nestjs/common';
import { GaizController } from './gaiz.controller';
import { GaizStagingService } from './gaiz-staging.service';
import { GaizCustodyAttemptsService } from './gaiz-custody-attempts.service';
import { GaizCustodyHandoffService } from './gaiz-custody-handoff.service';

@Module({
  controllers: [GaizController],
  providers: [GaizStagingService,GaizCustodyAttemptsService,GaizCustodyHandoffService],
})
export class GaizModule {}
