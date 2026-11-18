/// <reference types="node" />
import type { KeyLike } from 'node:crypto';
export declare function verifyGaiz2ForPreview(
  input: Buffer | Uint8Array,
  policy: {
    trustedIssuerPublicKey: KeyLike | string;
    expectedIssuerId: string;
    expectedTenantScope: string;
  },
): Readonly<{
  verified: true;
  format: 'GAIZ2';
  artifactId: string;
  issuerId: string;
  tenantScope: string;
  sha256: string;
  authorizationGranted: false;
  importAllowed: false;
}>;
