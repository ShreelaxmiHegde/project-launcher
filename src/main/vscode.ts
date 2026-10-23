import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { OpenResult } from '../shared/types';

const isFile = (p: string): boolean => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const isScript = (p: string): boolean => /\.(cmd|bat)$/i.test(p);

/** Look the command up on this process's PATH (same idea as `where`). */
function findOnPath(command: string): string | null {
  const exts = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const hasExt = path.extname(command) !== '';
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);

  for (const rawDir of dirs) {
    const base = path.join(rawDir.replace(/^"|"$/g, ''), command);
    const candidates = hasExt ? [base] : exts.map((e) => base + e.toLowerCase());
    const hit = candidates.find(isFile);
    if (hit) return hit;
  }
  return null;
}

/** Usual install locations, used when "code" is not on PATH. */
function knownLocations(): string[] {
  const env = process.env;
  const roots = [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs'), env.ProgramFiles, env['ProgramFiles(x86)']];
  return roots
    .filter((r): r is string => !!r)
    .map((r) => path.join(r, 'Microsoft VS Code', 'Code.exe'));
}

/** Returns the full path to launch, or null when VS Code cannot be found. */
export function resolveVsCode(command: string): string | null {
  const found = path.isAbsolute(command) ? (isFile(command) ? command : null) : findOnPath(command);

  if (found) {
    // code.cmd lives in <install>\bin; the real executable is <install>\Code.exe.
    // Launching the exe directly avoids cmd.exe and its quoting rules.
    if (isScript(found)) {
      const exe = path.normalize(path.join(path.dirname(found), '..', 'Code.exe'));
      if (isFile(exe)) return exe;
    }
    return found;
  }

  // Only guess install locations for the default command.
  if (command.toLowerCase() === 'code') return knownLocations().find(isFile) ?? null;
  return null;
}

export function launchVsCode(command: string, folder: string): Promise<OpenResult> {
  const exe = resolveVsCode(command);
  if (!exe) {
    return Promise.resolve({
      ok: false,
      error: `Could not find VS Code ("${command}"). Install it, or set "vscodeCommand" in projects.json to the full path of Code.exe.`
    });
  }

  return new Promise((resolve) => {
    const child = isScript(exe)
      ? spawn(`"${exe}"`, [`"${folder}"`], { shell: true, detached: true, stdio: 'ignore', windowsHide: true })
      : spawn(exe, [folder], { detached: true, stdio: 'ignore' }); // GUI app: do not hide its window

    // A first-run VS Code stays alive as the app, so "still running after 4s" means success.
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
          : { ok: false, error: `VS Code (${exe}) exited with code ${code}.` }
      );
    });
    child.unref();
  });
}
