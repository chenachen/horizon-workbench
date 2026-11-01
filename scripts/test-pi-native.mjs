import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
const binary = process.env.HORIZON_PI_BINARY || '/tmp/horizon-pi/pi/pi';
await access(binary);
const child = spawn('cargo', ['test', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml', 'agent::tests::real_pi_broker_review_and_secret_isolation', '--', '--ignored', '--nocapture', '--test-threads=1'], { stdio: 'inherit', env: { ...process.env, HORIZON_PI_BINARY: binary } });
child.on('exit', code => process.exit(code ?? 1));
