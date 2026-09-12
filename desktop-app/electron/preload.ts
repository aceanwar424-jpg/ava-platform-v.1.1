import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getProducts: () => ipcRenderer.invoke('db:getProducts'),
  createProduct: (data: Record<string, unknown>) => ipcRenderer.invoke('db:createProduct', data),
  updateProduct: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('db:updateProduct', { id, data }),
  deleteProduct: (id: string) => ipcRenderer.invoke('db:deleteProduct', id),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getSitus: () => ipcRenderer.invoke('platform:getSitus'),
});
