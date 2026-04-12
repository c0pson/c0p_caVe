/* ============================================================
   tasks.js — task list CRUD
   ============================================================ */

let tasks = [];

async function loadTasks() {
    try {
        const res = await fetch("/api/tasks");
        if (!res.ok) throw new Error("Failed to load tasks");
        tasks = await res.json();
        renderTasks();
    } catch (err) {
        console.error("Tasks error:", err);
    }
}

function renderTasks() {
    const container = document.getElementById("tasks-list");
    container.innerHTML = "";

    const active    = tasks.filter(t => !t.completed);
    const completed = tasks.filter(t =>  t.completed);

    if (!active.length && !completed.length) {
        container.innerHTML = '<div class="no-tasks">— NO TASKS —</div>';
        return;
    }

    active.forEach(t => container.appendChild(buildTaskEl(t)));

    if (completed.length) {
        const sep = document.createElement("div");
        sep.className = "task-separator";
        sep.textContent = "COMPLETED";
        container.appendChild(sep);
        completed.forEach(t => container.appendChild(buildTaskEl(t)));
    }
}

function buildTaskEl(task) {
    const div = document.createElement("div");
    div.className = `task-item priority-${task.priority}${task.completed ? " completed" : ""}`;
    div.innerHTML = `
        <div class="task-content">
            <input type="checkbox" class="task-check"
                ${task.completed ? "checked" : ""}
                onchange="toggleTask(${task.id})">
            <div class="task-info">
                <div class="task-title">${esc(task.title)}</div>
                ${task.description ? `<div class="task-desc">${esc(task.description)}</div>` : ""}
                ${task.due_date    ? `<div class="task-due">📅 ${task.due_date}</div>` : ""}
            </div>
        </div>
        <button class="task-delete" onclick="deleteTask(${task.id})">✕</button>`;
    return div;
}

function esc(str) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return str.replace(/[&<>"']/g, m => map[m]);
}

async function addTask() {
    const input    = document.getElementById("task-input");
    const title    = input.value.trim();
    if (!title) return;

    try {
        const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, priority: "medium" }),
        });
        if (!res.ok) throw new Error("Failed to create task");
        input.value = "";
        await loadTasks();
    } catch (err) {
        console.error("Add task error:", err);
    }
}

async function toggleTask(id) {
    try {
        const res = await fetch(`/api/tasks/${id}/toggle`, { method: "POST" });
        if (!res.ok) throw new Error("Failed to toggle task");
        await loadTasks();
    } catch (err) {
        console.error("Toggle task error:", err);
    }
}

async function deleteTask(id) {
    try {
        const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete task");
        await loadTasks();
    } catch (err) {
        console.error("Delete task error:", err);
    }
}
