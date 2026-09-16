import { BrowserWindow, ipcMain } from "electron";

function notifyTasksChanged(payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("tasks:changed", payload);
  }
}

export default function setUpHandlers(db) {
  ipcMain.handle("tasks: addTask", (_, title) => {
    const result = db.addTask(title);
    notifyTasksChanged({ action: "add", task: result, at: Date.now() });
    return result;
  });

  ipcMain.handle("tasks: deleteTask", (_, id) => {
    const ok = db.deleteTask(id);
    if (ok) notifyTasksChanged({ action: "delete", id, at: Date.now() });
    return ok;
  });

  ipcMain.handle("tasks: markComplete", (_, params) => {
    const ok = db.markComplete(params);
    if (ok) notifyTasksChanged({ action: "markComplete", ...params, at: Date.now() });
    return ok;
  });

  ipcMain.handle("tasks: getAllTasks", (_) => {
    return db.getAllTasks();
  });
}
