// AO v1 OT/TEBE handoff — exact disabled Windows native-host reply contract.
// Source-only validation. No Chrome/native bridge connection and NO execution grant.
// Reference: OT PR #80, merged; verified raw Windows ao_capabilities response.
const STATUS='disabled_pending_authorization_and_contract_tests';
const NOTE='Discovery handshake only. No MCP servers, commands or external tools are launched.';
const fields=new Set(['ok','protocolVersion','integration','enabled','status','tools','executionSupported','note']);
const deny=reason=>Object.freeze({accepted:false,reason,executionSupported:false});
export function checkAoDisabledNativeCapabilities({command,reply}={}){
 if(command!=='ao_capabilities')return deny('unsupported_command');
 try {
 if(reply===null||typeof reply!=='object'||Array.isArray(reply)||
    Object.getPrototypeOf(reply)!==Object.prototype)return deny('invalid_reply');
 // Snapshot own data fields without invoking getters from an untrusted adapter.
 const data=Object.create(null);
 for(const key of Reflect.ownKeys(reply)){
  if(typeof key!=='string'||!fields.has(key))return deny('unexpected_reply_field');
  const descriptor=Object.getOwnPropertyDescriptor(reply,key);
  if(!descriptor||!Object.hasOwn(descriptor,'value'))return deny('invalid_reply');
  data[key]=descriptor.value;
 }
 reply=data;
 const length=Array.isArray(reply.tools)
   ? Object.getOwnPropertyDescriptor(reply.tools,'length') : null;
 if(reply.ok!==true||reply.protocolVersion!==1||reply.integration!=='AO'||
    reply.enabled!==false||reply.status!==STATUS||
    reply.executionSupported!==false||!Array.isArray(reply.tools)||
    !length||length.value!==0||(reply.note!==undefined&&reply.note!==NOTE))
   return deny('untrusted_or_enabled_host');
 return Object.freeze({accepted:true,reason:'disabled_discovery_only',integration:'AO',
   protocolVersion:1,enabled:false,executionSupported:false,tools:Object.freeze([])});
 } catch { return deny('invalid_reply'); }
}

