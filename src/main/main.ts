import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  shell,
  Tray
} from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getConfigPath, loadConfig } from './config';
import { isConfiguredParent, isProjectPath, scanParent } from './scan';
import type { LoadResult, OpenResult, OpenTarget, ScanResult } from '../shared/types';

const WIN_WIDTH = 460;
const WIN_HEIGHT = 520;
const SCREEN_MARGIN = 12;
const DEV_URL = process.env.VITE_DEV_SERVER_URL;

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let lastResult: LoadResult = loadConfig();
let registeredShortcut: string | null = null;
let failedShortcut: string | null = null;

/* ---------------------------------------------------------------- config */

function applyConfig(): void {
  lastResult = loadConfig();
  registerShortcut(lastResult.config.shortcut);
}

function registerShortcut(accelerator: string): void {
  if (accelerator === registeredShortcut) return;

  if (registeredShortcut) {
    globalShortcut.unregister(registeredShortcut);
    registeredShortcut = null;
  }

  let ok = false;
  try {
    ok = globalShortcut.register(accelerator, toggleWindow);
  } catch {
    ok = false;
  }

  if (ok) {
    registeredShortcut = accelerator;
    failedShortcut = null;
    tray?.setToolTip(`Project Launcher (${accelerator})`);
    return;
  }

  tray?.setToolTip('Project Launcher (shortcut not registered)');
  if (failedShortcut !== accelerator) {
    failedShortcut = accelerator;
    dialog.showErrorBox(
      'Project Launcher',
      `The shortcut "${accelerator}" could not be registered. Another app may be using it, or it is not a valid shortcut.\n\nChange "shortcut" in projects.json (tray menu > Edit projects.json).`
    );
  }
}

/* ---------------------------------------------------------------- window */

function createWindow(): void {
  win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.on('blur', () => {
    // Keep the popup open while DevTools is focused during development.
    if (!win?.webContents.isDevToolsOpened()) hideWindow();
  });

  if (DEV_URL) {
    void win.loadURL(DEV_URL);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function positionWindow(): void {
  if (!win) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea; // excludes the taskbar
  win.setBounds({
    x: x + width - WIN_WIDTH - SCREEN_MARGIN,
    y: y + height - WIN_HEIGHT - SCREEN_MARGIN,
    width: WIN_WIDTH,
    height: WIN_HEIGHT
  });
}

function showWindow(): void {
  if (!win) return;
  applyConfig(); // pick up edits to projects.json every time the popup opens
  positionWindow();
  win.show();
  win.focus();
  win.webContents.send('launcher:shown');
}

function hideWindow(): void {
  if (win?.isVisible()) win.hide();
}

function toggleWindow(): void {
  if (win?.isVisible()) hideWindow();
  else showWindow();
}

/* ------------------------------------------------------------------ tray */

function trayIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../build/icon.png');
}

function createTray(): void {
  const icon = nativeImage.createFromPath(trayIconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Project Launcher');
  tray.on('click', toggleWindow);

  const rebuildMenu = () =>
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Show launcher', click: showWindow },
        { label: 'Edit projects.json', click: () => void shell.openPath(getConfigPath()) },
        { label: 'Reload config', click: applyConfig },
        { type: 'separator' },
        {
          label: 'Start with Windows',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => {
            app.setLoginItemSettings({ openAtLogin: item.checked });
            rebuildMenu();
          }
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ])
    );
  rebuildMenu();
}

/* ------------------------------------------------------------------- IPC */

function launchVsCode(command: string, folder: string): Promise<OpenResult> {
  return new Promise((resolve) => {
    // `code` is a .cmd shim on Windows, so it needs a shell. Quote both parts for spaces.
    const child = spawn(`"${command}"`, [`"${folder}"`], {
      shell: true,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });

    const timer = setTimeout(() => resolve({ ok: true }), 4000);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `Could not start VS Code: ${err.message}` });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(
        code === 0 || code === null
          ? { ok: true }
          : {
              ok: false,
              error: `VS Code command "${command}" failed. Check "vscodeCommand" in projects.json.`
            }
      );
    });
    child.unref();
  });
}

function registerIpc(): void {
  ipcMain.handle('launcher:get-config', (): LoadResult => lastResult);

  ipcMain.handle('launcher:scan', async (_event, parentPath: unknown): Promise<ScanResult> => {
    const parents = lastResult.config.parentFolders;
    if (typeof parentPath !== 'string' || !isConfiguredParent(parents, parentPath)) {
      return { parent: String(parentPath), categories: [], error: 'That folder is not listed in projects.json.' };
    }
    return scanParent(parentPath);
  });

  ipcMain.handle(
    'launcher:open',
    async (_event, projectPath: unknown, target: unknown): Promise<OpenResult> => {
      if (typeof projectPath !== 'string' || (target !== 'vscode' && target !== 'explorer')) {
        return { ok: false, error: 'Invalid request.' };
      }
      // Only folders two levels below a configured parent folder may be opened.
      if (!isProjectPath(lastResult.config.parentFolders, projectPath)) {
        return { ok: false, error: 'That folder is not inside a configured parent folder.' };
      }
      if (!fs.existsSync(projectPath)) {
        return { ok: false, error: `Folder not found: ${projectPath}` };
      }

      let result: OpenResult;
      if ((target as OpenTarget) === 'explorer') {
        const err = await shell.openPath(projectPath);
        result = err ? { ok: false, error: err } : { ok: true };
      } else {
        result = await launchVsCode(lastResult.config.vscodeCommand, projectPath);
      }

      if (result.ok) hideWindow();
      return result;
    }
  );

  ipcMain.on('launcher:hide', hideWindow);
}

/* ------------------------------------------------------------- lifecycle */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    if (!DEV_URL) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
            ]
          }
        });
      });
    }

    registerIpc();
    createWindow();
    createTray();
    applyConfig();
  });

  // The app lives in the tray; closing the (hidden) window must not quit it.
  app.on('window-all-closed', () => {});
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
