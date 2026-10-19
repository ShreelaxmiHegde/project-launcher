import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { Category, LauncherConfig, LoadResult, Project } from '../shared/types';

export const DEFAULT_SHORTCUT = 'Control+Alt+P';
const MAX_ICON_BYTES = 256 * 1024;
const ICON_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

export function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'projects.json');
}

function defaultConfig(): LauncherConfig {
  return {
    shortcut: DEFAULT_SHORTCUT,
    vscodeCommand: 'code',
    categories: [
      {
        name: 'SoftwareEngineering',
        path: 'D:\\SoftwareEngineering',
        projects: [
          { name: 'Project Launcher', path: 'D:\\SoftwareEngineering\\explorr\\project-launcher' }
        ]
      }
    ]
  };
}

function ensureConfigFile(): void {
  const file = getConfigPath();
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(defaultConfig(), null, 2), 'utf8');
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readIcon(iconPath: string | null): string | undefined {
  if (!iconPath) return undefined;
  try {
    const mime = ICON_MIME[path.extname(iconPath).toLowerCase()];
    if (!mime) return undefined;
    const stat = fs.statSync(iconPath);
    if (!stat.isFile() || stat.size > MAX_ICON_BYTES) return undefined;
    return `data:${mime};base64,${fs.readFileSync(iconPath).toString('base64')}`;
  } catch {
    return undefined;
  }
}

function normalizeProject(raw: any): Project | null {
  const name = str(raw?.name);
  const projectPath = str(raw?.path);
  if (!name || !projectPath) return null;
  const icon = str(raw?.icon);
  return { name, path: projectPath, icon: icon ?? undefined, iconData: readIcon(icon) };
}

function normalizeCategory(raw: any): Category | null {
  const name = str(raw?.name);
  if (!name) return null;
  const projects = Array.isArray(raw?.projects)
    ? (raw.projects.map(normalizeProject).filter(Boolean) as Project[])
    : [];
  return { name, path: str(raw?.path) ?? '', projects };
}

export function loadConfig(): LoadResult {
  const configPath = getConfigPath();
  try {
    ensureConfigFile();
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const categories = Array.isArray(raw?.categories)
      ? (raw.categories.map(normalizeCategory).filter(Boolean) as Category[])
      : [];
    return {
      configPath,
      config: {
        shortcut: str(raw?.shortcut) ?? DEFAULT_SHORTCUT,
        vscodeCommand: str(raw?.vscodeCommand) ?? 'code',
        categories
      }
    };
  } catch (err) {
    return {
      configPath,
      error: `Could not read projects.json: ${(err as Error).message}`,
      config: { shortcut: DEFAULT_SHORTCUT, vscodeCommand: 'code', categories: [] }
    };
  }
}
