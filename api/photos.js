// Vercel Serverless Function. Forwards the existing, public Google Apps Script photo feed.
// The client reads /api/photos from the same website origin to avoid browser CORS failures.
const FEED_URL = 'https://script.google.com/macros/s/AKfycbyaEMBcOb0-FisrU5Zm3yi4w9ptceioZ2Ng8PJJJq0G6KBGcEPNdmloexOXgNlugCHe/exec';
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    const response = await fetch(FEED_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('Google photo feed HTTP ' + response.status);
    const data = await response.json();
    const records = Array.isArray(data) ? data :
      (data && (data.images || data.items || data.photos || data.data)) || [];
    if (!Array.isArray(records)) throw new Error('Unexpected photo feed response');
    const photos = records.map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return null;
      if (item.url || item.src || item.downloadUrl || item.thumbnailUrl) {
        return item.url || item.src || item.downloadUrl || item.thumbnailUrl;
      }
      if (item.id) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(item.id) + '&sz=w800';
      return null;
    }).filter((url) => typeof url === 'string' && /^https:\/\//i.test(url));
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=90, stale-while-revalidate=120');
    return res.status(200).json({ images: [...new Set(photos)], count: photos.length });
  } catch (error) {
    console.error('Photo feed error:', error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ images: [], error: 'Photo feed temporarily unavailable' });
  }
};
