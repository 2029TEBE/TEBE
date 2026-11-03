/**
 * C59 PostgreSQL adapter for C58. Requires the C59 SQL schema to be applied
 * in an isolated TEST database by an authorized operator. Never runs DDL.
 * pool is an injected pg-compatible Pool; no connection strings or secrets here.
 */
const identifier = /^[a-z][a-z0-9_]{0,62}$/;
export function createTestWebhookDatabase(pool, {schema='commercial_test'}={}) {
  if (!identifier.test(schema)) throw Error('Invalid schema');
  if (!pool || typeof pool.connect !== 'function') throw Error('PostgreSQL pool required');
  const q = '"'+schema+'"';
  return {
    async withSerializableTenantTransaction(tenantId, fn) {
      if (typeof tenantId !== 'string' || !tenantId) throw Error('Tenant required');
      if (typeof fn !== 'function') throw Error('Transaction callback required');
      const client=await pool.connect();
      let begun=false;
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        begun=true;
        // SET LOCAL is scoped to this transaction; RLS fails closed if absent.
        await client.query("SELECT set_config('app.tenant_id', $1, true)",[tenantId]);
        const tx={
          async lockSubscription(accountId, subscriptionId) {
            const r=await client.query(`SELECT tenant_id FROM ${q}.subscriptions WHERE tenant_id=$1 AND account_id=$2 AND subscription_id=$3 FOR UPDATE`,[tenantId,accountId,subscriptionId]);
            if(r.rowCount!==1) throw Error('Subscription binding not found');
          },
          async claimEvent(accountId,eventId,eventType) {
            const r=await client.query(`INSERT INTO ${q}.events(tenant_id,account_id,event_id,event_type,status) VALUES($1,$2,$3,$4,'processing') ON CONFLICT (account_id,event_id) DO NOTHING RETURNING event_id`,[tenantId,accountId,eventId,eventType]);
            return r.rowCount===1;
          },
          async getSubscriptionState(accountId,subscriptionId) {
            const r=await client.query(`SELECT last_event_created AS "lastEventCreated", last_event_id AS "lastEventId" FROM ${q}.subscriptions WHERE tenant_id=$1 AND account_id=$2 AND subscription_id=$3`,[tenantId,accountId,subscriptionId]);
            if(r.rowCount!==1) throw Error('Subscription missing');
            return r.rows[0];
          },
          async setEntitlement(accountId,subscriptionId,v) {
            if(v.tenantId!==tenantId || typeof v.enabled!=='boolean') throw Error('Entitlement tenant mismatch');
            const r=await client.query(`INSERT INTO ${q}.entitlements(tenant_id,account_id,subscription_id,enabled,source_event_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,account_id,subscription_id) DO UPDATE SET enabled=EXCLUDED.enabled,source_event_id=EXCLUDED.source_event_id`,[tenantId,accountId,subscriptionId,v.enabled,v.sourceEventId]);
            if(r.rowCount!==1) throw Error('Entitlement write failed');
          },
          async setSubscriptionState(accountId,subscriptionId,v) {
            if(v.tenantId!==tenantId || !Number.isSafeInteger(v.lastEventCreated)) throw Error('Invalid state');
            const r=await client.query(`UPDATE ${q}.subscriptions SET last_event_created=$4,last_event_id=$5,last_decision=$6 WHERE tenant_id=$1 AND account_id=$2 AND subscription_id=$3`,[tenantId,accountId,subscriptionId,v.lastEventCreated,v.lastEventId,v.lastDecision]);
            if(r.rowCount!==1) throw Error('Subscription state write failed');
          },
          async finishEvent(accountId,eventId,status) {
            const r=await client.query(`UPDATE ${q}.events SET status=$4,processed_at=now() WHERE tenant_id=$1 AND account_id=$2 AND event_id=$3 AND status='processing'`,[tenantId,accountId,eventId,status]);
            if(r.rowCount!==1) throw Error('Event finalization failed');
          }
        };
        const result=await fn(tx);
        await client.query('COMMIT');
        begun=false;
        return result;
      } catch(error) {
        if(begun) {try {await client.query('ROLLBACK')} catch {}}
        throw error;
      } finally {client.release()}
    }
  };
}
