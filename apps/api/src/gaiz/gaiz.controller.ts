import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe,
  Post, ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { requireCapability } from '../common/require-capability';
import { currentContext } from '../tenancy/tenant-context';
import { RequiresModule } from '../platform/module.guard';
import { verifyGaiz2ForPreview } from './gaiz2-verifier.mjs';
import { GaizStagingService } from './gaiz-staging.service';

const artifactBody = z.object({
  artifactBase64url: z.string().regex(/^[A-Za-z0-9_-]+$/).max(90_000),
}).strict();
const reviewBody = z.object({
  decision: z.enum(['approved','rejected']),
  note: z.string().max(500).optional(),
}).strict();

@Controller('api/v1/gaiz')
export class GaizController {
  constructor(private readonly staging: GaizStagingService) {}

  private verifyArtifact(body: z.infer<typeof artifactBody>) {
    if (process.env.NODE_ENV !== 'development' ||
        (process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV !== 'development') ||
        process.env.GAIZ_PREVIEW_ENABLED !== 'true') {
      throw new ServiceUnavailableException('GIZE AI verification preview is not enabled');
    }
    const ctx = currentContext();
    if (!ctx.userId) throw new ForbiddenException('Signed-in user is required');
    const publicKey = process.env.GAIZ_PREVIEW_ISSUER_PUBLIC_KEY_PEM?.replace(/\\n/g, '\n');
    const issuerId = process.env.GAIZ_PREVIEW_ISSUER_ID;
    if (!publicKey || !issuerId) throw new ServiceUnavailableException('GIZE AI issuer trust is not configured');
    const bytes = Buffer.from(body.artifactBase64url, 'base64url');
    if (bytes.length > 64*1024 || bytes.toString('base64url') !== body.artifactBase64url) {
      throw new BadRequestException('Legacy .gaiz artifact exceeds preview limits');
    }
    try {
      return verifyGaiz2ForPreview(bytes, {
        trustedIssuerPublicKey: publicKey,
        expectedIssuerId: issuerId,
        expectedTenantScope: ctx.tenantId,
      });
    } catch {
      throw new BadRequestException('Legacy .gaiz artifact could not be verified');
    }
  }

  @RequiresModule('analytics360')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify')
  verify(@Body(new ZodPipe(artifactBody)) body: z.infer<typeof artifactBody>) {
    requireCapability('pmoa_view_financials');
    return { ...this.verifyArtifact(body), status: 'signature_verified_only', importAllowed: false };
  }

  @RequiresModule('analytics360')
  @Throttle({ default: { ttl: 60_000, limit: 4 } })
  @Post('stage')
  stage(@Body(new ZodPipe(artifactBody)) body: z.infer<typeof artifactBody>) {
    // Stage by exact cryptographic receipt, not caller-supplied sha/manifest.
    // Service checks staging flag, explicit capability and durable idempotency.
    requireCapability('pmoa_manage_projects');
    const verified = this.verifyArtifact(body);
    return this.staging.stage({ ...verified, verified: true });
  }

  @RequiresModule('analytics360')
  @Get('requests')
  list() { return this.staging.list(); }

  @RequiresModule('analytics360')
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('requests/:id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reviewBody)) body: z.infer<typeof reviewBody>,
  ) {
    return this.staging.review(id, body.decision, body.note);
  }
}
