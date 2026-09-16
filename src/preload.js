import { contextBridge, ipcRenderer } from "electron";

const api = {
  addTask: (title) => ipcRenderer.invoke("tasks: addTask", title),
  deleteTask: (id) => ipcRenderer.invoke("tasks: deleteTask", id),
  markComplete: (params) => ipcRenderer.invoke("tasks: markComplete", params),
  getAllTasks: () => ipcRenderer.invoke("tasks: getAllTasks"),
};
contextBridge.exposeInMainWorld("api", api);

// ── Window / Parent-Child / Multi-Instance API ──
const winApi = {
  getInfo: () => ipcRenderer.invoke("window:get-info"),
  getAllInfo: () => ipcRenderer.invoke("window:get-all-info"),
  createChild: () => ipcRenderer.invoke("window:create-child"),
  createMulti: () => ipcRenderer.invoke("window:create-multi"),
  closeSelf: () => ipcRenderer.invoke("window:close-self"),
  broadcast: (msg) => ipcRenderer.invoke("window:broadcast", msg),
  sendToParent: (msg) => ipcRenderer.invoke("window:send-to-parent", msg),
  sendToChildren: (msg) => ipcRenderer.invoke("window:send-to-children", msg),
  focusParent: () => ipcRenderer.invoke("window:focus-parent"),
  on: (channel, cb) => {
    const allowed = [
      "window:broadcast-msg",
      "window:msg-from-child",
      "window:msg-from-parent",
      "window:child-created",
      "window:child-closed",
      "window:second-instance",
      "window:info-updated",
    ];
    if (!allowed.includes(channel)) return () => {};
    const handler = (_e, data) => cb(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};
contextBridge.exposeInMainWorld("winApi", winApi);
