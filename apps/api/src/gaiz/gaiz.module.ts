import { Module } from '@nestjs/common';
import { GaizController } from './gaiz.controller';

@Module({ controllers: [GaizController] })
export class GaizModule {}
