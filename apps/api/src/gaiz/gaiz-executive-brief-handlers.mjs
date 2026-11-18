// Fixed, allowlisted report handler for the existing GAIZ worker.
// Source-only: injecting into createGaizReportWorker does not activate routes.
import {renderGaizExecutiveBrief} from './gaiz-executive-brief.mjs';
import {renderGaizExecutiveBriefPdf} from './gaiz-executive-brief-pdf.mjs';
export const GAIZ_EXECUTIVE_BRIEF_KEY='gaiz.executive-brief.v1';
export function renderGaizExecutiveBriefByFormat(request){
 if(!request||request.toolId!==GAIZ_EXECUTIVE_BRIEF_KEY)throw Error('GIZE AI executive brief tool unavailable');
 if(request.format==='html')return renderGaizExecutiveBrief(request);
 if(request.format==='pdf')return renderGaizExecutiveBriefPdf(request);
 // GAIZ2 cryptographic output requires separately approved signer/key custody.
 throw Error('GIZE AI executive brief format unavailable');
}
export const GAIZ_EXECUTIVE_BRIEF_HANDLERS=Object.freeze({
 [GAIZ_EXECUTIVE_BRIEF_KEY]:renderGaizExecutiveBriefByFormat
});
