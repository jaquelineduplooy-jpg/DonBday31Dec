// OPTIONAL: Use only if the existing GOOGLE DRIVE PHOTO FEED fails.
// This is NOT the Google Sheets RSVP Apps Script. It belongs in the separate photo-feed project.
const DVE_PHOTO_FOLDER_ID = '1303l_SMGXM7H-x27RGDhT7H0Z-goqKjf';

function doGet(e) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'DVE1956_PHOTOS_V2';
    let json = cache.get(cacheKey);
    if (!json || (e && e.parameter && e.parameter.refresh === '1')) {
      const folder = DriveApp.getFolderById(DVE_PHOTO_FOLDER_ID);
      const files = folder.getFiles();
      const photos = [];
      while (files.hasNext()) {
        const file = files.next();
        if (String(file.getMimeType()).startsWith('image/')) {
          photos.push({
            id: file.getId(),
            name: file.getName(),
            url: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w800'
          });
        }
      }
      json = JSON.stringify(photos);
      if (json.length < 95000) cache.put(cacheKey, json, 120);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({images:[],error:String(err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// OPTIONAL one-time function for the album owner: makes images viewable by people with a link.
// WARNING: This changes the sharing of each image, so only run it if that is acceptable.
function makeAlbumPhotosViewable() {
  const files = DriveApp.getFolderById(DVE_PHOTO_FOLDER_ID).getFiles();
  let changed = 0;
  while (files.hasNext()) {
    const file = files.next();
    if (!String(file.getMimeType()).startsWith('image/')) continue;
    try {
      if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        changed++;
      }
    } catch (err) { console.log('Could not change access for ' + file.getName() + ': ' + err); }
  }
  console.log('Images newly made viewable: ' + changed);
}
