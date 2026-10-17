/** Birthday RSVP: attach this Apps Script to a private Google Sheet. */
const TAB = 'RSVPs';
const SHEET_ID = '10eqUEZeiPZe_Ap6g9lv0b8bRIRAcQniIEKPB9UVS6Xg';
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const rawName = String(p.name || '').trim().slice(0, 100);
    const name = /^[=+\-@]/.test(rawName) ? '\'' + rawName : rawName;
    const response = p.response === 'No' ? 'No' : 'Yes';
    const count = response === 'Yes' ? Math.max(0, Math.min(50,parseInt(p.people || '0', 10) || 0)) : 0;
    if (!name) throw new Error('Name is required');
    if (response === 'Yes' && count < 1) throw new Error('At least one guest required');
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB);
    if (!sheet) throw new Error('Please run setup() first');
    const data = sheet.getDataRange().getValues();
    let row = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1] || '').trim().toLowerCase() === name.toLowerCase()) { row = i + 1; break; }
    }
    const values = [new Date(), name, response, count];
    if (row < 0) sheet.appendRow(values);
    else sheet.getRange(row, 1, 1, 4).setValues([values]);
    return reply(true);
  } catch (error) { return reply(false); }
}
function reply(ok) {
  return HtmlService.createHtmlOutput('<!doctype html><script>window.top.postMessage({type:"birthday-rsvp",ok:' + ok + '},"*");<\/script>');
}
function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  if (!sh.getLastRow()) sh.appendRow(['Timestamp','Name','Response','Number attending']);
  sh.setFrozenRows(1);
  const summary = ss.getSheetByName('Headcount') || ss.insertSheet('Headcount');
  summary.getRange('A1:B5').setValues([
    ['31 December 2026 — RSVP overview','Total'],
    ['Confirmed people','=SUM(RSVPs!D2:D)'],
    ['Accepted RSVPs','=COUNTIF(RSVPs!C2:C,"Yes")'],
    ['Declined RSVPs','=COUNTIF(RSVPs!C2:C,"No")'],
    ['Guest responses','=COUNTA(RSVPs!B2:B)']
  ]);
  summary.setFrozenRows(1);
}
