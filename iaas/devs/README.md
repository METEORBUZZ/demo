# Developer Setup Guide

This guide covers the local setup, dependency installation, and common developer commands for the Gravity Todoist project and its DevOps-related workflow.

## 1. Install Node.js

### macOS
```bash
brew install node
```

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y nodejs npm
```

### Windows
Download and install from:
https://nodejs.org/

Verify installation:
```bash
node -v
npm -v
```

## 2. Install SQLite

### macOS
```bash
brew install sqlite
```

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y sqlite3
```

### Windows
Download SQLite tools from:
https://www.sqlite.org/download.html

Verify installation:
```bash
sqlite3 --version
```

## 3. Install project dependencies

From the project root:
```bash
npm install
```

If you need to reinstall everything cleanly:
```bash
rm -rf node_modules package-lock.json
npm install
```

## 4. Run the app

```bash
npm start
```

For development mode:
```bash
npm run dev
```

## 5. Run tests

```bash
npm test
```

## 6. Basic SQLite commands

### Open database
```bash
sqlite3 data/tasks.db
```

### Create a table
```sql
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
);
```

### Insert a task
```sql
INSERT INTO tasks (title, description, status, priority, assignee, due_date, reminder_time)
VALUES ('Plan sprint review', 'Review sprint goals and blockers', 'backlog', 'high', 'Ava', '2026-10-10', '2026-10-10T09:00:00');
```

### Read tasks
```sql
SELECT * FROM tasks;
```

### Update a task
```sql
UPDATE tasks
SET status = 'in_progress', priority = 'critical'
WHERE id = 1;
```

### Delete a task
```sql
DELETE FROM tasks WHERE id = 1;
```

## 7. Common Node.js commands

### Initialize a project
```bash
npm init -y
```

### Install a package
```bash
npm install express
```

### Install a dev dependency
```bash
npm install --save-dev nodemon
```

### Install SQLite driver
```bash
npm install sqlite3
```

## 8. Kubernetes / DevOps setup

### Install kubectl
```bash
brew install kubectl
```

Or Ubuntu:
```bash
sudo apt-get install -y kubectl
```

### Check cluster status
```bash
kubectl version --client
kubectl cluster-info
```

### Sample commands
```bash
kubectl get pods
kubectl get nodes
kubectl apply -f ./iaas/kubernetes
kubectl describe pod <pod-name>
```

## 9. Terraform commands

### Install Terraform

macOS:
```bash
brew install terraform
```

Ubuntu:
```bash
sudo apt-get update && sudo apt-get install -y gnupg software-properties-common
sudo apt-get install -y terraform
```

### Common Terraform usage
```bash
terraform init
terraform validate
terraform plan
terraform apply
terraform destroy
```

## 10. Ansible commands

### Install Ansible
```bash
pip install ansible
```

### Common commands
```bash
ansible --version
ansible-playbook -i inventory.ini playbook.yml
```

## 11. Grafana / monitoring commands

### Run Grafana (example)
```bash
docker run -d -p 3000:3000 --name=grafana grafana/grafana
```

### Check container health
```bash
docker ps
```

## 12. Docker commands

### Install Docker
Follow official Docker installation instructions for your OS.

### Common commands
```bash
docker --version
docker build -t gravitytodoist .
docker run -p 3000:3000 gravitytodoist
```

## 13. Useful project commands summary

```bash
npm install
npm start
npm run dev
npm test
sqlite3 data/tasks.db
kubectl get pods
terraform init
ansible-playbook -i inventory.ini playbook.yml
```

## 14. Best practices

- Keep environment variables in `.env` and never commit secrets.
- Validate app logic with tests before deployment.
- Keep DB schema and app logic aligned.
- Use version control for all infrastructure changes.
- Document any deployment assumption in the DevOps folder.
