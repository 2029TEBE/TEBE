import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { RequiresModule } from '../platform/module.guard';
import { StudioRequestService } from './studio-request.service';

const submitBody=z.object({
 serviceVersionId:z.string().uuid(), values:z.record(z.string().max(100),z.unknown())
}).strict();
const decisionBody=z.object({decision:z.enum(['approved','rejected'])}).strict();
const escalationBody=z.object({step:z.enum(['manager','finance']),action:z.enum(['acknowledged','contacted_owner','referred_to_governance']),note:z.string().trim().min(10).max(1000)}).strict();
const evidenceBody=z.object({artifactReference:z.string().regex(/^sha256:[a-f0-9]{64}$/)}).strict();
@Controller('api/v1/studio/requests')
@RequiresModule('pmo360')
export class StudioRequestController {
 constructor(private readonly svc:StudioRequestService){}
 @Get() mine(){return this.svc.myRequests();}
 @Get('assigned') assigned(){return this.svc.assignedApprovals();}
 @Get('overdue') overdue(){return this.svc.overdueApprovals();}
 @Post() submit(@Body(new ZodPipe(submitBody)) body:z.infer<typeof submitBody>){
   return this.svc.submit(body.serviceVersionId,body.values);
 }
 @Post(':id/decision')
 decide(@Param('id',ParseUUIDPipe) id:string,@Body(new ZodPipe(decisionBody)) body:z.infer<typeof decisionBody>){
   return this.svc.decide(id,body.decision);
 }
 @Post(':id/escalation-review')
 recordEscalationReview(@Param('id',ParseUUIDPipe) id:string,@Body(new ZodPipe(escalationBody)) body:z.infer<typeof escalationBody>){
   return this.svc.recordEscalationReview(id,body);
 }
 @Post(':id/evidence')
 evidence(@Param('id',ParseUUIDPipe) id:string,@Body(new ZodPipe(evidenceBody)) body:z.infer<typeof evidenceBody>){
   return this.svc.attachEvidence(id,body.artifactReference);
 }
}
