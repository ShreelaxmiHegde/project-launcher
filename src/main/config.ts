import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LauncherConfig, LoadResult } from '../shared/types';

export const DEFAULT_SHORTCUT = 'Control+Alt+P';

/**
 * Development: use <repo>/config/projects.json when it exists.
 * Otherwise: %APPDATA%\project-launcher\projects.json
 */
export function getConfigPath(): string {
  if (!app.isPackaged) {
    const local = path.join(app.getAppPath(), 'config', 'projects.json');
    if (fs.existsSync(local)) return local;
  }
  return path.join(app.getPath('userData'), 'projects.json');
}

function defaultConfig(): LauncherConfig {
  return { shortcut: DEFAULT_SHORTCUT, vscodeCommand: 'code', parentFolders: ['C:\\Dev'] };
}

function ensureConfigFile(file: string): void {
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(defaultConfig(), null, 2), 'utf8');
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Supports "~" and %ENV_VARS% in folder paths. */
function expandPath(p: string): string {
  let out = p.replace(/%([^%]+)%/g, (m, name: string) => process.env[name] ?? m);
  if (out === '~' || out.startsWith('~/') || out.startsWith('~\\')) {
    out = path.join(os.homedir(), out.slice(1));
  }
  return path.normalize(out);
}

export function loadConfig(): LoadResult {
  const configPath = getConfigPath();
  const fallback = defaultConfig();
  try {
    ensureConfigFile(configPath);
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const folders = Array.isArray(raw?.parentFolders)
      ? Array.from(
          new Set(
            (raw.parentFolders as unknown[])
              .map(str)
              .filter((p): p is string => p !== null)
              .map(expandPath)
          )
        )
      : [];

    return {
      configPath,
      error:
        folders.length === 0
          ? 'No parent folders found. Add a "parentFolders" list to projects.json (tray menu > Edit projects.json).'
          : undefined,
      config: {
        shortcut: str(raw?.shortcut) ?? DEFAULT_SHORTCUT,
        vscodeCommand: str(raw?.vscodeCommand) ?? 'code',
        parentFolders: folders
      }
    };
  } catch (err) {
    return {
      configPath,
      error: `Could not read projects.json: ${(err as Error).message}`,
      config: { ...fallback, parentFolders: [] }
    };
  }
}
