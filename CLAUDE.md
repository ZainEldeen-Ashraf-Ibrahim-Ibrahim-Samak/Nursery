<!-- SPECKIT START -->
Active feature plan: `specs/002-excel-import-env-config/plan.md`
(see also: spec.md, research.md, data-model.md, contracts/env-vars.md, contracts/import-ipc.md, quickstart.md in the same directory)
Prior feature: `specs/001-nursery-management-system/plan.md`

Stack: Electron 28 + React 18 + TypeScript (Vite, Tailwind, Zustand). Local data in SQLite
(better-sqlite3, main process only); ExcelJS + pdfmake export and mongoose sync also main-process only.
Renderer talks to the main process exclusively through the typed `window.api` IPC bridge
(contextIsolation on, nodeIntegration off). Roles: admin/employee, re-validated in IPC handlers.
Bilingual Arabic (RTL) / English (LTR). Currency: EGP. For technologies, structure, and conventions,
read the current plan.
<!-- SPECKIT END -->
