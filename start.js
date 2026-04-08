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

console.log('\x1b[36m%s\x1b[0m', '[System] Initializing Conflict Intelligence Agent...');

// 1. CSL Bridge (Port 5000)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting CSL Bridge on port 5000...');
const cslBackend = spawn(pyCmd, [join(__dirname, 'csllogsfetch.py')], { stdio: 'inherit' });

// 2. Matchmaking Bridge (Port 5001)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting Matchmaking Bridge on port 5001...');
const matchBackend = spawn(pyCmd, [join(__dirname, 'matmakingapi.py')], { stdio: 'inherit' });

// 3. PaidSince Bridge (Port 5002)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting PaidSince Bridge on port 5002...');
const paidSinceBackend = spawn(pyCmd, [join(__dirname, 'paidsince.py')], { stdio: 'inherit' });

// 4. CategoryReport Bridge (Port 5003)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting CategoryReport Bridge on port 5003...');
const categoryBackend = spawn(pyCmd, [join(__dirname, 'categoryreport.py')], { stdio: 'inherit' });

// 5. BS Complaints Bridge (Port 5004)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting BS Complaints Bridge on port 5004...');
const complaintsBackend = spawn(pyCmd, [join(__dirname, 'bscomplaints.py')], { stdio: 'inherit' });

// 6. Supplier Rating Bridge (Port 5005)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting Supplier Rating Bridge on port 5005...');
const ratingBackend = spawn(pyCmd, [join(__dirname, 'supplier_rating.py')], { stdio: 'inherit' });

// 7. LMS Fraud Detection Bridge (Port 5006)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting LMS Fraud Detection Bridge on port 5006...');
const fraudBackend = spawn(pyCmd, [join(__dirname, 'lms_fraud.py')], { stdio: 'inherit' });

// 8. Company Overview Bridge (Port 5007)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting Company Overview Bridge on port 5007...');
const overviewBackend = spawn(pyCmd, [join(__dirname, 'company_overview.py')], { stdio: 'inherit' });

// 9. Top Bar Summary Bridge (Port 5008)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting Top Bar Summary Bridge on port 5008...');
const summaryBackend = spawn(pyCmd, [join(__dirname, 'topbarsummary.py')], { stdio: 'inherit' });

// 10. History Service Bridge (Port 5009)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting History Service Bridge on port 5009...');
const historyBackend = spawn(pyCmd, [join(__dirname, 'history_service.py')], { stdio: 'inherit' });

// 10. MCAT Fetch Bridge (Port 5010)
console.log('\x1b[33m%s\x1b[0m', '[Backend] Starting MCAT Fetch Bridge on port 5010...');
const mcatBridge = spawn(pyCmd, [join(__dirname, 'mcat_fetch.py')], { stdio: 'inherit' });

// 11. Vite Frontend
console.log('\x1b[32m%s\x1b[0m', '[Frontend] Starting Vite Dev Server...');
const frontend = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

// Error handling for backend crashes
summaryBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] Top Bar Summary Bridge crashed with code ${code}.`);
});

overviewBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] Company Overview Bridge crashed with code ${code}.`);
});

cslBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] CSL Bridge crashed with code ${code}.`);
});

matchBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] Matchmaking Bridge crashed with code ${code}.`);
});

paidSinceBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] PaidSince Bridge crashed with code ${code}.`);
});

categoryBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] CategoryReport Bridge crashed with code ${code}.`);
});

complaintsBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] BS Complaints Bridge crashed with code ${code}.`);
});

ratingBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] Supplier Rating Bridge crashed with code ${code}.`);
});

fraudBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] LMS Fraud Bridge crashed with code ${code}.`);
});

historyBackend.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] History Service Bridge crashed with code ${code}.`);
});

mcatBridge.on('exit', (code) => {
  if (code !== 0) console.error('\x1b[31m%s\x1b[0m', `[Error] MCAT Fetch Bridge crashed with code ${code}.`);
});

process.on('SIGINT', () => {
  console.log('\x1b[35m%s\x1b[0m', '[System] Shutting down all services...');
  cslBackend.kill();
  matchBackend.kill();
  paidSinceBackend.kill();
  categoryBackend.kill();
  complaintsBackend.kill();
  ratingBackend.kill();
  fraudBackend.kill();
  overviewBackend.kill();
  summaryBackend.kill();
  historyBackend.kill();
  mcatBridge.kill();
  frontend.kill();
  process.exit();
});