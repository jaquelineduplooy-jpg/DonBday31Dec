/* Vercel serverless photo feed: same-origin gateway for the existing Google Drive Apps Script. */
const FEED_URL = 'https://script.google.com/macros/s/AKfycbyaEMBcOb0-FisrU5Zm3yi4w9ptceioZ2Ng8PJJJq0G6KBGcEPNdmloexOXgNlugCHe/exec';
let lastGood = [];
let cachedUntil = 0;

function toPhotos(input) {
  const entries = Array.isArray(input) ? input :
    input && (input.images || input.photos || input.files || input.items || input.data);
  if (!Array.isArray(entries)) return [];
  const result = new Set();
  entries.forEach(item => {
    const url = typeof item === 'string' ? item : item &&
      (item.url || item.src || item.downloadUrl || item.thumbnailUrl || item.thumbnail ||
       (item.id && 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(item.id) + '&sz=w800'));
    if (typeof url !== 'string') return;
    try {
      if (new URL(url).protocol === 'https:') result.add(url);
    } catch (_) { /* discard malformed URL */ }
  });
  return [...result];
}
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error:'Method not allowed'});
  }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=120, stale-while-revalidate=120');
  if (lastGood.length && Date.now() < cachedUntil) {
    return res.status(200).json({images:lastGood,count:lastGood.length});
  }
  try {
    const response = await fetch(FEED_URL, {
      method:'GET',redirect:'follow',
      headers:{Accept:'application/json'},
      signal:AbortSignal.timeout(23000)
    });
    if (!response.ok) throw new Error('Photo feed HTTP ' + response.status);
    const data = await response.json();
    const images = toPhotos(data);
    if (!images.length) throw new Error('Photo feed returned no usable images');
    lastGood = images;
    cachedUntil = Date.now() + 120000;
    return res.status(200).json({images,count:images.length});
  } catch (err) {
    console.error('DvE photos: upstream unavailable:',err.message);
    if (lastGood.length) return res.status(200).json({images:lastGood,count:lastGood.length,stale:true});
    res.setHeader('Cache-Control','no-store');
    return res.status(502).json({images:[],error:'Google Drive photo feed unavailable. Verify its Apps Script deployment and folder access.'});
  }
};
