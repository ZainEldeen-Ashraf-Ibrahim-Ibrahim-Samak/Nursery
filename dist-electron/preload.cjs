let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("api", {
	auth: {
		login: (args) => electron.ipcRenderer.invoke("auth:login", args),
		logout: () => electron.ipcRenderer.invoke("auth:logout"),
		current: () => electron.ipcRenderer.invoke("auth:current"),
		restore: (args) => electron.ipcRenderer.invoke("auth:restore", args)
	},
	users: {
		list: () => electron.ipcRenderer.invoke("users:list"),
		create: (args) => electron.ipcRenderer.invoke("users:create", args),
		update: (args) => electron.ipcRenderer.invoke("users:update", args),
		deactivate: (args) => electron.ipcRenderer.invoke("users:deactivate", args)
	},
	children: {
		get: (args) => electron.ipcRenderer.invoke("children:get", args),
		add: (args) => electron.ipcRenderer.invoke("children:add", args),
		update: (args) => electron.ipcRenderer.invoke("children:update", args),
		deactivate: (args) => electron.ipcRenderer.invoke("children:deactivate", args),
		statement: (args) => electron.ipcRenderer.invoke("children:statement", args)
	},
	childServices: {
		list: (args) => electron.ipcRenderer.invoke("childServices:list", args),
		add: (args) => electron.ipcRenderer.invoke("childServices:add", args),
		update: (args) => electron.ipcRenderer.invoke("childServices:update", args),
		remove: (args) => electron.ipcRenderer.invoke("childServices:remove", args)
	},
	payments: {
		get: (args) => electron.ipcRenderer.invoke("payments:get", args),
		generate: (args) => electron.ipcRenderer.invoke("payments:generate", args),
		update: (args) => electron.ipcRenderer.invoke("payments:update", args),
		bulkPay: (args) => electron.ipcRenderer.invoke("payments:bulkPay", args)
	},
	employees: {
		get: () => electron.ipcRenderer.invoke("employees:get"),
		add: (args) => electron.ipcRenderer.invoke("employees:add", args),
		update: (args) => electron.ipcRenderer.invoke("employees:update", args),
		deactivate: (args) => electron.ipcRenderer.invoke("employees:deactivate", args)
	},
	salary: {
		get: (args) => electron.ipcRenderer.invoke("salary:get", args),
		update: (args) => electron.ipcRenderer.invoke("salary:update", args)
	},
	expenses: {
		get: (args) => electron.ipcRenderer.invoke("expenses:get", args),
		update: (args) => electron.ipcRenderer.invoke("expenses:update", args),
		addItem: (args) => electron.ipcRenderer.invoke("expenses:addItem", args),
		removeItem: (args) => electron.ipcRenderer.invoke("expenses:removeItem", args)
	},
	dashboard: { get: (args) => electron.ipcRenderer.invoke("dashboard:get", args) },
	target: {
		get: (args) => electron.ipcRenderer.invoke("target:get", args),
		calc: (args) => electron.ipcRenderer.invoke("target:calc", args)
	},
	settings: {
		get: () => electron.ipcRenderer.invoke("settings:get"),
		update: (args) => electron.ipcRenderer.invoke("settings:update", args)
	},
	branding: {
		get: () => electron.ipcRenderer.invoke("branding:get"),
		save: (args) => electron.ipcRenderer.invoke("branding:save", args),
		uploadLogo: () => electron.ipcRenderer.invoke("branding:upload-logo"),
		uploadIcon: () => electron.ipcRenderer.invoke("branding:upload-icon"),
		reset: () => electron.ipcRenderer.invoke("branding:reset")
	},
	export: {
		full: (args) => electron.ipcRenderer.invoke("export:full", args),
		month: (args) => electron.ipcRenderer.invoke("export:month", args),
		child: (args) => electron.ipcRenderer.invoke("export:child", args),
		salaries: (args) => electron.ipcRenderer.invoke("export:salaries", args),
		expenses: (args) => electron.ipcRenderer.invoke("export:expenses", args),
		employees: (args) => electron.ipcRenderer.invoke("export:employees", args)
	},
	storage: {
		stats: () => electron.ipcRenderer.invoke("storage:stats"),
		backup: () => electron.ipcRenderer.invoke("storage:backup"),
		restore: (args) => electron.ipcRenderer.invoke("storage:restore", args),
		import: (args) => electron.ipcRenderer.invoke("storage:import", args),
		clear: (args) => electron.ipcRenderer.invoke("storage:clear", args),
		audit: () => electron.ipcRenderer.invoke("storage:audit")
	},
	sync: {
		connect: (args) => electron.ipcRenderer.invoke("sync:connect", args),
		disconnect: () => electron.ipcRenderer.invoke("sync:disconnect"),
		push: () => electron.ipcRenderer.invoke("sync:push"),
		pull: () => electron.ipcRenderer.invoke("sync:pull"),
		status: () => electron.ipcRenderer.invoke("sync:status"),
		autoSync: (args) => electron.ipcRenderer.invoke("sync:auto-sync", args)
	},
	/**
	* Subscribe to long-running operation progress (push/pull/import/backup/restore).
	* Returns an unsubscribe function. Payload: { op, phase, current, total, percent }.
	*/
	onProgress: (callback) => {
		const handler = (_e, payload) => callback(payload);
		electron.ipcRenderer.on("progress:update", handler);
		return () => electron.ipcRenderer.removeListener("progress:update", handler);
	}
});
//#endregion

//# sourceMappingURL=preload.cjs.map