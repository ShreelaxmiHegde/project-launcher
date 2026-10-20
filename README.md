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
| Switch parent folder | Click the pink dropdown at the top (your choice is remembered) |
| Open a project | Click a project name in the tree |
| Choose how to open | Click, or press `V` (VS Code) / `E` (File Explorer) |
| Close | `Esc`, or click anywhere outside the popup |

The tray menu has: Show launcher, Edit projects.json, Reload config, Start with Windows, Quit.
The config is re-read and the folders are re-scanned every time the popup opens, so new
folders and config edits show up immediately.

## How folders map to the tree

```
C:\Dev                  <- parent folder (listed in projects.json, shown in the dropdown)
  Work                  <- immediate child  = category
    billing-api         <- its immediate child = project (clickable)
    admin-portal
  Personal
    blog
```

Hidden folders (starting with `.` or `$`) and `node_modules` are skipped. Category folders with
no sub-folders are shown in gray and are not clickable.

## Configuration

Development: `config/projects.json` is used if it exists. Otherwise (and in packaged builds):
`%APPDATA%\project-launcher\projects.json` (open it from the tray menu).

```json
{
  "shortcut": "Control+Alt+P",
  "vscodeCommand": "code",
  "parentFolders": ["C:\\Dev", "D:\\Clients", "~/Documents/Code"]
}
```

- `parentFolders`: any number of folders. `~` and `%ENV_VARS%` are expanded. Backslashes must be doubled in JSON.
- `shortcut`: any [Electron accelerator](https://www.electronjs.org/docs/latest/api/accelerator).
- `vscodeCommand`: command that starts VS Code (default `code`).

## Structure

```
src/main/main.ts       window, shortcut, tray, IPC handlers
src/main/config.ts     load + validate projects.json
src/preload/preload.ts contextBridge API (window.launcher)
src/main/scan.ts       parent -> category -> project folder scanning
src/renderer/          React UI (App.tsx, styles.css)
src/shared/types.ts    types shared by all three
```

## Security notes

- `contextIsolation` on, `nodeIntegration` off, renderer sandboxed, strict CSP in packaged builds.
- The renderer can only scan configured parent folders and open folders exactly two levels below them.
- Navigation and new windows are blocked.
