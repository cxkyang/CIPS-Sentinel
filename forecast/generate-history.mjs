import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLOTS = [];
for (let h = 9; h <= 16; h++) {
  for (const m of ['00','15','30','45']) SLOTS.push(`${String(h).padStart(2,'0')}:${m}`);
}
SLOTS.push('17:00');

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261019);

function dateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const base = {
  '09:00': 0.18, '09:15': 0.12, '09:30': 0.10, '09:45': 0.06,
  '10:00': 0.04, '10:15': 0.02, '10:30': -0.02, '10:45': -0.03,
  '11:00': -0.08, '11:15': -0.10, '11:30': -0.12, '11:45': -0.14,
  '12:00': -0.10, '12:15': -0.12, '12:30': -0.15, '12:45': -0.16,
  '13:00': -0.18, '13:15': -0.20, '13:30': -0.22, '13:45': -0.24,
  '14:00': -0.26, '14:15': -0.28, '14:30': -0.30, '14:45': -0.34,
  '15:00': -0.42, '15:15': -0.30, '15:30': -0.24, '15:45': -0.20,
  '16:00': -0.18, '16:15': -0.12, '16:30': -0.08, '16:45': -0.05,
  '17:00': 0
};

const rows = [];
const end = new Date('2026-10-18T00:00:00+08:00');
for (let day = 89; day >= 0; day--) {
  const d = new Date(end.getTime() - day * 86400000);
  const ds = dateString(d);
  const weekday = d.getDay();
  let balance = 9.2;
  let dayShock = 0;
  if (rand() < 0.18) dayShock = (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.55);
  for (const time of SLOTS) {
    const seasonal = (base[time] ?? 0) + (time >= '10:45' ? 0.05 : 0);
    const noise = (rand() - 0.5) * 0.34;
    const morningBias = time < '10:45' ? 0.05 : 0;
    const net = seasonal + morningBias + noise + (time === '15:00' ? dayShock : 0);
    const inflow = Math.max(0, net) + rand() * 0.05;
    const outflow = Math.max(0, -net) + rand() * 0.05;
    balance += net;
    const isPeak = time === '15:00';
    rows.push({
      date: ds,
      weekday,
      time,
      cips_balance: Number(balance.toFixed(4)),
      cips_inflow: Number(inflow.toFixed(4)),
      cips_outflow: Number(outflow.toFixed(4)),
      cips_queue_amount: Number(Math.max(0, 0.8 + rand() * 1.8 + (isPeak ? 0.5 : 0)).toFixed(4)),
      cnaps_inflow: Number((0.8 + rand() * 1.1).toFixed(4)),
      cnaps_outflow: Number((0.6 + rand() * 1.0).toFixed(4)),
      treats_available: Number((4.6 - (89 - day) * 0.004 + (rand() - 0.5) * 0.12).toFixed(4)),
      gpe_pending_amount: Number((rand() < 0.35 ? 0.12 + rand() * 0.45 : 0).toFixed(4)),
      payment_count: Math.round(20 + rand() * 45 + (isPeak ? 12 : 0)),
      p1_count: Math.round(rand() * 4)
    });
  }
}
fs.writeFileSync(path.join(__dirname, 'history.json'), JSON.stringify({ generatedAt: '2026-10-19T09:00:00+08:00', source: 'sandbox 15min history', rows }, null, 2));
console.log(`wrote ${rows.length} rows, ${Math.round(rows.length/32)} days`);
