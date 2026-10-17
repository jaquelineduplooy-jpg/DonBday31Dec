/**
 * WHEN I'M SEVENTY...  |  31 DECEMBER 2026
 * Private Google Sheet: birthday RSVP receiver.
 *
 * 1) Open the spreadsheet > Extensions > Apps Script.
 * 2) Paste this entire file into Code.gs and save.
 * 3) Run setup once and approve permissions.
 * 4) Deploy > New deployment > Web app.
 *    Execute as: Me. Who has access: Anyone.
 * 5) Copy the web app /exec URL and paste it into RSVP_SCRIPT_URL in index.html.
 */
const SHEET_ID = '10eqUEZeiPZe_Ap6g9lv0b8bRIRAcQniIEKPB9UVS6Xg';
const RSVP_TAB = 'Birthday RSVPs';
const COUNT_TAB = 'Birthday Headcount';

function setup() {
  const book = SpreadsheetApp.openById(SHEET_ID);
  let responses = book.getSheetByName(RSVP_TAB);
  if (!responses) responses = book.insertSheet(RSVP_TAB);
  if (responses.getLastRow() === 0) {
    responses.getRange(1, 1, 1, 4).setValues([
      ['Submitted at', 'Name', 'Response', 'People attending']
    ]);
  }
  responses.setFrozenRows(1);
  responses.getRange('A1:D1').setBackground('#102f53').setFontColor('#ffffff').setFontWeight('bold');
  responses.setColumnWidth(1, 185);
  responses.setColumnWidth(2, 250);
  responses.setColumnWidth(3, 145);
  responses.setColumnWidth(4, 170);

  let summary = book.getSheetByName(COUNT_TAB);
  if (!summary) summary = book.insertSheet(COUNT_TAB);
  summary.getRange('A1:B5').setValues([
    ["WHEN I'M SEVENTY — 31 DEC 2026", "Total"],
    ["Guests attending", `=SUMIF('Birthday RSVPs'!C2:C,"Yes",'Birthday RSVPs'!D2:D)`],
    ["Yes responses", `=COUNTIF('Birthday RSVPs'!C2:C,"Yes")`],
    ["No responses", `=COUNTIF('Birthday RSVPs'!C2:C,"No")`],
    ["Total replies", `=COUNTA('Birthday RSVPs'!B2:B)`]
  ]);
  summary.getRange('A1:B1').setBackground('#102f53').setFontColor('#ffffff').setFontWeight('bold');
  summary.getRange('A2:B2').setBackground('#e4eff8').setFontWeight('bold');
  summary.setColumnWidth(1, 350);
  summary.setColumnWidth(2, 100);
  summary.setFrozenRows(1);
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const rawName = String(p.name || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    const response = String(p.response || '');
    if (!rawName) throw new Error('Please enter your name.');
    if (response !== 'Yes' && response !== 'No') throw new Error('Select Yes or No.');

    const requestedCount = Number(p.people);
    if (response === 'Yes' && (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 50)) {
      throw new Error('Please enter a guest count between 1 and 50.');
    }
    const people = response === 'Yes' ? requestedCount : 0;

    // Prevent names beginning with =, +, -, @ from being evaluated as spreadsheet formulas.
    const safeName = /^[=+\-@]/.test(rawName) ? "'" + rawName : rawName;
    const norm = x => String(x || '').replace(/^'/, '').trim().toLocaleLowerCase();

    // Two submissions arriving simultaneously will not corrupt the count.
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const book = SpreadsheetApp.openById(SHEET_ID);
      let sh = book.getSheetByName(RSVP_TAB);
      if (!sh) throw new Error('Please run setup() before accepting RSVPs.');
      let match = 0;
      const last = sh.getLastRow();
      if (last > 1) {
        const names = sh.getRange(2, 2, last - 1, 1).getDisplayValues();
        for (let i = 0; i < names.length; i++) {
          if (norm(names[i][0]) === norm(rawName)) { match = i + 2; break; }
        }
      }
      const row = [new Date(), safeName, response, people];
      if (match) sh.getRange(match, 1, 1, 4).setValues([row]);
      else sh.appendRow(row);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
    return rsvpReply_(true, 'Thanks! Your RSVP is saved.');
  } catch (error) {
    return rsvpReply_(false, String(error.message || error));
  }
}

function rsvpReply_(ok, message) {
  const data = JSON.stringify({ type: 'birthday-rsvp', ok: ok, message: message });
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>(function(){const result=' + data + ';' +
    'window.parent.postMessage(result, "*");' +
    'if(window.top!==window.parent)window.top.postMessage(result, "*");' +
    '})();</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
