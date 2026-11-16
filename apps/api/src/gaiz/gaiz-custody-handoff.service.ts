import { ConflictException, Injectable } from '@nestjs/common';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';
import { GaizCustodyAttemptsService } from './gaiz-custody-attempts.service';
import { GaizTrustDirectoryService } from './gaiz-trust-directory.service';
import { requestGaizCustodyValidation } from './gaiz-custody-bridge.mjs';
import { makeCustodianMtlsTransport } from './gaiz-custodian-mtls.mjs';
import type { GaizMtlsTransportConfig } from './gaiz-custodian-mtls.mjs';

/** Internal orchestration only. Not exposed to HTTP, not a KMS adapter.
 * There are intentionally no default trusted directory/provider integrations. */
@Injectable()
export class GaizCustodyHandoffService {
  constructor(private readonly attempts: GaizCustodyAttemptsService,
    private readonly trustDirectory: GaizTrustDirectoryService) {}

  async validateInternal(
    reviewId: string, artifactSha256: string, recipientKeyId: string,
    trusted: {
      custodianId:string;
      getVerifiedArtifact(query: unknown): Promise<unknown>;
      mtls:GaizMtlsTransportConfig;
    },
  ) {
    if (process.env.NODE_ENV !== 'development' ||
        (process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV !== 'development') ||
        process.env.GAIZ_CUSTODY_BRIDGE_ENABLED !== 'true') {
      throw new ConflictException('GAIZ custody handoff disabled');
    }
    requireCapability('pmoa_admin');
    const session=currentContext();
    if (!session.userId) throw new ConflictException('Authenticated operator required');
    if (!trusted || typeof trusted.getVerifiedArtifact !== 'function' || !trusted.mtls) {
      throw new ConflictException('Trusted issuer/custodian adapters not configured');
    }
    if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trusted.custodianId))
      throw new ConflictException('Named custodian required');
    if(trusted.mtls.custodianId!==trusted.custodianId)
      throw new ConflictException('Custodian endpoint identity mismatch');
    // Fail closed until a separately provisioned service identity has been
    // configured. This does not provide a fallback custodian or key material.
    const transport=makeCustodianMtlsTransport(trusted.mtls);
    return requestGaizCustodyValidation({
      context:{tenantId:session.tenantId,userId:session.userId,
        capabilities:[...session.capabilities]},
      reviewId,artifactSha256,recipientKeyId,
    },{port:{
      loadReview:query=>this.attempts.loadReview(query),
      reserveAttempt:claim=>this.attempts.reserveAttempt(claim),
      recordResult:result=>this.attempts.recordResult(result),
      loadRecipient:query=>this.trustDirectory.loadRecipient(query),
      getVerifiedArtifact:query=>trusted.getVerifiedArtifact(query),
      loadCustodianTrust:query=>this.trustDirectory.loadCustodianTrust({
        tenantId:query.tenantId,custodianId:trusted.custodianId,
      }),
      requestAttestation:claim=>transport.requestAttestation(claim),
    }});
  }
}
