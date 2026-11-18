import { Module } from '@nestjs/common';
import { StudioCatalogController } from './studio-catalog.controller';
import { StudioCatalogService } from './studio-catalog.service';
import { StudioRequestController } from './studio-request.controller';
import { StudioRequestService } from './studio-request.service';

@Module({controllers:[StudioCatalogController,StudioRequestController],providers:[StudioCatalogService,StudioRequestService]})
export class StudioCatalogModule {}
