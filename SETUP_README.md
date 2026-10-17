# When I'm Seventy — Website and RSVP setup

1. Website: upload the contents of this ZIP (index.html, assets/) to your existing Vercel project. Do not upload the enclosing folder as a separate site unless you want a new URL.
2. Google Sheet: https://docs.google.com/spreadsheets/d/10eqUEZeiPZe_Ap6g9lv0b8bRIRAcQniIEKPB9UVS6Xg/edit
3. In the sheet: Extensions > Apps Script. Copy GOOGLE_SHEETS_RSVP_APPS_SCRIPT.gs into Code.gs, save and run setup() once. Approve the permissions.
4. Deploy > New deployment > Web app. Set Execute as 'Me' and Who has access 'Anyone'. Deploy and copy the web app URL ending in /exec.
5. Replace the RSVP_SCRIPT_URL placeholder in index.html with that /exec URL. Do not paste the /edit Google Sheets URL as the script endpoint.
6. Deploy the updated site to Vercel. Submit a test 'Yes' RSVP for two guests; confirm the Birthday RSVPs and Birthday Headcount tabs update. Submit a second RSVP with the same name and a different count; it replaces the previous response instead of doubling it. Try a 'No' RSVP too.
7. Your Google Sheet can stay private: the Google Apps Script runs on your behalf and only handles form submissions.

IMPORTANT: Until step 5 is complete, live RSVPs are not connected. The spinning vinyl record is an animation; audio is played only when the guest uses the Spotify embed/player.

Artwork: The musician montage is an original retro-inspired generated illustration. It is not a set of licensed archival photographs of the artists.
