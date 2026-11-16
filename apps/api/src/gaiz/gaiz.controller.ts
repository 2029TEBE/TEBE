import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post,
} from '@nestjs/common';
import {
  gaizDecision, gaizExportSubmission, gaizImportSubmission,
  type GaizDecision, type GaizExportSubmission, type GaizImportSubmission,
} from '@pmo/contracts';
import { ZodPipe } from '../common/zod.pipe';
import { RequiresModule } from '../platform/module.guard';
import { GaizOrchestrator } from './gaiz-orchestrator';

/**
 * Proposed enterprise routes. This controller is NOT registered in AppModule.
 * Analytics entitlement is a conservative placeholder pending a dedicated
 * GAIZ licensing decision; service checks remain mandatory.
 */
@RequiresModule('analytics360')
@Controller('api/v1/gaiz')
export class GaizController {
  constructor(private readonly gaiz: GaizOrchestrator) {}

  @Post('imports')
  submitImport(@Body(new ZodPipe(gaizImportSubmission)) body: GaizImportSubmission) {
    return this.gaiz.submitImport(body);
  }

  @Get('imports/:id')
  readImport(@Param('id', ParseUUIDPipe) id: string) {
    return this.gaiz.readImport(id);
  }

  @Post('imports/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(gaizDecision)) body: GaizDecision) {
    return this.gaiz.decideImport(id, 'approve', body);
  }

  @Post('imports/:id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(gaizDecision)) body: GaizDecision) {
    return this.gaiz.decideImport(id, 'reject', body);
  }

  @Post('exports')
  submitExport(@Body(new ZodPipe(gaizExportSubmission)) body: GaizExportSubmission) {
    return this.gaiz.submitExport(body);
  }

  @Get('exports/:id')
  readExport(@Param('id', ParseUUIDPipe) id: string) {
    return this.gaiz.readExport(id);
  }
}
