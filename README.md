# Autotest Tool Prototype

This prototype provides a lightweight frontend (Vite + React) and a simple backend (Express) to manage and run GUI testcases for the Qt-based diagram editor.

## Structure
- `backend/` - Express API and a mock test runner.
- `frontend/` - Vite + React prototype UI.

## Quick start (Windows)
1. Start backend

```powershell
cd autotest-tool\backend
npm install
npm start
```

2. Start frontend

```powershell
cd ..\frontend
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

## Next steps to integrate with real test runner
- Replace `backend/run_test_agent.js` with a module that invokes actual Qt test binaries (`child_process.spawn`) or Robot Framework commands and streams logs.
- Add authentication/role management to the backend if needed.
- Add persistent storage (SQLite/Postgres) and user interface for editing testcases and base-line images.
- Create CI job to run test suites and upload artifacts to PingCode via API.

## Team division suggestions (5 people)
- Frontend UI + components
- Backend API + runner integration
- Qt test scripts / Robot keywords and baseline images
- CI/CD / environment matrix (DPI/OS) + reporting
- Documentation + test-case review workflow
