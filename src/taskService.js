const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'tasks.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

function looksLikePlaceholderTask(title) {
  if (!title || typeof title !== 'string') return false;
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (trimmed.includes(' ')) return false;
  const lettersOnly = /^[a-zA-Z]+$/;
  return trimmed.length >= 8 && lettersOnly.test(trimmed) && !/[aeiou]/i.test(trimmed);
}

async function seedDemoTasks() {
  await run('DELETE FROM tasks');
  await run(
    `INSERT INTO tasks (title, description, status, priority, assignee, due_date, reminder_time) VALUES
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      'Launch product alpha', 'Prepare the onboarding workflow and validation milestones', 'in_progress', 'high', 'Ava', '2026-10-05', '2026-10-02T12:45:00',
      'Map sprint board', 'Build a shared workflow for design, QA, and engineering', 'backlog', 'medium', 'Noah', '2026-10-04', '2026-10-02T12:50:00',
      'Review release notes', 'Finalize the feature summary with the stakeholder updates', 'done', 'low', 'Mila', '2026-10-01', '2026-10-02T12:30:00'
    ]
  );
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee TEXT,
      due_date TEXT,
      reminder_time TEXT,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const existing = await all('SELECT * FROM tasks');
  const shouldSeed = existing.length === 0 || existing.some((task) => looksLikePlaceholderTask(task.title));

  if (shouldSeed) {
    await seedDemoTasks();
  }
}

function normalizeTask(task) {
  if (!task) return null;

  return {
    id: task.id,
    title: task.title,
    description: task.description || '',
    status: task.status || 'backlog',
    priority: task.priority || 'medium',
    assignee: task.assignee || '',
    dueDate: task.due_date || '',
    reminderTime: task.reminder_time || '',
    reminderSent: Boolean(task.reminder_sent),
    createdAt: task.created_at
  };
}

async function listTasks() {
  const rows = await all(
    `SELECT * FROM tasks ORDER BY CASE status
      WHEN 'backlog' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'review' THEN 3
      WHEN 'done' THEN 4
      ELSE 5
    END, created_at DESC`
  );
  return rows.map(normalizeTask);
}

async function getTaskById(id) {
  const row = await get('SELECT * FROM tasks WHERE id = ?', [id]);
  return normalizeTask(row);
}

async function createTask(payload) {
  if (!payload.title || !payload.title.trim()) {
    const error = new Error('Task title is required');
    error.statusCode = 400;
    throw error;
  }

  const title = payload.title.trim();
  const description = (payload.description || '').trim();
  const status = ['backlog', 'in_progress', 'review', 'done'].includes(payload.status) ? payload.status : 'backlog';
  const priority = ['low', 'medium', 'high', 'critical'].includes(payload.priority) ? payload.priority : 'medium';
  const assignee = (payload.assignee || '').trim();
  const dueDate = payload.dueDate || null;
  const reminderTime = payload.reminderTime || null;

  const result = await run(
    `INSERT INTO tasks (title, description, status, priority, assignee, due_date, reminder_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [title, description, status, priority, assignee, dueDate, reminderTime]
  );

  return getTaskById(result.id);
}

async function updateTask(id, payload) {
  const task = await getTaskById(id);
  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  const updates = {
    title: payload.title !== undefined ? (payload.title || '').trim() : task.title,
    description: payload.description !== undefined ? (payload.description || '').trim() : task.description,
    status: payload.status !== undefined && ['backlog', 'in_progress', 'review', 'done'].includes(payload.status) ? payload.status : task.status,
    priority: payload.priority !== undefined && ['low', 'medium', 'high', 'critical'].includes(payload.priority) ? payload.priority : task.priority,
    assignee: payload.assignee !== undefined ? (payload.assignee || '').trim() : task.assignee,
    due_date: payload.dueDate !== undefined ? (payload.dueDate || null) : task.dueDate,
    reminder_time: payload.reminderTime !== undefined ? (payload.reminderTime || null) : task.reminderTime
  };

  const sql = `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assignee = ?, due_date = ?, reminder_time = ? WHERE id = ?`;
  await run(sql, [
    updates.title,
    updates.description,
    updates.status,
    updates.priority,
    updates.assignee,
    updates.due_date,
    updates.reminder_time,
    id
  ]);

  return getTaskById(id);
}

async function deleteTask(id) {
  const task = await getTaskById(id);
  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  await run('DELETE FROM tasks WHERE id = ?', [id]);
  return task;
}

async function getSummary() {
  const rows = await all(`
    SELECT status, COUNT(*) as count
    FROM tasks
    GROUP BY status
  `);

  const summary = {
    backlog: 0,
    in_progress: 0,
    review: 0,
    done: 0
  };

  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(summary, row.status)) {
      summary[row.status] = Number(row.count || 0);
    }
  }

  const totals = await get('SELECT COUNT(*) as total, SUM(CASE WHEN priority = "high" OR priority = "critical" THEN 1 ELSE 0 END) as urgent FROM tasks');

  return {
    total: Number(totals.total || 0),
    urgent: Number(totals.urgent || 0),
    ...summary
  };
}

async function getDueReminders() {
  const now = new Date().toISOString();
  const rows = await all(
    `SELECT * FROM tasks
      WHERE reminder_time IS NOT NULL
      AND reminder_time <= ?
      AND reminder_sent = 0
      AND status != 'done'
      ORDER BY reminder_time ASC`,
    [now]
  );

  return rows.map(normalizeTask);
}

async function markReminderSent(taskIds) {
  if (!taskIds.length) return;
  const placeholders = taskIds.map(() => '?').join(', ');
  await run(`UPDATE tasks SET reminder_sent = 1 WHERE id IN (${placeholders})`, taskIds);
}

module.exports = {
  db,
  initDb,
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getSummary,
  getDueReminders,
  markReminderSent
};
