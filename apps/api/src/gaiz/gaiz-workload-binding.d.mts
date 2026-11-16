import type { KeyObject } from 'node:crypto';
export type GaizBoundWorkerAssignment = Readonly<{
  assignmentId:string;
  workerId:string;
  tenantId:string;
  workItemId:string;
  purpose:'gaiz_verify_worker'|'gaiz_execute_worker';
  expiresAtMs:number;
  authenticatedAssignment:true;
  databaseClaimRequired:true;
  importAllowed:false;
  workloadCredentialIssuer:string;
  workloadCredentialExpiresAtMs:number;
}>;
export function bindGaizWorkerIdentity(
  encoded:string,
  options:{
    workload:{
      workerId:string;
      role:'gaiz_verify_worker'|'gaiz_execute_worker';
      credentialIssuer:string;
      credentialExpiresAtMs:number;
    };
    tenantId:string;
    workItemId:string;
    purpose:'gaiz_verify_worker'|'gaiz_execute_worker';
    trustedIssuerPublicKey:KeyObject;
    nowMs:number;
  },
):GaizBoundWorkerAssignment;
