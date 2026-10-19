// One-command demo seed: 7 Ahmedabad bins, all full (>= 85%) so alerts fire.
// amd-bin-002 must be exactly 96 (telemetry test asserts "96").
// Usage: npm run demo:seed   (server must be running on PORT or SOCKET_IO_URL)

const BASE = process.env.SEED_URL || 'http://localhost:5000';

// Ahmedabad coordinates (depot first, bins follow)
const BINS = [
  { id: 'amd-bin-001', lat: 23.0245, lng: 72.5714, fullness: 92, weight: 14.2, temperature: 31, humidity: 55 },
  { id: 'amd-bin-002', lat: 23.0288, lng: 72.5781, fullness: 96, weight: 18.5, temperature: 33, humidity: 58 },
  { id: 'amd-bin-003', lat: 23.0326, lng: 72.5635, fullness: 87, weight: 9.8, temperature: 30, humidity: 52 },
  { id: 'amd-bin-004', lat: 23.0191, lng: 72.5849, fullness: 95, weight: 16.1, temperature: 34, humidity: 60 },
  { id: 'amd-bin-005', lat: 23.0395, lng: 72.5888, fullness: 90, weight: 11.4, temperature: 32, humidity: 57 },
  { id: 'amd-bin-006', lat: 23.0152, lng: 72.5592, fullness: 88, weight: 13.7, temperature: 31, humidity: 54 },
  { id: 'amd-bin-007', lat: 23.0442, lng: 72.5690, fullness: 98, weight: 19.3, temperature: 35, humidity: 61 },
];

async function seed() {
  let ok = 0;
  for (const b of BINS) {
    const res = await fetch(`${BASE}/updateBin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    });
    if (!res.ok) {
      console.error(`FAIL ${b.id}: HTTP ${res.status} ${await res.text()}`);
      process.exitCode = 1;
    } else {
      ok++;
      console.log(`ok  ${b.id}  fullness=${b.fullness}%  weight=${b.weight}kg`);
    }
  }
  console.log(`\nSeeded ${ok}/${BINS.length} bins at ${BASE}`);
  console.log('All bins are >= 85% -> fullnessAlert + rerouteSuggestion events fired.');
}

seed().catch((e) => {
  console.error('Seed failed:', e.message);
  console.error('Is the server running? Start it first:  npm start');
  process.exit(1);
});
