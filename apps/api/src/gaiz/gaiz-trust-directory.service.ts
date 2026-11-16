import { ConflictException, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import { createHash, createPublicKey } from 'node:crypto';
import { gaizTrustKeys, gaizRecoveryConsents, withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { requireCapability } from '../common/require-capability';

/** Internal, read-only public trust directory, without key-enrollment privileges.
 * A security administrator must provision key/consent records outside the app.
 * This service cannot authenticate a remote custodian or decrypt content. */
@Injectable()
export class GaizTrustDirectoryService {
  private tenant() {
    if (process.env.NODE_ENV !== 'development' ||
       (process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV !== 'development') ||
       process.env.GAIZ_TRUST_DIRECTORY_ENABLED !== 'true')
      throw new ConflictException('GAIZ trust directory disabled');
    requireCapability('pmoa_admin');
    const ctx=currentContext();
    if (!ctx.userId) throw new ConflictException('Authenticated operator required');
    return ctx.tenantId;
  }
  private async loadKey(tenantId:string,keyKind:'issuer'|'recipient'|'custodian',keyId:string){
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(keyId))
      throw new ConflictException('Invalid trust key ID');
    const now=new Date();
    const [row]=await withTenant(tenantId,tx=>tx.select().from(gaizTrustKeys).where(and(
      eq(gaizTrustKeys.tenantId,tenantId),eq(gaizTrustKeys.keyKind,keyKind),
      eq(gaizTrustKeys.keyId,keyId),eq(gaizTrustKeys.status,'active'),
      lt(gaizTrustKeys.validFrom,now),gt(gaizTrustKeys.validUntil,now),
      isNull(gaizTrustKeys.revokedAt),
    )).limit(1));
    if (!row||!row.approvedBy||row.approvedBy===row.registeredBy||!row.approvedAt)
      throw new ConflictException('Unapproved trust record');
    let key;
    try {key=createPublicKey(row.publicKeyPem);} catch {
      throw new ConflictException('Invalid trusted public key');
    }
    const expectedType=keyKind==='recipient'?'rsa':'ed25519';
    if(key.asymmetricKeyType!==expectedType ||
       (expectedType==='rsa' && (key.asymmetricKeyDetails?.modulusLength??0)<3072))
      throw new ConflictException('Untrusted public-key algorithm');
    const actualHash=createHash('sha256').update(
      key.export({type:'spki',format:'der'})).digest('hex');
    if(actualHash!==row.publicKeySha256)throw new ConflictException('Trust-key fingerprint mismatch');
    return row;
  }
  async loadRecipient(query:{tenantId:string;recipientKeyId:string}){
    const tenantId=this.tenant();
    if(query.tenantId!==tenantId)throw new ConflictException('Cross-tenant recipient');
    const row=await this.loadKey(tenantId,'recipient',query.recipientKeyId);
    if(row.algorithm!=='RSA-OAEP-SHA256')throw new ConflictException('Wrong recipient algorithm');
    let consent:undefined|{status:string;tenantId:string;keyId:string;consentId:string;expiresAt:string};
    if(row.ownerType==='platform'){
      const now=new Date();
      const [approved]=await withTenant(tenantId,tx=>tx.select().from(gaizRecoveryConsents).where(and(
        eq(gaizRecoveryConsents.tenantId,tenantId),
        eq(gaizRecoveryConsents.recipientKeyId,row.keyId),
        eq(gaizRecoveryConsents.status,'approved'),
        eq(gaizRecoveryConsents.purpose,'custodian-validation-only'),
        gt(gaizRecoveryConsents.expiresAt,now),
        isNull(gaizRecoveryConsents.revokedAt),
      )).orderBy(desc(gaizRecoveryConsents.approvedAt)).limit(1));
      if(!approved||!approved.approvedBy||
          approved.approvedBy===approved.requestedBy||!approved.approvedAt)
        throw new ConflictException('Approved recovery consent record absent');
      consent={status:'approved',tenantId,keyId:row.keyId,
        consentId:approved.consentId,expiresAt:approved.expiresAt.toISOString()};
    } else if(row.ownerType!=='customer')throw new ConflictException('Unknown recipient owner');
    return Object.freeze({tenantScope:tenantId,keyId:row.keyId,status:'active',
      algorithm:row.algorithm,ownerType:row.ownerType,
      activeFrom:row.validFrom.toISOString(),activeUntil:row.validUntil.toISOString(),
      consent});
  }
  async loadCustodianTrust(query:{tenantId:string;custodianId:string}){
    const tenantId=this.tenant();
    if(query.tenantId!==tenantId)throw new ConflictException('Cross-tenant custodian');
    const row=await this.loadKey(tenantId,'custodian',query.custodianId);
    if(row.algorithm!=='Ed25519')throw new ConflictException('Wrong custodian algorithm');
    return Object.freeze({tenantId,status:'active',custodianId:row.keyId,
      publicKey:row.publicKeyPem,publicKeySha256:row.publicKeySha256});
  }
  async loadIssuerTrust(query:{tenantId:string;issuerId:string}){
    const tenantId=this.tenant();
    if(query.tenantId!==tenantId)throw new ConflictException('Cross-tenant issuer');
    const row=await this.loadKey(tenantId,'issuer',query.issuerId);
    if(row.algorithm!=='Ed25519')throw new ConflictException('Wrong issuer algorithm');
    return Object.freeze({tenantId,issuerId:row.keyId,
      publicKey:row.publicKeyPem,publicKeySha256:row.publicKeySha256});
  }
}
