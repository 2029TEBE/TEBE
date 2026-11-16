import { Body, Controller, ForbiddenException, Post, ServiceUnavailableException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { requireCapability } from '../common/require-capability';
import { currentContext } from '../tenancy/tenant-context';
import { RequiresModule } from '../platform/module.guard';
import { verifyGaiz2ForPreview } from './gaiz2-verifier.mjs';

// Deliberately read-only and disabled by default. Session auth and origin enforcement
// come from the existing TenantMiddleware + global request guard.
const previewBody = z.object({
  artifactBase64url: z.string().regex(/^[A-Za-z0-9_-]+$/).max(90_000),
}).strict();

@Controller('api/v1/gaiz')
export class GaizController {
  @RequiresModule('analytics360')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify')
  verify(@Body(new ZodPipe(previewBody)) body: z.infer<typeof previewBody>) {
    if (process.env.GAIZ_PREVIEW_ENABLED !== 'true' ||
        process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('GAIZ preview is not enabled');
    }
    const context = currentContext();
    if (!context.userId) throw new ForbiddenException('A signed-in user is required');
    requireCapability('pmoa_view_financials');
    const publicKey = process.env.GAIZ_PREVIEW_ISSUER_PUBLIC_KEY_PEM?.replace(/\\n/g, '\n');
    const issuerId = process.env.GAIZ_PREVIEW_ISSUER_ID;
    if (!publicKey || !issuerId) {
      throw new ServiceUnavailableException('GAIZ issuer trust is not configured');
    }
    const data = Buffer.from(body.artifactBase64url, 'base64url');
    if (data.toString('base64url') !== body.artifactBase64url || data.length > 64*1024) {
      throw new ForbiddenException('Invalid GAIZ upload');
    }
    // expectedTenantScope ALWAYS originates from trusted authenticated context,
    // NEVER the uploaded manifest, query string or caller body.
    const receipt = verifyGaiz2ForPreview(data, {
      trustedIssuerPublicKey: publicKey,
      expectedIssuerId: issuerId,
      expectedTenantScope: context.tenantId,
    });
    return { ...receipt, status: 'signature_verified_only', importAllowed: false };
  }
}
