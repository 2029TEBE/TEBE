import type {GaizPgExecutor,GaizExecutionContext} from './pg-executor.mjs';
export interface GaizRuntimeComposition extends GaizPgExecutor {
 executeAndCommit(context:GaizExecutionContext,input:{authorizationId:string;custodianId:string;artifact:Buffer}):Promise<unknown>;
}
export function createGaizRuntimeComposition(options:Record<string,unknown>):GaizRuntimeComposition;
