import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAoDisabledNativeCapabilities as inspect} from './ao-native-handshake-policy.mjs';
// Exact raw JSON shape from merged OT #80 Windows native bridge.
const nativeReply={ok:true,protocolVersion:1,integration:'AO',
 enabled:false,status:'disabled_pending_authorization_and_contract_tests',
 tools:[],executionSupported:false,
 note:'Discovery handshake only. No MCP servers, commands or external tools are launched.'};
const run=(command='ao_capabilities',reply=nativeReply)=>inspect({command,reply});
test('OT Windows AO v1 disabled discovery interoperates without granting execution',()=>{
 const r=run();assert.equal(r.accepted,true);assert.equal(r.enabled,false);
 assert.equal(r.executionSupported,false);assert.equal(r.tools.length,0);
 assert.equal(Object.isFrozen(r),true);
});
test('an execution request is never accepted, even with a forged disabled response',()=>{
 for(const cmd of ['ao_execute','execute','ao_capabilities:write',null,''])
  assert.deepEqual(run(cmd),{accepted:false,reason:'unsupported_command',executionSupported:false});
});
test('disabled host policy rejects tool injection and privilege activation',()=>{
 for(const patch of [{enabled:true},{executionSupported:true},{tools:[{id:'arbitrary.shell'}]},
  {status:'enabled'},{integration:'OT'},{protocolVersion:2},{ok:false},
  {note:'permitted'},{extra:'authority'}])
   assert.equal(run('ao_capabilities',{...nativeReply,...patch}).accepted,false);
});
test('native response cannot omit required protocol keys or return malformed types',()=>{
 for(const key of ['ok','protocolVersion','integration','enabled','status','tools','executionSupported']){
  const reply={...nativeReply};delete reply[key];assert.equal(run('ao_capabilities',reply).accepted,false);
 }
 for(const reply of [null,undefined,[],[],new Date(),Object.create(null),{...nativeReply,tools:null},
  {...nativeReply,tools:{}},{...nativeReply,protocolVersion:'1'},'ok'])
  assert.equal(inspect({command:'ao_capabilities',reply}).accepted,false);
});
test('OT host may omit optional explanatory note but cannot change it',()=>{
 const {note,...reply}=nativeReply;
 assert.equal(run('ao_capabilities',reply).accepted,true);
 assert.equal(run('ao_capabilities',{...reply,note:'unexpected'}).accepted,false);
});
test('even a valid reply cannot assert a runnable TEBE capability',()=>{
 const r=run();assert.equal(r.reason,'disabled_discovery_only');
 assert.equal(r.executionSupported,false);assert.equal(r.accepted,true);
 assert.equal(Object.hasOwn(r,'grant'),false);assert.equal(Object.hasOwn(r,'execute'),false);
});
