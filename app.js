/* DvE 1956 - reliable family Memory Reel, Google Drive feed and RSVP */
const GOOGLE_DRIVE_PHOTO_FEED_URL = 'https://script.google.com/macros/s/AKfycbyaEMBcOb0-FisrU5Zm3yi4w9ptceioZ2Ng8PJJJq0G6KBGcEPNdmloexOXgNlugCHe/exec';
// Genuine family snapshots cropped from the user's earlier Memory Reel screenshots.
// Shown immediately if the live Drive feed is inaccessible; never replace family photos with unrelated artwork.
const MEMORY_BACKUP = [
  'assets/memories/straat-en-geskiedenis.jpg',
  'assets/memories/familie-in-die-stad.jpg',
  'assets/memories/familie-by-muurkuns.jpg',
  'assets/memories/familie-aan-tafel.jpg',
  'assets/memories/familie-saam.jpg'
];
const REEL_SPEED = 37; // pixels/second (noticeably moving, even on a phone)
const REEL_SET_SIZE = 18;

function memoryShuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function memoryNormalize(payload) {
  const data = Array.isArray(payload) ? payload :
    payload && (payload.images || payload.items || payload.photos || payload.files || payload.data);
  if (!Array.isArray(data)) return [];
  const found = new Set();
  for (const item of data) {
    let value = typeof item === 'string' ? item : item &&
      (item.url || item.src || item.downloadUrl || item.thumbnailUrl || item.thumbnail ||
      (item.id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(item.id) + '&sz=w800' : null));
    if (typeof value !== 'string') continue;
    try {
      const parsed = new URL(value.trim(), window.location.href);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') found.add(parsed.href);
    } catch (_) { /* ignore invalid URLs */ }
  }
  return Array.from(found);
}
async function memoryFetch(endpoint, maxWait) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), maxWait);
  try {
    const response = await fetch(endpoint, {
      method:'GET', cache:'no-store', signal:controller.signal,
      headers:{'Accept':'application/json'}
    });
    if (!response.ok) throw Error('HTTP ' + response.status);
    const images = memoryNormalize(await response.json());
    if (!images.length) throw Error('Geen foto’s in die antwoord nie');
    return images;
  } finally { clearTimeout(timer); }
}
async function memoryGetLivePhotos() {
  // Vercel API works without Google Apps Script CORS; direct URL helps in standalone previews.
  const attempts = [
    memoryFetch('/api/photos', 17000),
    memoryFetch(GOOGLE_DRIVE_PHOTO_FEED_URL, 16000)
  ];
  return Promise.any(attempts);
}
function memoryCheckImage(src, maxWait=6000) {
  return new Promise(resolve => {
    const image = new Image();
    let done = false;
    const finish = ok => {
      if(done) return;
      done = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), maxWait);
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    image.src = src;
  });
}
function startMemoryReel() {
  const track = document.getElementById('memoryTrack');
  if (!track) return;
  const view = track.closest('.film-window');
  const pauseButton = document.getElementById('reelPauseButton');
  const reloadButton = document.getElementById('reelReloadButton');
  let photos = MEMORY_BACKUP.slice();
  let current = [];
  let previousFirst = '';
  let offset = 0;
  let distance = 0;
  let previousTime = 0;
  let paused = false;
  let fetching = false;
  let lastLive = false;

  function nextSelection() {
    current = memoryShuffle(photos).slice(0, Math.min(photos.length, REEL_SET_SIZE));
    if (current.length > 1 && current[0] === previousFirst) {
      current.push(current.shift());
    }
    previousFirst = current[0] || '';
  }
  function paint() {
    if (!current.length) return;
    const fragment = document.createDocumentFragment();
    // Two identical, adjoining sets make the leftward motion seamless.
    current.concat(current).forEach((src, index) => {
      const frame = document.createElement('div');
      frame.className = 'film-frame';
      const img = document.createElement('img');
      img.alt = 'Familieherinnering ' + (index % current.length + 1);
      img.src = src;
      // Animated elements that start out off-screen should not be lazy-loaded.
      img.loading = 'eager';
      img.decoding = 'async';
      const safe = MEMORY_BACKUP[index % MEMORY_BACKUP.length];
      img.onerror = () => { if (img.src !== new URL(safe, window.location.href).href) img.src = safe; };
      frame.appendChild(img);
      fragment.appendChild(frame);
    });
    track.replaceChildren(fragment);
    offset = 0;
    distance = 0;
    previousTime = 0;
    track.style.transform = 'translate3d(0px,0,0)';
  }
  function measure() {
    const first = track.children[0];
    const second = track.children[current.length];
    const result = first && second ? second.offsetLeft - first.offsetLeft : 0;
    return Number.isFinite(result) && result > 0 ? result : 0;
  }
  function frame(time) {
    // Never pause on swipe/touch: iPhones otherwise get stuck after a swipe.
    const dt = previousTime ? Math.min(Math.max((time - previousTime)/1000,0),.15) : 0;
    previousTime = time;
    if (!paused && !document.hidden && current.length) {
      if (!distance) distance = measure();
      if (distance > 0) {
        offset -= dt * REEL_SPEED;
        if (-offset >= distance) {
          nextSelection();
          paint();
        } else {
          track.style.transform = 'translate3d(' + offset.toFixed(2) + 'px,0,0)';
        }
      }
    }
    requestAnimationFrame(frame);
  }
  async function reload() {
    if (fetching) return;
    fetching = true;
    if (reloadButton) reloadButton.disabled = true;
    try {
      const result = await memoryGetLivePhotos();
      // Verify that at least one Drive thumbnail is actually publicly viewable.
      const sample = memoryShuffle(result).slice(0, Math.min(result.length, 4));
      const checks = await Promise.all(sample.map(src => memoryCheckImage(src)));
      if (!checks.some(Boolean)) throw new Error('Google Drive-foto’s is nie publiek sigbaar nie');
      photos = result;
      lastLive = true;
      track.dataset.source = 'Google Drive';
      nextSelection();
      paint();
    } catch (error) {
      console.warn('Family album unavailable. Keeping real family backup photos:', error);
      track.dataset.source = lastLive ? 'Google Drive' : 'Familiefoto’s (rugsteun)';
      // Keep the reel moving with the genuine family previews, never generic product imagery.
    } finally {
      fetching = false;
      if (reloadButton) reloadButton.disabled = false;
    }
  }
  if (pauseButton) {
    pauseButton.addEventListener('click', () => {
      paused = !paused;
      pauseButton.textContent = paused ? 'Speel die reel ▶' : 'Pouseer die reel';
      pauseButton.setAttribute('aria-pressed', String(paused));
      previousTime = 0;
    });
  }
  if (reloadButton) reloadButton.addEventListener('click', reload);
  window.addEventListener('resize', () => {distance=0;previousTime=0;});
  document.addEventListener('visibilitychange', () => {previousTime=0;});

  nextSelection();
  paint();
  track.dataset.source = 'Familiefoto’s (rugsteun)';
  requestAnimationFrame(frame); // one loop, no touchstart/touchend pause
  reload();
  // Automatically check again for new photos while the party is underway.
  setInterval(reload, 120000);
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

