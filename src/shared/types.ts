export interface Project {
  name: string;
  /** Absolute path of the project folder (grandchild of a parent folder). */
  path: string;
}

export interface Category {
  name: string;
  /** Absolute path of the category folder (child of a parent folder). */
  path: string;
  projects: Project[];
}

export interface LauncherConfig {
  /** Electron accelerator, e.g. "Control+Alt+P". */
  shortcut: string;
  /** Command used to start VS Code. Default "code". */
  vscodeCommand: string;
  /** Parent folders. Their child folders are categories, grandchildren are projects. */
  parentFolders: string[];
}

export type OpenTarget = 'vscode' | 'explorer';

export interface LoadResult {
  config: LauncherConfig;
  configPath: string;
  /** Set when the config file is missing, unreadable or has no parent folders. */
  error?: string;
}

export interface ScanResult {
  parent: string;
  categories: Category[];
  error?: string;
}

export interface OpenResult {
  ok: boolean;
  error?: string;
}

export interface LauncherApi {
  getConfig(): Promise<LoadResult>;
  scanParent(parentPath: string): Promise<ScanResult>;
  openProject(path: string, target: OpenTarget): Promise<OpenResult>;
  hide(): void;
  /** Subscribe to "popup was just shown". Returns an unsubscribe function. */
  onShown(callback: () => void): () => void;
}
