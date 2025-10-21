import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', { title, body }),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
});

// Type definitions for TypeScript
export interface ElectronAPI {
  showNotification: (title: string, body: string) => Promise<void>;
  getAppPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
