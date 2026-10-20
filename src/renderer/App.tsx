import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LoadResult, OpenTarget, Project, ScanResult } from '../shared/types';

const PALETTE = ['#13e3f0', '#e5e519', '#7dff4f', '#ff8a00', '#b266ff', '#4f8bff', '#ff5a5a'];
const EMPTY_COLOR = '#6b6b6b';
const STORAGE_KEY = 'launcher.parent';

interface Selected {
  project: Project;
  color: string;
}

function folderName(p: string): string {
  const parts = p.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

function colorVar(color: string): CSSProperties {
  return { '--c': color } as CSSProperties;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function App() {
  const [config, setConfig] = useState<LoadResult | null>(null);
  const [parentPath, setParentPath] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load config on start and every time the popup is shown.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const result = await window.launcher.getConfig();
      if (!alive) return;
      setConfig(result);
      setTick((t) => t + 1);
    };
    void load();
    const off = window.launcher.onShown(() => {
      setMenuOpen(false);
      setSelected(null);
      setError(null);
      void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const parents = config?.config.parentFolders ?? [];
  const activeParent = parents.includes(parentPath) ? parentPath : parents[0] ?? '';

  // Scan the selected parent folder (re-scans on each show so new folders appear).
  useEffect(() => {
    if (!activeParent) {
      setScan(null);
      return;
    }
    let alive = true;
    void window.launcher.scanParent(activeParent).then((result) => {
      if (alive) setScan(result);
    });
    return () => {
      alive = false;
    };
  }, [activeParent, tick]);

  const visibleScan = scan && scan.parent === activeParent ? scan : null;

  const chooseParent = (p: string) => {
    setParentPath(p);
    setMenuOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  };

  const open = useCallback(
    async (target: OpenTarget) => {
      if (!selected || busy) return;
      setBusy(true);
      setError(null);
      const res = await window.launcher.openProject(selected.project.path, target);
      setBusy(false);
      if (!res.ok) setError(res.error ?? 'Something went wrong.');
    },
    [selected, busy]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected) setSelected(null);
        else if (menuOpen) setMenuOpen(false);
        else window.launcher.hide();
        return;
      }
      if (selected) {
        const k = e.key.toLowerCase();
        if (k === 'v') void open('vscode');
        else if (k === 'e') void open('explorer');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, menuOpen, open]);

  return (
    <div className="app">
      {/* ---- parent folder dropdown (root of the tree) ---- */}
      <div className="root">
        <button
          className="root-button"
          disabled={parents.length === 0}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          title={activeParent}
        >
          <span>{activeParent ? folderName(activeParent) : 'No parent folder'}</span>
          <Chevron open={menuOpen} />
        </button>

        {menuOpen && parents.length > 0 && (
          <ul className="root-menu" role="listbox">
            {parents.map((p) => (
              <li key={p}>
                <button className="root-item" role="option" aria-selected={p === activeParent} onClick={() => chooseParent(p)}>
                  <span>{folderName(p)}</span>
                  <small>{p}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- tree: categories -> projects ---- */}
      <div className="scroll">
        {config?.error && <p className="notice err">{config.error}</p>}
        {visibleScan?.error && <p className="notice err">{visibleScan.error}</p>}
        {activeParent && !visibleScan && <p className="notice">Scanning…</p>}
        {visibleScan && !visibleScan.error && visibleScan.categories.length === 0 && (
          <p className="notice">There are no folders inside {visibleScan.parent}.</p>
        )}

        {visibleScan && visibleScan.categories.length > 0 && (
          <ul className="branch rooted tree">
            {visibleScan.categories.map((cat, i) => {
              const hasProjects = cat.projects.length > 0;
              const color = hasProjects ? PALETTE[i % PALETTE.length] : EMPTY_COLOR;
              return (
                <li key={cat.path}>
                  <div className="cat-row" style={colorVar(color)}>
                    <span className="cat-name" title={cat.path}>{cat.name}</span>
                    {hasProjects && (
                      <>
                        <span className="link" />
                        <ul className="branch projects">
                          {cat.projects.map((p) => (
                            <li key={p.path}>
                              <button
                                className="proj"
                                title={p.path}
                                onClick={() => {
                                  setError(null);
                                  setSelected({ project: p, color });
                                }}
                              >
                                {p.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---- where to open ---- */}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="sheet" role="dialog" aria-label={`Open ${selected.project.name}`} onClick={(e) => e.stopPropagation()}>
            <p className="sheet-name" style={{ color: selected.color }}>{selected.project.name}</p>
            <p className="sheet-path">{selected.project.path}</p>

            <ul className="branch rooted opts">
              <li>
                <button className="opt" disabled={busy} onClick={() => void open('vscode')} autoFocus>
                  Open in VS Code <span className="key">V</span>
                </button>
              </li>
              <li>
                <button className="opt" disabled={busy} onClick={() => void open('explorer')}>
                  Open in File Explorer <span className="key">E</span>
                </button>
              </li>
            </ul>

            {error && <p className="sheet-error">{error}</p>}
            <button className="cancel" onClick={() => setSelected(null)}>Cancel (Esc)</button>
          </div>
        </div>
      )}
    </div>
  );
}
