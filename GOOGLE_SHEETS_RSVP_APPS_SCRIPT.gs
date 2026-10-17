/** BIRTHDAY RSVP - Google Apps Script. Create from your private Google Sheet. */
const TAB='RSVPs';
function doPost(e){
 try{
  const p=e.parameter||{};
  const name=String(p.name||'').trim().slice(0,100);
  const response=p.response==='No'?'No':'Yes';
  const num=k=>Math.max(0,Math.min(40,Number.parseInt(p[k]||0,10)||0));
  if(!name) throw Error('Name required');
  const adults=response==='Yes'?num('adults'):0;
  const kids=response==='Yes'?num('kids'):0;
  const grandkids=response==='Yes'?num('grandkids'):0;
  if(response==='Yes'&&adults+kids+grandkids===0)throw Error('At least one guest required');
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB);
  if(!sheet)throw Error('Missing RSVPs sheet: run setup once');
  sheet.appendRow([new Date(),name,response,adults,kids,grandkids,adults+kids+grandkids,String(p.guests||'').slice(0,500)]);
  return reply(true);
 }catch(error){return reply(false);}
}
function reply(ok){
 return HtmlService.createHtmlOutput('<!doctype html><script>parent.postMessage({type:"birthday-rsvp",ok:'+ok+'},"*");<\/script>');
}
function setup(){
 const book=SpreadsheetApp.getActiveSpreadsheet();
 let sh=book.getSheetByName(TAB)||book.insertSheet(TAB);
 sh.clear();
 sh.appendRow(['Submitted at','RSVP name','Response','Adults','Kids','Grandkids','Total','Guest names']);
 sh.setFrozenRows(1);
 let summary=book.getSheetByName('Headcount')||book.insertSheet('Headcount');
 summary.clear();
 summary.getRange('A1:B6').setValues([
 ['31 December 2026 — RSVP overview','Count'],
 ['Confirmed adults','=SUMIF(RSVPs!C2:C,"Yes",RSVPs!D2:D)'],
 ['Confirmed kids','=SUMIF(RSVPs!C2:C,"Yes",RSVPs!E2:E)'],
 ['Confirmed grandkids','=SUMIF(RSVPs!C2:C,"Yes",RSVPs!F2:F)'],
 ['TOTAL ATTENDING','=SUM(B2:B4)'],
 ['Declined RSVPs','=COUNTIF(RSVPs!C2:C,"No")']
 ]);
 summary.setFrozenRows(1);
}
