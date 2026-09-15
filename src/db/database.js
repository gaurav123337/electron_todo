import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";

class AppDatabase {
  constructor() {
    const dbPath = path.join(app.getPath("userData"), "to-do.sqlite");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.setupDataBase();
  }

  setupDataBase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0
      ) 
      `);

    console.log("db initialize");
  }

  addTask(title) {
    const stmt = this.db.prepare("INSERT INTO tasks (title) VALUES (?)");
    const info = stmt.run(title);

    return {
      id: info.lastInsertedRowid,
      title: title,
      completed: 0,
    };
  }

  deleteTask(id) {
    const stmt = this.db.prepare("DELETE FROM tasks WHERE id =?");
    const info = stmt.run(id);

    return info.changes > 0;
  }

  markComplete({ id, completed }) {
    const stmt = this.db.prepare("UPDATE tasks SET completed =? WHERE id = ?");
    const info = stmt.run(completed, id);

    return info.changes > 0;
  }

  getAllTasks() {
    const stmt = this.db.prepare("SELECT * FROM tasks ORDER BY id DESC");
    return stmt.all();
  }

  close() {
    this.db.close();
    console.log("db closed");
  }
}

export default AppDatabase;
