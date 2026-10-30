/* DvE 1956: continuous family photo reel. Every available photo is scheduled once
   per shuffled cycle; a small sliding DOM buffer keeps phones responsive. */
const GOOGLE_DRIVE_PHOTO_FEED_URL = 'https://script.google.com/macros/s/AKfycbyaEMBcOb0-FisrU5Zm3yi4w9ptceioZ2Ng8PJJJq0G6KBGcEPNdmloexOXgNlugCHe/exec';
const MEMORY_BACKUP = [
  'assets/memories/straat-en-geskiedenis.jpg',
  'assets/memories/familie-in-die-stad.jpg',
  'assets/memories/familie-by-muurkuns.jpg',
  'assets/memories/familie-aan-tafel.jpg',
  'assets/memories/familie-saam.jpg'
];
const REEL_SPEED = 60; // px/s, a new image approximately every 4-5 seconds
const REEL_BUFFER = 12; // never create hundreds of <img> elements on an iPhone
const REEL_REFRESH_MS = 120000;

function memoryShuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function memoryNormalize(payload) {
  const data = Array.isArray(payload) ? payload :
    payload && (payload.images || payload.items || payload.photos || payload.files || payload.data);
  if (!Array.isArray(data)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of data) {
    const value = typeof entry === 'string' ? entry : entry &&
      (entry.url || entry.src || entry.downloadUrl || entry.thumbnailUrl || entry.thumbnail ||
       (entry.id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(entry.id) + '&sz=w800' : null));
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value.trim(), window.location.href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      if (!seen.has(url.href)) {
        seen.add(url.href);
        result.push(url.href);
      }
    } catch (_) { /* ignore invalid URLs */ }
  }
  return result;
}
async function memoryFetch(endpoint, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(endpoint, {
      method: 'GET', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error('Photo feed HTTP ' + res.status);
    const photos = memoryNormalize(await res.json());
    if (!photos.length) throw new Error('Geen foto’s beskikbaar in die foto-album nie');
    return photos;
  } finally { clearTimeout(timer); }
}
async function memoryGetLivePhotos() {
  // Same-origin serverless API avoids Apps Script browser CORS restrictions.
  // The original direct feed is a fallback when viewing an exported preview.
  return Promise.any([
    memoryFetch('/api/photos', 18000),
    memoryFetch(GOOGLE_DRIVE_PHOTO_FEED_URL, 17000)
  ]);
}
function memoryCheckImage(src, timeout = 5500) {
  return new Promise(resolve => {
    const img = new Image();
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeout);
    img.onload = () => finish(img.naturalWidth > 0);
    img.onerror = () => finish(false);
    img.src = src;
  });
}
function startMemoryReel() {
  const track = document.getElementById('memoryTrack');
  const status = document.getElementById('reelStatus');
  if (!track) return;

  let photoList = MEMORY_BACKUP.slice();
  let shuffledDeck = [];
  let deckIndex = 0;
  let lastPhoto = '';
  let listSignature = '';
  let live = false;
  let fetching = false;
  let offset = 0;
  let previousTime = 0;
  let brokenPhotos = 0;

  function showStatus(message, mode) {
    if (!status) return;
    status.textContent = message;
    status.dataset.mode = mode;
  }
  function nextPhoto() {
    if (deckIndex >= shuffledDeck.length) {
      shuffledDeck = memoryShuffle(photoList);
      deckIndex = 0;
      if (shuffledDeck.length > 1 && shuffledDeck[0] === lastPhoto) {
        const next = shuffledDeck[0];
        shuffledDeck[0] = shuffledDeck[1];
        shuffledDeck[1] = next;
      }
    }
    const src = shuffledDeck[deckIndex++];
    lastPhoto = src;
    return src;
  }
  function photoFrame(src) {
    const frame = document.createElement('div');
    frame.className = 'film-frame';
    const ambient = document.createElement('img');
    ambient.className = 'film-frame-ambient';
    ambient.alt = '';
    ambient.setAttribute('aria-hidden', 'true');
    ambient.loading = 'eager';
    ambient.decoding = 'async';
    const img = document.createElement('img');
    img.className = 'film-frame-photo';
    img.alt = 'Familieherinnering';
    img.loading = 'eager';
    img.decoding = 'async';
    frame.append(ambient, img);

    let tries = 0;
    img.addEventListener('error', () => {
      if (frame.classList.contains('film-frame-unavailable')) return;
      if (!live || tries >= 3) {
        frame.classList.add('film-frame-unavailable');
        ambient.removeAttribute('src');
        img.removeAttribute('src');
        brokenPhotos++;
        if (live) showStatus('Sommige foto’s kan nie gelaai word nie. Kontroleer die Google Drive-toestemmings.', 'warning');
        return;
      }
      // Skip inaccessible Drive pictures, rather than repeating the same five backups.
      tries++;
      setSource(nextPhoto());
    });
    function setSource(value) {
      frame.dataset.photo = value;
      ambient.src = value;
      img.src = value;
    }
    setSource(src);
    return frame;
  }
  function restartStrip() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < REEL_BUFFER; i++) fragment.appendChild(photoFrame(nextPhoto()));
    track.replaceChildren(fragment);
    offset = 0;
    previousTime = 0;
    track.style.transform = 'translate3d(0,0,0)';
  }
  function frameStep() {
    const first = track.firstElementChild;
    const second = first && first.nextElementSibling;
    return first && second ? Math.max(0, second.offsetLeft - first.offsetLeft) : 0;
  }
  function animate(time) {
    const dt = previousTime ? Math.min(Math.max((time - previousTime) / 1000, 0), .15) : 0;
    previousTime = time;
    if (!document.hidden && track.childElementCount && dt > 0) {
      offset -= dt * REEL_SPEED;
      let step = frameStep();
      let safety = 0;
      while (step > 0 && -offset >= step && safety++ < 5) {
        offset += step;
        track.firstElementChild.remove();
        track.appendChild(photoFrame(nextPhoto()));
        step = frameStep();
      }
      track.style.transform = 'translate3d(' + offset.toFixed(2) + 'px,0,0)';
    }
    requestAnimationFrame(animate);
  }
  async function reload() {
    if (fetching) return;
    fetching = true;
    try {
      const found = await memoryGetLivePhotos();
      // A real image must be viewable by guests; valid JSON alone is not enough.
      if (!live) {
        const sample = memoryShuffle(found).slice(0, Math.min(4, found.length));
        const visible = await Promise.all(sample.map(src => memoryCheckImage(src)));
        if (!visible.some(Boolean)) throw new Error('Drive-foto’s is nie publiek leesbaar nie');
      }
      const signature = found.slice().sort().join('\n');
      if (signature !== listSignature) {
        photoList = found;
        listSignature = signature;
        shuffledDeck = [];
        deckIndex = 0;
        lastPhoto = '';
        if (!live) restartStrip();
        // When new photos arrive, keep the moving filmstrip continuous;
        // queued frames will be replaced naturally, not reset every 2 minutes.
      }
      live = true;
      brokenPhotos = 0;
      track.dataset.source = 'Google Drive';
      track.dataset.total = String(found.length);
      showStatus(found.length + ' foto’s in die herinneringsreel', 'live');
    } catch (error) {
      console.warn('Memory Reel: cannot reach shared Google Drive album:', error);
      if (!live) {
        track.dataset.source = 'Rugsteunfoto’s';
        track.dataset.total = String(MEMORY_BACKUP.length);
        showStatus('Die volledige Google Drive-album kon nie laai nie — slegs rugsteunfoto’s word tans gewys.', 'warning');
      }
      // Never discard a previously successful feed after a transient failure.
    } finally {
      fetching = false;
    }
  }

  showStatus('Laai die volledige foto-album…', 'loading');
  restartStrip();
  track.dataset.source = 'Rugsteunfoto’s';
  track.dataset.total = String(MEMORY_BACKUP.length);
  requestAnimationFrame(animate);
  document.addEventListener('visibilitychange', () => { previousTime = 0; });
  window.addEventListener('resize', () => { previousTime = 0; });
  reload();
  setInterval(reload, REEL_REFRESH_MS); // automatic live updates, no refresh button
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

