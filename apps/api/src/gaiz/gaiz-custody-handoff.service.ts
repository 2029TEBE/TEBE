import { ConflictException, Injectable } from '@nestjs/common';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';
import { GaizCustodyAttemptsService } from './gaiz-custody-attempts.service';
import { requestGaizCustodyValidation } from './gaiz-custody-bridge.mjs';

/** Internal orchestration only. Not exposed to HTTP, not a KMS adapter.
 * There are intentionally no default trusted directory/provider integrations. */
@Injectable()
export class GaizCustodyHandoffService {
  constructor(private readonly attempts: GaizCustodyAttemptsService) {}

  async validateInternal(
    reviewId: string, artifactSha256: string, recipientKeyId: string,
    trusted: {
      loadRecipient(query: unknown): Promise<unknown>;
      getVerifiedArtifact(query: unknown): Promise<unknown>;
      loadCustodianTrust(query: unknown): Promise<unknown>;
      requestAttestation(claim: unknown): Promise<unknown>;
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
    if (!trusted || ['loadRecipient','getVerifiedArtifact','loadCustodianTrust','requestAttestation']
       .some(k => typeof trusted[k as keyof typeof trusted] !== 'function')) {
      throw new ConflictException('Trusted issuer/custodian adapters not configured');
    }
    return requestGaizCustodyValidation({
      context:{tenantId:session.tenantId,userId:session.userId,
        capabilities:[...session.capabilities]},
      reviewId,artifactSha256,recipientKeyId,
    },{port:{
      loadReview:query=>this.attempts.loadReview(query),
      reserveAttempt:claim=>this.attempts.reserveAttempt(claim),
      recordResult:result=>this.attempts.recordResult(result),
      loadRecipient:query=>trusted.loadRecipient(query),
      getVerifiedArtifact:query=>trusted.getVerifiedArtifact(query),
      loadCustodianTrust:query=>trusted.loadCustodianTrust(query),
      requestAttestation:claim=>trusted.requestAttestation(claim),
    }});
  }
}
