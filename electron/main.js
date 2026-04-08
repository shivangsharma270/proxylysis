import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;

function getPython() {
  for (const cmd of ['python3', 'python', 'py']) {
    try {
      require('child_process').execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch {}
  }
  return null;
}

function startBackend() {
  const isDev = !app.isPackaged;
  let pyCmd;
  let pyScript;

  if (isDev) {
    pyCmd = 'python3'; // Or use getPython() logic
    pyScript = path.join(__dirname, '..', 'backend.py');
    console.log(`[Electron] Starting dev backend: ${pyCmd} ${pyScript}`);
    backendProcess = spawn(pyCmd, [pyScript]);
  } else {
    // In production, backend.py should be bundled as an executable sidecar
    // or run via a bundled python environment.
    // For simplicity, we assume backend.exe is in the extraResources folder.
    const backendExe = path.join(process.resourcesPath, 'backend.exe');
    if (fs.existsSync(backendExe)) {
      console.log(`[Electron] Starting production backend: ${backendExe}`);
      backendProcess = spawn(backendExe);
    } else {
      console.error(`[Electron] Backend executable not found at ${backendExe}`);
    }
  }

  if (backendProcess) {
    backendProcess.stdout.on('data', (data) => console.log(`[Backend] ${data}`));
    backendProcess.stderr.on('data', (data) => console.error(`[Backend Error] ${data}`));
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

process.on('exit', () => {
  if (backendProcess) backendProcess.kill();
});
