// Waste Wise Citizen — nearby bins, report flow, Swachh score, EN/HI.
let API_BASE = '';
async function detectApiBase() {
  try {
    if (window.location && window.location.protocol === 'file:') return 'http://localhost:5000';
    const c = window.location.origin;
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(c + '/health', { signal: ctrl.signal });
      clearTimeout(id);
      if (r && r.ok) return c;
    } catch (e) { /* fallback */ }
    return 'http://localhost:5000';
  } catch (e) { return 'http://localhost:5000'; }
}

const I18N = {
  en: {
    hero: 'Swachh City<br><span>starts with you.</span>',
    herosub: 'See a full bin? Report it. It lands on a driver\u2019s route today \u2014 track it here.',
    score: 'MY SWACHH SCORE', nearby: 'BINS NEAR YOU',
    segtitle: 'SEGREGATE RIGHT \u2014 SWM RULES 2016',
    wet: 'WET \u00B7 GREEN', wetex: 'Kitchen, flowers, food',
    dry: 'DRY \u00B7 BLUE', dryex: 'Plastic, paper, metal',
    haz: 'HAZARD \u00B7 RED', hazex: 'Sanitary, blades, chemicals',
    mine: 'MY REPORTS', send: 'SEND REPORT \u2192'
  },
  hi: {
    hero: '\u0938\u094d\u0935\u091a\u094d\u091b \u0936\u0939\u0930<br><span>\u0906\u092a\u0938\u0947 \u0936\u0941\u0930\u0942\u0964</span>',
    herosub: '\u092d\u0930\u093e \u0915\u091a\u0930\u093e\u0926\u093e\u0928 \u0926\u093f\u0916\u093e? \u0930\u093f\u092a\u094b\u0930\u094d\u091f \u0915\u0930\u0947\u0902\u0964 \u0906\u091c \u0939\u0940 \u0921\u094d\u0930\u093e\u0907\u0935\u0930 \u0915\u0947 \u0930\u0942\u091f \u092a\u0930 \u0906\u090f\u0917\u093e\u0964',
    score: '\u092e\u0947\u0930\u093e \u0938\u094d\u0935\u091a\u094d\u091b \u0938\u094d\u0915\u094b\u0930', nearby: '\u092a\u093e\u0938 \u0915\u0947 \u0915\u091a\u0930\u093e\u0926\u093e\u0928',
    segtitle: '\u0938\u0939\u0940 \u0905\u0932\u0917\u093e\u0935 \u0915\u0930\u0947\u0902 \u2014 SWM \u0928\u093f\u092f\u092e 2016',
    wet: '\u0917\u0940\u0932\u093e \u00B7 \u0939\u0930\u093e', wetex: '\u0930\u0938\u094b\u0908, \u092b\u0942\u0932, \u092d\u094b\u091c\u0928',
    dry: '\u0938\u0942\u0916\u093e \u00B7 \u0928\u0940\u0932\u093e', dryex: '\u092a\u094d\u0932\u093e\u0938\u094d\u091f\u093f\u0915, \u0915\u093e\u0917\u091c\u093c, \u0927\u093e\u0924\u0941',
    haz: '\u0916\u0924\u0930\u0928\u093e\u0915 \u00B7 \u0932\u093e\u0932', hazex: '\u0938\u0948\u0928\u093f\u091f\u0930\u0940, \u092c\u094d\u0932\u0947\u0921, \u0930\u0938\u093e\u092f\u0928',
    mine: '\u092e\u0947\u0930\u0940 \u0930\u093f\u092a\u094b\u0930\u094d\u091f', send: '\u092d\u0947\u091c\u0947\u0902 \u2192'
  }
};
const TYPE_LABEL = {
  overflow: { en: 'Overflowing', hi: '\u091b\u0932\u0915\u0924\u093e \u0915\u091a\u0930\u093e' },
  missed_pickup: { en: 'Missed pickup', hi: '\u0917\u093e\u0921\u093c\u0940 \u0928\u0939\u0940\u0902 \u0906\u0908' },
  burning: { en: 'Burning/smoke', hi: '\u091c\u0932 \u0930\u0939\u093e \u0939\u0948' },
  segregation: { en: 'Mixed waste', hi: '\u092e\u093f\u0932\u093e \u0915\u091a\u0930\u093e' },
  damaged_bin: { en: 'Damaged bin', hi: '\u091f\u0942\u091f\u093e \u0921\u092c\u094d\u092c\u093e' },
  other: { en: 'Other', hi: '\u0905\u0928\u094d\u092f' }
};
let lang = localStorage.getItem('ww_lang') || 'en';
let myName = localStorage.getItem('ww_name') || '';
let sheetBin = null;
let sheetType = 'overflow';

function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.getElementById('langEn').classList.toggle('on', lang === 'en');
  document.getElementById('langHi').classList.toggle('on', lang === 'hi');
  document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  renderTypeChips();
  loadMine();
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}
function reporter() {
  const v = (document.getElementById('reporterName').value || '').trim();
  if (v) { myName = v; localStorage.setItem('ww_name', v); }
  return myName || 'citizen';
}
function statusDot(b) {
  const f = Number(b.fullness || 0);
  const haz = b.status === 'hazard' || b.status === 'on_fire' || Number(b.temperature) >= 60;
  if (haz) return 'r';
  if (f >= 80) return 'o';
  if (f >= 50) return 'y';
  return 'g';
}
async function locate() {
  if (!navigator.geolocation) return { lat: 23.0225, lng: 72.5714 };
  try {
    const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 }));
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch (e) { return { lat: 23.0225, lng: 72.5714 }; }
}
async function loadNearby() {
  const list = document.getElementById('nearList');
  try {
    const { lat, lng } = await locate();
    const r = await fetch(`${API_BASE}/nearby-bins?lat=${lat}&lng=${lng}&r=5000`);
    const { bins } = await r.json();
    if (!bins || !bins.length) {
      list.innerHTML = `<div style="font-family:var(--font-mono);font-size:11px;color:var(--color-slate-600);padding:8px 4px">No bins nearby yet.</div>`;
      return;
    }
    list.innerHTML = '';
    bins.slice(0, 12).forEach(b => {
      const row = document.createElement('div');
      row.className = 'binrow';
      row.innerHTML = `<i class="sdot ${statusDot(b)}"></i>
        <div class="bininfo"><b>${b.id}</b><span>${b.location || ''} · ${b.fullness || 0}%</span></div>
        <button class="rep" data-bin="${b.id}">${lang === 'hi' ? 'रिपोर्ट' : 'Report'}</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll('.rep').forEach(btn => btn.addEventListener('click', () => openSheet(btn.dataset.bin)));
  } catch (e) {
    list.innerHTML = `<div style="font-family:var(--font-mono);font-size:11px;color:#b91c1c;padding:8px 4px">Could not reach server.</div>`;
  }
}
function renderTypeChips() {
  const box = document.getElementById('typeChips');
  box.innerHTML = '';
  Object.keys(TYPE_LABEL).forEach(k => {
    const b = document.createElement('button');
    b.textContent = TYPE_LABEL[k][lang] || TYPE_LABEL[k].en;
    if (k === sheetType) b.classList.add('on');
    b.addEventListener('click', () => { sheetType = k; renderTypeChips(); });
    box.appendChild(b);
  });
}
function openSheet(binId) {
  sheetBin = binId;
  document.getElementById('sheetTitle').textContent = (lang === 'hi' ? 'रिपोर्ट: ' : 'Report ') + binId;
  renderTypeChips();
  document.getElementById('sheet').classList.add('show');
  document.getElementById('scrim').classList.add('show');
}
function closeSheet() {
  document.getElementById('sheet').classList.remove('show');
  document.getElementById('scrim').classList.remove('show');
}
async function sendReport() {
  const note = document.getElementById('noteInput').value.trim();
  try {
    const r = await fetch(`${API_BASE}/complaints`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ binId: sheetBin, type: sheetType, note, reporter: reporter() })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    closeSheet();
    document.getElementById('noteInput').value = '';
    toast(lang === 'hi' ? 'रिपोर्ट भेजी गई +10 अंक' : 'Reported! +10 pts — on a route today');
    loadMine(); loadScore();
  } catch (e) { toast('Failed. Server reachable?'); }
}
async function loadMine() {
  const ul = document.getElementById('myList');
  try {
    const r = await fetch(`${API_BASE}/complaints`);
    const { complaints } = await r.json();
    const name = reporter();
    const mine = complaints.filter(c => c.reporter === name).slice(0, 8);
    if (!mine.length) { ul.innerHTML = `<li style="color:var(--color-slate-500)">—</li>`; return; }
    ul.innerHTML = '';
    mine.forEach(c => {
      const li = document.createElement('li');
      const lbl = (TYPE_LABEL[c.type] && (TYPE_LABEL[c.type][lang] || TYPE_LABEL[c.type].en)) || c.type;
      li.innerHTML = `${c.binId || 'area'} · ${lbl}<span class="pill ${c.status}">${c.status}</span><br><span style="color:var(--color-slate-500)">${new Date(c.createdAt).toLocaleString()}</span>`;
      ul.appendChild(li);
    });
  } catch (e) { /* ignore */ }
}
async function loadScore() {
  try {
    const r = await fetch(`${API_BASE}/citizen/${encodeURIComponent(reporter())}/score`);
    const s = await r.json();
    document.getElementById('myPoints').textContent = s.points;
    document.getElementById('myLevel').textContent = (s.level || '').toUpperCase();
  } catch (e) { /* ignore */ }
}
document.addEventListener('DOMContentLoaded', async () => {
  API_BASE = await detectApiBase();
  document.getElementById('reporterName').value = myName;
  document.getElementById('reporterName').addEventListener('change', () => { reporter(); loadMine(); loadScore(); });
  document.getElementById('langEn').addEventListener('click', () => { lang = 'en'; localStorage.setItem('ww_lang', lang); applyLang(); loadNearby(); });
  document.getElementById('langHi').addEventListener('click', () => { lang = 'hi'; localStorage.setItem('ww_lang', lang); applyLang(); loadNearby(); });
  document.getElementById('scrim').addEventListener('click', closeSheet);
  document.getElementById('sendBtn').addEventListener('click', sendReport);
  applyLang();
  loadNearby(); loadMine(); loadScore();
  try {
    const s = io(API_BASE);
    s.on('connect', () => s.emit('subscribeRoutes'));
    s.on('complaintResolved', () => { loadMine(); loadScore(); });
  } catch (e) { /* realtime optional */ }
});
