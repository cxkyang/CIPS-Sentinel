import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBacktest } from './engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const result = runBacktest({ trainDays: 60, testDays: 20 });
fs.writeFileSync(path.join(__dirname, 'backtest.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
