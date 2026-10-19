# Project Launcher

A tiny Windows tray app. Press a global shortcut, a black popup appears in the bottom-right
corner, click a project, and open it in VS Code or File Explorer.

## Run it

```bash
npm install
npm run dev      # Vite + Electron with hot reload
npm run start    # production build, run locally
npm run dist     # Windows installer + portable exe in ./release
```

Requires Node 18+ and VS Code's `code` command on PATH (VS Code installer: "Add to PATH").

## Use it

| Action | How |
| --- | --- |
| Show / hide popup | `Ctrl+Alt+P` (configurable) or left-click the tray icon |
| Switch category | Click the dropdown at the top |
| Open a project | Click it, or press `1`-`9` |
| Choose how to open | Click, or press `V` (VS Code) / `E` (File Explorer) |
| Close | `Esc`, or click anywhere outside the popup |

The tray menu has: Show launcher, Edit projects.json, Reload config, Start with Windows, Quit.
The config is re-read every time the popup opens, so edits apply immediately.

## Configuration

On first run the app creates `%APPDATA%\project-launcher\projects.json` (open it from the tray menu).
`config/projects.sample.json` shows the full format:

```json
{
  "shortcut": "Control+Alt+P",
  "vscodeCommand": "code",
  "categories": [
    {
      "name": "Work",
      "path": "C:\\Dev\\Work",
      "projects": [
        { "name": "Billing API", "path": "C:\\Dev\\Work\\billing-api" },
        { "name": "Mobile App", "path": "C:\\Dev\\Work\\mobile-app", "icon": "C:\\Dev\\icons\\mobile.png" }
      ]
    }
  ]
}
```

- `shortcut`: any [Electron accelerator](https://www.electronjs.org/docs/latest/api/accelerator).
- `categories[].path`: the main folder shown under the category name in the dropdown.
- `icon` (optional): png/jpg/svg/ico under 256 KB. Defaults to the yellow folder outline.
- Backslashes must be doubled in JSON.

## Structure

```
src/main/main.ts       window, shortcut, tray, IPC handlers
src/main/config.ts     load + validate projects.json
src/preload/preload.ts contextBridge API (window.launcher)
src/renderer/          React UI (App.tsx, styles.css)
src/shared/types.ts    types shared by all three
```

## Security notes

- `contextIsolation` on, `nodeIntegration` off, renderer sandboxed, strict CSP in packaged builds.
- The renderer can only ask the main process to open paths that appear in `projects.json`.
- Navigation and new windows are blocked.
