import { Module } from '@nestjs/common';
import { StudioCatalogController } from './studio-catalog.controller';
import { StudioCatalogService } from './studio-catalog.service';

@Module({controllers:[StudioCatalogController],providers:[StudioCatalogService]})
export class StudioCatalogModule {}
