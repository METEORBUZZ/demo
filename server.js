const express = require('express');
const path = require('path');
const {
  initDb,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  getSummary,
  getDueReminders,
  markReminderSent
} = require('./src/taskService');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/tasks', async (req, res, next) => {
  try {
    const tasks = await listTasks();
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

app.get('/api/summary', async (req, res, next) => {
  try {
    const summary = await getSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', async (req, res, next) => {
  try {
    const task = await createTask(req.body || {});
    res.status(201).json(task);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Unable to create task' });
  }
});

app.put('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await updateTask(Number(req.params.id), req.body || {});
    res.json(task);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Unable to update task' });
  }
});

app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await deleteTask(Number(req.params.id));
    res.json({ deleted: task });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Unable to delete task' });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  await initDb();

  if (require.main === module) {
    app.listen(port, () => {
      console.log(`Gravity Todoist running on http://localhost:${port}`);
    });
  }

  return app;
}

const reminderLoop = () => {
  setInterval(async () => {
    try {
      const reminders = await getDueReminders();
      if (reminders.length) {
        console.log('Reminder trigger:', reminders.map((task) => task.title));
        await markReminderSent(reminders.map((task) => task.id));
      }
    } catch (error) {
      console.error('Reminder loop error:', error.message);
    }
  }, 30000);
};

if (require.main === module) {
  startServer();
  reminderLoop();
}

module.exports = { app, startServer };
