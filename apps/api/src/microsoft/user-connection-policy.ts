/** Preview-only per-user store gate; does not switch public API routes. */
export function microsoftUserStorePreviewEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.MS_USER_CONNECTIONS_STORE_PREVIEW === 'enabled';
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertMicrosoftUserIdentity(tenantId: string, userId: string): void {
  if (!UUID.test(tenantId) || !UUID.test(userId))
    throw new Error('A valid tenant and consenting user are required for Microsoft storage.');
}

/**
 * Exact bearer-to-credential binding for read-only Graph results.
 * A rotated/revoked credential or another owner's cached bearer is never
 * sufficient, even if the Graph HTTP request itself completed successfully.
 */
export function isCurrentMicrosoftGraphRead(
  own: { status: string; sealedRefreshToken: string | null } | null,
  issued: { accessToken: string; credential: string } | undefined,
  token: string,
): boolean {
  return own?.status === 'connected' &&
    typeof own.sealedRefreshToken === 'string' &&
    own.sealedRefreshToken.length > 0 &&
    typeof token === 'string' && token.length > 0 &&
    issued?.accessToken === token &&
    issued.credential === own.sealedRefreshToken;
}
