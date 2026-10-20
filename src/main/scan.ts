import fs from 'node:fs';
import path from 'node:path';
import type { Category, ScanResult } from '../shared/types';

const IGNORED = new Set(['node_modules', 'system volume information', '$recycle.bin']);

interface Entry {
  name: string;
  path: string;
}

async function listDirs(dir: string): Promise<Entry[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const out: Entry[] = [];

  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('$') || IGNORED.has(e.name.toLowerCase())) continue;
    const full = path.join(dir, e.name);

    let isDir = e.isDirectory();
    if (!isDir && e.isSymbolicLink()) {
      try {
        isDir = (await fs.promises.stat(full)).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (isDir) out.push({ name: e.name, path: full });
  }

  return out.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  );
}

/** parent -> children (categories) -> grandchildren (projects). */
export async function scanParent(parent: string): Promise<ScanResult> {
  try {
    const cats = await listDirs(parent);
    const categories: Category[] = await Promise.all(
      cats.map(async (c) => {
        try {
          return { ...c, projects: await listDirs(c.path) };
        } catch {
          return { ...c, projects: [] };
        }
      })
    );
    return { parent, categories };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return {
      parent,
      categories: [],
      error:
        code === 'ENOENT'
          ? `Folder not found: ${parent}`
          : `Cannot read ${parent}: ${(err as Error).message}`
    };
  }
}

function norm(p: string): string {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function isConfiguredParent(parents: string[], target: string): boolean {
  const t = norm(target);
  return parents.some((p) => norm(p) === t);
}

/** True only for folders exactly two levels below a configured parent folder. */
export function isProjectPath(parents: string[], target: string): boolean {
  const grandparent = path.dirname(path.dirname(norm(target)));
  return parents.some((p) => norm(p) === grandparent);
}
