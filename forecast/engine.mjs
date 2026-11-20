import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = path.join(__dirname, 'history.json');
const SCENARIO_PATH = path.join(__dirname, 'scenario.json');
const BACKTEST_PATH = path.join(__dirname, 'backtest.json');
const SLOTS = [];
for (let h = 9; h <= 16; h++) for (const m of ['00','15','30','45']) SLOTS.push(`${String(h).padStart(2,'0')}:${m}`);
SLOTS.push('17:00');

let historyCache = null;
function history() {
  if (!historyCache) historyCache = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')).rows;
  return historyCache;
}
function scenario() {
  if (fs.existsSync(SCENARIO_PATH)) return JSON.parse(fs.readFileSync(SCENARIO_PATH, 'utf8'));
  return { asOf: '2026-10-19T10:42:00+08:00', openingBalance: 6.2, floor: 5.0, scheduledFlows: [] };
}
function backtestInfo() {
  if (fs.existsSync(BACKTEST_PATH)) return JSON.parse(fs.readFileSync(BACKTEST_PATH, 'utf8'));
  return { coverage_p72: 0.72, mae: null, pinball_p72: null };
}

function median(a) {
  if (!a.length) return 0;
  const x = [...a].sort((a,b)=>a-b);
  const m = Math.floor(x.length/2);
  return x.length % 2 ? x[m] : (x[m-1]+x[m])/2;
}
function quantile(a, q) {
  if (!a.length) return 0;
  const x = [...a].sort((a,b)=>a-b);
  const pos = (x.length-1)*q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? x[lo] : x[lo] + (x[hi]-x[lo])*(pos-lo);
}
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fitProfile(rows) {
  const bySlot = new Map();
  for (const r of rows) {
    if (!bySlot.has(r.time)) bySlot.set(r.time, []);
    bySlot.get(r.time).push(Number(r.cips_inflow || 0) - Number(r.cips_outflow || 0));
  }
  const profile = {};
  const residuals = {};
  for (const [slot, vals] of bySlot) {
    const m = median(vals);
    profile[slot] = m;
    residuals[slot] = vals.map(v => v - m);
  }
  return { profile, residuals };
}

export function runForecast(options = {}) {
  const sc = { ...scenario(), ...options };
  const asOf = sc.asOf || '2026-10-19T10:42:00+08:00';
  const targetDate = asOf.slice(0, 10);
  const cutoff = asOf.slice(11, 16);
  const rows = history().filter(r => r.date < targetDate);
  const { profile, residuals } = fitProfile(rows);
  const opening = Number(sc.openingBalance ?? 6.2);
  const floor = Number(sc.floor ?? 5.0);
  const scheduled = Array.isArray(sc.scheduledFlows) ? sc.scheduledFlows : [];
  const future = SLOTS.filter(s => s > cutoff);
  const pathCount = Number(sc.paths ?? 1200);
  const rand = mulberry32(20261019);

  const paths = [];
  const minima = [];
  const minTimes = [];
  for (let p = 0; p < pathCount; p++) {
    let bal = opening, min = opening, minAt = future[0] || cutoff;
    const path = [];
    for (const slot of future) {
      const sched = scheduled.filter(x => x.time === slot).reduce((s,x)=>s+Number(x.amount||0),0);
      const pool = residuals[slot]?.length ? residuals[slot] : residuals['15:00'] || [0];
      // sample residual from the same 15-min bucket; this preserves intraday heteroskedasticity
      const eps = pool[Math.floor(rand() * pool.length)] * 0.95;
      const net = (profile[slot] ?? 0) - sched + eps;
      bal += net;
      path.push({ time: slot, balance: Number(bal.toFixed(4)) });
      if (bal < min) { min = bal; minAt = slot; }
    }
    paths.push(path);
    minima.push(Math.max(0, floor - min));
    minTimes.push(minAt);
  }

  const gapP50 = quantile(minima, 0.50);
  const gapP72 = quantile(minima, 0.72);
  const gapP95 = quantile(minima, 0.95);
  // Choose the time of the median path's minimum as the narrative gap time.
  const ordered = [...paths].sort((a,b)=>a[a.length-1].balance-b[b.length-1].balance);
  const medianPath = ordered[Math.floor(ordered.length*0.5)];
  let medianMin = Infinity, at = future[0];
  for (const x of medianPath) if (x.balance < medianMin) { medianMin = x.balance; at = x.time; }
  const bt = backtestInfo();
  const coverage = Number(bt.coverage_p72 ?? 0.72);
  const drivers = [];
  if (scheduled.length) drivers.push(`计划内大额付款 ${scheduled.map(x=>`${x.time} ${Number(x.amount).toFixed(2)} 亿`).join(' / ')}`);
  if (sc.queueAmount) drivers.push(`CIPS 排队 ${Number(sc.queueAmount).toFixed(2)} 亿`);
  if (sc.treatsAvailable) drivers.push(`TREATS 可调 ${Number(sc.treatsAvailable).toFixed(2)} 亿`);

  return {
    ok: true,
    as_of: asOf,
    horizon: future[future.length-1] || '17:00',
    step_min: 15,
    opening_balance_yi: opening,
    floor_yi: floor,
    gap_yi: Number(gapP72.toFixed(2)),
    at,
    p50_yi: Number(gapP50.toFixed(2)),
    p72_yi: Number(gapP72.toFixed(2)),
    p95_yi: Number(gapP95.toFixed(2)),
    confidence: Number(coverage.toFixed(2)),
    coverage_p72: Number(coverage.toFixed(2)),
    backtest_mae_yi: bt.mae,
    backtest_pinball_p72: bt.pinball_p72,
    paths: pathCount,
    drivers,
    path: medianPath,
    model_version: 'forecast-v0.1-seasonal-bootstrap',
    source: 'sandbox 90d 15min history + residual bootstrap',
    generated_at: new Date().toISOString()
  };
}

export function runBacktest({ trainDays = 60, testDays = 20 } = {}) {
  const rows = history();
  const dates = [...new Set(rows.map(r => r.date))].sort();
  if (dates.length < trainDays + testDays) throw new Error('not enough history');
  const testDates = dates.slice(-testDays);
  const residualsErrors = [];
  let covered = 0, total = 0, pinball = 0;
  for (const testDate of testDates) {
    const trainRows = rows.filter(r => r.date < testDate);
    const { profile, residuals } = fitProfile(trainRows);
    for (const r of rows.filter(r => r.date === testDate)) {
      const actualNet = Number(r.cips_inflow) - Number(r.cips_outflow);
      const predicted = profile[r.time] ?? 0;
      const pool = residuals[r.time]?.length ? residuals[r.time] : [0];
      const q72 = quantile(pool, 0.72);
      residualsErrors.push(Math.abs(actualNet - predicted));
      total++;
      // p72 one-sided coverage on net flow: actual <= predicted + q72
      if (actualNet <= predicted + q72) covered++;
      const err = actualNet - predicted;
      const q = 0.72;
      pinball += Math.max(q * err, (q - 1) * err);
    }
  }
  return {
    model_version: 'forecast-v0.1-seasonal-bootstrap',
    train_days: trainDays,
    test_days: testDays,
    test_rows: total,
    mae: Number((residualsErrors.reduce((a,b)=>a+b,0)/total).toFixed(4)),
    pinball_p72: Number((pinball/total).toFixed(4)),
    coverage_p72: Number((covered/total).toFixed(3)),
    generated_at: new Date().toISOString()
  };
}
