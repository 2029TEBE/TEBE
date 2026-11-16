// GAIZ deterministic Executive Brief PDF renderer. Source-only; never registered.
// Deliberately supports printable ASCII only until embedded Unicode fonts are reviewed.
// No HTML, headless browser, network, script, file paths or dynamic code rendering.
const fail=()=>{throw Error('GAIZ PDF brief invalid')};
const TOOL='gaiz.executive-brief.v1';
const A4={width:595.28,height:841.89};
const pageTop=774, pageBottom=70, left=55, right=540;
const ascii=x=>typeof x==='string'&&x.length>0&&/^[\x20-\x7e\n]+$/.test(x);
function checkInputs(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!=='findings,recommendations,title'||!ascii(x.title)||x.title.length>140||x.title.includes('\n'))fail();
 for(const k of ['findings','recommendations'])if(!Array.isArray(x[k])||x[k].length<1||x[k].length>10||x[k].some(s=>!ascii(s)||s.length>500||s.includes('\n')))fail();
 return x;
}
// Escape all PDF string metacharacters. Reject unsupported characters rather
// than misrepresenting customer text as a missing/incorrect glyph.
const pdfEscape=s=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function splitLines(text,maxChars){
 const words=text.split(/ +/);const lines=[];let line='';
 for(let word of words){
  while(word.length>maxChars){
   if(line){lines.push(line);line='';}
   lines.push(word.slice(0,maxChars));word=word.slice(maxChars);
  }
  if(!word)continue;
  if(!line)line=word;
  else if(line.length+1+word.length<=maxChars)line+=' '+word;
  else{lines.push(line);line=word;}
 }
 if(line)lines.push(line);
 return lines;
}
function makePdf(pageContents){
 const objects=[null];
 const add=s=>{objects.push(s);return objects.length-1;};
 const catalog=add('');const pages=add('');
 const regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const refs=[];
 for(const content of pageContents){
  const body=Buffer.from(content,'ascii');
  const stream=add('<< /Length '+body.length+' >>\nstream\n'+content+'\nendstream');
  refs.push(add('<< /Type /Page /Parent '+pages+' 0 R /MediaBox [0 0 '+A4.width+' '+A4.height+'] /Resources << /Font << /F1 '+regular+' 0 R /F2 '+bold+' 0 R >> >> /Contents '+stream+' 0 R >>'));
 }
 objects[catalog]='<< /Type /Catalog /Pages '+pages+' 0 R >>';
 objects[pages]='<< /Type /Pages /Count '+refs.length+' /Kids ['+refs.map(x=>x+' 0 R').join(' ')+'] >>';
 let output='%PDF-1.4\n%GAIZ\n',offsets=[0];
 for(let i=1;i<objects.length;i++){
  offsets.push(Buffer.byteLength(output,'binary'));
  output+=i+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const xref=Buffer.byteLength(output,'binary');
 output+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
 for(let i=1;i<objects.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 output+='trailer\n<< /Size '+objects.length+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Buffer.from(output,'binary');
}
export function renderGaizExecutiveBriefPdf({inputs,format,toolId}={}){
 if(toolId!==TOOL||format!=='pdf')fail();checkInputs(inputs);
 const pages=[];let commands=[],y=pageTop;
 const emit=(text,size=11,bold=false,indent=0)=>{
  if(y<pageBottom+size){pages.push(commands.join('\n'));commands=[];y=pageTop;}
  commands.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+(left+indent)+' '+y.toFixed(2)+' Tm ('+pdfEscape(text)+') Tj ET');
  y-=size===20?30:size===14?24:17;
 };
 const spacer=(n=11)=>{y-=n;if(y<pageBottom){pages.push(commands.join('\n'));commands=[];y=pageTop;}};
 emit('GAIZ  /  EXECUTIVE INTELLIGENCE',11,true);spacer(8);
 for(const line of splitLines(inputs.title,49))emit(line,20,true);
 spacer(18);
 for(const [heading,values] of [['KEY FINDINGS',inputs.findings],['RECOMMENDATIONS',inputs.recommendations]]){
  emit(heading,14,true);spacer(4);
  for(let i=0;i<values.length;i++){
   for(const [j,line] of splitLines(values[i],78).entries())emit((j===0?String(i+1)+'.  ':'    ')+line,11,false,10);
   spacer(5);
  }
  spacer(13);
 }
 spacer(7);
 emit('Generated from supplied report inputs. Verify independently before decisions.',9);
 pages.push(commands.join('\n'));
 const bytes=makePdf(pages);
 if(bytes.length>2_000_000)fail();
 return Object.freeze({bytes,format:'pdf',contentType:'application/pdf'});
}
