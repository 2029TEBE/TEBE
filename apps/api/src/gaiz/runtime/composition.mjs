// Server composition only; TO module and all credentials come from a pinned
// deployment artifact, never an uploaded file, browser or dynamic request URL.
import {createPgGaizExecutor,createPgGaizPolicyStore} from './pg-executor.mjs';
import {createVaultTransit} from './vault-transit.mjs';
export function createGaizRuntimeComposition({transaction,grantPublicKey,grantSigningRef,custodyRoutes,grantVault,custodianVault,ledger,createTrustedRuntime,clock=Date.now}={}){
 if(typeof createTrustedRuntime!=='function')throw Error('Pinned TO runtime required');
 const custody=createVaultTransit(custodianVault);
 const grantCustody=createVaultTransit(grantVault);
 const executor=createPgGaizExecutor({transaction,grantPublicKey,signGrant:bytes=>grantCustody.sign(bytes,grantSigningRef),clock});
 const policyStore=createPgGaizPolicyStore({transaction,custodyRoutes,clock});
 const worker=createTrustedRuntime({grantPublicKey,policyStore,custody,ledger,clock});
 return Object.freeze({
  issue:(context,input)=>executor.issue(context,input),
  commit:(context,envelope)=>executor.commit(context,envelope),
  async executeAndCommit(context,{authorizationId,custodianId,artifact}){
   const request=await executor.issue(context,{authorizationId,custodianId});
   const result=await worker.execute({...request,artifact});
   return executor.commit(context,result);
  },
 });
}
