const state = {
  tasks: [],
  search: '',
  audioEnabled: false,
  audioContext: null
};

const elements = {
  form: document.querySelector('#task-form'),
  modalForm: document.querySelector('#task-modal-form'),
  title: document.querySelector('#task-title'),
  description: document.querySelector('#task-description'),
  priority: document.querySelector('#task-priority'),
  assignee: document.querySelector('#task-assignee'),
  dueDate: document.querySelector('#task-due-date'),
  reminder: document.querySelector('#task-reminder'),
  search: document.querySelector('#task-search'),
  musicToggle: document.querySelector('#music-toggle'),
  notifyToggle: document.querySelector('#notify-btn'),
  quickAddBtn: document.querySelector('#quick-add-btn'),
  modal: document.querySelector('#task-modal'),
  closeModalBtn: document.querySelector('#close-modal-btn'),
  toast: document.querySelector('#toast')
};

const statusOrder = ['backlog', 'in_progress', 'review', 'done'];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function formatTime(value) {
  if (!value) return 'Any time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Any time';
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

async function loadTasks() {
  const response = await fetch('/api/tasks');
  if (!response.ok) {
    throw new Error('Unable to load tasks');
  }

  state.tasks = await response.json();
  render();
}

async function loadSummary() {
  const response = await fetch('/api/summary');
  if (!response.ok) {
    throw new Error('Unable to load summary');
  }

  const summary = await response.json();
  const fields = {
    total: document.querySelector('#metric-total'),
    urgent: document.querySelector('#metric-urgent'),
    next: document.querySelector('#metric-next'),
    backlog: document.querySelector('#stat-backlog'),
    in_progress: document.querySelector('#stat-in-progress'),
    review: document.querySelector('#stat-review'),
    done: document.querySelector('#stat-done')
  };

  const focusScore = Math.min(98, 58 + Number(summary.done || 0) * 8);
  document.querySelector('#focus-score').textContent = `${focusScore}%`;
  document.querySelector('#deadline-count').textContent = `${Math.max(0, Number(summary.total || 0) - Number(summary.done || 0))} due`;

  fields.total.textContent = summary.total || 0;
  fields.urgent.textContent = summary.urgent || 0;
  fields.backlog.textContent = summary.backlog || 0;
  fields.in_progress.textContent = summary.in_progress || 0;
  fields.review.textContent = summary.review || 0;
  fields.done.textContent = summary.done || 0;

  const next = state.tasks
    .filter((task) => task.reminderTime && task.status !== 'done')
    .sort((a, b) => new Date(a.reminderTime) - new Date(b.reminderTime))[0];

  fields.next.textContent = next ? new Date(next.reminderTime).toLocaleString() : 'None';

  document.querySelector('#count-backlog').textContent = summary.backlog || 0;
  document.querySelector('#count-in-progress').textContent = summary.in_progress || 0;
  document.querySelector('#count-review').textContent = summary.review || 0;
  document.querySelector('#count-done').textContent = summary.done || 0;
}

function getFilteredTasks() {
  return state.tasks.filter((task) => {
    const search = state.search.trim().toLowerCase();
    const matchesSearch = !search || `${task.title} ${task.description}`.toLowerCase().includes(search);
    return matchesSearch;
  });
}

function renderBoard() {
  const grouped = {};
  for (const status of statusOrder) {
    grouped[status] = [];
  }

  for (const task of getFilteredTasks()) {
    const status = statusOrder.includes(task.status) ? task.status : 'backlog';
    grouped[status].push(task);
  }

  for (const status of statusOrder) {
    const list = document.querySelector(`#${status}-list`);
    if (!list) continue;
    list.innerHTML = grouped[status].map((task) => `
      <article class="task-card" data-priority="${task.priority}" data-id="${task.id}">
        <div class="task-card-header">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <span class="task-priority priority-${task.priority}">${escapeHtml(task.priority)}</span>
        </div>
        <div class="task-description">${escapeHtml(task.description || 'No description yet')}</div>
        <div class="task-meta">
          <span>${task.assignee ? `Owner: ${escapeHtml(task.assignee)}` : 'No owner'}</span>
          <span>${formatDate(task.dueDate)}</span>
        </div>
        <div class="task-actions">
          <button class="move-button" data-action="advance" data-id="${task.id}">Move</button>
          <button class="danger" data-action="delete" data-id="${task.id}">Delete</button>
        </div>
      </article>
    `).join('');
  }
}

function renderTimetable() {
  const container = document.querySelector('#timetable-list');
  if (!container) return;

  const entries = state.tasks
    .filter((task) => task.reminderTime || task.dueDate)
    .sort((a, b) => new Date(a.reminderTime || a.dueDate) - new Date(b.reminderTime || b.dueDate))
    .slice(0, 6);

  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">No timetable blocks yet. Add a task to build your personal plan.</div>';
    return;
  }

  container.innerHTML = entries.map((task) => {
    const time = task.reminderTime ? formatTime(task.reminderTime) : formatDate(task.dueDate);
    return `
      <div class="timetable-item">
        <span class="time-badge">${escapeHtml(time)}</span>
        <div class="timetable-copy">
          <strong>${escapeHtml(task.title)}</strong>
          <small>${task.assignee ? `Owner: ${escapeHtml(task.assignee)}` : 'Personal task'}</small>
        </div>
        <span class="status-dot ${task.status}"></span>
      </div>
    `;
  }).join('');
}

function render() {
  renderBoard();
  renderTimetable();
  loadSummary().catch((error) => showToast(error.message));
}

function collectTaskPayload(form) {
  return {
    title: form.querySelector('[name="title"]').value.trim(),
    description: form.querySelector('[name="description"]').value.trim(),
    priority: form.querySelector('[name="priority"]').value,
    assignee: form.querySelector('[name="assignee"]').value.trim(),
    dueDate: form.querySelector('[name="dueDate"]').value || null,
    reminderTime: form.querySelector('[name="reminderTime"]').value || null
  };
}

async function createTask(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = collectTaskPayload(form);

  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Unable to create task');
  }

  form.reset();
  if (form === elements.modalForm) {
    closeTaskModal();
  }

  await loadTasks();
  showToast('Task created successfully');
  playChime();
}

function openTaskModal() {
  elements.modal.classList.remove('hidden');
  elements.modal.setAttribute('aria-hidden', 'false');
  const input = elements.modalForm.querySelector('[name="title"]');
  setTimeout(() => input.focus(), 50);
}

function closeTaskModal() {
  elements.modal.classList.add('hidden');
  elements.modal.setAttribute('aria-hidden', 'true');
  elements.modalForm.reset();
}

async function handleTaskAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const task = state.tasks.find((current) => current.id === id);
  if (!task) return;

  if (action === 'delete') {
    const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (response.ok) {
      await loadTasks();
      showToast('Task deleted');
      return;
    }
  }

  if (action === 'advance') {
    const order = statusOrder;
    const index = order.indexOf(task.status);
    const nextStatus = order[Math.min(index + 1, order.length - 1)];
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });

    if (response.ok) {
      await loadTasks();
      showToast(`Moved to ${nextStatus.replace('_', ' ')}`);
      playChime();
    }
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2600);
}

function ensureAudioContext() {
  if (!state.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    state.audioContext = new AudioCtx();
  }

  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }

  return state.audioContext;
}

function playChime() {
  if (!state.audioEnabled) return;

  const context = ensureAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 440;
  gainNode.gain.value = 0.03;
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
}

async function toggleMusic() {
  state.audioEnabled = !state.audioEnabled;
  elements.musicToggle.textContent = state.audioEnabled ? '🔇 Ambient sound' : '🔊 Ambient sound';
  if (state.audioEnabled) {
    playChime();
    showToast('Ambient sound enabled');
  }
}

async function toggleNotifications() {
  if (!('Notification' in window)) {
    showToast('Browser notifications are not supported here');
    return;
  }

  if (Notification.permission === 'granted') {
    showToast('Notifications are already enabled');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    showToast('Reminder notifications enabled');
  } else {
    showToast('Notifications permission denied');
  }
}

function maybeShowReminderAlerts() {
  const upcoming = state.tasks.filter((task) => task.reminderTime && task.status !== 'done');
  if (upcoming.length === 0) return;

  const nextTask = upcoming.sort((a, b) => new Date(a.reminderTime) - new Date(b.reminderTime))[0];
  const reminderTime = new Date(nextTask.reminderTime).getTime();
  const now = Date.now();

  if (Notification.permission === 'granted' && reminderTime <= now + 60000 && reminderTime >= now - 60000) {
    new Notification('Reminder', {
      body: `${nextTask.title} is due soon. Keep momentum going!`
    });
  }
}

function bindEvents() {
  elements.form.addEventListener('submit', async (event) => {
    try {
      await createTask(event);
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.modalForm.addEventListener('submit', async (event) => {
    try {
      await createTask(event);
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.search.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderBoard();
  });

  document.addEventListener('click', (event) => {
    if (event.target.matches('[data-close-modal="true"]')) {
      closeTaskModal();
      return;
    }

    if (event.target.closest('#quick-add-btn')) {
      openTaskModal();
      return;
    }

    if (event.target.closest('#close-modal-btn')) {
      closeTaskModal();
      return;
    }

    handleTaskAction(event);
  });

  elements.musicToggle.addEventListener('click', toggleMusic);
  elements.notifyToggle.addEventListener('click', toggleNotifications);
}

async function init() {
  bindEvents();
  await loadTasks();
  setInterval(() => {
    loadTasks().catch((error) => console.warn(error));
    maybeShowReminderAlerts();
  }, 20000);
}

init().catch((error) => {
  console.error(error);
  showToast('The app could not start properly');
});
