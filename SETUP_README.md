# WHEN I'M SEVENTY — V20 website / RSVP integration

## Your website
The V20 website has the Google Apps Script `/exec` URL inserted in both `index.html` and `preview.html`.
The RSVP form sends **name, number attending, Yes / No** via POST to the Google Apps Script web app, which is configured for your Google spreadsheet.

Google Sheet: https://docs.google.com/spreadsheets/d/10eqUEZeiPZe_Ap6g9lv0b8bRIRAcQniIEKPB9UVS6Xg/edit
Google Apps Script endpoint: https://script.google.com/macros/s/AKfycbzV8ApftHEJ8ND0d4d7IdcNDDdjrQOY9rWMBiLVjWDLj8DA9xR1llLQy0mQKTwr3oyNGw/exec

## Publish the website
Upload the contents of this ZIP to your existing Vercel website project. The ZIP has `index.html` at its root. You do not need to change the RSVP URL in the HTML.

## Verify before sharing the invitation
1. In Apps Script ensure the Web app is deployed, **Execute as: Me**, **Who has access: Anyone**.
2. Submit a test RSVP on the published website with the name `Website Test RSVP` and 2 guests. Watch for the success message.
3. Open the Google Sheet and verify a new row in **Birthday RSVPs** and that **Birthday Headcount** shows 2 guests.
4. Submit that same test name again with 3 guests; total should update to 3 rather than add to 5.
5. Change it to **No**; the total should return to 0.
6. Delete the test row once verified.

**Important**: The endpoint has been added to the frontend, but live submissions and sheet writes cannot be confirmed without a real browser submission and checking the private Sheet. No test RSVP was submitted during packaging.

## Website presentation
V20 navy vintage layout; full-bleed fishing-and-Lions hero montage; The Shadows spinning record, The Beatles theme; Elvis/Beatles/Beach Boys/Shadows/Eagles artist collage; family memory reel; simplified RSVP by 15 November 2026.

## Music
The spinning vinyl is a visual animation. Spotify requires the guest to click play before audio starts.
