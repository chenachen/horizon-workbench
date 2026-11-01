import {appendFileSync} from 'node:fs';
appendFileSync('identities.jsonl', JSON.stringify({role:'child',pid:process.pid,ppid:process.ppid,cwd:process.cwd(),at:new Date().toISOString()})+'\n');
setInterval(() => {}, 1000);
process.on('SIGTERM', () => { appendFileSync('stop-order.jsonl', JSON.stringify({role:'child',pid:process.pid,at:new Date().toISOString()})+'\n'); process.exit(0); });
