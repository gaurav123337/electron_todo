import { app, BrowserWindow, Menu, ipcMain } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import AppDatabase from "./db/database";
import setUpHandlers from "./db/ipcHandler";

let db;
if (started) {
  app.quit();
}

// ── SINGLE-INSTANCE LOCK (multi-instance prevention / focus) ──
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send("window:second-instance", {
        at: new Date().toISOString(),
        message: "Second instance blocked — focused existing window.",
      });
    }
  });
}

// ── Window tracking ──
let mainWindow = null;
const childWindows = new Set();
const multiWindows = new Set();
const windowMeta = new Map();
let windowCounter = 0;

function getLoadTarget(win, type) {
  windowMeta.set(win.id, { type, createdAt: Date.now(), id: win.id });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

function createParentWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: "Parent Window — Todo (main)",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  getLoadTarget(mainWindow, "parent");
  mainWindow.webContents.openDevTools({ mode: "detach" });
  mainWindow.on("closed", () => {
    mainWindow = null;
    childWindows.clear();
  });
}

function createChildWindow(parent) {
  const parentWin = parent || mainWindow || BrowserWindow.getFocusedWindow();
  if (!parentWin) return null;
  const child = new BrowserWindow({
    width: 500,
    height: 500,
    title: `Child Window #${++windowCounter}`,
    parent: parentWin,
    modal: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  childWindows.add(child);
  getLoadTarget(child, "child");
  child.once("ready-to-show", () => child.show());
  parentWin.webContents.send("window:child-created", { childId: child.id, totalChildren: childWindows.size });
  child.on("closed", () => {
    childWindows.delete(child);
    windowMeta.delete(child.id);
    if (parentWin && !parentWin.isDestroyed()) {
      parentWin.webContents.send("window:child-closed", { childId: child.id, totalChildren: childWindows.size });
    }
    broadcastToAll("window:info-updated", getAllWindowsInfo());
  });
  child.webContents.once("did-finish-load", () => broadcastToAll("window:info-updated", getAllWindowsInfo()));
  return child;
}

function createMultiInstanceWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: `Multi-Instance Window #${++windowCounter}`,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  multiWindows.add(win);
  getLoadTarget(win, "multi");
  win.on("closed", () => {
    multiWindows.delete(win);
    windowMeta.delete(win.id);
    broadcastToAll("window:info-updated", getAllWindowsInfo());
  });
  win.webContents.once("did-finish-load", () => broadcastToAll("window:info-updated", getAllWindowsInfo()));
  return win;
}

function getAllWindowsInfo() {
  return BrowserWindow.getAllWindows().map((w) => {
    const meta = windowMeta.get(w.id) || { type: "unknown" };
    return { id: w.id, type: meta.type, title: w.getTitle(), isParent: w === mainWindow, isChild: childWindows.has(w), isMulti: multiWindows.has(w) };
  });
}

function broadcastToAll(channel, data) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, data);
  }
}

function setupWindowIpc() {
  ipcMain.handle("window:get-info", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const meta = windowMeta.get(win.id) || { type: "unknown" };
    return { id: win.id, type: meta.type, title: win.getTitle(), isParent: win === mainWindow, totalWindows: BrowserWindow.getAllWindows().length, childCount: childWindows.size, multiCount: multiWindows.size };
  });
  ipcMain.handle("window:get-all-info", () => getAllWindowsInfo());
  ipcMain.handle("window:create-child", (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const child = createChildWindow(parent);
    return { childId: child?.id ?? null, totalChildren: childWindows.size };
  });
  ipcMain.handle("window:create-multi", () => {
    const win = createMultiInstanceWindow();
    return { windowId: win.id, total: BrowserWindow.getAllWindows().length };
  });
  ipcMain.handle("window:close-self", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.close();
    return { closedId: win.id };
  });
  ipcMain.handle("window:broadcast", (event, message) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    const payload = { fromId: sender.id, fromType: windowMeta.get(sender.id)?.type, message, at: new Date().toLocaleTimeString() };
    broadcastToAll("window:broadcast-msg", payload);
    return payload;
  });
  ipcMain.handle("window:send-to-parent", (event, message) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    const target = sender.getParentWindow() || mainWindow;
    if (windowMeta.get(sender.id)?.type === "parent") return { ok: false, reason: "Parent has no parent to send to" };
    if (target && !target.isDestroyed()) {
      target.webContents.send("window:msg-from-child", { fromId: sender.id, message, at: new Date().toLocaleTimeString() });
      return { ok: true, toId: target.id };
    }
    return { ok: false, reason: "No parent found" };
  });
  ipcMain.handle("window:send-to-children", (event, message) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    const payload = { fromId: sender.id, message, at: new Date().toLocaleTimeString() };
    let count = 0;
    for (const c of childWindows) if (!c.isDestroyed()) { c.webContents.send("window:msg-from-parent", payload); count++; }
    for (const m of multiWindows) if (!m.isDestroyed()) { m.webContents.send("window:msg-from-parent", payload); count++; }
    return { sentTo: count };
  });
  ipcMain.handle("window:focus-parent", () => {
    if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); return { focused: mainWindow.id }; }
    return { focused: null };
  });
}

app.whenReady().then(() => {
  db = new AppDatabase();
  setUpHandlers(db);
  setupWindowIpc();
  createParentWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createParentWindow();
    }
  });
});

app.on("window-all-closed", () => {
  try { db?.close(); } catch {}
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
