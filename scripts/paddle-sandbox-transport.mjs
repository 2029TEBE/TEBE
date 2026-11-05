/**
 * Isolated sandbox API transport candidate, not wired into a customer route.
 * Caller MUST lock/create a tenant-owned checkout intent before invoking.
 * Never retry a transaction-create POST: reconcile by persisted intent first.
 */
import { validatePaddleSandboxTransaction } from './paddle-sandbox-checkout-policy.mjs';

export async function createSandboxPaddleTransaction(prepared, {
  apiKey, sandboxNetworkApproved = false, fetchImpl,
} = {}) {
  if (!sandboxNetworkApproved || !prepared?.ok ||
      prepared.apiOrigin !== 'https://sandbox-api.paddle.com' ||
      prepared.endpoint !== '/transactions' || prepared.environment !== 'sandbox')
    return { ok:false, reason:'sandbox_not_authorized' };
  if (typeof apiKey !== 'string' || !/^pdl_sdbx_apikey_[A-Za-z0-9_-]{20,}$/.test(apiKey))
    return { ok:false, reason:'invalid_sandbox_credentials' };
  if (typeof fetchImpl !== 'function')
    return { ok:false, reason:'transport_not_configured' };
  try {
    const response = await fetchImpl('https://sandbox-api.paddle.com/transactions',{
      method:'POST', redirect:'error', cache:'no-store',
      headers:{
        'Authorization':'Bearer '+apiKey,
        'Content-Type':'application/json',
        'Accept':'application/json',
        'Paddle-Version':'1',
      },
      body:JSON.stringify(prepared.request),
      signal:AbortSignal.timeout(8000),
    });
    if (response?.status !== 201 || response?.ok !== true)
      return {ok:false,reason:'sandbox_provider_rejected'};
    const contentType=response.headers?.get?.('content-type')||'';
    if (!contentType.toLowerCase().includes('application/json'))
      return {ok:false,reason:'unexpected_provider_response'};
    const envelope=await response.json();
    const candidate=validatePaddleSandboxTransaction(prepared,envelope?.data);
    if (!candidate.ok) return candidate;
    return {...candidate, sandboxOnly:true,requiresAtomicTenantPersistence:true};
  } catch {
    // Do not leak provider response bodies, token, or errors to the caller.
    return {ok:false,reason:'sandbox_transport_failed'};
  }
}
