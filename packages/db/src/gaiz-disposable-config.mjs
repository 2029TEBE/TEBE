/**
 * Conservative config gate for opt-in disposable GAIZ PostgreSQL tests.
 * This checks intent, not the actual database identity or its privileges;
 * the caller must separately inspect current_database(), current_user,
 * RLS/roles, and seeded synthetic fixtures before running writes.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reject=()=>{throw new Error('Refusing unsafe GAIZ acceptance database configuration')};

export function validateGaizDisposableConfig({url,tenantA,tenantB}={}) {
  if(typeof url!=='string'||!UUID.test(tenantA??'')||
    !UUID.test(tenantB??'')||tenantA===tenantB)reject();
  let u;
  try{u=new URL(url)}catch{reject()}
  if(!['postgres:','postgresql:'].includes(u.protocol) ||
     !['localhost','127.0.0.1','[::1]'].includes(u.hostname.toLowerCase()) ||
     !/^gaiz_(?:disposable|test)[a-z0-9_]*$/i.test(u.pathname.slice(1)) ||
     !u.username || !u.password ||
     ['postgres','root','admin','pmo_owner'].includes(decodeURIComponent(u.username).toLowerCase()) ||
     u.hash || u.search || u.pathname.includes('%') || u.username.includes('%'))
    reject();
  return Object.freeze({tenantA,tenantB,database:u.pathname.slice(1)});
}
