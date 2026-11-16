import { Module } from '@nestjs/common';
import { GaizController } from './gaiz.controller';
import { GaizStagingService } from './gaiz-staging.service';

@Module({ controllers: [GaizController], providers: [GaizStagingService] })
export class GaizModule {}
