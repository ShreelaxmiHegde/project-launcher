export interface Project {
  name: string;
  /** Absolute folder path of the project. */
  path: string;
  /** Optional path to a png/jpg/svg/ico file. Falls back to the folder outline icon. */
  icon?: string;
  /** Filled in by the main process: the icon file as a data URL. */
  iconData?: string;
}

export interface Category {
  name: string;
  /** Main folder that contains this category's projects. */
  path: string;
  projects: Project[];
}

export interface LauncherConfig {
  /** Electron accelerator, e.g. "Control+Alt+P". */
  shortcut: string;
  /** Command used to start VS Code. Default "code". */
  vscodeCommand: string;
  categories: Category[];
}

export type OpenTarget = 'vscode' | 'explorer';

export interface LoadResult {
  config: LauncherConfig;
  configPath: string;
  /** Set when the config file is missing, unreadable or invalid. */
  error?: string;
}

export interface OpenResult {
  ok: boolean;
  error?: string;
}

export interface LauncherApi {
  getConfig(): Promise<LoadResult>;
  openProject(path: string, target: OpenTarget): Promise<OpenResult>;
  hide(): void;
  /** Subscribe to "popup was just shown". Returns an unsubscribe function. */
  onShown(callback: () => void): () => void;
}
