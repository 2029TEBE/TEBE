import { ConflictException, Injectable } from '@nestjs/common';
import { withGaizExecutionTransaction } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';
import type { GaizPgExecutor } from './runtime/pg-executor.mjs';
import type { GaizRuntimeComposition } from './runtime/composition.mjs';

/** Internal trusted-worker entry point. No HTTP controller accepts patches,
 * principals, key references or configuration. Composition is server-owned. */
@Injectable()
export class GaizExecutorService {
  private runtime: GaizPgExecutor | undefined;
  async configureInternal(options:{grantPublicKey:unknown;signGrant:Function}) {
    if(this.runtime)throw new ConflictException('GAIZ executor already configured');
    const {createPgGaizExecutor}=await import('./runtime/pg-executor.mjs');
    this.runtime=createPgGaizExecutor({transaction:withGaizExecutionTransaction,...options});
  }
  async configureCompositionInternal(options:Record<string,unknown>) {
    if(this.runtime)throw new ConflictException('GAIZ executor already configured');
    const {createGaizRuntimeComposition}=await import('./runtime/composition.mjs');
    this.runtime=createGaizRuntimeComposition({...options,transaction:withGaizExecutionTransaction});
  }
  executeInternal(input:{authorizationId:string;custodianId:string;artifact:Buffer}) {
    const caller=this.caller();
    const runtime=this.runtime as GaizRuntimeComposition;
    if(typeof runtime.executeAndCommit!=='function')throw new ConflictException('Custodian runtime unavailable');
    return runtime.executeAndCommit(caller,input);
  }
  private caller() {
    if(process.env.GAIZ_EXECUTOR_ENABLED!=='true')throw new ConflictException('GAIZ executor disabled');
    requireCapability('pmoa_admin');
    const ctx=currentContext();
    if(!ctx.userId||!this.runtime)throw new ConflictException('Trusted runtime and authenticated administrator required');
    return {tenantId:ctx.tenantId,userId:ctx.userId,capabilities:['pmoa_admin']};
  }
  issueInternal(input:{authorizationId:string;custodianId:string}) {
    const caller=this.caller();return this.runtime!.issue(caller,input);
  }
  commitInternal(signedResult:unknown) {
    const caller=this.caller();return this.runtime!.commit(caller,signedResult);
  }
}
