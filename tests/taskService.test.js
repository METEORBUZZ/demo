const test = require('node:test');
const assert = require('node:assert/strict');

const { db, initDb, createTask, listTasks, getSummary, updateTask, deleteTask } = require('../src/taskService');

async function resetTasks() {
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM tasks', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

test('initializes the database and exposes tasks', async () => {
  await initDb();
  const tasks = await listTasks();
  assert.ok(Array.isArray(tasks));
  assert.ok(tasks.length >= 1);
});

test('creates and summarizes tasks correctly', async () => {
  await resetTasks();

  const created = await createTask({
    title: 'Ship feature launch',
    description: 'Deliver launch playbook',
    status: 'in_progress',
    priority: 'high',
    assignee: 'Ava',
    dueDate: '2026-10-05',
    reminderTime: '2026-10-02T12:40:00'
  });

  const another = await createTask({
    title: 'Write QA checklist',
    description: 'Verify release checklist',
    status: 'review',
    priority: 'low',
    assignee: 'Mila'
  });

  assert.equal(created.title, 'Ship feature launch');
  assert.equal(another.assignee, 'Mila');

  const summary = await getSummary();
  assert.equal(summary.total, 2);
  assert.equal(summary.in_progress, 1);
  assert.equal(summary.review, 1);
  assert.equal(summary.urgent, 1);
});

test('updates and deletes a task', async () => {
  await resetTasks();

  const created = await createTask({
    title: 'Fix onboarding bug',
    description: 'Resolve user drop-off',
    status: 'backlog',
    priority: 'medium',
    assignee: 'Noah'
  });

  const updated = await updateTask(created.id, { status: 'done', priority: 'critical' });
  assert.equal(updated.status, 'done');
  assert.equal(updated.priority, 'critical');

  const deleted = await deleteTask(created.id);
  assert.equal(deleted.id, created.id);
  assert.equal((await listTasks()).length, 0);
});
