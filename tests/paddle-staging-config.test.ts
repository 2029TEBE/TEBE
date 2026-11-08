import { describe, expect, it } from 'vitest';
import { requirePaddleSandboxStagingConfig } from '../apps/api/src/platform/paddle-staging-config';

const valid=():NodeJS.ProcessEnv=>({
  NODE_ENV:'production',DEPLOYMENT_ENV:'staging',PADDLE_ENV:'sandbox',
  PADDLE_ENABLED:'false',PADDLE_STAGING_WEBHOOK_ENABLED:'true',
  PADDLE_STAGING_WEBHOOK_SECRET:'sandbox_staging_secret_only_0123456789',
  DATABASE_URL:'postgresql://paddle_staging:isolated_secret@db-staging.internal:5432/epmo_staging',
});

describe('Paddle staging ingress config — fail closed',()=>{
  it('accepts only explicit isolated sandbox staging configuration',()=>{
    const cfg=requirePaddleSandboxStagingConfig(valid());
    expect(cfg.environment).toBe('sandbox');
    expect(cfg.databaseHost).toBe('db-staging.internal');
  });
  for(const [key,value] of [
    ['DEPLOYMENT_ENV','production'],['NODE_ENV','test'],['PADDLE_ENV','production'],
    ['PADDLE_ENABLED','true'],['PADDLE_STAGING_WEBHOOK_ENABLED','false'],
    ['CI','true'],['GITHUB_ACTIONS','true'],['PADDLE_LEDGER_WRITE_MODE','ci_disposable_only'],
    ['PHASE15_ACCEPT_DISPOSABLE_DB','YES_RESEED_DISPOSABLE_TEST_DATABASE'],
    ['PADDLE_STAGING_WEBHOOK_SECRET','short'],
    ['DATABASE_URL','postgresql://pmo_app:password@localhost:5433/pmo'],
    ['DATABASE_URL','postgresql://app:secret@db-production.internal:5432/epmo_production'],
  ] as const){
    it('rejects '+key+'='+value,()=>{
      expect(()=>requirePaddleSandboxStagingConfig({...valid(),[key]:value})).toThrow('disabled or misconfigured');
    });
  }
  it('rejects reused webhook signing secret',()=>{
    const env=valid();env.PADDLE_WEBHOOK_SECRET=env.PADDLE_STAGING_WEBHOOK_SECRET;
    expect(()=>requirePaddleSandboxStagingConfig(env)).toThrow();
  });
  it('rejects missing opt-in and missing secret',()=>{
    for(const key of ['PADDLE_STAGING_WEBHOOK_ENABLED','PADDLE_STAGING_WEBHOOK_SECRET']){
      const env=valid();delete env[key];
      expect(()=>requirePaddleSandboxStagingConfig(env)).toThrow();
    }
  });
});
