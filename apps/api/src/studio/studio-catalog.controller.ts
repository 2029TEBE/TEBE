import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { RequiresModule } from '../platform/module.guard';
import { StudioCatalogService } from './studio-catalog.service';

const localized=z.record(z.string().min(1).max(1000));
const field=z.object({
 id:z.string().min(1).max(100),type:z.enum(['text','number','date','boolean','select','file']),
 label:localized,help:localized.optional(),required:z.boolean().optional(),readOnly:z.boolean().optional(),
 options:z.array(z.object({id:z.string().min(1).max(100),label:localized}).strict()).max(100).optional()
}).strict();
const step=z.object({
 id:z.string().min(1).max(100),kind:z.enum(['approval','fulfillment']),
 label:localized, assignees:z.array(z.string().uuid()).min(1).max(50),
 mode:z.enum(['any','all']).optional(),timeoutAction:z.enum(['escalate','reject','return_for_revision']).optional()
}).strict();
const definition=z.object({
 id:z.string().min(1).max(100),tenantId:z.string().uuid(),version:z.literal(1),
 state:z.literal('draft'),contentHash:z.string().regex(/^[a-f0-9]{64}$/),
 creatorId:z.string().uuid(),name:localized,
 fields:z.array(field).min(1).max(100),steps:z.array(step).min(1).max(50)
}).strict();
const createBody=z.object({serviceKey:z.string().regex(/^[a-z][a-z0-9_-]{2,79}$/),definition}).strict();

@Controller('api/v1/studio')
@RequiresModule('pmo360')
export class StudioCatalogController {
 constructor(private readonly svc:StudioCatalogService){}
 @Get('catalog') catalog(){return this.svc.catalog();}
 @Get('definitions') definitions(){return this.svc.myDefinitions();}
 @Post('definitions') create(@Body(new ZodPipe(createBody)) body:z.infer<typeof createBody>){
   return this.svc.create(body);
 }
 @Post('definitions/:id/submit-review')
 submitReview(@Param('id',ParseUUIDPipe) id:string){return this.svc.transition(id,'submit_review');}
 @Post('definitions/:id/approve')
 approve(@Param('id',ParseUUIDPipe) id:string){return this.svc.transition(id,'approve');}
 @Post('definitions/:id/publish')
 publish(@Param('id',ParseUUIDPipe) id:string){return this.svc.transition(id,'publish');}
 @Post('definitions/:id/retire')
 retire(@Param('id',ParseUUIDPipe) id:string){return this.svc.transition(id,'retire');}
}
