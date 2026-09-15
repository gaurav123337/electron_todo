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
    });
    li.appendChild(checkBox);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "❌ Delete";
    deleteBtn.addEventListener("click", async () => {
      await window.api.deleteTask(task.id);
      renderTask();
    });
    li.appendChild(deleteBtn);

    taskList.appendChild(li);
  });
};

const handleAddTask = async () => {
  const title = taskInput.value.trim();
  await window.api.addTask(title);
  taskInput.value = "";
  renderTask();
};

addTaskBtn.addEventListener("click", handleAddTask);

renderTask();
console.log(
  '👋 This message is being logged by "renderer.js", included via Vite',
);
