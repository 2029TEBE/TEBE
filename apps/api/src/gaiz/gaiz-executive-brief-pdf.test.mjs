import test from 'node:test';
import assert from 'node:assert/strict';
import {renderGaizExecutiveBriefPdf} from './gaiz-executive-brief-pdf.mjs';
const data={title:'Board Portfolio Overview',findings:['Projects require clear ownership and measurable outcomes.'],recommendations:['Set a quarterly review cycle.']};
const run=inputs=>renderGaizExecutiveBriefPdf({toolId:'gaiz.executive-brief.v1',format:'pdf',inputs});
test('valid PDF output with expected headings and xref',()=>{
 const r=run(data);assert.equal(r.contentType,'application/pdf');
 assert.equal(r.bytes.subarray(0,8).toString(),'%PDF-1.4');
 assert.match(r.bytes.toString('latin1'),/xref\n0 \d+/);
 assert.match(r.bytes.toString('latin1'),/Board Portfolio Overview/);
});
test('deterministic output and safe PDF text escaping',()=>{
 const x={...data,findings:['Use (plain) text and backslash \\ before signatures']};
 const a=run(x).bytes,b=run(x).bytes;
 assert.deepEqual(a,b);
 assert.match(a.toString(),/\\\(plain\\\)/);
 assert.match(a.toString(),/backslash \\\\/);
});
test('rejects malformed and unsupported Unicode input rather than corrupt content',()=>{
 for(const x of [{...data,title:'مراجعة'},{...data,title:'Hello\nWorld'},
  {...data,title:'OK',findings:[]},{...data,extra:true}])assert.throws(()=>run(x));
});
test('long content paginates and maintains separate page objects',()=>{
 const x={...data,findings:Array(10).fill('Status review and governance. '.repeat(14)),
 recommendations:Array(10).fill('Action plan improvement. '.repeat(14))};
 const b=run(x).bytes;
 assert.ok((b.toString().match(/\/Type \/Page \/Parent/g)||[]).length>1);
});
test('fails closed on incorrect tool or format',()=>{
 assert.throws(()=>renderGaizExecutiveBriefPdf({inputs:data,format:'html',toolId:'gaiz.executive-brief.v1'}));
 assert.throws(()=>renderGaizExecutiveBriefPdf({inputs:data,format:'pdf',toolId:'other'}));
});
