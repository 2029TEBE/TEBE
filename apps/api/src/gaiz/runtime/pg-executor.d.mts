export interface GaizExecutionContext {tenantId:string;userId:string;capabilities:string[];}
export interface GaizPgExecutor {
 issue(context:GaizExecutionContext,input:{authorizationId:string;custodianId:string}):Promise<unknown>;
 commit(context:GaizExecutionContext,envelope:unknown):Promise<unknown>;
}
export function createPgGaizExecutor(options:{transaction:Function;grantPublicKey:unknown;signGrant:Function;clock?:()=>number}):GaizPgExecutor;
