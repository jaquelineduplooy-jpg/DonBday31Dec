/** Private, spreadsheet-bound RSVP receiver for 'When I'm Seventy'. */
const TAB_NAME = 'SeventyRSVPs';
function doPost(e) {
  try {
    const p = e.parameter || {};
    const name = String(p.name || '').trim().slice(0,100);
    const response = p.response === 'No' ? 'No' : 'Yes';
    const rawCount = Number.parseInt(p.people,10);
    const people = response === 'No' ? 0 : rawCount;
    if(!name || (response==='Yes' && (!Number.isInteger(people)||people<1||people>50))) {
      throw new Error('Invalid RSVP');
    }
    const book = SpreadsheetApp.getActiveSpreadsheet();
    let sheet=book.getSheetByName(TAB_NAME);
    if(!sheet) { setup(); sheet=book.getSheetByName(TAB_NAME); }
    const lock=LockService.getScriptLock();
    lock.waitLock(15000);
    try{sheet.appendRow([new Date(),name,response,people]); SpreadsheetApp.flush();}
    finally{lock.releaseLock();}
    return respond(true);
  } catch(err) {
    console.error(err);
    return respond(false);
  }
}
function respond(ok) {
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>parent.postMessage({type:"birthday-rsvp",ok:'+ok+'},"*");<\/script></body></html>');
}
function setup(){
  const book=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=book.getSheetByName(TAB_NAME)||book.insertSheet(TAB_NAME);
  if(sheet.getLastRow()===0){sheet.appendRow(['Submitted at','Guest name','RSVP','People attending']);sheet.setFrozenRows(1);}
  let summary=book.getSheetByName('Headcount')||book.insertSheet('Headcount');
  summary.getRange('A1:B5').setValues([
   ['New Year’s Eve 2026','Count'],
   ['Confirmed people','=SUMIF(SeventyRSVPs!C2:C,"Yes",SeventyRSVPs!D2:D)'],
   ['Acceptances','=COUNTIF(SeventyRSVPs!C2:C,"Yes")'],
   ['Declines','=COUNTIF(SeventyRSVPs!C2:C,"No")'],
   ['Responses received','=COUNTA(SeventyRSVPs!B2:B)']
  ]);
  summary.setFrozenRows(1);
}
