# Developer Rules

1. Keep application code clean, readable, and modular.
2. Use Node.js as the default runtime for service logic.
3. Keep database access in dedicated service files.
4. Never commit secrets, tokens, or production credentials.
5. Validate changes with tests before merging.
6. Keep infrastructure templates in the IaC folders and avoid hardcoding environment values.
7. Document any operational assumption before deployment.
8. Prefer small, reversible changes over large risky edits.
9. Use consistent naming across app, service, and infrastructure resources.
10. Maintain security, observability, and backups as part of deployment readiness.
