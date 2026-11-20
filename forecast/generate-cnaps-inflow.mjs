import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const rand=mulberry32(20260811);
const end=new Date('2026-08-11T00:00:00+08:00');
const rows=[];
const recurringBase=[0,15.2,16.0,16.8,16.4,18.2,0,0];
for(let i=179;i>=0;i--){
  const d=new Date(end.getTime()-i*86400000);
  const wd=d.getDay();
  if(wd===0||wd===6) continue;
  const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const monthEnd=d.getDate()>=27;
  const recurring=recurringBase[wd]+(rand()-0.5)*1.3;
  const large=1.3+rand()*3.6+(monthEnd?1.6:0)+(rand()<0.07?2.5+rand()*3:0);
  const instant=.18+rand()*.55;
  const total=recurring+large+instant;
  const unmatched=total*(.025+rand()*.055);
  rows.push({
    date:ds, weekday:wd,
    recurring:Number(recurring.toFixed(4)),
    large:Number(large.toFixed(4)),
    instant:Number(instant.toFixed(4)),
    total:Number(total.toFixed(4)),
    unmatched:Number(unmatched.toFixed(4)),
    confirmed:Number((total-unmatched).toFixed(4))
  });
}
fs.writeFileSync(path.join(__dirname,'cnaps-inflow-history.json'),JSON.stringify({source:'sandbox CNAPS daily inflow history',rows},null,2));
console.log('wrote',rows.length,'business days');
