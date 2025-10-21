import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackendServer() {
  console.log('Starting backend server...');

  const serverPath = path.join(__dirname, '../server/index.js');
  const command = 'node';

  serverProcess = spawn(command, [serverPath], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
  });

  // Wait for server to be ready
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log('✅ Backend server started');
      resolve();
    }, 2000);
  });
}

function stopBackendServer() {
  if (serverProcess) {
    console.log('Stopping backend server...');
    serverProcess.kill();
    serverProcess = null;
  }
}

// IPC Handlers
ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
    }).show();
  }
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// App lifecycle
app.whenReady().then(async () => {
  console.log(`Running in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  
  // In dev mode, server is already running via npm run dev
  if (!isDev) {
    console.log('Starting backend server from Electron...');
    await startBackendServer();
  } else {
    console.log('Skipping server start - using npm run dev server');
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
