import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getProducts: () => ipcRenderer.invoke('db:getProducts'),
  createProduct: (data: any) => ipcRenderer.invoke('db:createProduct', data),
  updateProduct: (id: string, data: any) => ipcRenderer.invoke('db:updateProduct', { id, data }),
  deleteProduct: (id: string) => ipcRenderer.invoke('db:deleteProduct', id),
  seedDatabase: () => ipcRenderer.invoke('db:seedInitialData'),
  execSql: (sql: string) => ipcRenderer.invoke('db:execSql', sql),
  getTables: () => ipcRenderer.invoke('db:getTables'),
  getTableData: (tableName: string) => ipcRenderer.invoke('db:getTableData', tableName),
  getTableColumns: (tableName: string) => ipcRenderer.invoke('db:getTableColumns', tableName),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getSitus: () => ipcRenderer.invoke('platform:getSitus'),
});
