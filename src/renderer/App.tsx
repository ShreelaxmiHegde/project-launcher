import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LoadResult, OpenTarget, Project } from '../shared/types';

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#e5e519" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function App() {
  const [result, setResult] = useState<LoadResult | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await window.launcher.getConfig();
    setResult(next);
    setCategoryIndex((i) => Math.min(i, Math.max(0, next.config.categories.length - 1)));
  }, []);

  useEffect(() => {
    void refresh();
    return window.launcher.onShown(() => {
      setMenuOpen(false);
      setSelected(null);
      setError(null);
      void refresh();
    });
  }, [refresh]);

  const categories = result?.config.categories ?? [];
  const category = categories[categoryIndex];
  const projects = useMemo(() => category?.projects ?? [], [category]);

  const open = useCallback(
    async (target: OpenTarget) => {
      if (!selected || busy) return;
      setBusy(true);
      setError(null);
      const res = await window.launcher.openProject(selected.path, target);
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
        return;
      }
      if (!menuOpen && /^[1-9]$/.test(e.key)) {
        const project = projects[Number(e.key) - 1];
        if (project) {
          setError(null);
          setSelected(project);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, menuOpen, projects, open]);

  return (
    <div className="app">
      <div className="dropdown">
        <button
          className="dropdown-button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
        >
          <span className="dropdown-label">{category ? category.name : 'No categories'}</span>
          <Chevron open={menuOpen} />
        </button>

        {menuOpen && categories.length > 0 && (
          <ul className="dropdown-menu" role="listbox">
            {categories.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <button
                  className="dropdown-item"
                  role="option"
                  aria-selected={i === categoryIndex}
                  onClick={() => {
                    setCategoryIndex(i);
                    setMenuOpen(false);
                  }}
                >
                  <span>{c.name}</span>
                  <small>{c.path}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="divider" />

      {result?.error && <p className="notice notice-error">{result.error}</p>}

      <div className="grid">
        {projects.map((p, i) => (
          <button
            key={`${p.path}-${i}`}
            className="project"
            onClick={() => {
              setError(null);
              setSelected(p);
            }}
            title={p.path}
          >
            <span className="project-icon">
              {p.iconData ? <img src={p.iconData} alt="" /> : <FolderIcon />}
            </span>
            <span className="project-name">{p.name}</span>
          </button>
        ))}

        {!result?.error && projects.length === 0 && (
          <p className="notice">
            No projects in this category yet. Right-click the tray icon and choose Edit projects.json.
          </p>
        )}
      </div>

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" role="dialog" aria-label={`Open ${selected.name}`} onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{selected.name}</h2>
            <p className="modal-path">{selected.path}</p>

            <button className="action" disabled={busy} onClick={() => void open('vscode')} autoFocus>
              Open in VS Code
              <kbd>V</kbd>
            </button>
            <button className="action" disabled={busy} onClick={() => void open('explorer')}>
              Open in File Explorer
              <kbd>E</kbd>
            </button>

            {error && <p className="modal-error">{error}</p>}

            <button className="cancel" onClick={() => setSelected(null)}>
              Cancel (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
