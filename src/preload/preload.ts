import { contextBridge, ipcRenderer } from 'electron';
import type { LauncherApi } from '../shared/types';

const api: LauncherApi = {
  getConfig: () => ipcRenderer.invoke('launcher:get-config'),
  openProject: (path, target) => ipcRenderer.invoke('launcher:open', path, target),
  hide: () => ipcRenderer.send('launcher:hide'),
  onShown: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('launcher:shown', listener);
    return () => ipcRenderer.removeListener('launcher:shown', listener);
  }
};

contextBridge.exposeInMainWorld('launcher', api);
