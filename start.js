import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getPython() {
  for (const cmd of ['python3', 'python', 'py']) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch {}
  }
  return null;
}

const pyCmd = getPython();
if (!pyCmd) {
  console.error('\x1b[31m%s\x1b[0m', '[Critical] Python 3 is required but not found in PATH.');
  process.exit(1);
}

console.log('\x1b[36m%s\x1b[0m', '[System] Initializing PROXYLYSIS UNIFIED DESKTOP ENGINE...');

// Unified Backend (Port 3000)
// This server serves both the static React build and all API endpoints.
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting Unified Server on port 3000...');
const server = spawn(pyCmd, [join(__dirname, 'backend.py')], { stdio: 'inherit' });

server.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] Unified Server crashed with code ${code}.`);
});

process.on('SIGINT', () => {
  console.log('\x1b[35m%s\x1b[0m', '[System] Shutting down unified server...');
  server.kill();
  process.exit();
});
