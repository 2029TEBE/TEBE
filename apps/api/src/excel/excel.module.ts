import { Module } from '@nestjs/common';
import { ExcelController } from './excel.controller';
import { ExcelService } from './excel.service';
import { ExcelImportGuard } from './excel-import.guard';

@Module({ controllers: [ExcelController], providers: [ExcelService, ExcelImportGuard] })
export class ExcelModule {}
