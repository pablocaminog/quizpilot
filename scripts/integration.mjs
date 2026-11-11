// Real-runtime integration harness (orders-demo pattern): build the Worker and
// UI, apply D1 migrations to a temporary persistence dir, boot `wrangler dev`
// against the emitted deploy config, poll /api/health, then run the suite.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

const state = await mkdtemp(join(tmpdir(), 'quizpilot-test-'));
const cli = 'node_modules/wrangler/bin/wrangler.js';
const config = 'dist/quizpilot/wrangler.json';
const port = Number(process.env.TEST_PORT || 8811);
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' };

function run(command, args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env, ...extra });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))));
  });
}

let server;
try {
  await run('npm', ['run', 'build']);
  await run(process.execPath, [cli, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state, '--config', config]);
  server = spawn(process.execPath, [cli, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0', '--persist-to', state, '--config', config], { stdio: 'inherit', env });
  server.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error('Local Worker stopped before it was ready');
    try {
      ready = (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Local Worker readiness timeout');
  const files = (await readdir('tests/integration')).filter((n) => n.endsWith('.test.js')).map((n) => 'tests/integration/' + n);
  await run(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    env: { ...env, BASE_URL: base, TEST_STATE: state, WRANGLER_CONFIG: config },
  });
} finally {
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    const force = setTimeout(() => server.kill('SIGKILL'), 5000);
    await stopped;
    clearTimeout(force);
  }
  await rm(state, { recursive: true, force: true });
}
