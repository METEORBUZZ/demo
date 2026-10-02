# Gravity Todoist

Gravity Todoist is a dynamic personal productivity workspace built with Node.js and SQLite. It blends a polished dashboard, anti-gravity task cards, a personal timetable, reminder pop-ups, and a lightweight microservice-style API for task management.

## Features

- Dynamic Kanban board with task states: Backlog, In Progress, Review, Done
- Professional glassmorphism UI with motion effects
- SQL-backed storage using SQLite
- Reminder automation with due-date pop-ups and browser notifications
- Calm synth-based audio chime for user feedback
- API endpoints for CRUD operations and summary analytics
- Test coverage for black-box API behavior and white-box database/service logic

## Quick start

```bash
npm install
npm start
```

Open http://localhost:3000 in a browser.

## API

- `GET /api/health`
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/summary`

## Testing

```bash
npm test
```

## Notes

This project follows a simple microservice-inspired structure with separate service logic and a UI layer while staying in a single Node.js process.
# demo
