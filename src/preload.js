import { contextBridge, ipcRenderer } from "electron";

const api = {
  addTask: (title) => ipcRenderer.invoke("tasks: addTask", title),
  deleteTask: (id) => ipcRenderer.invoke("tasks: deleteTask", id),
  markComplete: (params) => ipcRenderer.invoke("tasks: markComplete", params),
  getAllTasks: () => ipcRenderer.invoke("tasks: getAllTasks"),
};
contextBridge.exposeInMainWorld("api", api);
