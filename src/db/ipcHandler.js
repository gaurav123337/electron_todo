import { ipcMain } from "electron";

export default function setUpHandlers(db) {
  ipcMain.handle("tasks: addTask", (_, title) => {
    return db.addTask(title);
  });

  ipcMain.handle("tasks: deleteTask", (_, id) => {
    return db.deleteTask(id);
  });

  ipcMain.handle("tasks: markComplete", (_, params) => {
    return db.markComplete(params);
  });

  ipcMain.handle("tasks: getAllTasks", (_) => {
    return db.getAllTasks();
  });
}
