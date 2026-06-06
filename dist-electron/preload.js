import { contextBridge, ipcRenderer } from "electron";
//#region electron/preload.ts
contextBridge.exposeInMainWorld("api", {
	auth: {
		login: (args) => ipcRenderer.invoke("auth:login", args),
		logout: () => ipcRenderer.invoke("auth:logout"),
		current: () => ipcRenderer.invoke("auth:current")
	},
	users: {
		list: () => ipcRenderer.invoke("users:list"),
		create: (args) => ipcRenderer.invoke("users:create", args),
		update: (args) => ipcRenderer.invoke("users:update", args),
		deactivate: (args) => ipcRenderer.invoke("users:deactivate", args)
	},
	children: {
		get: (args) => ipcRenderer.invoke("children:get", args),
		add: (args) => ipcRenderer.invoke("children:add", args),
		update: (args) => ipcRenderer.invoke("children:update", args),
		deactivate: (args) => ipcRenderer.invoke("children:deactivate", args),
		statement: (args) => ipcRenderer.invoke("children:statement", args)
	},
	payments: {
		get: (args) => ipcRenderer.invoke("payments:get", args),
		generate: (args) => ipcRenderer.invoke("payments:generate", args),
		update: (args) => ipcRenderer.invoke("payments:update", args),
		bulkPay: (args) => ipcRenderer.invoke("payments:bulkPay", args)
	},
	employees: {
		get: () => ipcRenderer.invoke("employees:get"),
		add: (args) => ipcRenderer.invoke("employees:add", args),
		update: (args) => ipcRenderer.invoke("employees:update", args),
		deactivate: (args) => ipcRenderer.invoke("employees:deactivate", args)
	},
	salary: {
		get: (args) => ipcRenderer.invoke("salary:get", args),
		update: (args) => ipcRenderer.invoke("salary:update", args)
	},
	expenses: {
		get: (args) => ipcRenderer.invoke("expenses:get", args),
		update: (args) => ipcRenderer.invoke("expenses:update", args),
		addItem: (args) => ipcRenderer.invoke("expenses:addItem", args),
		removeItem: (args) => ipcRenderer.invoke("expenses:removeItem", args)
	},
	dashboard: { get: (args) => ipcRenderer.invoke("dashboard:get", args) },
	target: {
		get: (args) => ipcRenderer.invoke("target:get", args),
		calc: (args) => ipcRenderer.invoke("target:calc", args)
	},
	settings: {
		get: () => ipcRenderer.invoke("settings:get"),
		update: (args) => ipcRenderer.invoke("settings:update", args)
	},
	branding: {
		get: () => ipcRenderer.invoke("branding:get"),
		save: (args) => ipcRenderer.invoke("branding:save", args),
		uploadLogo: () => ipcRenderer.invoke("branding:upload-logo"),
		uploadIcon: () => ipcRenderer.invoke("branding:upload-icon"),
		reset: () => ipcRenderer.invoke("branding:reset")
	},
	export: {
		full: (args) => ipcRenderer.invoke("export:full", args),
		month: (args) => ipcRenderer.invoke("export:month", args),
		child: (args) => ipcRenderer.invoke("export:child", args),
		salaries: (args) => ipcRenderer.invoke("export:salaries", args),
		expenses: (args) => ipcRenderer.invoke("export:expenses", args)
	},
	storage: {
		stats: () => ipcRenderer.invoke("storage:stats"),
		backup: () => ipcRenderer.invoke("storage:backup"),
		restore: (args) => ipcRenderer.invoke("storage:restore", args),
		import: (args) => ipcRenderer.invoke("storage:import", args),
		clear: (args) => ipcRenderer.invoke("storage:clear", args),
		audit: () => ipcRenderer.invoke("storage:audit")
	},
	sync: {
		connect: (args) => ipcRenderer.invoke("sync:connect", args),
		disconnect: () => ipcRenderer.invoke("sync:disconnect"),
		push: () => ipcRenderer.invoke("sync:push"),
		pull: () => ipcRenderer.invoke("sync:pull"),
		status: () => ipcRenderer.invoke("sync:status"),
		autoSync: (args) => ipcRenderer.invoke("sync:auto-sync", args)
	}
});
//#endregion
export {};

//# sourceMappingURL=preload.js.map