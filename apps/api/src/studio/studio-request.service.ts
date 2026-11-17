import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { withTenant } from '@pmo/db';
import {
  createStudioRequest, voteStudioRequest, assessStudioApprovalSla, StudioPolicyError,
  type StudioDefinition, type StudioPrincipal, type StudioRequest, type StudioRole,
} from '@pmo/contracts';
import { can, capabilitiesFor } from '@pmo/contracts';
import { currentContext } from '../tenancy/tenant-context';

/** Metadata-only request handling. No fulfillment execution or artifact trust is implied. */
@Injectable()
export class StudioRequestService {
  private principal(): StudioPrincipal {
    if (process.env.STUDIO_CATALOG_ENABLED !== 'true') throw new ServiceUnavailableException('Studio catalogue disabled');
    const c=currentContext();
    if (!c.userId || !can(c.capabilities,'read')) throw new ForbiddenException('Authenticated catalog member required');
    const roles:StudioRole[]=['requester'];
    if (can(c.capabilities,'pmoa_approve')) roles.push('reviewer');
    if (can(c.capabilities,'pmoa_manage_work')) roles.push('operator');
    if (can(c.capabilities,'pmoa_admin')) roles.push('publisher');
    return {id:c.userId,tenantId:c.tenantId,roles};
  }
  private rows<T=any>(value:unknown):T[]{return value as T[];}
  private policy<T>(fn:()=>T):T {
    try { return fn(); }
    catch (e) {
      if (e instanceof StudioPolicyError) {
        if (/FORBIDDEN|ROLE_|APPROVER_/.test(e.code)) throw new ForbiddenException(e.code);
        throw new ConflictException(e.code);
      }
      throw e;
    }
  }
  private workflow(definition:StudioDefinition) {
    const named = (id:string) => definition.steps.filter(s=>s.id===id);
    const manager=named('manager'),finance=named('finance'),fulfillment=named('fulfillment');
    if (manager.length!==1 || manager[0].kind!=='approval' || manager[0].mode!=='any'
      || fulfillment.length!==1 || fulfillment[0].kind!=='fulfillment'
      || finance.length>1 || (finance.length===1 && (finance[0].kind!=='approval'||finance[0].mode!=='all'))
      || definition.steps.length!==2+finance.length)
      throw new ConflictException('Unsupported workflow: explicit manager ANY, optional finance ALL and fulfillment required');
    return {manager:manager[0],finance:finance[0],fulfillment:fulfillment[0]};
  }
  private validateValues(definition:StudioDefinition,values:Record<string,unknown>){
    if (!values || typeof values!=='object' || Array.isArray(values)
      || JSON.stringify(values).length>32000) throw new ConflictException('Invalid input size or type');
    const allowed=new Set(definition.fields.map(f=>f.id));
    for(const key of Object.keys(values)) if(!allowed.has(key)) throw new ConflictException('Unknown intake field');
    // Conditions are evaluated against validated, preceding source values.
    // Hidden values must not reach persistence or alter approval routing.
    for(const field of definition.fields){
      if(field.visibleWhen){
        const source=definition.fields.find(f=>f.id===field.visibleWhen!.fieldId);
        if(!source || source.id===field.id || source.visibleWhen ||
          definition.fields.indexOf(source)>=definition.fields.indexOf(field))
          throw new ConflictException('Invalid conditional field dependency');
        const visible=values[source.id]===field.visibleWhen.equals;
        if(!visible){
          if(Object.prototype.hasOwnProperty.call(values,field.id))
            throw new ConflictException('Hidden conditional field was submitted: '+field.id);
          continue;
        }
      }
      const v=values[field.id];
      if(field.readOnly && v!==undefined) throw new ConflictException('Read-only field provided');
      if(field.required && (v===undefined || v===null || v==='')) throw new ConflictException('Required field missing');
      if(v===undefined||v===null)continue;
      const valid = field.type==='text' ? typeof v==='string'&&v.length<=5000
        : field.type==='number' ? typeof v==='number'&&Number.isFinite(v)
        : field.type==='boolean' ? typeof v==='boolean'
        : field.type==='date' ? typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)
        : field.type==='select' ? typeof v==='string'&&(field.options??[]).some(o=>o.id===v)
        : false; // file uploads require a separate verified attachment workflow
      if(!valid) throw new ConflictException('Unsupported or invalid intake value for '+field.id);
    }
  }
  async submit(serviceVersionId:string,values:Record<string,unknown>){
    const actor=this.principal();
    return withTenant(actor.tenantId,async tx=>{
      const [row]=this.rows<any>(await tx.execute(sql`
        SELECT id,version,service_key AS "serviceKey",definition,content_sha256 AS "contentHash"
        FROM studio_service_versions
        WHERE tenant_id=${actor.tenantId} AND id=${serviceVersionId} AND state='published' FOR SHARE
      `));
      if(!row) throw new ConflictException('Published service not found');
      const allowed=row.definition?.accessUserIds;
      if(!Array.isArray(allowed)||!allowed.includes(actor.id)) throw new ForbiddenException('Catalog access forbidden');
      const definition={...row.definition,state:'published',version:row.version,tenantId:actor.tenantId,
        contentHash:row.contentHash} as StudioDefinition;
      this.validateValues(definition,values);
      const {manager,finance}=this.workflow(definition);
      const impact=values.budgetImpact;
      if (finance && (!definition.fields.some(f=>f.id==='budgetImpact' && f.type==='number' && f.required)
        || typeof impact !== 'number'))
        throw new ConflictException('Finance condition requires a mandatory numeric budgetImpact value');
      if (impact!==undefined && (typeof impact!=='number'||impact<0)) throw new ConflictException('Invalid budget impact');
      const financeRequired=typeof impact==='number' && impact>0;
      if(financeRequired&&!finance) throw new ConflictException('Finance approval step required');
      const requestId=randomUUID();
      const initial=this.policy(()=>createStudioRequest({
        requestId,requester:actor,definition,
        managerApprovers:manager.assignees,financeApprovers:finance?.assignees??[],financeRequired,
      }));
      await tx.execute(sql`
        INSERT INTO studio_service_requests
          (id,tenant_id,service_version_id,form_version,workflow_version,definition_sha256,requester_id,phase,submitted_values)
        VALUES (${requestId},${actor.tenantId},${row.id},${initial.pinned.formVersion},
          ${initial.pinned.workflowVersion},${initial.pinned.definitionHash},${actor.id},
          ${initial.phase},${JSON.stringify(values)}::jsonb)
      `);
      return {id:requestId,phase:initial.phase,formVersion:initial.pinned.formVersion,
        workflowVersion:initial.pinned.workflowVersion,artifactExecuted:false};
    });
  }
  private async loadForUpdate(tx:any,actor:StudioPrincipal,id:string){
    const [row]=this.rows<any>(await tx.execute(sql`
      SELECT r.*,v.definition
      FROM studio_service_requests r
      JOIN studio_service_versions v ON v.id=r.service_version_id AND v.tenant_id=r.tenant_id
      WHERE r.tenant_id=${actor.tenantId} AND r.id=${id} FOR UPDATE OF r
    `));
    if(!row) throw new ConflictException('Request not found');
    const [votes,evidence,delegations]=await Promise.all([
      tx.execute(sql`SELECT step_key AS "stepKey",principal_id AS "principalId",decision
        FROM studio_service_decisions WHERE tenant_id=${actor.tenantId} AND request_id=${id}`),
      tx.execute(sql`SELECT id,operator_id AS "operatorId",artifact_reference AS "artifactReference"
        FROM studio_service_evidence WHERE tenant_id=${actor.tenantId} AND request_id=${id}`),
      tx.execute(sql`SELECT step_key AS "stepKey",original_approver_id AS "originalApproverId",
          delegate_id AS "delegateId" FROM studio_approval_delegations
        WHERE tenant_id=${actor.tenantId} AND request_id=${id}`),
    ]);
    const definition={...row.definition,tenantId:actor.tenantId,state:'published',
      version:row.form_version,contentHash:row.definition_sha256} as StudioDefinition;
    const steps=this.workflow(definition);
    const v=this.rows<any>(votes);
    const delegationsByStep=this.rows<any>(delegations);
    const effective=(step:'manager'|'finance',ids:string[])=>ids.map(original=>
      delegationsByStep.find(row=>row.stepKey===step && row.originalApproverId===original)?.delegateId??original);
    const map=(stepKey:string)=>Object.fromEntries(v.filter(x=>x.stepKey===stepKey)
      .map(x=>[x.principalId,x.decision])) as Record<string,'approved'|'rejected'>;
    const request:StudioRequest={
      id:row.id,tenantId:actor.tenantId,requesterId:row.requester_id,
      pinned:{tenantId:actor.tenantId,definitionId:definition.id,formVersion:row.form_version,
        workflowVersion:row.workflow_version,definitionHash:row.definition_sha256},
      phase:row.phase,managerApprovers:effective('manager',steps.manager.assignees),
      financeApprovers:effective('finance',steps.finance?.assignees??[]),managerVotes:map('manager'),
      financeVotes:map('finance'),
      financeRequired:typeof row.submitted_values?.budgetImpact==='number'&&row.submitted_values.budgetImpact>0,
      evidence:this.rows<any>(evidence).map(x=>({id:x.id,operatorId:x.operatorId,artifactId:x.artifactReference})),
    };
    return {request,steps};
  }
  async decide(id:string,decision:'approved'|'rejected'){
    const actor=this.principal();
    if (!actor.roles.includes('reviewer')) throw new ForbiddenException('Reviewer permission required');
    return withTenant(actor.tenantId,async tx=>{
      const {request}=await this.loadForUpdate(tx,actor,id);
      const next=this.policy(()=>voteStudioRequest(request,actor,decision));
      await tx.execute(sql`
        INSERT INTO studio_service_decisions (tenant_id,request_id,step_key,principal_id,decision)
        VALUES (${actor.tenantId},${id},${request.phase},${actor.id},${decision})
      `);
      await tx.execute(sql`
        UPDATE studio_service_requests SET phase=${next.phase},
          updated_at=CASE WHEN ${next.phase}<>${request.phase} THEN now() ELSE updated_at END
        WHERE tenant_id=${actor.tenantId} AND id=${id}
      `);
      return {id,phase:next.phase,decision,executed:false};
    });
  }
  async attachEvidence(id:string,artifactReference:string){
    const actor=this.principal();
    if (!actor.roles.includes('operator')) throw new ForbiddenException('Operator permission required');
    if (!/^sha256:[a-f0-9]{64}$/.test(artifactReference))
      throw new ConflictException('Evidence must reference a SHA-256 digest');
    return withTenant(actor.tenantId,async tx=>{
      const {request,steps}=await this.loadForUpdate(tx,actor,id);
      if(request.phase!=='fulfillment') throw new ConflictException('Approvals not completed');
      if(!steps.fulfillment.assignees.includes(actor.id)) throw new ForbiddenException('Operator is not assigned');
      const [row]=this.rows<any>(await tx.execute(sql`
        INSERT INTO studio_service_evidence (tenant_id,request_id,operator_id,artifact_reference)
        VALUES (${actor.tenantId},${id},${actor.id},${artifactReference})
        RETURNING id
      `));
      return {id:row.id,requestId:id,artifactReference,verified:false,workflowCompleted:false};
    });
  }
  /** One-way, one-seat human delegation. Approval votes are never fabricated.
   * Request row lock serializes delegation against concurrent decisions.
   */
  async delegateApproval(id:string,body:{
    step:'manager'|'finance';originalApproverId:string;delegateId:string;reason:string;
  }){
    const actor=this.principal();
    if(!actor.roles.includes('publisher'))throw new ForbiddenException('Studio administrator capability required');
    const reason=body.reason.trim();
    if(reason.length<10||reason.length>1000)throw new ConflictException('Delegation justification must be 10-1000 characters');
    if(body.originalApproverId===body.delegateId||actor.id===body.delegateId)
      throw new ForbiddenException('Delegation must target a distinct reviewer');
    return withTenant(actor.tenantId,async tx=>{
      const {request,steps}=await this.loadForUpdate(tx,actor,id);
      if(request.phase!==body.step)throw new ConflictException('Only the active approval step can be delegated');
      if(request.requesterId===body.delegateId)throw new ForbiddenException('Requester may never approve own request');
      const stage=body.step==='manager'?steps.manager:steps.finance;
      if(!stage||!stage.assignees.includes(body.originalApproverId))
        throw new ConflictException('Original approver is not assigned to this step');
      const voters=body.step==='manager'?request.managerVotes:request.financeVotes;
      if(voters[body.originalApproverId]||voters[body.delegateId])
        throw new ConflictException('Already voted approval seats cannot be reassigned');
      if(request.managerApprovers.includes(body.delegateId)||
         request.financeApprovers.includes(body.delegateId))
        throw new ConflictException('Delegate already holds a request approval seat');
      if(!request[body.step==='manager'?'managerApprovers':'financeApprovers'].includes(body.originalApproverId))
        throw new ConflictException('Approval seat has already been delegated');
      const [candidate]=this.rows<any>(await tx.execute(sql`
        SELECT m.role,u.is_active AS "userActive"
        FROM memberships m JOIN users u ON u.id=m.user_id
        WHERE m.tenant_id=${actor.tenantId} AND m.user_id=${body.delegateId}
          AND m.is_active=true
      `));
      if(!candidate||!candidate.userActive||!can(capabilitiesFor(candidate.role),'pmoa_approve'))
        throw new ForbiddenException('Delegate must be an active, approval-capable member of this tenant');
      const [receipt]=this.rows<any>(await tx.execute(sql`
        INSERT INTO studio_approval_delegations
          (tenant_id,request_id,step_key,original_approver_id,delegate_id,delegated_by,reason)
        VALUES (${actor.tenantId},${id},${body.step},${body.originalApproverId},
          ${body.delegateId},${actor.id},${reason})
        RETURNING id,request_id AS "requestId",step_key AS "step",
          original_approver_id AS "originalApproverId",delegate_id AS "delegateId",
          created_at AS "createdAt"
      `));
      return {...receipt,delegated:true,approved:false,phaseChanged:false,notified:false};
    });
  }

  /** Inbox is scoped to the actual authenticated principal and assigned step.
   * Definition metadata never becomes a cross-tenant or unassigned request feed.
   */
  async assignedApprovals(){
    const actor=this.principal();
    if(!actor.roles.includes('reviewer')) throw new ForbiddenException('Reviewer capability required');
    const result=await withTenant(actor.tenantId,tx=>tx.execute(sql`
      SELECT r.id, r.phase, r.submitted_at AS "submittedAt",
             r.updated_at AS "phaseStartedAt", r.form_version AS "formVersion",
             v.service_key AS "serviceKey",
             step->>'timeoutHours' AS "timeoutHours",
             step->>'timeoutAction' AS "timeoutAction"
      FROM studio_service_requests r
      JOIN studio_service_versions v
        ON v.id=r.service_version_id AND v.tenant_id=r.tenant_id
      CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') step
      WHERE r.tenant_id=${actor.tenantId}
        AND r.phase IN ('manager','finance')
        AND r.requester_id <> ${actor.id}
        AND step->>'id'=r.phase AND step->>'kind'='approval'
        AND step->'assignees' @> to_jsonb(${actor.id}::text)
        AND NOT EXISTS (
          SELECT 1 FROM studio_service_decisions d
          WHERE d.tenant_id=r.tenant_id AND d.request_id=r.id
            AND d.step_key=r.phase AND d.principal_id=${actor.id}
        )
      ORDER BY r.submitted_at ASC LIMIT 100
    `));
    const now=new Date();
    return this.rows<any>(result).map(row=>{
      const status=assessStudioApprovalSla({
        phaseStartedAt:row.phaseStartedAt,now,
        timeoutHours:row.timeoutHours===null?null:Number(row.timeoutHours),
        timeoutAction:row.timeoutAction,
      });
      // A policy label means human review is due, never that automatic
      // rejection or reassignment was executed.
      return {id:row.id,phase:row.phase,submittedAt:row.submittedAt,
        phaseStartedAt:row.phaseStartedAt,formVersion:row.formVersion,
        serviceKey:row.serviceKey,sla:status};
    });
  }

  /** Tenant-admin escalation review only; never acts on an approval. */
  async overdueApprovals(){
    const actor=this.principal();
    if(!actor.roles.includes('publisher')) throw new ForbiddenException('Studio admin capability required');
    const result=await withTenant(actor.tenantId,tx=>tx.execute(sql`
      SELECT r.id,r.phase,r.updated_at AS "phaseStartedAt",
        r.submitted_at AS "submittedAt",v.service_key AS "serviceKey",
        step->>'timeoutHours' AS "timeoutHours",
        step->>'timeoutAction' AS "timeoutAction",
        r.form_version AS "formVersion"
      FROM studio_service_requests r
      JOIN studio_service_versions v ON v.id=r.service_version_id AND v.tenant_id=r.tenant_id
      CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') step
      WHERE r.tenant_id=${actor.tenantId}
        AND r.phase IN ('manager','finance')
        AND step->>'id'=r.phase AND step->>'kind'='approval'
        AND jsonb_typeof(step->'timeoutHours') = 'number'
        AND CASE WHEN (step->>'timeoutHours') ~ '^[0-9]{1,3}$'
             THEN (step->>'timeoutHours')::int BETWEEN 1 AND 720 ELSE false END
        AND r.updated_at +
          CASE WHEN (step->>'timeoutHours') ~ '^[0-9]{1,3}$'
               THEN (step->>'timeoutHours')::int ELSE 720 END * INTERVAL '1 hour' <= now()
        AND NOT EXISTS (
          SELECT 1 FROM studio_service_decisions d
          WHERE d.tenant_id=r.tenant_id AND d.request_id=r.id AND d.step_key=r.phase
            AND d.decision='rejected'
        )
      ORDER BY r.updated_at ASC,r.id ASC LIMIT 100
    `));
    const now=new Date();
    return this.rows<any>(result).flatMap(row=>{
      const sla=assessStudioApprovalSla({
        phaseStartedAt:row.phaseStartedAt,now,
        timeoutHours:Number(row.timeoutHours),timeoutAction:row.timeoutAction,
      });
      if(sla.status!=='overdue')return [];
      return [{id:row.id,phase:row.phase,serviceKey:row.serviceKey,
        formVersion:row.formVersion,submittedAt:row.submittedAt,
        phaseStartedAt:row.phaseStartedAt,sla,
        actionStatus:'awaiting_authorized_human_review',
        autoDecision:false,autoDelegation:false}];
    });
  }

  /** Administrator acknowledgment is an append-only audit receipt.
   * It never changes request phase, approval votes or reviewer assignment.
   */
  async recordEscalationReview(id:string,body:{
    step:'manager'|'finance';
    action:'acknowledged'|'contacted_owner'|'referred_to_governance';
    note:string;
  }){
    const actor=this.principal();
    if(!actor.roles.includes('publisher'))throw new ForbiddenException('Studio admin capability required');
    const note=body.note.trim();
    if(note.length<10||note.length>1000)throw new ConflictException('A review note of 10–1000 characters is required');
    return withTenant(actor.tenantId,async tx=>{
      const [row]=this.rows<any>(await tx.execute(sql`
        SELECT r.id,r.phase,r.updated_at AS "phaseStartedAt",
               step->>'timeoutHours' AS "timeoutHours",
               step->>'timeoutAction' AS "timeoutAction"
        FROM studio_service_requests r
        JOIN studio_service_versions v
          ON v.id=r.service_version_id AND v.tenant_id=r.tenant_id
        CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') step
        WHERE r.tenant_id=${actor.tenantId} AND r.id=${id}
          AND r.phase=${body.step} AND r.phase IN ('manager','finance')
          AND step->>'id'=r.phase AND step->>'kind'='approval'
        FOR UPDATE OF r
      `));
      if(!row)throw new ConflictException('Current approval step not found');
      const hours=typeof row.timeoutHours==='string'?Number(row.timeoutHours):null;
      const sla=assessStudioApprovalSla({
        phaseStartedAt:row.phaseStartedAt,now:new Date(),
        timeoutHours:hours,timeoutAction:row.timeoutAction,
      });
      if(sla.status!=='overdue')throw new ConflictException('Escalation review is permitted only for an overdue approval');
      const [receipt]=this.rows<any>(await tx.execute(sql`
        INSERT INTO studio_escalation_reviews
          (tenant_id,request_id,step_key,reviewed_by,action,note,phase_started_at)
        VALUES (${actor.tenantId},${id},${body.step},${actor.id},
                ${body.action},${note},${row.phaseStartedAt})
        RETURNING id,request_id AS "requestId",step_key AS "step",
                  action,created_at AS "createdAt"
      `));
      return {...receipt,recorded:true,requestChanged:false,
        autoDecision:false,autoDelegation:false};
    });
  }

  async myRequests(){
    const actor=this.principal();
    const result=await withTenant(actor.tenantId,tx=>tx.execute(sql`
      SELECT id,service_version_id AS "serviceVersionId",form_version AS "formVersion",
        workflow_version AS "workflowVersion",phase,submitted_at AS "submittedAt"
      FROM studio_service_requests
      WHERE tenant_id=${actor.tenantId} AND requester_id=${actor.id}
      ORDER BY submitted_at DESC LIMIT 100
    `));
    return this.rows(result);
  }
}
