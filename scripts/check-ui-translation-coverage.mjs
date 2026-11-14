import { readFileSync } from 'node:fs';
import { UI_TRANSLATIONS } from '../apps/web/src/lib/generated-translations.mjs';
const keys=JSON.parse(readFileSync(new URL('../translation-source.json',import.meta.url),'utf8'));
let missing=0,invalid=0;
const signature=value=>[...value.matchAll(/\{[a-zA-Z][\w]*\}|<\/?[a-z][^>]*>/g)].map(m=>m[0]).sort().join('|');
for(const [locale,copy]of Object.entries(UI_TRANSLATIONS)){
  const gaps=keys.filter(k=>!Object.hasOwn(copy,k)||!copy[k]?.trim());
  const broken=keys.filter(k=>copy[k]&&signature(k)!==signature(copy[k]));
  missing+=gaps.length;invalid+=broken.length;
  console.log(`${locale}: ${keys.length-gaps.length-broken.length}/${keys.length}; missing=${gaps.length}; invalid=${broken.length}`);
}
if(invalid||process.argv.includes('--strict')&&missing)process.exitCode=1;
