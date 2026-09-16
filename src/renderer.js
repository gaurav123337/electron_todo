import "./index.css";

const taskInput = document.getElementById("task-input");
const addTaskBtn = document.getElementById("add_task_btn");
const taskList = document.getElementById("task-list");

const renderTask = async () => {
  const tasks = await window.api.getAllTasks();
  taskList.innerHTML = "";

  tasks.forEach((task) => {
    const li = document.createElement("li");
    const titleSpan = document.createElement("span");
    titleSpan.textContent = task.title;
    li.appendChild(titleSpan);

    const checkBox = document.createElement("input");
    checkBox.type = "checkbox";
    checkBox.checked = !!task.completed;
    checkBox.addEventListener("change", async () => {
      await window.api.markComplete({
        id: task.id,
        completed: checkBox.checked ? 1 : 0,
      });
      // sender's check state already updated; other windows will sync via tasks:changed event
    });
    li.appendChild(checkBox);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "❌ Delete";
    deleteBtn.addEventListener("click", async () => {
      await window.api.deleteTask(task.id);
      // no direct renderTask here — rely on broadcast so every window (including this one) re-renders exactly once via tasks:changed
    });
    li.appendChild(deleteBtn);

    taskList.appendChild(li);
  });
};

const handleAddTask = async () => {
  const title = taskInput.value.trim();
  if (!title) return;
  await window.api.addTask(title);
  taskInput.value = "";
  // no direct renderTask — broadcast will trigger it for all windows
};

addTaskBtn.addEventListener("click", handleAddTask);
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleAddTask();
});

renderTask();

// ── SYNC: re-render whenever ANY window mutates tasks ──
if (window.api?.onTasksChanged) {
  window.api.onTasksChanged((payload) => {
    // optional debug
    // console.log("tasks:changed", payload);
    renderTask();
  });
}

// ──────────────────────────────────────────────
//  Parent / Child / Multi-Instance renderer logic
// ──────────────────────────────────────────────
const winLabel = document.getElementById("win-label");
const winDetails = document.getElementById("win-details");
const winBadge = document.getElementById("win-badge");
const allWindowsEl = document.getElementById("all-windows");
const msgInput = document.getElementById("msg-input");
const msgLog = document.getElementById("msg-log");

function logMsg(text) {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  line.style.borderBottom = "1px solid #eee";
  line.style.padding = "2px 0";
  msgLog.prepend(line);
}

async function refreshWindowInfo() {
  if (!window.winApi) return;
  try {
    const info = await window.winApi.getInfo();
    const typeLabel = info.type === "parent" ? "PARENT (main)" : info.type === "child" ? "CHILD" : info.type === "multi" ? "MULTI-INSTANCE" : info.type;
    const color = info.type === "parent" ? "#0f3460" : info.type === "child" ? "#e94560" : "#16213e";
    winLabel.textContent = `${typeLabel} — id ${info.id} — "${info.title}"`;
    winLabel.style.color = "#fff";
    document.getElementById("window-bar").style.background = color;
    winBadge.textContent = `Windows: ${info.totalWindows} | Child: ${info.childCount} | Multi: ${info.multiCount}`;
    winDetails.textContent = info.isParent ? "This is the PARENT window. Children are tied to it (BrowserWindow parent option). Try second app launch → single-instance lock focuses this window." : info.type === "child" ? "This is a CHILD window (parent-tied, centered, closes with parent)." : "This is an INDEPENDENT multi-instance window (no parent).";
    const all = await window.winApi.getAllInfo();
    allWindowsEl.innerHTML = all.map((w) => `<div style="padding:4px 6px;margin:2px 0;background:${w.isParent ? "#dbeafe" : w.isChild ? "#ffe4e6" : "#e0e7ff"};border-radius:6px;">#${w.id} — <b>${w.type}</b> — ${w.title} ${w.isParent ? "⭐ PARENT" : ""}</div>`).join("") || "<i>No windows</i>";
  } catch (e) {
    winLabel.textContent = "Window API unavailable";
    console.error(e);
  }
}

// Buttons
document.getElementById("btn-create-child")?.addEventListener("click", async () => {
  const r = await window.winApi.createChild();
  logMsg(`Created child window id=${r.childId} (total children: ${r.totalChildren})`);
  refreshWindowInfo();
});
document.getElementById("btn-create-multi")?.addEventListener("click", async () => {
  const r = await window.winApi.createMulti();
  logMsg(`Created multi-instance window id=${r.windowId} (total windows: ${r.total})`);
  refreshWindowInfo();
});
document.getElementById("btn-close-self")?.addEventListener("click", async () => {
  await window.winApi.closeSelf();
});
document.getElementById("btn-focus-parent")?.addEventListener("click", async () => {
  const r = await window.winApi.focusParent();
  logMsg(r.focused ? `Focused parent id=${r.focused}` : "No parent to focus");
});
document.getElementById("btn-broadcast")?.addEventListener("click", async () => {
  const msg = msgInput.value.trim() || "(empty)";
  const p = await window.winApi.broadcast(msg);
  logMsg(`(you broadcast) ${p.message}`);
  msgInput.value = "";
});
document.getElementById("btn-to-parent")?.addEventListener("click", async () => {
  const msg = msgInput.value.trim() || "(empty)";
  const r = await window.winApi.sendToParent(msg);
  logMsg(r.ok ? `→ sent to parent id=${r.toId}: ${msg}` : `→ to-parent failed: ${r.reason}`);
  msgInput.value = "";
});
document.getElementById("btn-to-children")?.addEventListener("click", async () => {
  const msg = msgInput.value.trim() || "(empty)";
  const r = await window.winApi.sendToChildren(msg);
  logMsg(`→ sent to ${r.sentTo} child/multi windows: ${msg}`);
  msgInput.value = "";
});
msgInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-broadcast").click();
});

// IPC listeners (via preload safe wrapper)
if (window.winApi?.on) {
  window.winApi.on("window:broadcast-msg", (d) => { logMsg(`📢 broadcast from #${d.fromId}(${d.fromType}) : ${d.message}`); refreshWindowInfo(); });
  window.winApi.on("window:msg-from-child", (d) => logMsg(`↑ from child #${d.fromId}: ${d.message}`));
  window.winApi.on("window:msg-from-parent", (d) => logMsg(`↓ from parent #${d.fromId}: ${d.message}`));
  window.winApi.on("window:child-created", (d) => { logMsg(`Parent: child #${d.childId} created (total ${d.totalChildren})`); refreshWindowInfo(); });
  window.winApi.on("window:child-closed", (d) => { logMsg(`Parent: child #${d.childId} closed (remaining ${d.totalChildren})`); refreshWindowInfo(); });
  window.winApi.on("window:second-instance", (d) => logMsg(`🔒 Second instance attempt blocked at ${d.at}`));
  window.winApi.on("window:info-updated", () => refreshWindowInfo());
}

refreshWindowInfo();
setInterval(refreshWindowInfo, 3000);

console.log('👋 This message is being logged by "renderer.js", included via Vite');
