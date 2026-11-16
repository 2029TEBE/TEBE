// First built-in GAIZ report: deterministic Executive Brief HTML.
// Restricted plain-text fields only; no browser JavaScript, dynamic templates,
// remote images, network calls, arbitrary URLs, or customer-provided HTML.
const fail=()=>{throw Error('GAIZ executive brief invalid')};
const clean=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&
 !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function lines(a,maxItems,maxChars){
 if(!Array.isArray(a)||a.length<1||a.length>maxItems||
   a.some(x=>!clean(x,maxChars)))fail();
 return a.map(escape);
}
export function renderGaizExecutiveBrief({inputs,format,toolId}={}){
 if(toolId!=='gaiz.executive-brief.v1'||format!=='html'||!inputs||
    typeof inputs!=='object'||Array.isArray(inputs)||Object.keys(inputs).sort().join(',')!==
    'findings,recommendations,title')fail();
 if(!clean(inputs.title,140))fail();
 const findings=lines(inputs.findings,10,500);
 const recommendations=lines(inputs.recommendations,10,500);
 const list=a=>a.map(s=>'<li>'+s+'</li>').join('');
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">'+
  '<title>GAIZ Executive Brief</title>'+
  '<style>body{font:16px/1.65 system-ui,sans-serif;max-width:760px;margin:4rem auto;padding:0 1rem;color:#202936}h1,h2{line-height:1.25}section{margin-top:2rem}li{margin-bottom:.55rem}footer{font-size:.8rem;color:#566}</style>'+
  '</head><body><header><p>GAIZ • Executive Intelligence</p><h1>'+
  escape(inputs.title)+'</h1></header><main>'+
  '<section><h2>Key findings</h2><ol>'+list(findings)+'</ol></section>'+
  '<section><h2>Recommendations</h2><ol>'+list(recommendations)+'</ol></section>'+
  '</main><footer>Generated from supplied report inputs. Verify independently before decisions.</footer></body></html>';
 return Object.freeze({bytes:Buffer.from(html,'utf8'),format:'html',
  contentType:'text/html; charset=utf-8'});
}
export const GAIZ_EXECUTIVE_BRIEF_WORKER_KEY='gaiz.executive-brief.v1';
