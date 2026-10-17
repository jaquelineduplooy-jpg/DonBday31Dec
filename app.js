/* DvE 1956 | V29: shuffled live Memory Reel + existing RSVP */
// This is the SAME Google Drive folder that powered the original birthday album.
const GOOGLE_DRIVE_PHOTO_FEED_URL = 'https://script.google.com/macros/s/AKfycbyaEMBcOb0-FisrU5Zm3yi4w9ptceioZ2Ng8PJJJq0G6KBGcEPNdmloexOXgNlugCHe/exec';
const FALLBACK_IMAGES = [
  'assets/hero-fishing-lions-coffee.jpg',
  'assets/beatles-vinyl.jpg',
  'assets/rugby-and-fishing.jpg',
  'assets/elvis-music.jpg',
  'assets/spotify-vinyl-cover.png'
];
const REEL_SET_SIZE = 18;
const REEL_SPEED = 22; // pixels per second

function shuffled(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function normalizePhotos(payload) {
  const entries = Array.isArray(payload) ? payload :
    (payload && (payload.images || payload.items || payload.photos || payload.data)) || [];
  if (!Array.isArray(entries)) return [];
  const unique = new Set();
  for (const entry of entries) {
    let src;
    if (typeof entry === 'string') src = entry;
    else if (entry && typeof entry === 'object') {
      src = entry.url || entry.src || entry.downloadUrl || entry.thumbnailUrl || entry.thumbnail;
      if (!src && entry.id) src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(entry.id) + '&sz=w800';
    }
    if (typeof src !== 'string' || !src.trim()) continue;
    try {
      const parsed = new URL(src.trim(), window.location.href);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') unique.add(parsed.href);
    } catch (_) { /* ignore malformed photo URLs */ }
  }
  return Array.from(unique);
}
async function fetchPhotoFeed(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('Photo feed returned ' + response.status);
    const urls = normalizePhotos(await response.json());
    if (!urls.length) throw new Error('No usable photos in the feed');
    return urls;
  } finally {
    clearTimeout(timeout);
  }
}
async function loadDriveImages() {
  // Vercel's same-origin serverless proxy avoids CORS/redirect issues with Apps Script.
  // Direct Apps Script remains a backup for local previews or non-Vercel hosting.
  const candidates = ['/api/photos', GOOGLE_DRIVE_PHOTO_FEED_URL];
  for (const endpoint of candidates) {
    try {
      const urls = await fetchPhotoFeed(endpoint, endpoint === '/api/photos' ? 12000 : 8000);
      return { urls, live: true };
    } catch (error) {
      console.warn('Memory Reel: photo feed unavailable:', endpoint, error.message);
    }
  }
  return { urls: FALLBACK_IMAGES, live: false };
}

function startMemoryReel() {
  const track = document.getElementById('memoryTrack');
  if (!track) return;
  const windowEl = track.closest('.film-window');
  let sourcePhotos = FALLBACK_IMAGES.slice();
  let currentPhotos = [];
  let recentStarts = [];
  let offsetX = 0;
  let cycleWidth = 0;
  let prevTimestamp = 0;
  let pausedByPointer = false;
  let pausedByTouch = false;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { recentStarts = JSON.parse(sessionStorage.getItem('dve1956-reel-recent') || '[]'); }
  catch (_) { recentStarts = []; }

  function selectNext() {
    // Shuffle the ENTIRE Drive folder first, not just the first 14 entries.
    let randomized = shuffled(sourcePhotos);
    if (randomized.length > 6 && recentStarts.length) {
      randomized = randomized.filter(url => !recentStarts.includes(url))
        .concat(randomized.filter(url => recentStarts.includes(url)));
    }
    currentPhotos = randomized.slice(0, Math.min(REEL_SET_SIZE, randomized.length));
    recentStarts = currentPhotos.slice(0, Math.min(5, currentPhotos.length));
    try { sessionStorage.setItem('dve1956-reel-recent', JSON.stringify(recentStarts)); }
    catch (_) { /* Private browsing may restrict session storage */ }
  }
  function renderPhotos() {
    if (!currentPhotos.length) return;
    const fragment = document.createDocumentFragment();
    const copies = currentPhotos.concat(currentPhotos);
    for (let i = 0; i < copies.length; i++) {
      const frame = document.createElement('div');
      frame.className = 'film-frame';
      const photo = document.createElement('img');
      photo.src = copies[i];
      photo.alt = 'Familieherinnering ' + ((i % currentPhotos.length) + 1);
      photo.loading = i < 4 ? 'eager' : 'lazy';
      photo.decoding = 'async';
      frame.appendChild(photo);
      fragment.appendChild(frame);
    }
    track.replaceChildren(fragment);
    offsetX = 0;
    cycleWidth = 0;
    track.style.transform = 'translate3d(0,0,0)';
  }
  function widthOfOneCycle() {
    const first = track.children[0];
    const firstDuplicate = track.children[currentPhotos.length];
    return first && firstDuplicate ? firstDuplicate.offsetLeft - first.offsetLeft : 0;
  }
  function animate(timestamp) {
    const elapsed = prevTimestamp ? Math.min((timestamp - prevTimestamp) / 1000, 0.1) : 0;
    prevTimestamp = timestamp;
    if (!prefersReducedMotion && !document.hidden && !pausedByPointer && !pausedByTouch && currentPhotos.length) {
      if (!cycleWidth) cycleWidth = widthOfOneCycle();
      if (cycleWidth > 0) {
        offsetX -= REEL_SPEED * elapsed;
        if (-offsetX >= cycleWidth) {
          // Shuffle again after each complete pass; a different selection can now appear.
          selectNext();
          renderPhotos();
        } else {
          track.style.transform = 'translate3d(' + offsetX.toFixed(2) + 'px,0,0)';
        }
      }
    }
    requestAnimationFrame(animate);
  }
  windowEl.addEventListener('mouseenter', () => { pausedByPointer = true; });
  windowEl.addEventListener('mouseleave', () => { pausedByPointer = false; });
  windowEl.addEventListener('touchstart', () => { pausedByTouch = true; }, { passive: true });
  windowEl.addEventListener('touchend', () => { pausedByTouch = false; }, { passive: true });
  windowEl.addEventListener('touchcancel', () => { pausedByTouch = false; }, { passive: true });
  window.addEventListener('resize', () => { cycleWidth = 0; });

  // Start with a shuffled placeholder, then switch to the live Drive folder.
  selectNext();
  renderPhotos();
  requestAnimationFrame(animate); // A SINGLE animation loop, even after the feed refreshes.
  loadDriveImages().then(result => {
    sourcePhotos = result.urls;
    track.dataset.source = result.live ? 'Google Drive' : 'Fallback';
    selectNext();
    renderPhotos();
  });
  // New photos can appear while the celebration is underway, without a page reload.
  setInterval(async () => {
    const result = await loadDriveImages();
    if (result.live) sourcePhotos = result.urls;
  }, 240000);
}
startMemoryReel();

// Live Google Apps Script endpoint linked to the birthday RSVP spreadsheet.
const RSVP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzV8ApftHEJ8ND0d4d7IdcNDDdjrQOY9rWMBiLVjWDLj8DA9xR1llLQy0mQKTwr3oyNGw/exec';
const form = document.getElementById('rsvpForm');
const status = document.getElementById('rsvpStatus');
const count = document.getElementById('guestCount');
const radios = [...document.querySelectorAll('input[name="response"]')];
const isGoing = () => form.querySelector('input[name="response"]:checked').value === 'Yes';
let rsvpTimeout = null;
const setCount = n => {count.value = Math.max(1,Math.min(50,Math.trunc(Number(n)||1)));};
document.getElementById('countMinus').addEventListener('click',()=>setCount(Number(count.value)-1));
document.getElementById('countPlus').addEventListener('click',()=>setCount(Number(count.value)+1));
count.addEventListener('change',()=>setCount(count.value));
radios.forEach(r=>r.addEventListener('change',()=>{ const attending = isGoing(); if(attending && Number(count.value)<1)count.value='1'; count.disabled = !attending; document.querySelector('.people-field').classList.toggle('not-attending',!attending); status.textContent=attending?'Wonderlik! Laat weet met hoeveel julle kom.':'Dankie dat julle laat weet het.';}));
form.addEventListener('submit',event=>{
  if(!RSVP_SCRIPT_URL.startsWith('https://script.google.com/macros/s/')){
    event.preventDefault();
    status.textContent='Die RSVP-diens is nog nie gekoppel nie. Kontak asseblief die organiseerder.';
    status.classList.add('notice');
    return;
  }
  if(isGoing() && !(Number(count.value)>=1 && Number(count.value)<=50)){
    event.preventDefault(); status.textContent='Vul asseblief in hoeveel mense gaan kom.';return;
  }
  // Declined RSVP still writes a count of zero to the Sheet.
  if(!isGoing()){count.disabled=false; count.value='0';}
  form.action=RSVP_SCRIPT_URL;
  document.getElementById('rsvpSubmit').disabled=true;
  status.textContent='Besig om jou RSVP te stuur…';
  clearTimeout(rsvpTimeout);
  rsvpTimeout=setTimeout(()=>{document.getElementById('rsvpSubmit').disabled=false; status.textContent='Ons kon nie bevestig dat jou RSVP ontvang is nie. Vra asseblief die organiseerder voordat jy weer stuur.';},20000);
});
window.addEventListener('message',event=>{
  if(event.origin!=='https://script.google.com' && event.origin!=='https://script.googleusercontent.com' && !event.origin.endsWith('.googleusercontent.com'))return;
  if(!event.data || event.data.type!=='birthday-rsvp')return;
  clearTimeout(rsvpTimeout);
  document.getElementById('rsvpSubmit').disabled=false;
  status.textContent=event.data.ok?'Baie dankie! Jou RSVP is aangeteken.':'Jammer, jou antwoord kon nie gestoor word nie. Probeer asseblief weer.';
  if(event.data.ok){form.reset();count.disabled=false; document.querySelector('.people-field').classList.remove('not-attending');}
});

