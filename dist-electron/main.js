import { n as getDb, r as initDb, t as closeDb } from "./connection-87fvLz8b.js";
import { createRequire } from "node:module";
import path from "node:path";
import nodeCrypto from "crypto";
import { BrowserWindow, app, dialog, ipcMain, net, protocol } from "electron";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import PdfPrinter from "pdfmake";
import mongoose, { Schema } from "mongoose";
import { promises } from "dns";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __require = /* @__PURE__ */ createRequire(import.meta.url);
//#endregion
//#region node_modules/dotenv/package.json
var package_exports = /* @__PURE__ */ __exportAll({
	browser: () => browser,
	default: () => package_default,
	description: () => description,
	devDependencies: () => devDependencies,
	engines: () => engines,
	exports: () => exports$1,
	funding: () => funding,
	homepage: () => homepage,
	keywords: () => keywords,
	license: () => license,
	main: () => main,
	name: () => name,
	readmeFilename: () => readmeFilename,
	repository: () => repository,
	scripts: () => scripts,
	types: () => types,
	version: () => version
});
var name, version, description, main, types, exports$1, scripts, repository, homepage, funding, keywords, readmeFilename, license, devDependencies, engines, browser, package_default;
var init_package = __esmMin((() => {
	name = "dotenv";
	version = "16.6.1";
	description = "Loads environment variables from .env file";
	main = "lib/main.js";
	types = "lib/main.d.ts";
	exports$1 = {
		".": {
			"types": "./lib/main.d.ts",
			"require": "./lib/main.js",
			"default": "./lib/main.js"
		},
		"./config": "./config.js",
		"./config.js": "./config.js",
		"./lib/env-options": "./lib/env-options.js",
		"./lib/env-options.js": "./lib/env-options.js",
		"./lib/cli-options": "./lib/cli-options.js",
		"./lib/cli-options.js": "./lib/cli-options.js",
		"./package.json": "./package.json"
	};
	scripts = {
		"dts-check": "tsc --project tests/types/tsconfig.json",
		"lint": "standard",
		"pretest": "npm run lint && npm run dts-check",
		"test": "tap run --allow-empty-coverage --disable-coverage --timeout=60000",
		"test:coverage": "tap run --show-full-coverage --timeout=60000 --coverage-report=text --coverage-report=lcov",
		"prerelease": "npm test",
		"release": "standard-version"
	};
	repository = {
		"type": "git",
		"url": "git://github.com/motdotla/dotenv.git"
	};
	homepage = "https://github.com/motdotla/dotenv#readme";
	funding = "https://dotenvx.com";
	keywords = [
		"dotenv",
		"env",
		".env",
		"environment",
		"variables",
		"config",
		"settings"
	];
	readmeFilename = "README.md";
	license = "BSD-2-Clause";
	devDependencies = {
		"@types/node": "^18.11.3",
		"decache": "^4.6.2",
		"sinon": "^14.0.1",
		"standard": "^17.0.0",
		"standard-version": "^9.5.0",
		"tap": "^19.2.0",
		"typescript": "^4.8.4"
	};
	engines = { "node": ">=12" };
	browser = { "fs": false };
	package_default = {
		name,
		version,
		description,
		main,
		types,
		exports: exports$1,
		scripts,
		repository,
		homepage,
		funding,
		keywords,
		readmeFilename,
		license,
		devDependencies,
		engines,
		browser
	};
}));
//#endregion
//#region electron/env.ts
var import_main = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs$1 = __require("fs");
	var path$1 = __require("path");
	var os = __require("os");
	var crypto$2 = __require("crypto");
	var version = (init_package(), __toCommonJS(package_exports).default).version;
	var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;
	function parse(src) {
		const obj = {};
		let lines = src.toString();
		lines = lines.replace(/\r\n?/gm, "\n");
		let match;
		while ((match = LINE.exec(lines)) != null) {
			const key = match[1];
			let value = match[2] || "";
			value = value.trim();
			const maybeQuote = value[0];
			value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
			if (maybeQuote === "\"") {
				value = value.replace(/\\n/g, "\n");
				value = value.replace(/\\r/g, "\r");
			}
			obj[key] = value;
		}
		return obj;
	}
	function _parseVault(options) {
		options = options || {};
		const vaultPath = _vaultPath(options);
		options.path = vaultPath;
		const result = DotenvModule.configDotenv(options);
		if (!result.parsed) {
			const err = /* @__PURE__ */ new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
			err.code = "MISSING_DATA";
			throw err;
		}
		const keys = _dotenvKey(options).split(",");
		const length = keys.length;
		let decrypted;
		for (let i = 0; i < length; i++) try {
			const attrs = _instructions(result, keys[i].trim());
			decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
			break;
		} catch (error) {
			if (i + 1 >= length) throw error;
		}
		return DotenvModule.parse(decrypted);
	}
	function _warn(message) {
		console.log(`[dotenv@${version}][WARN] ${message}`);
	}
	function _debug(message) {
		console.log(`[dotenv@${version}][DEBUG] ${message}`);
	}
	function _log(message) {
		console.log(`[dotenv@${version}] ${message}`);
	}
	function _dotenvKey(options) {
		if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) return options.DOTENV_KEY;
		if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) return process.env.DOTENV_KEY;
		return "";
	}
	function _instructions(result, dotenvKey) {
		let uri;
		try {
			uri = new URL(dotenvKey);
		} catch (error) {
			if (error.code === "ERR_INVALID_URL") {
				const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
				err.code = "INVALID_DOTENV_KEY";
				throw err;
			}
			throw error;
		}
		const key = uri.password;
		if (!key) {
			const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Missing key part");
			err.code = "INVALID_DOTENV_KEY";
			throw err;
		}
		const environment = uri.searchParams.get("environment");
		if (!environment) {
			const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Missing environment part");
			err.code = "INVALID_DOTENV_KEY";
			throw err;
		}
		const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
		const ciphertext = result.parsed[environmentKey];
		if (!ciphertext) {
			const err = /* @__PURE__ */ new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
			err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
			throw err;
		}
		return {
			ciphertext,
			key
		};
	}
	function _vaultPath(options) {
		let possibleVaultPath = null;
		if (options && options.path && options.path.length > 0) if (Array.isArray(options.path)) {
			for (const filepath of options.path) if (fs$1.existsSync(filepath)) possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
		} else possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
		else possibleVaultPath = path$1.resolve(process.cwd(), ".env.vault");
		if (fs$1.existsSync(possibleVaultPath)) return possibleVaultPath;
		return null;
	}
	function _resolveHome(envPath) {
		return envPath[0] === "~" ? path$1.join(os.homedir(), envPath.slice(1)) : envPath;
	}
	function _configVault(options) {
		const debug = Boolean(options && options.debug);
		const quiet = options && "quiet" in options ? options.quiet : true;
		if (debug || !quiet) _log("Loading env from encrypted .env.vault");
		const parsed = DotenvModule._parseVault(options);
		let processEnv = process.env;
		if (options && options.processEnv != null) processEnv = options.processEnv;
		DotenvModule.populate(processEnv, parsed, options);
		return { parsed };
	}
	function configDotenv(options) {
		const dotenvPath = path$1.resolve(process.cwd(), ".env");
		let encoding = "utf8";
		const debug = Boolean(options && options.debug);
		const quiet = options && "quiet" in options ? options.quiet : true;
		if (options && options.encoding) encoding = options.encoding;
		else if (debug) _debug("No encoding is specified. UTF-8 is used by default");
		let optionPaths = [dotenvPath];
		if (options && options.path) if (!Array.isArray(options.path)) optionPaths = [_resolveHome(options.path)];
		else {
			optionPaths = [];
			for (const filepath of options.path) optionPaths.push(_resolveHome(filepath));
		}
		let lastError;
		const parsedAll = {};
		for (const path of optionPaths) try {
			const parsed = DotenvModule.parse(fs$1.readFileSync(path, { encoding }));
			DotenvModule.populate(parsedAll, parsed, options);
		} catch (e) {
			if (debug) _debug(`Failed to load ${path} ${e.message}`);
			lastError = e;
		}
		let processEnv = process.env;
		if (options && options.processEnv != null) processEnv = options.processEnv;
		DotenvModule.populate(processEnv, parsedAll, options);
		if (debug || !quiet) {
			const keysCount = Object.keys(parsedAll).length;
			const shortPaths = [];
			for (const filePath of optionPaths) try {
				const relative = path$1.relative(process.cwd(), filePath);
				shortPaths.push(relative);
			} catch (e) {
				if (debug) _debug(`Failed to load ${filePath} ${e.message}`);
				lastError = e;
			}
			_log(`injecting env (${keysCount}) from ${shortPaths.join(",")}`);
		}
		if (lastError) return {
			parsed: parsedAll,
			error: lastError
		};
		else return { parsed: parsedAll };
	}
	function config(options) {
		if (_dotenvKey(options).length === 0) return DotenvModule.configDotenv(options);
		const vaultPath = _vaultPath(options);
		if (!vaultPath) {
			_warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
			return DotenvModule.configDotenv(options);
		}
		return DotenvModule._configVault(options);
	}
	function decrypt(encrypted, keyStr) {
		const key = Buffer.from(keyStr.slice(-64), "hex");
		let ciphertext = Buffer.from(encrypted, "base64");
		const nonce = ciphertext.subarray(0, 12);
		const authTag = ciphertext.subarray(-16);
		ciphertext = ciphertext.subarray(12, -16);
		try {
			const aesgcm = crypto$2.createDecipheriv("aes-256-gcm", key, nonce);
			aesgcm.setAuthTag(authTag);
			return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
		} catch (error) {
			const isRange = error instanceof RangeError;
			const invalidKeyLength = error.message === "Invalid key length";
			const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
			if (isRange || invalidKeyLength) {
				const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
				err.code = "INVALID_DOTENV_KEY";
				throw err;
			} else if (decryptionFailed) {
				const err = /* @__PURE__ */ new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
				err.code = "DECRYPTION_FAILED";
				throw err;
			} else throw error;
		}
	}
	function populate(processEnv, parsed, options = {}) {
		const debug = Boolean(options && options.debug);
		const override = Boolean(options && options.override);
		if (typeof parsed !== "object") {
			const err = /* @__PURE__ */ new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
			err.code = "OBJECT_REQUIRED";
			throw err;
		}
		for (const key of Object.keys(parsed)) if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
			if (override === true) processEnv[key] = parsed[key];
			if (debug) if (override === true) _debug(`"${key}" is already defined and WAS overwritten`);
			else _debug(`"${key}" is already defined and was NOT overwritten`);
		} else processEnv[key] = parsed[key];
	}
	var DotenvModule = {
		configDotenv,
		_configVault,
		_parseVault,
		config,
		decrypt,
		parse,
		populate
	};
	module.exports.configDotenv = DotenvModule.configDotenv;
	module.exports._configVault = DotenvModule._configVault;
	module.exports._parseVault = DotenvModule._parseVault;
	module.exports.config = DotenvModule.config;
	module.exports.decrypt = DotenvModule.decrypt;
	module.exports.parse = DotenvModule.parse;
	module.exports.populate = DotenvModule.populate;
	module.exports = DotenvModule;
})))(), 1);
/**
* Centralised environment configuration loader.
*
* This module MUST be imported before any other module that reads `process.env`
* (notably the IPC handlers), because ES module imports are evaluated in source
* order — see specs/002-excel-import-env-config/research.md R7.
*
* Sensitive/deployment values come from the environment (`.env`); non-sensitive
* seed defaults stay in code but are overridable here. In a packaged
* (production) build the app refuses to start without a JWT secret (FR-012).
*/
import_main.default.config();
try {
	if (app?.isPackaged) import_main.default.config({ path: path.join(path.dirname(app.getPath("exe")), ".env") });
} catch {}
var DEV_SECRET = "dev_insecure_jwt_secret_do_not_use_in_production";
function isProduction() {
	try {
		return !!app?.isPackaged;
	} catch {
		return false;
	}
}
var devSecretWarned = false;
/**
* The JWT signing secret. In production it must come from the environment;
* in development a fixed insecure secret is used with a one-time warning.
*/
function getJwtSecret() {
	const fromEnv = process.env.JWT_SECRET?.trim();
	if (fromEnv) return fromEnv;
	if (isProduction()) throw new Error("JWT_SECRET is not configured.");
	if (!devSecretWarned) {
		console.warn("[env] JWT_SECRET not set — using an insecure development secret. Set JWT_SECRET in .env before shipping a production build.");
		devSecretWarned = true;
	}
	return DEV_SECRET;
}
/**
* Validate that required configuration is present for the current build.
* Production build with no JWT secret → not ok (caller must halt startup).
*/
function checkRequiredConfig() {
	const secret = process.env.JWT_SECRET?.trim();
	if (isProduction() && !secret) return {
		ok: false,
		error: "JWT_SECRET is not configured. The application cannot start securely.\nCreate a .env file (see .env.example) next to the application and set JWT_SECRET to a long random value, then restart."
	};
	return { ok: true };
}
/** Initial admin credentials used only when seeding a fresh database. */
function getSeedAdmin() {
	return {
		username: process.env.SEED_ADMIN_USERNAME?.trim() || "admin",
		password: process.env.SEED_ADMIN_PASSWORD?.trim() || null
	};
}
/**
* Resolve a non-sensitive seed setting: optional `envKey` override, else the
* provided code default. Applied by the seeder only on first run (empty table).
*/
function seedSetting(envKey, fallback) {
	const v = process.env[envKey]?.trim();
	return v && v.length > 0 ? v : fallback;
}
//#endregion
//#region electron/db/migrations/index.ts
var migrations = [
	{
		name: "001_initial_schema",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          name TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS children (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          guardian TEXT NOT NULL,
          guardian_phone TEXT NOT NULL,
          child_phone TEXT,
          national_id TEXT,
          service TEXT NOT NULL,
          unit TEXT NOT NULL,
          price REAL NOT NULL,
          reg_date TEXT NOT NULL,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          service TEXT NOT NULL,
          unit TEXT NOT NULL,
          quantity REAL DEFAULT 1,
          price REAL NOT NULL,
          total REAL NOT NULL,
          paid REAL DEFAULT 0,
          balance REAL NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE,
          UNIQUE (child_id, month, year)
        );

        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          base_salary REAL NOT NULL,
          housing REAL DEFAULT 0,
          transport REAL DEFAULT 0,
          net_salary REAL NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS salary_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          bonus REAL DEFAULT 0,
          deductions REAL DEFAULT 0,
          actual_paid REAL NOT NULL,
          paid_date TEXT,
          notes TEXT,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
          UNIQUE (employee_id, month, year)
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item TEXT NOT NULL,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          amount REAL NOT NULL,
          category TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          table_name TEXT NOT NULL,
          record_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          synced_at TEXT NOT NULL
        );
      `);
		}
	},
	{
		name: "002_expenses_unique_constraint",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS expenses_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item TEXT NOT NULL,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          amount REAL NOT NULL,
          category TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          UNIQUE (item, month, year)
        );

        INSERT OR IGNORE INTO expenses_new (id, item, month, year, amount, category, notes, created_at, synced)
        SELECT id, item, month, year, amount, category, notes, created_at, synced FROM expenses;

        DROP TABLE expenses;

        ALTER TABLE expenses_new RENAME TO expenses;
      `);
		}
	},
	{
		name: "003_add_updated_at_columns",
		up: (db) => {
			try {
				db.exec("ALTER TABLE employees ADD COLUMN updated_at TEXT;");
			} catch (e) {}
			db.exec("UPDATE employees SET updated_at = created_at WHERE updated_at IS NULL;");
			try {
				db.exec("ALTER TABLE salary_payments ADD COLUMN updated_at TEXT;");
			} catch (e) {}
			db.exec("UPDATE salary_payments SET updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) WHERE updated_at IS NULL;");
			try {
				db.exec("ALTER TABLE expenses ADD COLUMN updated_at TEXT;");
			} catch (e) {}
			db.exec("UPDATE expenses SET updated_at = created_at WHERE updated_at IS NULL;");
		}
	}
];
function runMigrations(db) {
	db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      run_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
	const runMigrationList = db.prepare("SELECT name FROM migrations").all();
	const runMigrationNames = new Set(runMigrationList.map((m) => m.name));
	const insertMigration = db.prepare("INSERT INTO migrations (name) VALUES (?)");
	for (const migration of migrations) if (!runMigrationNames.has(migration.name)) {
		console.log(`Running migration: ${migration.name}`);
		db.transaction(() => {
			migration.up(db);
			insertMigration.run(migration.name);
		})();
	}
}
//#endregion
//#region node_modules/bcryptjs/index.js
/**
* The random implementation to use as a fallback.
* @type {?function(number):!Array.<number>}
* @inner
*/
var randomFallback = null;
/**
* Generates cryptographically secure random bytes.
* @function
* @param {number} len Bytes length
* @returns {!Array.<number>} Random bytes
* @throws {Error} If no random implementation is available
* @inner
*/
function randomBytes(len) {
	try {
		return crypto.getRandomValues(new Uint8Array(len));
	} catch {}
	try {
		return nodeCrypto.randomBytes(len);
	} catch {}
	if (!randomFallback) throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");
	return randomFallback(len);
}
/**
* Sets the pseudo random number generator to use as a fallback if neither node's `crypto` module nor the Web Crypto
*  API is available. Please note: It is highly important that the PRNG used is cryptographically secure and that it
*  is seeded properly!
* @param {?function(number):!Array.<number>} random Function taking the number of bytes to generate as its
*  sole argument, returning the corresponding array of cryptographically secure random byte values.
* @see http://nodejs.org/api/crypto.html
* @see http://www.w3.org/TR/WebCryptoAPI/
*/
function setRandomFallback(random) {
	randomFallback = random;
}
/**
* Synchronously generates a salt.
* @param {number=} rounds Number of rounds to use, defaults to 10 if omitted
* @param {number=} seed_length Not supported.
* @returns {string} Resulting salt
* @throws {Error} If a random fallback is required but not set
*/
function genSaltSync(rounds, seed_length) {
	rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
	if (typeof rounds !== "number") throw Error("Illegal arguments: " + typeof rounds + ", " + typeof seed_length);
	if (rounds < 4) rounds = 4;
	else if (rounds > 31) rounds = 31;
	var salt = [];
	salt.push("$2b$");
	if (rounds < 10) salt.push("0");
	salt.push(rounds.toString());
	salt.push("$");
	salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
	return salt.join("");
}
/**
* Asynchronously generates a salt.
* @param {(number|function(Error, string=))=} rounds Number of rounds to use, defaults to 10 if omitted
* @param {(number|function(Error, string=))=} seed_length Not supported.
* @param {function(Error, string=)=} callback Callback receiving the error, if any, and the resulting salt
* @returns {!Promise} If `callback` has been omitted
* @throws {Error} If `callback` is present but not a function
*/
function genSalt(rounds, seed_length, callback) {
	if (typeof seed_length === "function") callback = seed_length, seed_length = void 0;
	if (typeof rounds === "function") callback = rounds, rounds = void 0;
	if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
	else if (typeof rounds !== "number") throw Error("illegal arguments: " + typeof rounds);
	function _async(callback) {
		nextTick(function() {
			try {
				callback(null, genSaltSync(rounds));
			} catch (err) {
				callback(err);
			}
		});
	}
	if (callback) {
		if (typeof callback !== "function") throw Error("Illegal callback: " + typeof callback);
		_async(callback);
	} else return new Promise(function(resolve, reject) {
		_async(function(err, res) {
			if (err) {
				reject(err);
				return;
			}
			resolve(res);
		});
	});
}
/**
* Synchronously generates a hash for the given password.
* @param {string} password Password to hash
* @param {(number|string)=} salt Salt length to generate or salt to use, default to 10
* @returns {string} Resulting hash
*/
function hashSync(password, salt) {
	if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
	if (typeof salt === "number") salt = genSaltSync(salt);
	if (typeof password !== "string" || typeof salt !== "string") throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
	return _hash(password, salt);
}
/**
* Asynchronously generates a hash for the given password.
* @param {string} password Password to hash
* @param {number|string} salt Salt length to generate or salt to use
* @param {function(Error, string=)=} callback Callback receiving the error, if any, and the resulting hash
* @param {function(number)=} progressCallback Callback successively called with the percentage of rounds completed
*  (0.0 - 1.0), maximally once per `MAX_EXECUTION_TIME = 100` ms.
* @returns {!Promise} If `callback` has been omitted
* @throws {Error} If `callback` is present but not a function
*/
function hash(password, salt, callback, progressCallback) {
	function _async(callback) {
		if (typeof password === "string" && typeof salt === "number") genSalt(salt, function(err, salt) {
			_hash(password, salt, callback, progressCallback);
		});
		else if (typeof password === "string" && typeof salt === "string") _hash(password, salt, callback, progressCallback);
		else nextTick(callback.bind(this, Error("Illegal arguments: " + typeof password + ", " + typeof salt)));
	}
	if (callback) {
		if (typeof callback !== "function") throw Error("Illegal callback: " + typeof callback);
		_async(callback);
	} else return new Promise(function(resolve, reject) {
		_async(function(err, res) {
			if (err) {
				reject(err);
				return;
			}
			resolve(res);
		});
	});
}
/**
* Compares two strings of the same length in constant time.
* @param {string} known Must be of the correct length
* @param {string} unknown Must be the same length as `known`
* @returns {boolean}
* @inner
*/
function safeStringCompare(known, unknown) {
	var diff = known.length ^ unknown.length;
	for (var i = 0; i < known.length; ++i) diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
	return diff === 0;
}
/**
* Synchronously tests a password against a hash.
* @param {string} password Password to compare
* @param {string} hash Hash to test against
* @returns {boolean} true if matching, otherwise false
* @throws {Error} If an argument is illegal
*/
function compareSync(password, hash) {
	if (typeof password !== "string" || typeof hash !== "string") throw Error("Illegal arguments: " + typeof password + ", " + typeof hash);
	if (hash.length !== 60) return false;
	return safeStringCompare(hashSync(password, hash.substring(0, hash.length - 31)), hash);
}
/**
* Asynchronously tests a password against a hash.
* @param {string} password Password to compare
* @param {string} hashValue Hash to test against
* @param {function(Error, boolean)=} callback Callback receiving the error, if any, otherwise the result
* @param {function(number)=} progressCallback Callback successively called with the percentage of rounds completed
*  (0.0 - 1.0), maximally once per `MAX_EXECUTION_TIME = 100` ms.
* @returns {!Promise} If `callback` has been omitted
* @throws {Error} If `callback` is present but not a function
*/
function compare(password, hashValue, callback, progressCallback) {
	function _async(callback) {
		if (typeof password !== "string" || typeof hashValue !== "string") {
			nextTick(callback.bind(this, Error("Illegal arguments: " + typeof password + ", " + typeof hashValue)));
			return;
		}
		if (hashValue.length !== 60) {
			nextTick(callback.bind(this, null, false));
			return;
		}
		hash(password, hashValue.substring(0, 29), function(err, comp) {
			if (err) callback(err);
			else callback(null, safeStringCompare(comp, hashValue));
		}, progressCallback);
	}
	if (callback) {
		if (typeof callback !== "function") throw Error("Illegal callback: " + typeof callback);
		_async(callback);
	} else return new Promise(function(resolve, reject) {
		_async(function(err, res) {
			if (err) {
				reject(err);
				return;
			}
			resolve(res);
		});
	});
}
/**
* Gets the number of rounds used to encrypt the specified hash.
* @param {string} hash Hash to extract the used number of rounds from
* @returns {number} Number of rounds used
* @throws {Error} If `hash` is not a string
*/
function getRounds(hash) {
	if (typeof hash !== "string") throw Error("Illegal arguments: " + typeof hash);
	return parseInt(hash.split("$")[2], 10);
}
/**
* Gets the salt portion from a hash. Does not validate the hash.
* @param {string} hash Hash to extract the salt from
* @returns {string} Extracted salt part
* @throws {Error} If `hash` is not a string or otherwise invalid
*/
function getSalt(hash) {
	if (typeof hash !== "string") throw Error("Illegal arguments: " + typeof hash);
	if (hash.length !== 60) throw Error("Illegal hash length: " + hash.length + " != 60");
	return hash.substring(0, 29);
}
/**
* Tests if a password will be truncated when hashed, that is its length is
* greater than 72 bytes when converted to UTF-8.
* @param {string} password The password to test
* @returns {boolean} `true` if truncated, otherwise `false`
*/
function truncates(password) {
	if (typeof password !== "string") throw Error("Illegal arguments: " + typeof password);
	return utf8Length(password) > 72;
}
/**
* Continues with the callback after yielding to the event loop.
* @function
* @param {function(...[*])} callback Callback to execute
* @inner
*/
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
/** Calculates the byte length of a string encoded as UTF8. */
function utf8Length(string) {
	var len = 0, c = 0;
	for (var i = 0; i < string.length; ++i) {
		c = string.charCodeAt(i);
		if (c < 128) len += 1;
		else if (c < 2048) len += 2;
		else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
			++i;
			len += 4;
		} else len += 3;
	}
	return len;
}
/** Converts a string to an array of UTF8 bytes. */
function utf8Array(string) {
	var offset = 0, c1, c2;
	var buffer = new Array(utf8Length(string));
	for (var i = 0, k = string.length; i < k; ++i) {
		c1 = string.charCodeAt(i);
		if (c1 < 128) buffer[offset++] = c1;
		else if (c1 < 2048) {
			buffer[offset++] = c1 >> 6 | 192;
			buffer[offset++] = c1 & 63 | 128;
		} else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
			c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
			++i;
			buffer[offset++] = c1 >> 18 | 240;
			buffer[offset++] = c1 >> 12 & 63 | 128;
			buffer[offset++] = c1 >> 6 & 63 | 128;
			buffer[offset++] = c1 & 63 | 128;
		} else {
			buffer[offset++] = c1 >> 12 | 224;
			buffer[offset++] = c1 >> 6 & 63 | 128;
			buffer[offset++] = c1 & 63 | 128;
		}
	}
	return buffer;
}
/**
* bcrypt's own non-standard base64 dictionary.
* @type {!Array.<string>}
* @const
* @inner
**/
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
/**
* @type {!Array.<number>}
* @const
* @inner
**/
var BASE64_INDEX = [
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	54,
	55,
	56,
	57,
	58,
	59,
	60,
	61,
	62,
	63,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	11,
	12,
	13,
	14,
	15,
	16,
	17,
	18,
	19,
	20,
	21,
	22,
	23,
	24,
	25,
	26,
	27,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	28,
	29,
	30,
	31,
	32,
	33,
	34,
	35,
	36,
	37,
	38,
	39,
	40,
	41,
	42,
	43,
	44,
	45,
	46,
	47,
	48,
	49,
	50,
	51,
	52,
	53,
	-1,
	-1,
	-1,
	-1,
	-1
];
/**
* Encodes a byte array to base64 with up to len bytes of input.
* @param {!Array.<number>} b Byte array
* @param {number} len Maximum input length
* @returns {string}
* @inner
*/
function base64_encode(b, len) {
	var off = 0, rs = [], c1, c2;
	if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
	while (off < len) {
		c1 = b[off++] & 255;
		rs.push(BASE64_CODE[c1 >> 2 & 63]);
		c1 = (c1 & 3) << 4;
		if (off >= len) {
			rs.push(BASE64_CODE[c1 & 63]);
			break;
		}
		c2 = b[off++] & 255;
		c1 |= c2 >> 4 & 15;
		rs.push(BASE64_CODE[c1 & 63]);
		c1 = (c2 & 15) << 2;
		if (off >= len) {
			rs.push(BASE64_CODE[c1 & 63]);
			break;
		}
		c2 = b[off++] & 255;
		c1 |= c2 >> 6 & 3;
		rs.push(BASE64_CODE[c1 & 63]);
		rs.push(BASE64_CODE[c2 & 63]);
	}
	return rs.join("");
}
/**
* Decodes a base64 encoded string to up to len bytes of output.
* @param {string} s String to decode
* @param {number} len Maximum output length
* @returns {!Array.<number>}
* @inner
*/
function base64_decode(s, len) {
	var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
	if (len <= 0) throw Error("Illegal len: " + len);
	while (off < slen - 1 && olen < len) {
		code = s.charCodeAt(off++);
		c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
		code = s.charCodeAt(off++);
		c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
		if (c1 == -1 || c2 == -1) break;
		o = c1 << 2 >>> 0;
		o |= (c2 & 48) >> 4;
		rs.push(String.fromCharCode(o));
		if (++olen >= len || off >= slen) break;
		code = s.charCodeAt(off++);
		c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
		if (c3 == -1) break;
		o = (c2 & 15) << 4 >>> 0;
		o |= (c3 & 60) >> 2;
		rs.push(String.fromCharCode(o));
		if (++olen >= len || off >= slen) break;
		code = s.charCodeAt(off++);
		c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
		o = (c3 & 3) << 6 >>> 0;
		o |= c4;
		rs.push(String.fromCharCode(o));
		++olen;
	}
	var res = [];
	for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
	return res;
}
/**
* @type {number}
* @const
* @inner
*/
var BCRYPT_SALT_LEN = 16;
/**
* @type {number}
* @const
* @inner
*/
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
/**
* @type {number}
* @const
* @inner
*/
var BLOWFISH_NUM_ROUNDS = 16;
/**
* @type {number}
* @const
* @inner
*/
var MAX_EXECUTION_TIME = 100;
/**
* @type {Array.<number>}
* @const
* @inner
*/
var P_ORIG = [
	608135816,
	2242054355,
	320440878,
	57701188,
	2752067618,
	698298832,
	137296536,
	3964562569,
	1160258022,
	953160567,
	3193202383,
	887688300,
	3232508343,
	3380367581,
	1065670069,
	3041331479,
	2450970073,
	2306472731
];
/**
* @type {Array.<number>}
* @const
* @inner
*/
var S_ORIG = [
	3509652390,
	2564797868,
	805139163,
	3491422135,
	3101798381,
	1780907670,
	3128725573,
	4046225305,
	614570311,
	3012652279,
	134345442,
	2240740374,
	1667834072,
	1901547113,
	2757295779,
	4103290238,
	227898511,
	1921955416,
	1904987480,
	2182433518,
	2069144605,
	3260701109,
	2620446009,
	720527379,
	3318853667,
	677414384,
	3393288472,
	3101374703,
	2390351024,
	1614419982,
	1822297739,
	2954791486,
	3608508353,
	3174124327,
	2024746970,
	1432378464,
	3864339955,
	2857741204,
	1464375394,
	1676153920,
	1439316330,
	715854006,
	3033291828,
	289532110,
	2706671279,
	2087905683,
	3018724369,
	1668267050,
	732546397,
	1947742710,
	3462151702,
	2609353502,
	2950085171,
	1814351708,
	2050118529,
	680887927,
	999245976,
	1800124847,
	3300911131,
	1713906067,
	1641548236,
	4213287313,
	1216130144,
	1575780402,
	4018429277,
	3917837745,
	3693486850,
	3949271944,
	596196993,
	3549867205,
	258830323,
	2213823033,
	772490370,
	2760122372,
	1774776394,
	2652871518,
	566650946,
	4142492826,
	1728879713,
	2882767088,
	1783734482,
	3629395816,
	2517608232,
	2874225571,
	1861159788,
	326777828,
	3124490320,
	2130389656,
	2716951837,
	967770486,
	1724537150,
	2185432712,
	2364442137,
	1164943284,
	2105845187,
	998989502,
	3765401048,
	2244026483,
	1075463327,
	1455516326,
	1322494562,
	910128902,
	469688178,
	1117454909,
	936433444,
	3490320968,
	3675253459,
	1240580251,
	122909385,
	2157517691,
	634681816,
	4142456567,
	3825094682,
	3061402683,
	2540495037,
	79693498,
	3249098678,
	1084186820,
	1583128258,
	426386531,
	1761308591,
	1047286709,
	322548459,
	995290223,
	1845252383,
	2603652396,
	3431023940,
	2942221577,
	3202600964,
	3727903485,
	1712269319,
	422464435,
	3234572375,
	1170764815,
	3523960633,
	3117677531,
	1434042557,
	442511882,
	3600875718,
	1076654713,
	1738483198,
	4213154764,
	2393238008,
	3677496056,
	1014306527,
	4251020053,
	793779912,
	2902807211,
	842905082,
	4246964064,
	1395751752,
	1040244610,
	2656851899,
	3396308128,
	445077038,
	3742853595,
	3577915638,
	679411651,
	2892444358,
	2354009459,
	1767581616,
	3150600392,
	3791627101,
	3102740896,
	284835224,
	4246832056,
	1258075500,
	768725851,
	2589189241,
	3069724005,
	3532540348,
	1274779536,
	3789419226,
	2764799539,
	1660621633,
	3471099624,
	4011903706,
	913787905,
	3497959166,
	737222580,
	2514213453,
	2928710040,
	3937242737,
	1804850592,
	3499020752,
	2949064160,
	2386320175,
	2390070455,
	2415321851,
	4061277028,
	2290661394,
	2416832540,
	1336762016,
	1754252060,
	3520065937,
	3014181293,
	791618072,
	3188594551,
	3933548030,
	2332172193,
	3852520463,
	3043980520,
	413987798,
	3465142937,
	3030929376,
	4245938359,
	2093235073,
	3534596313,
	375366246,
	2157278981,
	2479649556,
	555357303,
	3870105701,
	2008414854,
	3344188149,
	4221384143,
	3956125452,
	2067696032,
	3594591187,
	2921233993,
	2428461,
	544322398,
	577241275,
	1471733935,
	610547355,
	4027169054,
	1432588573,
	1507829418,
	2025931657,
	3646575487,
	545086370,
	48609733,
	2200306550,
	1653985193,
	298326376,
	1316178497,
	3007786442,
	2064951626,
	458293330,
	2589141269,
	3591329599,
	3164325604,
	727753846,
	2179363840,
	146436021,
	1461446943,
	4069977195,
	705550613,
	3059967265,
	3887724982,
	4281599278,
	3313849956,
	1404054877,
	2845806497,
	146425753,
	1854211946,
	1266315497,
	3048417604,
	3681880366,
	3289982499,
	290971e4,
	1235738493,
	2632868024,
	2414719590,
	3970600049,
	1771706367,
	1449415276,
	3266420449,
	422970021,
	1963543593,
	2690192192,
	3826793022,
	1062508698,
	1531092325,
	1804592342,
	2583117782,
	2714934279,
	4024971509,
	1294809318,
	4028980673,
	1289560198,
	2221992742,
	1669523910,
	35572830,
	157838143,
	1052438473,
	1016535060,
	1802137761,
	1753167236,
	1386275462,
	3080475397,
	2857371447,
	1040679964,
	2145300060,
	2390574316,
	1461121720,
	2956646967,
	4031777805,
	4028374788,
	33600511,
	2920084762,
	1018524850,
	629373528,
	3691585981,
	3515945977,
	2091462646,
	2486323059,
	586499841,
	988145025,
	935516892,
	3367335476,
	2599673255,
	2839830854,
	265290510,
	3972581182,
	2759138881,
	3795373465,
	1005194799,
	847297441,
	406762289,
	1314163512,
	1332590856,
	1866599683,
	4127851711,
	750260880,
	613907577,
	1450815602,
	3165620655,
	3734664991,
	3650291728,
	3012275730,
	3704569646,
	1427272223,
	778793252,
	1343938022,
	2676280711,
	2052605720,
	1946737175,
	3164576444,
	3914038668,
	3967478842,
	3682934266,
	1661551462,
	3294938066,
	4011595847,
	840292616,
	3712170807,
	616741398,
	312560963,
	711312465,
	1351876610,
	322626781,
	1910503582,
	271666773,
	2175563734,
	1594956187,
	70604529,
	3617834859,
	1007753275,
	1495573769,
	4069517037,
	2549218298,
	2663038764,
	504708206,
	2263041392,
	3941167025,
	2249088522,
	1514023603,
	1998579484,
	1312622330,
	694541497,
	2582060303,
	2151582166,
	1382467621,
	776784248,
	2618340202,
	3323268794,
	2497899128,
	2784771155,
	503983604,
	4076293799,
	907881277,
	423175695,
	432175456,
	1378068232,
	4145222326,
	3954048622,
	3938656102,
	3820766613,
	2793130115,
	2977904593,
	26017576,
	3274890735,
	3194772133,
	1700274565,
	1756076034,
	4006520079,
	3677328699,
	720338349,
	1533947780,
	354530856,
	688349552,
	3973924725,
	1637815568,
	332179504,
	3949051286,
	53804574,
	2852348879,
	3044236432,
	1282449977,
	3583942155,
	3416972820,
	4006381244,
	1617046695,
	2628476075,
	3002303598,
	1686838959,
	431878346,
	2686675385,
	1700445008,
	1080580658,
	1009431731,
	832498133,
	3223435511,
	2605976345,
	2271191193,
	2516031870,
	1648197032,
	4164389018,
	2548247927,
	300782431,
	375919233,
	238389289,
	3353747414,
	2531188641,
	2019080857,
	1475708069,
	455242339,
	2609103871,
	448939670,
	3451063019,
	1395535956,
	2413381860,
	1841049896,
	1491858159,
	885456874,
	4264095073,
	4001119347,
	1565136089,
	3898914787,
	1108368660,
	540939232,
	1173283510,
	2745871338,
	3681308437,
	4207628240,
	3343053890,
	4016749493,
	1699691293,
	1103962373,
	3625875870,
	2256883143,
	3830138730,
	1031889488,
	3479347698,
	1535977030,
	4236805024,
	3251091107,
	2132092099,
	1774941330,
	1199868427,
	1452454533,
	157007616,
	2904115357,
	342012276,
	595725824,
	1480756522,
	206960106,
	497939518,
	591360097,
	863170706,
	2375253569,
	3596610801,
	1814182875,
	2094937945,
	3421402208,
	1082520231,
	3463918190,
	2785509508,
	435703966,
	3908032597,
	1641649973,
	2842273706,
	3305899714,
	1510255612,
	2148256476,
	2655287854,
	3276092548,
	4258621189,
	236887753,
	3681803219,
	274041037,
	1734335097,
	3815195456,
	3317970021,
	1899903192,
	1026095262,
	4050517792,
	356393447,
	2410691914,
	3873677099,
	3682840055,
	3913112168,
	2491498743,
	4132185628,
	2489919796,
	1091903735,
	1979897079,
	3170134830,
	3567386728,
	3557303409,
	857797738,
	1136121015,
	1342202287,
	507115054,
	2535736646,
	337727348,
	3213592640,
	1301675037,
	2528481711,
	1895095763,
	1721773893,
	3216771564,
	62756741,
	2142006736,
	835421444,
	2531993523,
	1442658625,
	3659876326,
	2882144922,
	676362277,
	1392781812,
	170690266,
	3921047035,
	1759253602,
	3611846912,
	1745797284,
	664899054,
	1329594018,
	3901205900,
	3045908486,
	2062866102,
	2865634940,
	3543621612,
	3464012697,
	1080764994,
	553557557,
	3656615353,
	3996768171,
	991055499,
	499776247,
	1265440854,
	648242737,
	3940784050,
	980351604,
	3713745714,
	1749149687,
	3396870395,
	4211799374,
	3640570775,
	1161844396,
	3125318951,
	1431517754,
	545492359,
	4268468663,
	3499529547,
	1437099964,
	2702547544,
	3433638243,
	2581715763,
	2787789398,
	1060185593,
	1593081372,
	2418618748,
	4260947970,
	69676912,
	2159744348,
	86519011,
	2512459080,
	3838209314,
	1220612927,
	3339683548,
	133810670,
	1090789135,
	1078426020,
	1569222167,
	845107691,
	3583754449,
	4072456591,
	1091646820,
	628848692,
	1613405280,
	3757631651,
	526609435,
	236106946,
	48312990,
	2942717905,
	3402727701,
	1797494240,
	859738849,
	992217954,
	4005476642,
	2243076622,
	3870952857,
	3732016268,
	765654824,
	3490871365,
	2511836413,
	1685915746,
	3888969200,
	1414112111,
	2273134842,
	3281911079,
	4080962846,
	172450625,
	2569994100,
	980381355,
	4109958455,
	2819808352,
	2716589560,
	2568741196,
	3681446669,
	3329971472,
	1835478071,
	660984891,
	3704678404,
	4045999559,
	3422617507,
	3040415634,
	1762651403,
	1719377915,
	3470491036,
	2693910283,
	3642056355,
	3138596744,
	1364962596,
	2073328063,
	1983633131,
	926494387,
	3423689081,
	2150032023,
	4096667949,
	1749200295,
	3328846651,
	309677260,
	2016342300,
	1779581495,
	3079819751,
	111262694,
	1274766160,
	443224088,
	298511866,
	1025883608,
	3806446537,
	1145181785,
	168956806,
	3641502830,
	3584813610,
	1689216846,
	3666258015,
	3200248200,
	1692713982,
	2646376535,
	4042768518,
	1618508792,
	1610833997,
	3523052358,
	4130873264,
	2001055236,
	3610705100,
	2202168115,
	4028541809,
	2961195399,
	1006657119,
	2006996926,
	3186142756,
	1430667929,
	3210227297,
	1314452623,
	4074634658,
	4101304120,
	2273951170,
	1399257539,
	3367210612,
	3027628629,
	1190975929,
	2062231137,
	2333990788,
	2221543033,
	2438960610,
	1181637006,
	548689776,
	2362791313,
	3372408396,
	3104550113,
	3145860560,
	296247880,
	1970579870,
	3078560182,
	3769228297,
	1714227617,
	3291629107,
	3898220290,
	166772364,
	1251581989,
	493813264,
	448347421,
	195405023,
	2709975567,
	677966185,
	3703036547,
	1463355134,
	2715995803,
	1338867538,
	1343315457,
	2802222074,
	2684532164,
	233230375,
	2599980071,
	2000651841,
	3277868038,
	1638401717,
	4028070440,
	3237316320,
	6314154,
	819756386,
	300326615,
	590932579,
	1405279636,
	3267499572,
	3150704214,
	2428286686,
	3959192993,
	3461946742,
	1862657033,
	1266418056,
	963775037,
	2089974820,
	2263052895,
	1917689273,
	448879540,
	3550394620,
	3981727096,
	150775221,
	3627908307,
	1303187396,
	508620638,
	2975983352,
	2726630617,
	1817252668,
	1876281319,
	1457606340,
	908771278,
	3720792119,
	3617206836,
	2455994898,
	1729034894,
	1080033504,
	976866871,
	3556439503,
	2881648439,
	1522871579,
	1555064734,
	1336096578,
	3548522304,
	2579274686,
	3574697629,
	3205460757,
	3593280638,
	3338716283,
	3079412587,
	564236357,
	2993598910,
	1781952180,
	1464380207,
	3163844217,
	3332601554,
	1699332808,
	1393555694,
	1183702653,
	3581086237,
	1288719814,
	691649499,
	2847557200,
	2895455976,
	3193889540,
	2717570544,
	1781354906,
	1676643554,
	2592534050,
	3230253752,
	1126444790,
	2770207658,
	2633158820,
	2210423226,
	2615765581,
	2414155088,
	3127139286,
	673620729,
	2805611233,
	1269405062,
	4015350505,
	3341807571,
	4149409754,
	1057255273,
	2012875353,
	2162469141,
	2276492801,
	2601117357,
	993977747,
	3918593370,
	2654263191,
	753973209,
	36408145,
	2530585658,
	25011837,
	3520020182,
	2088578344,
	530523599,
	2918365339,
	1524020338,
	1518925132,
	3760827505,
	3759777254,
	1202760957,
	3985898139,
	3906192525,
	674977740,
	4174734889,
	2031300136,
	2019492241,
	3983892565,
	4153806404,
	3822280332,
	352677332,
	2297720250,
	60907813,
	90501309,
	3286998549,
	1016092578,
	2535922412,
	2839152426,
	457141659,
	509813237,
	4120667899,
	652014361,
	1966332200,
	2975202805,
	55981186,
	2327461051,
	676427537,
	3255491064,
	2882294119,
	3433927263,
	1307055953,
	942726286,
	933058658,
	2468411793,
	3933900994,
	4215176142,
	1361170020,
	2001714738,
	2830558078,
	3274259782,
	1222529897,
	1679025792,
	2729314320,
	3714953764,
	1770335741,
	151462246,
	3013232138,
	1682292957,
	1483529935,
	471910574,
	1539241949,
	458788160,
	3436315007,
	1807016891,
	3718408830,
	978976581,
	1043663428,
	3165965781,
	1927990952,
	4200891579,
	2372276910,
	3208408903,
	3533431907,
	1412390302,
	2931980059,
	4132332400,
	1947078029,
	3881505623,
	4168226417,
	2941484381,
	1077988104,
	1320477388,
	886195818,
	18198404,
	3786409e3,
	2509781533,
	112762804,
	3463356488,
	1866414978,
	891333506,
	18488651,
	661792760,
	1628790961,
	3885187036,
	3141171499,
	876946877,
	2693282273,
	1372485963,
	791857591,
	2686433993,
	3759982718,
	3167212022,
	3472953795,
	2716379847,
	445679433,
	3561995674,
	3504004811,
	3574258232,
	54117162,
	3331405415,
	2381918588,
	3769707343,
	4154350007,
	1140177722,
	4074052095,
	668550556,
	3214352940,
	367459370,
	261225585,
	2610173221,
	4209349473,
	3468074219,
	3265815641,
	314222801,
	3066103646,
	3808782860,
	282218597,
	3406013506,
	3773591054,
	379116347,
	1285071038,
	846784868,
	2669647154,
	3771962079,
	3550491691,
	2305946142,
	453669953,
	1268987020,
	3317592352,
	3279303384,
	3744833421,
	2610507566,
	3859509063,
	266596637,
	3847019092,
	517658769,
	3462560207,
	3443424879,
	370717030,
	4247526661,
	2224018117,
	4143653529,
	4112773975,
	2788324899,
	2477274417,
	1456262402,
	2901442914,
	1517677493,
	1846949527,
	2295493580,
	3734397586,
	2176403920,
	1280348187,
	1908823572,
	3871786941,
	846861322,
	1172426758,
	3287448474,
	3383383037,
	1655181056,
	3139813346,
	901632758,
	1897031941,
	2986607138,
	3066810236,
	3447102507,
	1393639104,
	373351379,
	950779232,
	625454576,
	3124240540,
	4148612726,
	2007998917,
	544563296,
	2244738638,
	2330496472,
	2058025392,
	1291430526,
	424198748,
	50039436,
	29584100,
	3605783033,
	2429876329,
	2791104160,
	1057563949,
	3255363231,
	3075367218,
	3463963227,
	1469046755,
	985887462
];
/**
* @type {Array.<number>}
* @const
* @inner
*/
var C_ORIG = [
	1332899944,
	1700884034,
	1701343084,
	1684370003,
	1668446532,
	1869963892
];
/**
* @param {Array.<number>} lr
* @param {number} off
* @param {Array.<number>} P
* @param {Array.<number>} S
* @returns {Array.<number>}
* @inner
*/
function _encipher(lr, off, P, S) {
	var n, l = lr[off], r = lr[off + 1];
	l ^= P[0];
	n = S[l >>> 24];
	n += S[256 | l >> 16 & 255];
	n ^= S[512 | l >> 8 & 255];
	n += S[768 | l & 255];
	r ^= n ^ P[1];
	n = S[r >>> 24];
	n += S[256 | r >> 16 & 255];
	n ^= S[512 | r >> 8 & 255];
	n += S[768 | r & 255];
	l ^= n ^ P[2];
	n = S[l >>> 24];
	n += S[256 | l >> 16 & 255];
	n ^= S[512 | l >> 8 & 255];
	n += S[768 | l & 255];
	r ^= n ^ P[3];
	n = S[r >>> 24];
	n += S[256 | r >> 16 & 255];
	n ^= S[512 | r >> 8 & 255];
	n += S[768 | r & 255];
	l ^= n ^ P[4];
	n = S[l >>> 24];
	n += S[256 | l >> 16 & 255];
	n ^= S[512 | l >> 8 & 255];
	n += S[768 | l & 255];
	r ^= n ^ P[5];
	n = S[r >>> 24];
	n += S[256 | r >> 16 & 255];
	n ^= S[512 | r >> 8 & 255];
	n += S[768 | r & 255];
	l ^= n ^ P[6];
	n = S[l >>> 24];
	n += S[256 | l >> 16 & 255];
	n ^= S[512 | l >> 8 & 255];
	n += S[768 | l & 255];
	r ^= n ^ P[7];
	n = S[r >>> 24];
	n += S[256 | r >> 16 & 255];
	n ^= S[512 | r >> 8 & 255];
	n += S[768 | r & 255];
	l ^= n ^ P[8];
	n = S[l >>> 24];
	n += S[256 | l >> 16 & 255];
	n ^= S[512 | l >> 8 & 255];
	n += S[768 | l & 255];
	r ^= n ^ P[9];
	n = S[r >>> 24];
	n += S[256 | r >> 16 & 255];
	n ^= S[512 | r >> 8 & 255];
	n += S[768 | r & 255];
	l ^= n ^ P[10];
	n = S[l >>> 24];
	n += S[256 | l >> 16 & 255];
	n ^= S[512 | l >> 8 & 255];
	n += S[768 | l & 255];
	r ^= n ^ P[11];
	n = S[r >>> 24];
	n += S[256 | r >> 16 & 255];
	n ^= S[512 | r >> 8 & 255];
	n += S[768 | r & 255];
	l ^= n ^ P[12];
	n = S[l >>> 24];
	n += S[256 | l >> 16 & 255];
	n ^= S[512 | l >> 8 & 255];
	n += S[768 | l & 255];
	r ^= n ^ P[13];
	n = S[r >>> 24];
	n += S[256 | r >> 16 & 255];
	n ^= S[512 | r >> 8 & 255];
	n += S[768 | r & 255];
	l ^= n ^ P[14];
	n = S[l >>> 24];
	n += S[256 | l >> 16 & 255];
	n ^= S[512 | l >> 8 & 255];
	n += S[768 | l & 255];
	r ^= n ^ P[15];
	n = S[r >>> 24];
	n += S[256 | r >> 16 & 255];
	n ^= S[512 | r >> 8 & 255];
	n += S[768 | r & 255];
	l ^= n ^ P[16];
	lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
	lr[off + 1] = l;
	return lr;
}
/**
* @param {Array.<number>} data
* @param {number} offp
* @returns {{key: number, offp: number}}
* @inner
*/
function _streamtoword(data, offp) {
	for (var i = 0, word = 0; i < 4; ++i) word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
	return {
		key: word,
		offp
	};
}
/**
* @param {Array.<number>} key
* @param {Array.<number>} P
* @param {Array.<number>} S
* @inner
*/
function _key(key, P, S) {
	var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
	for (var i = 0; i < plen; i++) sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
	for (i = 0; i < plen; i += 2) lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
	for (i = 0; i < slen; i += 2) lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
/**
* Expensive key schedule Blowfish.
* @param {Array.<number>} data
* @param {Array.<number>} key
* @param {Array.<number>} P
* @param {Array.<number>} S
* @inner
*/
function _ekskey(data, key, P, S) {
	var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
	for (var i = 0; i < plen; i++) sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
	offp = 0;
	for (i = 0; i < plen; i += 2) sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
	for (i = 0; i < slen; i += 2) sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
/**
* Internaly crypts a string.
* @param {Array.<number>} b Bytes to crypt
* @param {Array.<number>} salt Salt bytes to use
* @param {number} rounds Number of rounds
* @param {function(Error, Array.<number>=)=} callback Callback receiving the error, if any, and the resulting bytes. If
*  omitted, the operation will be performed synchronously.
*  @param {function(number)=} progressCallback Callback called with the current progress
* @returns {!Array.<number>|undefined} Resulting bytes if callback has been omitted, otherwise `undefined`
* @inner
*/
function _crypt(b, salt, rounds, callback, progressCallback) {
	var cdata = C_ORIG.slice(), clen = cdata.length, err;
	if (rounds < 4 || rounds > 31) {
		err = Error("Illegal number of rounds (4-31): " + rounds);
		if (callback) {
			nextTick(callback.bind(this, err));
			return;
		} else throw err;
	}
	if (salt.length !== BCRYPT_SALT_LEN) {
		err = Error("Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN);
		if (callback) {
			nextTick(callback.bind(this, err));
			return;
		} else throw err;
	}
	rounds = 1 << rounds >>> 0;
	var P, S, i = 0, j;
	if (typeof Int32Array === "function") {
		P = new Int32Array(P_ORIG);
		S = new Int32Array(S_ORIG);
	} else {
		P = P_ORIG.slice();
		S = S_ORIG.slice();
	}
	_ekskey(salt, b, P, S);
	/**
	* Calcualtes the next round.
	* @returns {Array.<number>|undefined} Resulting array if callback has been omitted, otherwise `undefined`
	* @inner
	*/
	function next() {
		if (progressCallback) progressCallback(i / rounds);
		if (i < rounds) {
			var start = Date.now();
			for (; i < rounds;) {
				i = i + 1;
				_key(b, P, S);
				_key(salt, P, S);
				if (Date.now() - start > MAX_EXECUTION_TIME) break;
			}
		} else {
			for (i = 0; i < 64; i++) for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
			var ret = [];
			for (i = 0; i < clen; i++) ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
			if (callback) {
				callback(null, ret);
				return;
			} else return ret;
		}
		if (callback) nextTick(next);
	}
	if (typeof callback !== "undefined") next();
	else {
		var res;
		while (true) if (typeof (res = next()) !== "undefined") return res || [];
	}
}
/**
* Internally hashes a password.
* @param {string} password Password to hash
* @param {?string} salt Salt to use, actually never null
* @param {function(Error, string=)=} callback Callback receiving the error, if any, and the resulting hash. If omitted,
*  hashing is performed synchronously.
*  @param {function(number)=} progressCallback Callback called with the current progress
* @returns {string|undefined} Resulting hash if callback has been omitted, otherwise `undefined`
* @inner
*/
function _hash(password, salt, callback, progressCallback) {
	var err;
	if (typeof password !== "string" || typeof salt !== "string") {
		err = Error("Invalid string / salt: Not a string");
		if (callback) {
			nextTick(callback.bind(this, err));
			return;
		} else throw err;
	}
	var minor, offset;
	if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
		err = Error("Invalid salt version: " + salt.substring(0, 2));
		if (callback) {
			nextTick(callback.bind(this, err));
			return;
		} else throw err;
	}
	if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
	else {
		minor = salt.charAt(2);
		if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
			err = Error("Invalid salt revision: " + salt.substring(2, 4));
			if (callback) {
				nextTick(callback.bind(this, err));
				return;
			} else throw err;
		}
		offset = 4;
	}
	if (salt.charAt(offset + 2) > "$") {
		err = Error("Missing salt rounds");
		if (callback) {
			nextTick(callback.bind(this, err));
			return;
		} else throw err;
	}
	var rounds = parseInt(salt.substring(offset, offset + 1), 10) * 10 + parseInt(salt.substring(offset + 1, offset + 2), 10), real_salt = salt.substring(offset + 3, offset + 25);
	password += minor >= "a" ? "\0" : "";
	var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
	/**
	* Finishes hashing.
	* @param {Array.<number>} bytes Byte array
	* @returns {string}
	* @inner
	*/
	function finish(bytes) {
		var res = [];
		res.push("$2");
		if (minor >= "a") res.push(minor);
		res.push("$");
		if (rounds < 10) res.push("0");
		res.push(rounds.toString());
		res.push("$");
		res.push(base64_encode(saltb, saltb.length));
		res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
		return res.join("");
	}
	if (typeof callback == "undefined") return finish(_crypt(passwordb, saltb, rounds));
	else _crypt(passwordb, saltb, rounds, function(err, bytes) {
		if (err) callback(err, null);
		else callback(null, finish(bytes));
	}, progressCallback);
}
/**
* Encodes a byte array to base64 with up to len bytes of input, using the custom bcrypt alphabet.
* @function
* @param {!Array.<number>} bytes Byte array
* @param {number} length Maximum input length
* @returns {string}
*/
function encodeBase64(bytes, length) {
	return base64_encode(bytes, length);
}
/**
* Decodes a base64 encoded string to up to len bytes of output, using the custom bcrypt alphabet.
* @function
* @param {string} string String to decode
* @param {number} length Maximum output length
* @returns {!Array.<number>}
*/
function decodeBase64(string, length) {
	return base64_decode(string, length);
}
var bcryptjs_default = {
	setRandomFallback,
	genSaltSync,
	genSalt,
	hashSync,
	hash,
	compareSync,
	compare,
	getRounds,
	getSalt,
	truncates,
	encodeBase64,
	decodeBase64
};
//#endregion
//#region electron/db/seed.ts
async function seedDatabase(db) {
	if (db.prepare("SELECT COUNT(*) as count FROM users").get().count === 0) {
		const { username, password } = getSeedAdmin();
		const adminPassword = password || "admin123";
		if (!password) console.warn("[seed] SEED_ADMIN_PASSWORD not set — seeding default admin password \"admin123\". Set SEED_ADMIN_PASSWORD in .env and change it after first login.");
		console.log(`No users found. Seeding admin user "${username}"...`);
		const hashedPassword = await bcryptjs_default.hash(adminPassword, 10);
		db.prepare(`
      INSERT INTO users (username, password, role, name, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, hashedPassword, "admin", "Administrator", 1);
	}
	if (db.prepare("SELECT COUNT(*) as count FROM settings").get().count === 0) {
		console.log("No settings found. Seeding default configuration...");
		const defaultSettings = [
			{
				key: "nursery_monthly",
				value: seedSetting("SEED_NURSERY_MONTHLY", "2500")
			},
			{
				key: "nursery_daily",
				value: seedSetting("SEED_NURSERY_DAILY", "150")
			},
			{
				key: "nursery_hourly",
				value: seedSetting("SEED_NURSERY_HOURLY", "30")
			},
			{
				key: "hosting_monthly",
				value: seedSetting("SEED_HOSTING_MONTHLY", "3000")
			},
			{
				key: "hosting_daily",
				value: seedSetting("SEED_HOSTING_DAILY", "200")
			},
			{
				key: "hosting_hourly",
				value: seedSetting("SEED_HOSTING_HOURLY", "40")
			},
			{
				key: "session_hourly",
				value: seedSetting("SEED_SESSION_HOURLY", "100")
			},
			{
				key: "session_daily",
				value: seedSetting("SEED_SESSION_DAILY", "400")
			},
			{
				key: "target_profit_pct",
				value: seedSetting("SEED_TARGET_PROFIT_PCT", "0.20")
			},
			{
				key: "max_capacity",
				value: seedSetting("SEED_MAX_CAPACITY", "50")
			},
			{
				key: "work_days",
				value: seedSetting("SEED_WORK_DAYS", "22")
			},
			{
				key: "work_hours",
				value: seedSetting("SEED_WORK_HOURS", "8")
			},
			{
				key: "brand_app_name",
				value: seedSetting("SEED_BRAND_APP_NAME", "أكاديمية زين الدين")
			},
			{
				key: "brand_org_name",
				value: seedSetting("SEED_BRAND_ORG_NAME", "مركز زين الدين للتوحد ونمو الطفل")
			},
			{
				key: "brand_tagline",
				value: "رعاية متميزة وتنمية مهارات طفلك"
			},
			{
				key: "brand_primary_color",
				value: seedSetting("SEED_BRAND_PRIMARY_COLOR", "#0f766e")
			},
			{
				key: "brand_accent_color",
				value: seedSetting("SEED_BRAND_ACCENT_COLOR", "#f59e0b")
			},
			{
				key: "brand_phone",
				value: seedSetting("SEED_BRAND_PHONE", "+20 123 456 7890")
			},
			{
				key: "brand_address",
				value: "القاهرة، مصر"
			},
			{
				key: "brand_email",
				value: seedSetting("SEED_BRAND_EMAIL", "info@zaineldeen.com")
			},
			{
				key: "brand_show_logo_sidebar",
				value: "1"
			},
			{
				key: "brand_show_logo_login",
				value: "1"
			},
			{
				key: "brand_show_logo_export",
				value: "1"
			},
			{
				key: "brand_logo_path",
				value: ""
			},
			{
				key: "brand_icon_path",
				value: ""
			}
		];
		const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
		db.transaction(() => {
			for (const setting of defaultSettings) insertSetting.run(setting.key, setting.value);
		})();
	}
}
//#endregion
//#region node_modules/safe-buffer/index.js
var require_safe_buffer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
	var buffer = __require("buffer");
	var Buffer = buffer.Buffer;
	function copyProps(src, dst) {
		for (var key in src) dst[key] = src[key];
	}
	if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) module.exports = buffer;
	else {
		copyProps(buffer, exports);
		exports.Buffer = SafeBuffer;
	}
	function SafeBuffer(arg, encodingOrOffset, length) {
		return Buffer(arg, encodingOrOffset, length);
	}
	SafeBuffer.prototype = Object.create(Buffer.prototype);
	copyProps(Buffer, SafeBuffer);
	SafeBuffer.from = function(arg, encodingOrOffset, length) {
		if (typeof arg === "number") throw new TypeError("Argument must not be a number");
		return Buffer(arg, encodingOrOffset, length);
	};
	SafeBuffer.alloc = function(size, fill, encoding) {
		if (typeof size !== "number") throw new TypeError("Argument must be a number");
		var buf = Buffer(size);
		if (fill !== void 0) if (typeof encoding === "string") buf.fill(fill, encoding);
		else buf.fill(fill);
		else buf.fill(0);
		return buf;
	};
	SafeBuffer.allocUnsafe = function(size) {
		if (typeof size !== "number") throw new TypeError("Argument must be a number");
		return Buffer(size);
	};
	SafeBuffer.allocUnsafeSlow = function(size) {
		if (typeof size !== "number") throw new TypeError("Argument must be a number");
		return buffer.SlowBuffer(size);
	};
}));
//#endregion
//#region node_modules/jws/lib/data-stream.js
var require_data_stream = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffer = require_safe_buffer().Buffer;
	var Stream$2 = __require("stream");
	var util$3 = __require("util");
	function DataStream(data) {
		this.buffer = null;
		this.writable = true;
		this.readable = true;
		if (!data) {
			this.buffer = Buffer.alloc(0);
			return this;
		}
		if (typeof data.pipe === "function") {
			this.buffer = Buffer.alloc(0);
			data.pipe(this);
			return this;
		}
		if (data.length || typeof data === "object") {
			this.buffer = data;
			this.writable = false;
			process.nextTick(function() {
				this.emit("end", data);
				this.readable = false;
				this.emit("close");
			}.bind(this));
			return this;
		}
		throw new TypeError("Unexpected data type (" + typeof data + ")");
	}
	util$3.inherits(DataStream, Stream$2);
	DataStream.prototype.write = function write(data) {
		this.buffer = Buffer.concat([this.buffer, Buffer.from(data)]);
		this.emit("data", data);
	};
	DataStream.prototype.end = function end(data) {
		if (data) this.write(data);
		this.emit("end", data);
		this.emit("close");
		this.writable = false;
		this.readable = false;
	};
	module.exports = DataStream;
}));
//#endregion
//#region node_modules/ecdsa-sig-formatter/src/param-bytes-for-alg.js
var require_param_bytes_for_alg = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function getParamSize(keySize) {
		return (keySize / 8 | 0) + (keySize % 8 === 0 ? 0 : 1);
	}
	var paramBytesForAlg = {
		ES256: getParamSize(256),
		ES384: getParamSize(384),
		ES512: getParamSize(521)
	};
	function getParamBytesForAlg(alg) {
		var paramBytes = paramBytesForAlg[alg];
		if (paramBytes) return paramBytes;
		throw new Error("Unknown algorithm \"" + alg + "\"");
	}
	module.exports = getParamBytesForAlg;
}));
//#endregion
//#region node_modules/ecdsa-sig-formatter/src/ecdsa-sig-formatter.js
var require_ecdsa_sig_formatter = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffer = require_safe_buffer().Buffer;
	var getParamBytesForAlg = require_param_bytes_for_alg();
	var MAX_OCTET = 128, CLASS_UNIVERSAL = 0, PRIMITIVE_BIT = 32, TAG_SEQ = 16, TAG_INT = 2, ENCODED_TAG_SEQ = TAG_SEQ | PRIMITIVE_BIT | CLASS_UNIVERSAL << 6, ENCODED_TAG_INT = TAG_INT | CLASS_UNIVERSAL << 6;
	function base64Url(base64) {
		return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	}
	function signatureAsBuffer(signature) {
		if (Buffer.isBuffer(signature)) return signature;
		else if ("string" === typeof signature) return Buffer.from(signature, "base64");
		throw new TypeError("ECDSA signature must be a Base64 string or a Buffer");
	}
	function derToJose(signature, alg) {
		signature = signatureAsBuffer(signature);
		var paramBytes = getParamBytesForAlg(alg);
		var maxEncodedParamLength = paramBytes + 1;
		var inputLength = signature.length;
		var offset = 0;
		if (signature[offset++] !== ENCODED_TAG_SEQ) throw new Error("Could not find expected \"seq\"");
		var seqLength = signature[offset++];
		if (seqLength === (MAX_OCTET | 1)) seqLength = signature[offset++];
		if (inputLength - offset < seqLength) throw new Error("\"seq\" specified length of \"" + seqLength + "\", only \"" + (inputLength - offset) + "\" remaining");
		if (signature[offset++] !== ENCODED_TAG_INT) throw new Error("Could not find expected \"int\" for \"r\"");
		var rLength = signature[offset++];
		if (inputLength - offset - 2 < rLength) throw new Error("\"r\" specified length of \"" + rLength + "\", only \"" + (inputLength - offset - 2) + "\" available");
		if (maxEncodedParamLength < rLength) throw new Error("\"r\" specified length of \"" + rLength + "\", max of \"" + maxEncodedParamLength + "\" is acceptable");
		var rOffset = offset;
		offset += rLength;
		if (signature[offset++] !== ENCODED_TAG_INT) throw new Error("Could not find expected \"int\" for \"s\"");
		var sLength = signature[offset++];
		if (inputLength - offset !== sLength) throw new Error("\"s\" specified length of \"" + sLength + "\", expected \"" + (inputLength - offset) + "\"");
		if (maxEncodedParamLength < sLength) throw new Error("\"s\" specified length of \"" + sLength + "\", max of \"" + maxEncodedParamLength + "\" is acceptable");
		var sOffset = offset;
		offset += sLength;
		if (offset !== inputLength) throw new Error("Expected to consume entire buffer, but \"" + (inputLength - offset) + "\" bytes remain");
		var rPadding = paramBytes - rLength, sPadding = paramBytes - sLength;
		var dst = Buffer.allocUnsafe(rPadding + rLength + sPadding + sLength);
		for (offset = 0; offset < rPadding; ++offset) dst[offset] = 0;
		signature.copy(dst, offset, rOffset + Math.max(-rPadding, 0), rOffset + rLength);
		offset = paramBytes;
		for (var o = offset; offset < o + sPadding; ++offset) dst[offset] = 0;
		signature.copy(dst, offset, sOffset + Math.max(-sPadding, 0), sOffset + sLength);
		dst = dst.toString("base64");
		dst = base64Url(dst);
		return dst;
	}
	function countPadding(buf, start, stop) {
		var padding = 0;
		while (start + padding < stop && buf[start + padding] === 0) ++padding;
		if (buf[start + padding] >= MAX_OCTET) --padding;
		return padding;
	}
	function joseToDer(signature, alg) {
		signature = signatureAsBuffer(signature);
		var paramBytes = getParamBytesForAlg(alg);
		var signatureBytes = signature.length;
		if (signatureBytes !== paramBytes * 2) throw new TypeError("\"" + alg + "\" signatures must be \"" + paramBytes * 2 + "\" bytes, saw \"" + signatureBytes + "\"");
		var rPadding = countPadding(signature, 0, paramBytes);
		var sPadding = countPadding(signature, paramBytes, signature.length);
		var rLength = paramBytes - rPadding;
		var sLength = paramBytes - sPadding;
		var rsBytes = 2 + rLength + 1 + 1 + sLength;
		var shortLength = rsBytes < MAX_OCTET;
		var dst = Buffer.allocUnsafe((shortLength ? 2 : 3) + rsBytes);
		var offset = 0;
		dst[offset++] = ENCODED_TAG_SEQ;
		if (shortLength) dst[offset++] = rsBytes;
		else {
			dst[offset++] = MAX_OCTET | 1;
			dst[offset++] = rsBytes & 255;
		}
		dst[offset++] = ENCODED_TAG_INT;
		dst[offset++] = rLength;
		if (rPadding < 0) {
			dst[offset++] = 0;
			offset += signature.copy(dst, offset, 0, paramBytes);
		} else offset += signature.copy(dst, offset, rPadding, paramBytes);
		dst[offset++] = ENCODED_TAG_INT;
		dst[offset++] = sLength;
		if (sPadding < 0) {
			dst[offset++] = 0;
			signature.copy(dst, offset, paramBytes);
		} else signature.copy(dst, offset, paramBytes + sPadding);
		return dst;
	}
	module.exports = {
		derToJose,
		joseToDer
	};
}));
//#endregion
//#region node_modules/buffer-equal-constant-time/index.js
var require_buffer_equal_constant_time = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffer$2 = __require("buffer").Buffer;
	var SlowBuffer = __require("buffer").SlowBuffer;
	module.exports = bufferEq;
	function bufferEq(a, b) {
		if (!Buffer$2.isBuffer(a) || !Buffer$2.isBuffer(b)) return false;
		if (a.length !== b.length) return false;
		var c = 0;
		for (var i = 0; i < a.length; i++) c |= a[i] ^ b[i];
		return c === 0;
	}
	bufferEq.install = function() {
		Buffer$2.prototype.equal = SlowBuffer.prototype.equal = function equal(that) {
			return bufferEq(this, that);
		};
	};
	var origBufEqual = Buffer$2.prototype.equal;
	var origSlowBufEqual = SlowBuffer.prototype.equal;
	bufferEq.restore = function() {
		Buffer$2.prototype.equal = origBufEqual;
		SlowBuffer.prototype.equal = origSlowBufEqual;
	};
}));
//#endregion
//#region node_modules/jwa/index.js
var require_jwa = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffer = require_safe_buffer().Buffer;
	var crypto$1 = __require("crypto");
	var formatEcdsa = require_ecdsa_sig_formatter();
	var util$2 = __require("util");
	var MSG_INVALID_ALGORITHM = "\"%s\" is not a valid algorithm.\n  Supported algorithms are:\n  \"HS256\", \"HS384\", \"HS512\", \"RS256\", \"RS384\", \"RS512\", \"PS256\", \"PS384\", \"PS512\", \"ES256\", \"ES384\", \"ES512\" and \"none\".";
	var MSG_INVALID_SECRET = "secret must be a string or buffer";
	var MSG_INVALID_VERIFIER_KEY = "key must be a string or a buffer";
	var MSG_INVALID_SIGNER_KEY = "key must be a string, a buffer or an object";
	var supportsKeyObjects = typeof crypto$1.createPublicKey === "function";
	if (supportsKeyObjects) {
		MSG_INVALID_VERIFIER_KEY += " or a KeyObject";
		MSG_INVALID_SECRET += "or a KeyObject";
	}
	function checkIsPublicKey(key) {
		if (Buffer.isBuffer(key)) return;
		if (typeof key === "string") return;
		if (!supportsKeyObjects) throw typeError(MSG_INVALID_VERIFIER_KEY);
		if (typeof key !== "object") throw typeError(MSG_INVALID_VERIFIER_KEY);
		if (typeof key.type !== "string") throw typeError(MSG_INVALID_VERIFIER_KEY);
		if (typeof key.asymmetricKeyType !== "string") throw typeError(MSG_INVALID_VERIFIER_KEY);
		if (typeof key.export !== "function") throw typeError(MSG_INVALID_VERIFIER_KEY);
	}
	function checkIsPrivateKey(key) {
		if (Buffer.isBuffer(key)) return;
		if (typeof key === "string") return;
		if (typeof key === "object") return;
		throw typeError(MSG_INVALID_SIGNER_KEY);
	}
	function checkIsSecretKey(key) {
		if (Buffer.isBuffer(key)) return;
		if (typeof key === "string") return key;
		if (!supportsKeyObjects) throw typeError(MSG_INVALID_SECRET);
		if (typeof key !== "object") throw typeError(MSG_INVALID_SECRET);
		if (key.type !== "secret") throw typeError(MSG_INVALID_SECRET);
		if (typeof key.export !== "function") throw typeError(MSG_INVALID_SECRET);
	}
	function fromBase64(base64) {
		return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	}
	function toBase64(base64url) {
		base64url = base64url.toString();
		var padding = 4 - base64url.length % 4;
		if (padding !== 4) for (var i = 0; i < padding; ++i) base64url += "=";
		return base64url.replace(/\-/g, "+").replace(/_/g, "/");
	}
	function typeError(template) {
		var args = [].slice.call(arguments, 1);
		var errMsg = util$2.format.bind(util$2, template).apply(null, args);
		return new TypeError(errMsg);
	}
	function bufferOrString(obj) {
		return Buffer.isBuffer(obj) || typeof obj === "string";
	}
	function normalizeInput(thing) {
		if (!bufferOrString(thing)) thing = JSON.stringify(thing);
		return thing;
	}
	function createHmacSigner(bits) {
		return function sign(thing, secret) {
			checkIsSecretKey(secret);
			thing = normalizeInput(thing);
			var hmac = crypto$1.createHmac("sha" + bits, secret);
			return fromBase64((hmac.update(thing), hmac.digest("base64")));
		};
	}
	var bufferEqual;
	var timingSafeEqual = "timingSafeEqual" in crypto$1 ? function timingSafeEqual(a, b) {
		if (a.byteLength !== b.byteLength) return false;
		return crypto$1.timingSafeEqual(a, b);
	} : function timingSafeEqual(a, b) {
		if (!bufferEqual) bufferEqual = require_buffer_equal_constant_time();
		return bufferEqual(a, b);
	};
	function createHmacVerifier(bits) {
		return function verify(thing, signature, secret) {
			var computedSig = createHmacSigner(bits)(thing, secret);
			return timingSafeEqual(Buffer.from(signature), Buffer.from(computedSig));
		};
	}
	function createKeySigner(bits) {
		return function sign(thing, privateKey) {
			checkIsPrivateKey(privateKey);
			thing = normalizeInput(thing);
			var signer = crypto$1.createSign("RSA-SHA" + bits);
			return fromBase64((signer.update(thing), signer.sign(privateKey, "base64")));
		};
	}
	function createKeyVerifier(bits) {
		return function verify(thing, signature, publicKey) {
			checkIsPublicKey(publicKey);
			thing = normalizeInput(thing);
			signature = toBase64(signature);
			var verifier = crypto$1.createVerify("RSA-SHA" + bits);
			verifier.update(thing);
			return verifier.verify(publicKey, signature, "base64");
		};
	}
	function createPSSKeySigner(bits) {
		return function sign(thing, privateKey) {
			checkIsPrivateKey(privateKey);
			thing = normalizeInput(thing);
			var signer = crypto$1.createSign("RSA-SHA" + bits);
			return fromBase64((signer.update(thing), signer.sign({
				key: privateKey,
				padding: crypto$1.constants.RSA_PKCS1_PSS_PADDING,
				saltLength: crypto$1.constants.RSA_PSS_SALTLEN_DIGEST
			}, "base64")));
		};
	}
	function createPSSKeyVerifier(bits) {
		return function verify(thing, signature, publicKey) {
			checkIsPublicKey(publicKey);
			thing = normalizeInput(thing);
			signature = toBase64(signature);
			var verifier = crypto$1.createVerify("RSA-SHA" + bits);
			verifier.update(thing);
			return verifier.verify({
				key: publicKey,
				padding: crypto$1.constants.RSA_PKCS1_PSS_PADDING,
				saltLength: crypto$1.constants.RSA_PSS_SALTLEN_DIGEST
			}, signature, "base64");
		};
	}
	function createECDSASigner(bits) {
		var inner = createKeySigner(bits);
		return function sign() {
			var signature = inner.apply(null, arguments);
			signature = formatEcdsa.derToJose(signature, "ES" + bits);
			return signature;
		};
	}
	function createECDSAVerifer(bits) {
		var inner = createKeyVerifier(bits);
		return function verify(thing, signature, publicKey) {
			signature = formatEcdsa.joseToDer(signature, "ES" + bits).toString("base64");
			return inner(thing, signature, publicKey);
		};
	}
	function createNoneSigner() {
		return function sign() {
			return "";
		};
	}
	function createNoneVerifier() {
		return function verify(thing, signature) {
			return signature === "";
		};
	}
	module.exports = function jwa(algorithm) {
		var signerFactories = {
			hs: createHmacSigner,
			rs: createKeySigner,
			ps: createPSSKeySigner,
			es: createECDSASigner,
			none: createNoneSigner
		};
		var verifierFactories = {
			hs: createHmacVerifier,
			rs: createKeyVerifier,
			ps: createPSSKeyVerifier,
			es: createECDSAVerifer,
			none: createNoneVerifier
		};
		var match = algorithm.match(/^(RS|PS|ES|HS)(256|384|512)$|^(none)$/);
		if (!match) throw typeError(MSG_INVALID_ALGORITHM, algorithm);
		var algo = (match[1] || match[3]).toLowerCase();
		var bits = match[2];
		return {
			sign: signerFactories[algo](bits),
			verify: verifierFactories[algo](bits)
		};
	};
}));
//#endregion
//#region node_modules/jws/lib/tostring.js
var require_tostring = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffer$1 = __require("buffer").Buffer;
	module.exports = function toString(obj) {
		if (typeof obj === "string") return obj;
		if (typeof obj === "number" || Buffer$1.isBuffer(obj)) return obj.toString();
		return JSON.stringify(obj);
	};
}));
//#endregion
//#region node_modules/jws/lib/sign-stream.js
var require_sign_stream = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffer = require_safe_buffer().Buffer;
	var DataStream = require_data_stream();
	var jwa = require_jwa();
	var Stream$1 = __require("stream");
	var toString = require_tostring();
	var util$1 = __require("util");
	function base64url(string, encoding) {
		return Buffer.from(string, encoding).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	}
	function jwsSecuredInput(header, payload, encoding) {
		encoding = encoding || "utf8";
		var encodedHeader = base64url(toString(header), "binary");
		var encodedPayload = base64url(toString(payload), encoding);
		return util$1.format("%s.%s", encodedHeader, encodedPayload);
	}
	function jwsSign(opts) {
		var header = opts.header;
		var payload = opts.payload;
		var secretOrKey = opts.secret || opts.privateKey;
		var encoding = opts.encoding;
		var algo = jwa(header.alg);
		var securedInput = jwsSecuredInput(header, payload, encoding);
		var signature = algo.sign(securedInput, secretOrKey);
		return util$1.format("%s.%s", securedInput, signature);
	}
	function SignStream(opts) {
		var secret = opts.secret;
		secret = secret == null ? opts.privateKey : secret;
		secret = secret == null ? opts.key : secret;
		if (/^hs/i.test(opts.header.alg) === true && secret == null) throw new TypeError("secret must be a string or buffer or a KeyObject");
		var secretStream = new DataStream(secret);
		this.readable = true;
		this.header = opts.header;
		this.encoding = opts.encoding;
		this.secret = this.privateKey = this.key = secretStream;
		this.payload = new DataStream(opts.payload);
		this.secret.once("close", function() {
			if (!this.payload.writable && this.readable) this.sign();
		}.bind(this));
		this.payload.once("close", function() {
			if (!this.secret.writable && this.readable) this.sign();
		}.bind(this));
	}
	util$1.inherits(SignStream, Stream$1);
	SignStream.prototype.sign = function sign() {
		try {
			var signature = jwsSign({
				header: this.header,
				payload: this.payload.buffer,
				secret: this.secret.buffer,
				encoding: this.encoding
			});
			this.emit("done", signature);
			this.emit("data", signature);
			this.emit("end");
			this.readable = false;
			return signature;
		} catch (e) {
			this.readable = false;
			this.emit("error", e);
			this.emit("close");
		}
	};
	SignStream.sign = jwsSign;
	module.exports = SignStream;
}));
//#endregion
//#region node_modules/jws/lib/verify-stream.js
var require_verify_stream = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffer = require_safe_buffer().Buffer;
	var DataStream = require_data_stream();
	var jwa = require_jwa();
	var Stream = __require("stream");
	var toString = require_tostring();
	var util = __require("util");
	var JWS_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/;
	function isObject(thing) {
		return Object.prototype.toString.call(thing) === "[object Object]";
	}
	function safeJsonParse(thing) {
		if (isObject(thing)) return thing;
		try {
			return JSON.parse(thing);
		} catch (e) {
			return;
		}
	}
	function headerFromJWS(jwsSig) {
		var encodedHeader = jwsSig.split(".", 1)[0];
		return safeJsonParse(Buffer.from(encodedHeader, "base64").toString("binary"));
	}
	function securedInputFromJWS(jwsSig) {
		return jwsSig.split(".", 2).join(".");
	}
	function signatureFromJWS(jwsSig) {
		return jwsSig.split(".")[2];
	}
	function payloadFromJWS(jwsSig, encoding) {
		encoding = encoding || "utf8";
		var payload = jwsSig.split(".")[1];
		return Buffer.from(payload, "base64").toString(encoding);
	}
	function isValidJws(string) {
		return JWS_REGEX.test(string) && !!headerFromJWS(string);
	}
	function jwsVerify(jwsSig, algorithm, secretOrKey) {
		if (!algorithm) {
			var err = /* @__PURE__ */ new Error("Missing algorithm parameter for jws.verify");
			err.code = "MISSING_ALGORITHM";
			throw err;
		}
		jwsSig = toString(jwsSig);
		var signature = signatureFromJWS(jwsSig);
		var securedInput = securedInputFromJWS(jwsSig);
		return jwa(algorithm).verify(securedInput, signature, secretOrKey);
	}
	function jwsDecode(jwsSig, opts) {
		opts = opts || {};
		jwsSig = toString(jwsSig);
		if (!isValidJws(jwsSig)) return null;
		var header = headerFromJWS(jwsSig);
		if (!header) return null;
		var payload = payloadFromJWS(jwsSig);
		if (header.typ === "JWT" || opts.json) payload = JSON.parse(payload, opts.encoding);
		return {
			header,
			payload,
			signature: signatureFromJWS(jwsSig)
		};
	}
	function VerifyStream(opts) {
		opts = opts || {};
		var secretOrKey = opts.secret;
		secretOrKey = secretOrKey == null ? opts.publicKey : secretOrKey;
		secretOrKey = secretOrKey == null ? opts.key : secretOrKey;
		if (/^hs/i.test(opts.algorithm) === true && secretOrKey == null) throw new TypeError("secret must be a string or buffer or a KeyObject");
		var secretStream = new DataStream(secretOrKey);
		this.readable = true;
		this.algorithm = opts.algorithm;
		this.encoding = opts.encoding;
		this.secret = this.publicKey = this.key = secretStream;
		this.signature = new DataStream(opts.signature);
		this.secret.once("close", function() {
			if (!this.signature.writable && this.readable) this.verify();
		}.bind(this));
		this.signature.once("close", function() {
			if (!this.secret.writable && this.readable) this.verify();
		}.bind(this));
	}
	util.inherits(VerifyStream, Stream);
	VerifyStream.prototype.verify = function verify() {
		try {
			var valid = jwsVerify(this.signature.buffer, this.algorithm, this.key.buffer);
			var obj = jwsDecode(this.signature.buffer, this.encoding);
			this.emit("done", valid, obj);
			this.emit("data", valid);
			this.emit("end");
			this.readable = false;
			return valid;
		} catch (e) {
			this.readable = false;
			this.emit("error", e);
			this.emit("close");
		}
	};
	VerifyStream.decode = jwsDecode;
	VerifyStream.isValid = isValidJws;
	VerifyStream.verify = jwsVerify;
	module.exports = VerifyStream;
}));
//#endregion
//#region node_modules/jws/index.js
var require_jws = /* @__PURE__ */ __commonJSMin(((exports) => {
	var SignStream = require_sign_stream();
	var VerifyStream = require_verify_stream();
	exports.ALGORITHMS = [
		"HS256",
		"HS384",
		"HS512",
		"RS256",
		"RS384",
		"RS512",
		"PS256",
		"PS384",
		"PS512",
		"ES256",
		"ES384",
		"ES512"
	];
	exports.sign = SignStream.sign;
	exports.verify = VerifyStream.verify;
	exports.decode = VerifyStream.decode;
	exports.isValid = VerifyStream.isValid;
	exports.createSign = function createSign(opts) {
		return new SignStream(opts);
	};
	exports.createVerify = function createVerify(opts) {
		return new VerifyStream(opts);
	};
}));
//#endregion
//#region node_modules/jsonwebtoken/decode.js
var require_decode = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var jws = require_jws();
	module.exports = function(jwt, options) {
		options = options || {};
		var decoded = jws.decode(jwt, options);
		if (!decoded) return null;
		var payload = decoded.payload;
		if (typeof payload === "string") try {
			var obj = JSON.parse(payload);
			if (obj !== null && typeof obj === "object") payload = obj;
		} catch (e) {}
		if (options.complete === true) return {
			header: decoded.header,
			payload,
			signature: decoded.signature
		};
		return payload;
	};
}));
//#endregion
//#region node_modules/jsonwebtoken/lib/JsonWebTokenError.js
var require_JsonWebTokenError = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var JsonWebTokenError = function(message, error) {
		Error.call(this, message);
		if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
		this.name = "JsonWebTokenError";
		this.message = message;
		if (error) this.inner = error;
	};
	JsonWebTokenError.prototype = Object.create(Error.prototype);
	JsonWebTokenError.prototype.constructor = JsonWebTokenError;
	module.exports = JsonWebTokenError;
}));
//#endregion
//#region node_modules/jsonwebtoken/lib/NotBeforeError.js
var require_NotBeforeError = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var JsonWebTokenError = require_JsonWebTokenError();
	var NotBeforeError = function(message, date) {
		JsonWebTokenError.call(this, message);
		this.name = "NotBeforeError";
		this.date = date;
	};
	NotBeforeError.prototype = Object.create(JsonWebTokenError.prototype);
	NotBeforeError.prototype.constructor = NotBeforeError;
	module.exports = NotBeforeError;
}));
//#endregion
//#region node_modules/jsonwebtoken/lib/TokenExpiredError.js
var require_TokenExpiredError = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var JsonWebTokenError = require_JsonWebTokenError();
	var TokenExpiredError = function(message, expiredAt) {
		JsonWebTokenError.call(this, message);
		this.name = "TokenExpiredError";
		this.expiredAt = expiredAt;
	};
	TokenExpiredError.prototype = Object.create(JsonWebTokenError.prototype);
	TokenExpiredError.prototype.constructor = TokenExpiredError;
	module.exports = TokenExpiredError;
}));
//#endregion
//#region node_modules/ms/index.js
var require_ms = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Helpers.
	*/
	var s = 1e3;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var w = d * 7;
	var y = d * 365.25;
	/**
	* Parse or format the given `val`.
	*
	* Options:
	*
	*  - `long` verbose formatting [false]
	*
	* @param {String|Number} val
	* @param {Object} [options]
	* @throws {Error} throw an error if val is not a non-empty string or a number
	* @return {String|Number}
	* @api public
	*/
	module.exports = function(val, options) {
		options = options || {};
		var type = typeof val;
		if (type === "string" && val.length > 0) return parse(val);
		else if (type === "number" && isFinite(val)) return options.long ? fmtLong(val) : fmtShort(val);
		throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
	};
	/**
	* Parse the given `str` and return milliseconds.
	*
	* @param {String} str
	* @return {Number}
	* @api private
	*/
	function parse(str) {
		str = String(str);
		if (str.length > 100) return;
		var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
		if (!match) return;
		var n = parseFloat(match[1]);
		switch ((match[2] || "ms").toLowerCase()) {
			case "years":
			case "year":
			case "yrs":
			case "yr":
			case "y": return n * y;
			case "weeks":
			case "week":
			case "w": return n * w;
			case "days":
			case "day":
			case "d": return n * d;
			case "hours":
			case "hour":
			case "hrs":
			case "hr":
			case "h": return n * h;
			case "minutes":
			case "minute":
			case "mins":
			case "min":
			case "m": return n * m;
			case "seconds":
			case "second":
			case "secs":
			case "sec":
			case "s": return n * s;
			case "milliseconds":
			case "millisecond":
			case "msecs":
			case "msec":
			case "ms": return n;
			default: return;
		}
	}
	/**
	* Short format for `ms`.
	*
	* @param {Number} ms
	* @return {String}
	* @api private
	*/
	function fmtShort(ms) {
		var msAbs = Math.abs(ms);
		if (msAbs >= d) return Math.round(ms / d) + "d";
		if (msAbs >= h) return Math.round(ms / h) + "h";
		if (msAbs >= m) return Math.round(ms / m) + "m";
		if (msAbs >= s) return Math.round(ms / s) + "s";
		return ms + "ms";
	}
	/**
	* Long format for `ms`.
	*
	* @param {Number} ms
	* @return {String}
	* @api private
	*/
	function fmtLong(ms) {
		var msAbs = Math.abs(ms);
		if (msAbs >= d) return plural(ms, msAbs, d, "day");
		if (msAbs >= h) return plural(ms, msAbs, h, "hour");
		if (msAbs >= m) return plural(ms, msAbs, m, "minute");
		if (msAbs >= s) return plural(ms, msAbs, s, "second");
		return ms + " ms";
	}
	/**
	* Pluralization helper.
	*/
	function plural(ms, msAbs, n, name) {
		var isPlural = msAbs >= n * 1.5;
		return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
	}
}));
//#endregion
//#region node_modules/jsonwebtoken/lib/timespan.js
var require_timespan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ms = require_ms();
	module.exports = function(time, iat) {
		var timestamp = iat || Math.floor(Date.now() / 1e3);
		if (typeof time === "string") {
			var milliseconds = ms(time);
			if (typeof milliseconds === "undefined") return;
			return Math.floor(timestamp + milliseconds / 1e3);
		} else if (typeof time === "number") return timestamp + time;
		else return;
	};
}));
//#endregion
//#region node_modules/semver/internal/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SEMVER_SPEC_VERSION = "2.0.0";
	var MAX_LENGTH = 256;
	var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
	module.exports = {
		MAX_LENGTH,
		MAX_SAFE_COMPONENT_LENGTH: 16,
		MAX_SAFE_BUILD_LENGTH: MAX_LENGTH - 6,
		MAX_SAFE_INTEGER,
		RELEASE_TYPES: [
			"major",
			"premajor",
			"minor",
			"preminor",
			"patch",
			"prepatch",
			"prerelease"
		],
		SEMVER_SPEC_VERSION,
		FLAG_INCLUDE_PRERELEASE: 1,
		FLAG_LOOSE: 2
	};
}));
//#endregion
//#region node_modules/semver/internal/debug.js
var require_debug = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {};
}));
//#endregion
//#region node_modules/semver/internal/re.js
var require_re = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { MAX_SAFE_COMPONENT_LENGTH, MAX_SAFE_BUILD_LENGTH, MAX_LENGTH } = require_constants();
	var debug = require_debug();
	exports = module.exports = {};
	var re = exports.re = [];
	var safeRe = exports.safeRe = [];
	var src = exports.src = [];
	var safeSrc = exports.safeSrc = [];
	var t = exports.t = {};
	var R = 0;
	var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
	var safeRegexReplacements = [
		["\\s", 1],
		["\\d", MAX_LENGTH],
		[LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
	];
	var makeSafeRegex = (value) => {
		for (const [token, max] of safeRegexReplacements) value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
		return value;
	};
	var createToken = (name, value, isGlobal) => {
		const safe = makeSafeRegex(value);
		const index = R++;
		debug(name, index, value);
		t[name] = index;
		src[index] = value;
		safeSrc[index] = safe;
		re[index] = new RegExp(value, isGlobal ? "g" : void 0);
		safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
	};
	createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
	createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
	createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
	createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
	createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
	createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
	createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
	createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
	createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
	createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
	createToken("FULL", `^${src[t.FULLPLAIN]}$`);
	createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
	createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
	createToken("GTLT", "((?:<|>)?=?)");
	createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
	createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
	createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
	createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COERCEPLAIN", `(^|[^\\d])(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
	createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
	createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
	createToken("COERCERTL", src[t.COERCE], true);
	createToken("COERCERTLFULL", src[t.COERCEFULL], true);
	createToken("LONETILDE", "(?:~>?)");
	createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
	exports.tildeTrimReplace = "$1~";
	createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
	createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("LONECARET", "(?:\\^)");
	createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
	exports.caretTrimReplace = "$1^";
	createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
	createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
	createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
	createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
	exports.comparatorTrimReplace = "$1$2$3";
	createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
	createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
	createToken("STAR", "(<|>)?=?\\s*\\*");
	createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
	createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
}));
//#endregion
//#region node_modules/semver/internal/parse-options.js
var require_parse_options = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var looseOption = Object.freeze({ loose: true });
	var emptyOpts = Object.freeze({});
	var parseOptions = (options) => {
		if (!options) return emptyOpts;
		if (typeof options !== "object") return looseOption;
		return options;
	};
	module.exports = parseOptions;
}));
//#endregion
//#region node_modules/semver/internal/identifiers.js
var require_identifiers = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var numeric = /^[0-9]+$/;
	var compareIdentifiers = (a, b) => {
		if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
		const anum = numeric.test(a);
		const bnum = numeric.test(b);
		if (anum && bnum) {
			a = +a;
			b = +b;
		}
		return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
	};
	var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
	module.exports = {
		compareIdentifiers,
		rcompareIdentifiers
	};
}));
//#endregion
//#region node_modules/semver/classes/semver.js
var require_semver$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var debug = require_debug();
	var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
	var { safeRe: re, t } = require_re();
	var parseOptions = require_parse_options();
	var { compareIdentifiers } = require_identifiers();
	var isPrereleaseIdentifier = (prerelease, identifier) => {
		const identifiers = identifier.split(".");
		if (identifiers.length > prerelease.length) return false;
		for (let i = 0; i < identifiers.length; i++) if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) return false;
		return true;
	};
	module.exports = class SemVer {
		constructor(version, options) {
			options = parseOptions(options);
			if (version instanceof SemVer) if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) return version;
			else version = version.version;
			else if (typeof version !== "string") throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
			if (version.length > MAX_LENGTH) throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
			debug("SemVer", version, options);
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
			if (!m) throw new TypeError(`Invalid Version: ${version}`);
			this.raw = version;
			this.major = +m[1];
			this.minor = +m[2];
			this.patch = +m[3];
			if (this.major > MAX_SAFE_INTEGER || this.major < 0) throw new TypeError("Invalid major version");
			if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) throw new TypeError("Invalid minor version");
			if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) throw new TypeError("Invalid patch version");
			if (!m[4]) this.prerelease = [];
			else this.prerelease = m[4].split(".").map((id) => {
				if (/^[0-9]+$/.test(id)) {
					const num = +id;
					if (num >= 0 && num < MAX_SAFE_INTEGER) return num;
				}
				return id;
			});
			this.build = m[5] ? m[5].split(".") : [];
			this.format();
		}
		format() {
			this.version = `${this.major}.${this.minor}.${this.patch}`;
			if (this.prerelease.length) this.version += `-${this.prerelease.join(".")}`;
			return this.version;
		}
		toString() {
			return this.version;
		}
		compare(other) {
			debug("SemVer.compare", this.version, this.options, other);
			if (!(other instanceof SemVer)) {
				if (typeof other === "string" && other === this.version) return 0;
				other = new SemVer(other, this.options);
			}
			if (other.version === this.version) return 0;
			return this.compareMain(other) || this.comparePre(other);
		}
		compareMain(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.major < other.major) return -1;
			if (this.major > other.major) return 1;
			if (this.minor < other.minor) return -1;
			if (this.minor > other.minor) return 1;
			if (this.patch < other.patch) return -1;
			if (this.patch > other.patch) return 1;
			return 0;
		}
		comparePre(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.prerelease.length && !other.prerelease.length) return -1;
			else if (!this.prerelease.length && other.prerelease.length) return 1;
			else if (!this.prerelease.length && !other.prerelease.length) return 0;
			let i = 0;
			do {
				const a = this.prerelease[i];
				const b = other.prerelease[i];
				debug("prerelease compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		compareBuild(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			let i = 0;
			do {
				const a = this.build[i];
				const b = other.build[i];
				debug("build compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		inc(release, identifier, identifierBase) {
			if (release.startsWith("pre")) {
				if (!identifier && identifierBase === false) throw new Error("invalid increment argument: identifier is empty");
				if (identifier) {
					const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
					if (!match || match[1] !== identifier) throw new Error(`invalid identifier: ${identifier}`);
				}
			}
			switch (release) {
				case "premajor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor = 0;
					this.major++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "preminor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "prepatch":
					this.prerelease.length = 0;
					this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "prerelease":
					if (this.prerelease.length === 0) this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "release":
					if (this.prerelease.length === 0) throw new Error(`version ${this.raw} is not a prerelease`);
					this.prerelease.length = 0;
					break;
				case "major":
					if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) this.major++;
					this.minor = 0;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "minor":
					if (this.patch !== 0 || this.prerelease.length === 0) this.minor++;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "patch":
					if (this.prerelease.length === 0) this.patch++;
					this.prerelease = [];
					break;
				case "pre": {
					const base = Number(identifierBase) ? 1 : 0;
					if (this.prerelease.length === 0) this.prerelease = [base];
					else {
						let i = this.prerelease.length;
						while (--i >= 0) if (typeof this.prerelease[i] === "number") {
							this.prerelease[i]++;
							i = -2;
						}
						if (i === -1) {
							if (identifier === this.prerelease.join(".") && identifierBase === false) throw new Error("invalid increment argument: identifier already exists");
							this.prerelease.push(base);
						}
					}
					if (identifier) {
						let prerelease = [identifier, base];
						if (identifierBase === false) prerelease = [identifier];
						if (isPrereleaseIdentifier(this.prerelease, identifier)) {
							const prereleaseBase = this.prerelease[identifier.split(".").length];
							if (isNaN(prereleaseBase)) this.prerelease = prerelease;
						} else this.prerelease = prerelease;
					}
					break;
				}
				default: throw new Error(`invalid increment argument: ${release}`);
			}
			this.raw = this.format();
			if (this.build.length) this.raw += `+${this.build.join(".")}`;
			return this;
		}
	};
}));
//#endregion
//#region node_modules/semver/functions/parse.js
var require_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var parse = (version, options, throwErrors = false) => {
		if (version instanceof SemVer) return version;
		try {
			return new SemVer(version, options);
		} catch (er) {
			if (!throwErrors) return null;
			throw er;
		}
	};
	module.exports = parse;
}));
//#endregion
//#region node_modules/semver/functions/valid.js
var require_valid$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var valid = (version, options) => {
		const v = parse(version, options);
		return v ? v.version : null;
	};
	module.exports = valid;
}));
//#endregion
//#region node_modules/semver/functions/clean.js
var require_clean = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var clean = (version, options) => {
		const s = parse(version.trim().replace(/^[=v]+/, ""), options);
		return s ? s.version : null;
	};
	module.exports = clean;
}));
//#endregion
//#region node_modules/semver/functions/inc.js
var require_inc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var inc = (version, release, options, identifier, identifierBase) => {
		if (typeof options === "string") {
			identifierBase = identifier;
			identifier = options;
			options = void 0;
		}
		try {
			return new SemVer(version instanceof SemVer ? version.version : version, options).inc(release, identifier, identifierBase).version;
		} catch (er) {
			return null;
		}
	};
	module.exports = inc;
}));
//#endregion
//#region node_modules/semver/functions/diff.js
var require_diff = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var diff = (version1, version2) => {
		const v1 = parse(version1, null, true);
		const v2 = parse(version2, null, true);
		const comparison = v1.compare(v2);
		if (comparison === 0) return null;
		const v1Higher = comparison > 0;
		const highVersion = v1Higher ? v1 : v2;
		const lowVersion = v1Higher ? v2 : v1;
		const highHasPre = !!highVersion.prerelease.length;
		if (!!lowVersion.prerelease.length && !highHasPre) {
			if (!lowVersion.patch && !lowVersion.minor) return "major";
			if (lowVersion.compareMain(highVersion) === 0) {
				if (lowVersion.minor && !lowVersion.patch) return "minor";
				return "patch";
			}
		}
		const prefix = highHasPre ? "pre" : "";
		if (v1.major !== v2.major) return prefix + "major";
		if (v1.minor !== v2.minor) return prefix + "minor";
		if (v1.patch !== v2.patch) return prefix + "patch";
		return "prerelease";
	};
	module.exports = diff;
}));
//#endregion
//#region node_modules/semver/functions/major.js
var require_major = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var major = (a, loose) => new SemVer(a, loose).major;
	module.exports = major;
}));
//#endregion
//#region node_modules/semver/functions/minor.js
var require_minor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var minor = (a, loose) => new SemVer(a, loose).minor;
	module.exports = minor;
}));
//#endregion
//#region node_modules/semver/functions/patch.js
var require_patch = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var patch = (a, loose) => new SemVer(a, loose).patch;
	module.exports = patch;
}));
//#endregion
//#region node_modules/semver/functions/prerelease.js
var require_prerelease = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var prerelease = (version, options) => {
		const parsed = parse(version, options);
		return parsed && parsed.prerelease.length ? parsed.prerelease : null;
	};
	module.exports = prerelease;
}));
//#endregion
//#region node_modules/semver/functions/compare.js
var require_compare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
	module.exports = compare;
}));
//#endregion
//#region node_modules/semver/functions/rcompare.js
var require_rcompare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var rcompare = (a, b, loose) => compare(b, a, loose);
	module.exports = rcompare;
}));
//#endregion
//#region node_modules/semver/functions/compare-loose.js
var require_compare_loose = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var compareLoose = (a, b) => compare(a, b, true);
	module.exports = compareLoose;
}));
//#endregion
//#region node_modules/semver/functions/compare-build.js
var require_compare_build = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var compareBuild = (a, b, loose) => {
		const versionA = new SemVer(a, loose);
		const versionB = new SemVer(b, loose);
		return versionA.compare(versionB) || versionA.compareBuild(versionB);
	};
	module.exports = compareBuild;
}));
//#endregion
//#region node_modules/semver/functions/sort.js
var require_sort = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compareBuild = require_compare_build();
	var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
	module.exports = sort;
}));
//#endregion
//#region node_modules/semver/functions/rsort.js
var require_rsort = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compareBuild = require_compare_build();
	var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
	module.exports = rsort;
}));
//#endregion
//#region node_modules/semver/functions/gt.js
var require_gt = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var gt = (a, b, loose) => compare(a, b, loose) > 0;
	module.exports = gt;
}));
//#endregion
//#region node_modules/semver/functions/lt.js
var require_lt = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var lt = (a, b, loose) => compare(a, b, loose) < 0;
	module.exports = lt;
}));
//#endregion
//#region node_modules/semver/functions/eq.js
var require_eq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var eq = (a, b, loose) => compare(a, b, loose) === 0;
	module.exports = eq;
}));
//#endregion
//#region node_modules/semver/functions/neq.js
var require_neq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var neq = (a, b, loose) => compare(a, b, loose) !== 0;
	module.exports = neq;
}));
//#endregion
//#region node_modules/semver/functions/gte.js
var require_gte = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var gte = (a, b, loose) => compare(a, b, loose) >= 0;
	module.exports = gte;
}));
//#endregion
//#region node_modules/semver/functions/lte.js
var require_lte = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var lte = (a, b, loose) => compare(a, b, loose) <= 0;
	module.exports = lte;
}));
//#endregion
//#region node_modules/semver/functions/cmp.js
var require_cmp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var eq = require_eq();
	var neq = require_neq();
	var gt = require_gt();
	var gte = require_gte();
	var lt = require_lt();
	var lte = require_lte();
	var cmp = (a, op, b, loose) => {
		switch (op) {
			case "===":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a === b;
			case "!==":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a !== b;
			case "":
			case "=":
			case "==": return eq(a, b, loose);
			case "!=": return neq(a, b, loose);
			case ">": return gt(a, b, loose);
			case ">=": return gte(a, b, loose);
			case "<": return lt(a, b, loose);
			case "<=": return lte(a, b, loose);
			default: throw new TypeError(`Invalid operator: ${op}`);
		}
	};
	module.exports = cmp;
}));
//#endregion
//#region node_modules/semver/functions/coerce.js
var require_coerce = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var parse = require_parse();
	var { safeRe: re, t } = require_re();
	var coerce = (version, options) => {
		if (version instanceof SemVer) return version;
		if (typeof version === "number") version = String(version);
		if (typeof version !== "string") return null;
		options = options || {};
		let match = null;
		if (!options.rtl) match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
		else {
			const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
			let next;
			while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
				if (!match || next.index + next[0].length !== match.index + match[0].length) match = next;
				coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
			}
			coerceRtlRegex.lastIndex = -1;
		}
		if (match === null) return null;
		const major = match[2];
		return parse(`${major}.${match[3] || "0"}.${match[4] || "0"}${options.includePrerelease && match[5] ? `-${match[5]}` : ""}${options.includePrerelease && match[6] ? `+${match[6]}` : ""}`, options);
	};
	module.exports = coerce;
}));
//#endregion
//#region node_modules/semver/functions/truncate.js
var require_truncate = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var constants = require_constants();
	var SemVer = require_semver$1();
	var truncate = (version, truncation, options) => {
		if (!constants.RELEASE_TYPES.includes(truncation)) return null;
		const clonedVersion = cloneInputVersion(version, options);
		return clonedVersion && doTruncation(clonedVersion, truncation);
	};
	var cloneInputVersion = (version, options) => {
		return parse(version instanceof SemVer ? version.version : version, options);
	};
	var doTruncation = (version, truncation) => {
		if (isPrerelease(truncation)) return version.version;
		version.prerelease = [];
		switch (truncation) {
			case "major":
				version.minor = 0;
				version.patch = 0;
				break;
			case "minor":
				version.patch = 0;
				break;
		}
		return version.format();
	};
	var isPrerelease = (type) => {
		return type.startsWith("pre");
	};
	module.exports = truncate;
}));
//#endregion
//#region node_modules/semver/internal/lrucache.js
var require_lrucache = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var LRUCache = class {
		constructor() {
			this.max = 1e3;
			this.map = /* @__PURE__ */ new Map();
		}
		get(key) {
			const value = this.map.get(key);
			if (value === void 0) return;
			else {
				this.map.delete(key);
				this.map.set(key, value);
				return value;
			}
		}
		delete(key) {
			return this.map.delete(key);
		}
		set(key, value) {
			if (!this.delete(key) && value !== void 0) {
				if (this.map.size >= this.max) {
					const firstKey = this.map.keys().next().value;
					this.delete(firstKey);
				}
				this.map.set(key, value);
			}
			return this;
		}
	};
	module.exports = LRUCache;
}));
//#endregion
//#region node_modules/semver/classes/range.js
var require_range = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SPACE_CHARACTERS = /\s+/g;
	module.exports = class Range {
		constructor(range, options) {
			options = parseOptions(options);
			if (range instanceof Range) if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) return range;
			else return new Range(range.raw, options);
			if (range instanceof Comparator) {
				this.raw = range.value;
				this.set = [[range]];
				this.formatted = void 0;
				return this;
			}
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
			this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
			if (!this.set.length) throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
			if (this.set.length > 1) {
				const first = this.set[0];
				this.set = this.set.filter((c) => !isNullSet(c[0]));
				if (this.set.length === 0) this.set = [first];
				else if (this.set.length > 1) {
					for (const c of this.set) if (c.length === 1 && isAny(c[0])) {
						this.set = [c];
						break;
					}
				}
			}
			this.formatted = void 0;
		}
		get range() {
			if (this.formatted === void 0) {
				this.formatted = "";
				for (let i = 0; i < this.set.length; i++) {
					if (i > 0) this.formatted += "||";
					const comps = this.set[i];
					for (let k = 0; k < comps.length; k++) {
						if (k > 0) this.formatted += " ";
						this.formatted += comps[k].toString().trim();
					}
				}
			}
			return this.formatted;
		}
		format() {
			return this.range;
		}
		toString() {
			return this.range;
		}
		parseRange(range) {
			range = range.replace(BUILDSTRIPRE, "");
			const memoKey = ((this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE)) + ":" + range;
			const cached = cache.get(memoKey);
			if (cached) return cached;
			const loose = this.options.loose;
			const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
			range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
			debug("hyphen replace", range);
			range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
			debug("comparator trim", range);
			range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
			debug("tilde trim", range);
			range = range.replace(re[t.CARETTRIM], caretTrimReplace);
			debug("caret trim", range);
			let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
			if (loose) rangeList = rangeList.filter((comp) => {
				debug("loose invalid filter", comp, this.options);
				return !!comp.match(re[t.COMPARATORLOOSE]);
			});
			debug("range list", rangeList);
			const rangeMap = /* @__PURE__ */ new Map();
			const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
			for (const comp of comparators) {
				if (isNullSet(comp)) return [comp];
				rangeMap.set(comp.value, comp);
			}
			if (rangeMap.size > 1 && rangeMap.has("")) rangeMap.delete("");
			const result = [...rangeMap.values()];
			cache.set(memoKey, result);
			return result;
		}
		intersects(range, options) {
			if (!(range instanceof Range)) throw new TypeError("a Range is required");
			return this.set.some((thisComparators) => {
				return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
					return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
						return rangeComparators.every((rangeComparator) => {
							return thisComparator.intersects(rangeComparator, options);
						});
					});
				});
			});
		}
		test(version) {
			if (!version) return false;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			for (let i = 0; i < this.set.length; i++) if (testSet(this.set[i], version, this.options)) return true;
			return false;
		}
	};
	var cache = new (require_lrucache())();
	var parseOptions = require_parse_options();
	var Comparator = require_comparator();
	var debug = require_debug();
	var SemVer = require_semver$1();
	var { safeRe: re, src, t, comparatorTrimReplace, tildeTrimReplace, caretTrimReplace } = require_re();
	var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
	var BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
	var isNullSet = (c) => c.value === "<0.0.0-0";
	var isAny = (c) => c.value === "";
	var isSatisfiable = (comparators, options) => {
		let result = true;
		const remainingComparators = comparators.slice();
		let testComparator = remainingComparators.pop();
		while (result && remainingComparators.length) {
			result = remainingComparators.every((otherComparator) => {
				return testComparator.intersects(otherComparator, options);
			});
			testComparator = remainingComparators.pop();
		}
		return result;
	};
	var parseComparator = (comp, options) => {
		comp = comp.replace(re[t.BUILD], "");
		debug("comp", comp, options);
		comp = replaceCarets(comp, options);
		debug("caret", comp);
		comp = replaceTildes(comp, options);
		debug("tildes", comp);
		comp = replaceXRanges(comp, options);
		debug("xrange", comp);
		comp = replaceStars(comp, options);
		debug("stars", comp);
		return comp;
	};
	var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
	var replaceTildes = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
	};
	var replaceTilde = (comp, options) => {
		const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("tilde", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
			else if (isX(p)) ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
			else if (pr) {
				debug("replaceTilde pr", pr);
				ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
			} else ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
			debug("tilde return", ret);
			return ret;
		});
	};
	var replaceCarets = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
	};
	var replaceCaret = (comp, options) => {
		debug("caret", comp, options);
		const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
		const z = options.includePrerelease ? "-0" : "";
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("caret", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
			else if (isX(p)) if (M === "0") ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
			else ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
			else if (pr) {
				debug("replaceCaret pr", pr);
				if (M === "0") if (m === "0") ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
				else ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
			} else {
				debug("no pr");
				if (M === "0") if (m === "0") ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
				else ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
			}
			debug("caret return", ret);
			return ret;
		});
	};
	var replaceXRanges = (comp, options) => {
		debug("replaceXRanges", comp, options);
		return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
	};
	var replaceXRange = (comp, options) => {
		comp = comp.trim();
		const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
		return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
			debug("xRange", comp, ret, gtlt, M, m, p, pr);
			const xM = isX(M);
			const xm = xM || isX(m);
			const xp = xm || isX(p);
			const anyX = xp;
			if (gtlt === "=" && anyX) gtlt = "";
			pr = options.includePrerelease ? "-0" : "";
			if (xM) if (gtlt === ">" || gtlt === "<") ret = "<0.0.0-0";
			else ret = "*";
			else if (gtlt && anyX) {
				if (xm) m = 0;
				p = 0;
				if (gtlt === ">") {
					gtlt = ">=";
					if (xm) {
						M = +M + 1;
						m = 0;
						p = 0;
					} else {
						m = +m + 1;
						p = 0;
					}
				} else if (gtlt === "<=") {
					gtlt = "<";
					if (xm) M = +M + 1;
					else m = +m + 1;
				}
				if (gtlt === "<") pr = "-0";
				ret = `${gtlt + M}.${m}.${p}${pr}`;
			} else if (xm) ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
			else if (xp) ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
			debug("xRange return", ret);
			return ret;
		});
	};
	var replaceStars = (comp, options) => {
		debug("replaceStars", comp, options);
		return comp.trim().replace(re[t.STAR], "");
	};
	var replaceGTE0 = (comp, options) => {
		debug("replaceGTE0", comp, options);
		return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
	};
	var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
		if (isX(fM)) from = "";
		else if (isX(fm)) from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
		else if (isX(fp)) from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
		else if (fpr) from = `>=${from}`;
		else from = `>=${from}${incPr ? "-0" : ""}`;
		if (isX(tM)) to = "";
		else if (isX(tm)) to = `<${+tM + 1}.0.0-0`;
		else if (isX(tp)) to = `<${tM}.${+tm + 1}.0-0`;
		else if (tpr) to = `<=${tM}.${tm}.${tp}-${tpr}`;
		else if (incPr) to = `<${tM}.${tm}.${+tp + 1}-0`;
		else to = `<=${to}`;
		return `${from} ${to}`.trim();
	};
	var testSet = (set, version, options) => {
		for (let i = 0; i < set.length; i++) if (!set[i].test(version)) return false;
		if (version.prerelease.length && !options.includePrerelease) {
			for (let i = 0; i < set.length; i++) {
				debug(set[i].semver);
				if (set[i].semver === Comparator.ANY) continue;
				if (set[i].semver.prerelease.length > 0) {
					const allowed = set[i].semver;
					if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) return true;
				}
			}
			return false;
		}
		return true;
	};
}));
//#endregion
//#region node_modules/semver/classes/comparator.js
var require_comparator = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ANY = Symbol("SemVer ANY");
	module.exports = class Comparator {
		static get ANY() {
			return ANY;
		}
		constructor(comp, options) {
			options = parseOptions(options);
			if (comp instanceof Comparator) if (comp.loose === !!options.loose) return comp;
			else comp = comp.value;
			comp = comp.trim().split(/\s+/).join(" ");
			debug("comparator", comp, options);
			this.options = options;
			this.loose = !!options.loose;
			this.parse(comp);
			if (this.semver === ANY) this.value = "";
			else this.value = this.operator + this.semver.version;
			debug("comp", this);
		}
		parse(comp) {
			const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
			const m = comp.match(r);
			if (!m) throw new TypeError(`Invalid comparator: ${comp}`);
			this.operator = m[1] !== void 0 ? m[1] : "";
			if (this.operator === "=") this.operator = "";
			if (!m[2]) this.semver = ANY;
			else this.semver = new SemVer(m[2], this.options.loose);
		}
		toString() {
			return this.value;
		}
		test(version) {
			debug("Comparator.test", version, this.options.loose);
			if (this.semver === ANY || version === ANY) return true;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			return cmp(version, this.operator, this.semver, this.options);
		}
		intersects(comp, options) {
			if (!(comp instanceof Comparator)) throw new TypeError("a Comparator is required");
			if (this.operator === "") {
				if (this.value === "") return true;
				return new Range(comp.value, options).test(this.value);
			} else if (comp.operator === "") {
				if (comp.value === "") return true;
				return new Range(this.value, options).test(comp.semver);
			}
			options = parseOptions(options);
			if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) return false;
			if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) return false;
			if (this.operator.startsWith(">") && comp.operator.startsWith(">")) return true;
			if (this.operator.startsWith("<") && comp.operator.startsWith("<")) return true;
			if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) return true;
			if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) return true;
			if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) return true;
			return false;
		}
	};
	var parseOptions = require_parse_options();
	var { safeRe: re, t } = require_re();
	var cmp = require_cmp();
	var debug = require_debug();
	var SemVer = require_semver$1();
	var Range = require_range();
}));
//#endregion
//#region node_modules/semver/functions/satisfies.js
var require_satisfies = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var satisfies = (version, range, options) => {
		try {
			range = new Range(range, options);
		} catch (er) {
			return false;
		}
		return range.test(version);
	};
	module.exports = satisfies;
}));
//#endregion
//#region node_modules/semver/ranges/to-comparators.js
var require_to_comparators = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
	module.exports = toComparators;
}));
//#endregion
//#region node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var maxSatisfying = (versions, range, options) => {
		let max = null;
		let maxSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!max || maxSV.compare(v) === -1) {
					max = v;
					maxSV = new SemVer(max, options);
				}
			}
		});
		return max;
	};
	module.exports = maxSatisfying;
}));
//#endregion
//#region node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var minSatisfying = (versions, range, options) => {
		let min = null;
		let minSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!min || minSV.compare(v) === 1) {
					min = v;
					minSV = new SemVer(min, options);
				}
			}
		});
		return min;
	};
	module.exports = minSatisfying;
}));
//#endregion
//#region node_modules/semver/ranges/min-version.js
var require_min_version = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var gt = require_gt();
	var minVersion = (range, loose) => {
		range = new Range(range, loose);
		let minver = new SemVer("0.0.0");
		if (range.test(minver)) return minver;
		minver = new SemVer("0.0.0-0");
		if (range.test(minver)) return minver;
		minver = null;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let setMin = null;
			comparators.forEach((comparator) => {
				const compver = new SemVer(comparator.semver.version);
				switch (comparator.operator) {
					case ">":
						if (compver.prerelease.length === 0) compver.patch++;
						else compver.prerelease.push(0);
						compver.raw = compver.format();
					case "":
					case ">=":
						if (!setMin || gt(compver, setMin)) setMin = compver;
						break;
					case "<":
					case "<=": break;
					/* istanbul ignore next */
					default: throw new Error(`Unexpected operation: ${comparator.operator}`);
				}
			});
			if (setMin && (!minver || gt(minver, setMin))) minver = setMin;
		}
		if (minver && range.test(minver)) return minver;
		return null;
	};
	module.exports = minVersion;
}));
//#endregion
//#region node_modules/semver/ranges/valid.js
var require_valid = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var validRange = (range, options) => {
		try {
			return new Range(range, options).range || "*";
		} catch (er) {
			return null;
		}
	};
	module.exports = validRange;
}));
//#endregion
//#region node_modules/semver/ranges/outside.js
var require_outside = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Comparator = require_comparator();
	var { ANY } = Comparator;
	var Range = require_range();
	var satisfies = require_satisfies();
	var gt = require_gt();
	var lt = require_lt();
	var lte = require_lte();
	var gte = require_gte();
	var outside = (version, range, hilo, options) => {
		version = new SemVer(version, options);
		range = new Range(range, options);
		let gtfn, ltefn, ltfn, comp, ecomp;
		switch (hilo) {
			case ">":
				gtfn = gt;
				ltefn = lte;
				ltfn = lt;
				comp = ">";
				ecomp = ">=";
				break;
			case "<":
				gtfn = lt;
				ltefn = gte;
				ltfn = gt;
				comp = "<";
				ecomp = "<=";
				break;
			default: throw new TypeError("Must provide a hilo val of \"<\" or \">\"");
		}
		if (satisfies(version, range, options)) return false;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let high = null;
			let low = null;
			comparators.forEach((comparator) => {
				if (comparator.semver === ANY) comparator = new Comparator(">=0.0.0");
				high = high || comparator;
				low = low || comparator;
				if (gtfn(comparator.semver, high.semver, options)) high = comparator;
				else if (ltfn(comparator.semver, low.semver, options)) low = comparator;
			});
			if (high.operator === comp || high.operator === ecomp) return false;
			if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) return false;
			else if (low.operator === ecomp && ltfn(version, low.semver)) return false;
		}
		return true;
	};
	module.exports = outside;
}));
//#endregion
//#region node_modules/semver/ranges/gtr.js
var require_gtr = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var outside = require_outside();
	var gtr = (version, range, options) => outside(version, range, ">", options);
	module.exports = gtr;
}));
//#endregion
//#region node_modules/semver/ranges/ltr.js
var require_ltr = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var outside = require_outside();
	var ltr = (version, range, options) => outside(version, range, "<", options);
	module.exports = ltr;
}));
//#endregion
//#region node_modules/semver/ranges/intersects.js
var require_intersects = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var intersects = (r1, r2, options) => {
		r1 = new Range(r1, options);
		r2 = new Range(r2, options);
		return r1.intersects(r2, options);
	};
	module.exports = intersects;
}));
//#endregion
//#region node_modules/semver/ranges/simplify.js
var require_simplify = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var satisfies = require_satisfies();
	var compare = require_compare();
	module.exports = (versions, range, options) => {
		const set = [];
		let first = null;
		let prev = null;
		const v = versions.sort((a, b) => compare(a, b, options));
		for (const version of v) if (satisfies(version, range, options)) {
			prev = version;
			if (!first) first = version;
		} else {
			if (prev) set.push([first, prev]);
			prev = null;
			first = null;
		}
		if (first) set.push([first, null]);
		const ranges = [];
		for (const [min, max] of set) if (min === max) ranges.push(min);
		else if (!max && min === v[0]) ranges.push("*");
		else if (!max) ranges.push(`>=${min}`);
		else if (min === v[0]) ranges.push(`<=${max}`);
		else ranges.push(`${min} - ${max}`);
		const simplified = ranges.join(" || ");
		const original = typeof range.raw === "string" ? range.raw : String(range);
		return simplified.length < original.length ? simplified : range;
	};
}));
//#endregion
//#region node_modules/semver/ranges/subset.js
var require_subset = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var Comparator = require_comparator();
	var { ANY } = Comparator;
	var satisfies = require_satisfies();
	var compare = require_compare();
	var subset = (sub, dom, options = {}) => {
		if (sub === dom) return true;
		sub = new Range(sub, options);
		dom = new Range(dom, options);
		let sawNonNull = false;
		OUTER: for (const simpleSub of sub.set) {
			for (const simpleDom of dom.set) {
				const isSub = simpleSubset(simpleSub, simpleDom, options);
				sawNonNull = sawNonNull || isSub !== null;
				if (isSub) continue OUTER;
			}
			if (sawNonNull) return false;
		}
		return true;
	};
	var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
	var minimumVersion = [new Comparator(">=0.0.0")];
	var simpleSubset = (sub, dom, options) => {
		if (sub === dom) return true;
		if (sub.length === 1 && sub[0].semver === ANY) if (dom.length === 1 && dom[0].semver === ANY) return true;
		else if (options.includePrerelease) sub = minimumVersionWithPreRelease;
		else sub = minimumVersion;
		if (dom.length === 1 && dom[0].semver === ANY) if (options.includePrerelease) return true;
		else dom = minimumVersion;
		const eqSet = /* @__PURE__ */ new Set();
		let gt, lt;
		for (const c of sub) if (c.operator === ">" || c.operator === ">=") gt = higherGT(gt, c, options);
		else if (c.operator === "<" || c.operator === "<=") lt = lowerLT(lt, c, options);
		else eqSet.add(c.semver);
		if (eqSet.size > 1) return null;
		let gtltComp;
		if (gt && lt) {
			gtltComp = compare(gt.semver, lt.semver, options);
			if (gtltComp > 0) return null;
			else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) return null;
		}
		for (const eq of eqSet) {
			if (gt && !satisfies(eq, String(gt), options)) return null;
			if (lt && !satisfies(eq, String(lt), options)) return null;
			for (const c of dom) if (!satisfies(eq, String(c), options)) return false;
			return true;
		}
		let higher, lower;
		let hasDomLT, hasDomGT;
		let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
		let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
		if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) needDomLTPre = false;
		for (const c of dom) {
			hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
			hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
			if (gt) {
				if (needDomGTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) needDomGTPre = false;
				}
				if (c.operator === ">" || c.operator === ">=") {
					higher = higherGT(gt, c, options);
					if (higher === c && higher !== gt) return false;
				} else if (gt.operator === ">=" && !c.test(gt.semver)) return false;
			}
			if (lt) {
				if (needDomLTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) needDomLTPre = false;
				}
				if (c.operator === "<" || c.operator === "<=") {
					lower = lowerLT(lt, c, options);
					if (lower === c && lower !== lt) return false;
				} else if (lt.operator === "<=" && !c.test(lt.semver)) return false;
			}
			if (!c.operator && (lt || gt) && gtltComp !== 0) return false;
		}
		if (gt && hasDomLT && !lt && gtltComp !== 0) return false;
		if (lt && hasDomGT && !gt && gtltComp !== 0) return false;
		if (needDomGTPre || needDomLTPre) return false;
		return true;
	};
	var higherGT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
	};
	var lowerLT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
	};
	module.exports = subset;
}));
//#endregion
//#region node_modules/semver/index.js
var require_semver = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var internalRe = require_re();
	var constants = require_constants();
	var SemVer = require_semver$1();
	var identifiers = require_identifiers();
	module.exports = {
		parse: require_parse(),
		valid: require_valid$1(),
		clean: require_clean(),
		inc: require_inc(),
		diff: require_diff(),
		major: require_major(),
		minor: require_minor(),
		patch: require_patch(),
		prerelease: require_prerelease(),
		compare: require_compare(),
		rcompare: require_rcompare(),
		compareLoose: require_compare_loose(),
		compareBuild: require_compare_build(),
		sort: require_sort(),
		rsort: require_rsort(),
		gt: require_gt(),
		lt: require_lt(),
		eq: require_eq(),
		neq: require_neq(),
		gte: require_gte(),
		lte: require_lte(),
		cmp: require_cmp(),
		coerce: require_coerce(),
		truncate: require_truncate(),
		Comparator: require_comparator(),
		Range: require_range(),
		satisfies: require_satisfies(),
		toComparators: require_to_comparators(),
		maxSatisfying: require_max_satisfying(),
		minSatisfying: require_min_satisfying(),
		minVersion: require_min_version(),
		validRange: require_valid(),
		outside: require_outside(),
		gtr: require_gtr(),
		ltr: require_ltr(),
		intersects: require_intersects(),
		simplifyRange: require_simplify(),
		subset: require_subset(),
		SemVer,
		re: internalRe.re,
		src: internalRe.src,
		tokens: internalRe.t,
		SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
		RELEASE_TYPES: constants.RELEASE_TYPES,
		compareIdentifiers: identifiers.compareIdentifiers,
		rcompareIdentifiers: identifiers.rcompareIdentifiers
	};
}));
//#endregion
//#region node_modules/jsonwebtoken/lib/asymmetricKeyDetailsSupported.js
var require_asymmetricKeyDetailsSupported = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_semver().satisfies(process.version, ">=15.7.0");
}));
//#endregion
//#region node_modules/jsonwebtoken/lib/rsaPssKeyDetailsSupported.js
var require_rsaPssKeyDetailsSupported = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_semver().satisfies(process.version, ">=16.9.0");
}));
//#endregion
//#region node_modules/jsonwebtoken/lib/validateAsymmetricKey.js
var require_validateAsymmetricKey = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ASYMMETRIC_KEY_DETAILS_SUPPORTED = require_asymmetricKeyDetailsSupported();
	var RSA_PSS_KEY_DETAILS_SUPPORTED = require_rsaPssKeyDetailsSupported();
	var allowedAlgorithmsForKeys = {
		"ec": [
			"ES256",
			"ES384",
			"ES512"
		],
		"rsa": [
			"RS256",
			"PS256",
			"RS384",
			"PS384",
			"RS512",
			"PS512"
		],
		"rsa-pss": [
			"PS256",
			"PS384",
			"PS512"
		]
	};
	var allowedCurves = {
		ES256: "prime256v1",
		ES384: "secp384r1",
		ES512: "secp521r1"
	};
	module.exports = function(algorithm, key) {
		if (!algorithm || !key) return;
		const keyType = key.asymmetricKeyType;
		if (!keyType) return;
		const allowedAlgorithms = allowedAlgorithmsForKeys[keyType];
		if (!allowedAlgorithms) throw new Error(`Unknown key type "${keyType}".`);
		if (!allowedAlgorithms.includes(algorithm)) throw new Error(`"alg" parameter for "${keyType}" key type must be one of: ${allowedAlgorithms.join(", ")}.`);
		/* istanbul ignore next */
		if (ASYMMETRIC_KEY_DETAILS_SUPPORTED) switch (keyType) {
			case "ec":
				const keyCurve = key.asymmetricKeyDetails.namedCurve;
				const allowedCurve = allowedCurves[algorithm];
				if (keyCurve !== allowedCurve) throw new Error(`"alg" parameter "${algorithm}" requires curve "${allowedCurve}".`);
				break;
			case "rsa-pss":
				if (RSA_PSS_KEY_DETAILS_SUPPORTED) {
					const length = parseInt(algorithm.slice(-3), 10);
					const { hashAlgorithm, mgf1HashAlgorithm, saltLength } = key.asymmetricKeyDetails;
					if (hashAlgorithm !== `sha${length}` || mgf1HashAlgorithm !== hashAlgorithm) throw new Error(`Invalid key for this operation, its RSA-PSS parameters do not meet the requirements of "alg" ${algorithm}.`);
					if (saltLength !== void 0 && saltLength > length >> 3) throw new Error(`Invalid key for this operation, its RSA-PSS parameter saltLength does not meet the requirements of "alg" ${algorithm}.`);
				}
				break;
		}
	};
}));
//#endregion
//#region node_modules/jsonwebtoken/lib/psSupported.js
var require_psSupported = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_semver().satisfies(process.version, "^6.12.0 || >=8.0.0");
}));
//#endregion
//#region node_modules/jsonwebtoken/verify.js
var require_verify = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var JsonWebTokenError = require_JsonWebTokenError();
	var NotBeforeError = require_NotBeforeError();
	var TokenExpiredError = require_TokenExpiredError();
	var decode = require_decode();
	var timespan = require_timespan();
	var validateAsymmetricKey = require_validateAsymmetricKey();
	var PS_SUPPORTED = require_psSupported();
	var jws = require_jws();
	var { KeyObject: KeyObject$1, createSecretKey: createSecretKey$1, createPublicKey } = __require("crypto");
	var PUB_KEY_ALGS = [
		"RS256",
		"RS384",
		"RS512"
	];
	var EC_KEY_ALGS = [
		"ES256",
		"ES384",
		"ES512"
	];
	var RSA_KEY_ALGS = [
		"RS256",
		"RS384",
		"RS512"
	];
	var HS_ALGS = [
		"HS256",
		"HS384",
		"HS512"
	];
	if (PS_SUPPORTED) {
		PUB_KEY_ALGS.splice(PUB_KEY_ALGS.length, 0, "PS256", "PS384", "PS512");
		RSA_KEY_ALGS.splice(RSA_KEY_ALGS.length, 0, "PS256", "PS384", "PS512");
	}
	module.exports = function(jwtString, secretOrPublicKey, options, callback) {
		if (typeof options === "function" && !callback) {
			callback = options;
			options = {};
		}
		if (!options) options = {};
		options = Object.assign({}, options);
		let done;
		if (callback) done = callback;
		else done = function(err, data) {
			if (err) throw err;
			return data;
		};
		if (options.clockTimestamp && typeof options.clockTimestamp !== "number") return done(new JsonWebTokenError("clockTimestamp must be a number"));
		if (options.nonce !== void 0 && (typeof options.nonce !== "string" || options.nonce.trim() === "")) return done(new JsonWebTokenError("nonce must be a non-empty string"));
		if (options.allowInvalidAsymmetricKeyTypes !== void 0 && typeof options.allowInvalidAsymmetricKeyTypes !== "boolean") return done(new JsonWebTokenError("allowInvalidAsymmetricKeyTypes must be a boolean"));
		const clockTimestamp = options.clockTimestamp || Math.floor(Date.now() / 1e3);
		if (!jwtString) return done(new JsonWebTokenError("jwt must be provided"));
		if (typeof jwtString !== "string") return done(new JsonWebTokenError("jwt must be a string"));
		const parts = jwtString.split(".");
		if (parts.length !== 3) return done(new JsonWebTokenError("jwt malformed"));
		let decodedToken;
		try {
			decodedToken = decode(jwtString, { complete: true });
		} catch (err) {
			return done(err);
		}
		if (!decodedToken) return done(new JsonWebTokenError("invalid token"));
		const header = decodedToken.header;
		let getSecret;
		if (typeof secretOrPublicKey === "function") {
			if (!callback) return done(new JsonWebTokenError("verify must be called asynchronous if secret or public key is provided as a callback"));
			getSecret = secretOrPublicKey;
		} else getSecret = function(header, secretCallback) {
			return secretCallback(null, secretOrPublicKey);
		};
		return getSecret(header, function(err, secretOrPublicKey) {
			if (err) return done(new JsonWebTokenError("error in secret or public key callback: " + err.message));
			const hasSignature = parts[2].trim() !== "";
			if (!hasSignature && secretOrPublicKey) return done(new JsonWebTokenError("jwt signature is required"));
			if (hasSignature && !secretOrPublicKey) return done(new JsonWebTokenError("secret or public key must be provided"));
			if (!hasSignature && !options.algorithms) return done(new JsonWebTokenError("please specify \"none\" in \"algorithms\" to verify unsigned tokens"));
			if (secretOrPublicKey != null && !(secretOrPublicKey instanceof KeyObject$1)) try {
				secretOrPublicKey = createPublicKey(secretOrPublicKey);
			} catch (_) {
				try {
					secretOrPublicKey = createSecretKey$1(typeof secretOrPublicKey === "string" ? Buffer.from(secretOrPublicKey) : secretOrPublicKey);
				} catch (_) {
					return done(new JsonWebTokenError("secretOrPublicKey is not valid key material"));
				}
			}
			if (!options.algorithms) if (secretOrPublicKey.type === "secret") options.algorithms = HS_ALGS;
			else if (["rsa", "rsa-pss"].includes(secretOrPublicKey.asymmetricKeyType)) options.algorithms = RSA_KEY_ALGS;
			else if (secretOrPublicKey.asymmetricKeyType === "ec") options.algorithms = EC_KEY_ALGS;
			else options.algorithms = PUB_KEY_ALGS;
			if (options.algorithms.indexOf(decodedToken.header.alg) === -1) return done(new JsonWebTokenError("invalid algorithm"));
			if (header.alg.startsWith("HS") && secretOrPublicKey.type !== "secret") return done(new JsonWebTokenError(`secretOrPublicKey must be a symmetric key when using ${header.alg}`));
			else if (/^(?:RS|PS|ES)/.test(header.alg) && secretOrPublicKey.type !== "public") return done(new JsonWebTokenError(`secretOrPublicKey must be an asymmetric key when using ${header.alg}`));
			if (!options.allowInvalidAsymmetricKeyTypes) try {
				validateAsymmetricKey(header.alg, secretOrPublicKey);
			} catch (e) {
				return done(e);
			}
			let valid;
			try {
				valid = jws.verify(jwtString, decodedToken.header.alg, secretOrPublicKey);
			} catch (e) {
				return done(e);
			}
			if (!valid) return done(new JsonWebTokenError("invalid signature"));
			const payload = decodedToken.payload;
			if (typeof payload.nbf !== "undefined" && !options.ignoreNotBefore) {
				if (typeof payload.nbf !== "number") return done(new JsonWebTokenError("invalid nbf value"));
				if (payload.nbf > clockTimestamp + (options.clockTolerance || 0)) return done(new NotBeforeError("jwt not active", /* @__PURE__ */ new Date(payload.nbf * 1e3)));
			}
			if (typeof payload.exp !== "undefined" && !options.ignoreExpiration) {
				if (typeof payload.exp !== "number") return done(new JsonWebTokenError("invalid exp value"));
				if (clockTimestamp >= payload.exp + (options.clockTolerance || 0)) return done(new TokenExpiredError("jwt expired", /* @__PURE__ */ new Date(payload.exp * 1e3)));
			}
			if (options.audience) {
				const audiences = Array.isArray(options.audience) ? options.audience : [options.audience];
				if (!(Array.isArray(payload.aud) ? payload.aud : [payload.aud]).some(function(targetAudience) {
					return audiences.some(function(audience) {
						return audience instanceof RegExp ? audience.test(targetAudience) : audience === targetAudience;
					});
				})) return done(new JsonWebTokenError("jwt audience invalid. expected: " + audiences.join(" or ")));
			}
			if (options.issuer) {
				if (typeof options.issuer === "string" && payload.iss !== options.issuer || Array.isArray(options.issuer) && options.issuer.indexOf(payload.iss) === -1) return done(new JsonWebTokenError("jwt issuer invalid. expected: " + options.issuer));
			}
			if (options.subject) {
				if (payload.sub !== options.subject) return done(new JsonWebTokenError("jwt subject invalid. expected: " + options.subject));
			}
			if (options.jwtid) {
				if (payload.jti !== options.jwtid) return done(new JsonWebTokenError("jwt jwtid invalid. expected: " + options.jwtid));
			}
			if (options.nonce) {
				if (payload.nonce !== options.nonce) return done(new JsonWebTokenError("jwt nonce invalid. expected: " + options.nonce));
			}
			if (options.maxAge) {
				if (typeof payload.iat !== "number") return done(new JsonWebTokenError("iat required when maxAge is specified"));
				const maxAgeTimestamp = timespan(options.maxAge, payload.iat);
				if (typeof maxAgeTimestamp === "undefined") return done(new JsonWebTokenError("\"maxAge\" should be a number of seconds or string representing a timespan eg: \"1d\", \"20h\", 60"));
				if (clockTimestamp >= maxAgeTimestamp + (options.clockTolerance || 0)) return done(new TokenExpiredError("maxAge exceeded", /* @__PURE__ */ new Date(maxAgeTimestamp * 1e3)));
			}
			if (options.complete === true) {
				const signature = decodedToken.signature;
				return done(null, {
					header,
					payload,
					signature
				});
			}
			return done(null, payload);
		});
	};
}));
//#endregion
//#region node_modules/lodash.includes/index.js
var require_lodash_includes = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* lodash (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright jQuery Foundation and other contributors <https://jquery.org/>
	* Released under MIT license <https://lodash.com/license>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	*/
	/** Used as references for various `Number` constants. */
	var INFINITY = Infinity, MAX_SAFE_INTEGER = 9007199254740991, MAX_INTEGER = 17976931348623157e292, NAN = NaN;
	/** `Object#toString` result references. */
	var argsTag = "[object Arguments]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", stringTag = "[object String]", symbolTag = "[object Symbol]";
	/** Used to match leading and trailing whitespace. */
	var reTrim = /^\s+|\s+$/g;
	/** Used to detect bad signed hexadecimal string values. */
	var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
	/** Used to detect binary string values. */
	var reIsBinary = /^0b[01]+$/i;
	/** Used to detect octal string values. */
	var reIsOctal = /^0o[0-7]+$/i;
	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;
	/** Built-in method references without a dependency on `root`. */
	var freeParseInt = parseInt;
	/**
	* A specialized version of `_.map` for arrays without support for iteratee
	* shorthands.
	*
	* @private
	* @param {Array} [array] The array to iterate over.
	* @param {Function} iteratee The function invoked per iteration.
	* @returns {Array} Returns the new mapped array.
	*/
	function arrayMap(array, iteratee) {
		var index = -1, length = array ? array.length : 0, result = Array(length);
		while (++index < length) result[index] = iteratee(array[index], index, array);
		return result;
	}
	/**
	* The base implementation of `_.findIndex` and `_.findLastIndex` without
	* support for iteratee shorthands.
	*
	* @private
	* @param {Array} array The array to inspect.
	* @param {Function} predicate The function invoked per iteration.
	* @param {number} fromIndex The index to search from.
	* @param {boolean} [fromRight] Specify iterating from right to left.
	* @returns {number} Returns the index of the matched value, else `-1`.
	*/
	function baseFindIndex(array, predicate, fromIndex, fromRight) {
		var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
		while (fromRight ? index-- : ++index < length) if (predicate(array[index], index, array)) return index;
		return -1;
	}
	/**
	* The base implementation of `_.indexOf` without `fromIndex` bounds checks.
	*
	* @private
	* @param {Array} array The array to inspect.
	* @param {*} value The value to search for.
	* @param {number} fromIndex The index to search from.
	* @returns {number} Returns the index of the matched value, else `-1`.
	*/
	function baseIndexOf(array, value, fromIndex) {
		if (value !== value) return baseFindIndex(array, baseIsNaN, fromIndex);
		var index = fromIndex - 1, length = array.length;
		while (++index < length) if (array[index] === value) return index;
		return -1;
	}
	/**
	* The base implementation of `_.isNaN` without support for number objects.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
	*/
	function baseIsNaN(value) {
		return value !== value;
	}
	/**
	* The base implementation of `_.times` without support for iteratee shorthands
	* or max array length checks.
	*
	* @private
	* @param {number} n The number of times to invoke `iteratee`.
	* @param {Function} iteratee The function invoked per iteration.
	* @returns {Array} Returns the array of results.
	*/
	function baseTimes(n, iteratee) {
		var index = -1, result = Array(n);
		while (++index < n) result[index] = iteratee(index);
		return result;
	}
	/**
	* The base implementation of `_.values` and `_.valuesIn` which creates an
	* array of `object` property values corresponding to the property names
	* of `props`.
	*
	* @private
	* @param {Object} object The object to query.
	* @param {Array} props The property names to get values for.
	* @returns {Object} Returns the array of property values.
	*/
	function baseValues(object, props) {
		return arrayMap(props, function(key) {
			return object[key];
		});
	}
	/**
	* Creates a unary function that invokes `func` with its argument transformed.
	*
	* @private
	* @param {Function} func The function to wrap.
	* @param {Function} transform The argument transform.
	* @returns {Function} Returns the new function.
	*/
	function overArg(func, transform) {
		return function(arg) {
			return func(transform(arg));
		};
	}
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	/**
	* Used to resolve the
	* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var objectToString = objectProto.toString;
	/** Built-in value references. */
	var propertyIsEnumerable = objectProto.propertyIsEnumerable;
	var nativeKeys = overArg(Object.keys, Object), nativeMax = Math.max;
	/**
	* Creates an array of the enumerable property names of the array-like `value`.
	*
	* @private
	* @param {*} value The value to query.
	* @param {boolean} inherited Specify returning inherited property names.
	* @returns {Array} Returns the array of property names.
	*/
	function arrayLikeKeys(value, inherited) {
		var result = isArray(value) || isArguments(value) ? baseTimes(value.length, String) : [];
		var length = result.length, skipIndexes = !!length;
		for (var key in value) if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isIndex(key, length)))) result.push(key);
		return result;
	}
	/**
	* The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	*/
	function baseKeys(object) {
		if (!isPrototype(object)) return nativeKeys(object);
		var result = [];
		for (var key in Object(object)) if (hasOwnProperty.call(object, key) && key != "constructor") result.push(key);
		return result;
	}
	/**
	* Checks if `value` is a valid array-like index.
	*
	* @private
	* @param {*} value The value to check.
	* @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	* @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	*/
	function isIndex(value, length) {
		length = length == null ? MAX_SAFE_INTEGER : length;
		return !!length && (typeof value == "number" || reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
	}
	/**
	* Checks if `value` is likely a prototype object.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	*/
	function isPrototype(value) {
		var Ctor = value && value.constructor;
		return value === (typeof Ctor == "function" && Ctor.prototype || objectProto);
	}
	/**
	* Checks if `value` is in `collection`. If `collection` is a string, it's
	* checked for a substring of `value`, otherwise
	* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	* is used for equality comparisons. If `fromIndex` is negative, it's used as
	* the offset from the end of `collection`.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Collection
	* @param {Array|Object|string} collection The collection to inspect.
	* @param {*} value The value to search for.
	* @param {number} [fromIndex=0] The index to search from.
	* @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
	* @returns {boolean} Returns `true` if `value` is found, else `false`.
	* @example
	*
	* _.includes([1, 2, 3], 1);
	* // => true
	*
	* _.includes([1, 2, 3], 1, 2);
	* // => false
	*
	* _.includes({ 'a': 1, 'b': 2 }, 1);
	* // => true
	*
	* _.includes('abcd', 'bc');
	* // => true
	*/
	function includes(collection, value, fromIndex, guard) {
		collection = isArrayLike(collection) ? collection : values(collection);
		fromIndex = fromIndex && !guard ? toInteger(fromIndex) : 0;
		var length = collection.length;
		if (fromIndex < 0) fromIndex = nativeMax(length + fromIndex, 0);
		return isString(collection) ? fromIndex <= length && collection.indexOf(value, fromIndex) > -1 : !!length && baseIndexOf(collection, value, fromIndex) > -1;
	}
	/**
	* Checks if `value` is likely an `arguments` object.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an `arguments` object,
	*  else `false`.
	* @example
	*
	* _.isArguments(function() { return arguments; }());
	* // => true
	*
	* _.isArguments([1, 2, 3]);
	* // => false
	*/
	function isArguments(value) {
		return isArrayLikeObject(value) && hasOwnProperty.call(value, "callee") && (!propertyIsEnumerable.call(value, "callee") || objectToString.call(value) == argsTag);
	}
	/**
	* Checks if `value` is classified as an `Array` object.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an array, else `false`.
	* @example
	*
	* _.isArray([1, 2, 3]);
	* // => true
	*
	* _.isArray(document.body.children);
	* // => false
	*
	* _.isArray('abc');
	* // => false
	*
	* _.isArray(_.noop);
	* // => false
	*/
	var isArray = Array.isArray;
	/**
	* Checks if `value` is array-like. A value is considered array-like if it's
	* not a function and has a `value.length` that's an integer greater than or
	* equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	* @example
	*
	* _.isArrayLike([1, 2, 3]);
	* // => true
	*
	* _.isArrayLike(document.body.children);
	* // => true
	*
	* _.isArrayLike('abc');
	* // => true
	*
	* _.isArrayLike(_.noop);
	* // => false
	*/
	function isArrayLike(value) {
		return value != null && isLength(value.length) && !isFunction(value);
	}
	/**
	* This method is like `_.isArrayLike` except that it also checks if `value`
	* is an object.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an array-like object,
	*  else `false`.
	* @example
	*
	* _.isArrayLikeObject([1, 2, 3]);
	* // => true
	*
	* _.isArrayLikeObject(document.body.children);
	* // => true
	*
	* _.isArrayLikeObject('abc');
	* // => false
	*
	* _.isArrayLikeObject(_.noop);
	* // => false
	*/
	function isArrayLikeObject(value) {
		return isObjectLike(value) && isArrayLike(value);
	}
	/**
	* Checks if `value` is classified as a `Function` object.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a function, else `false`.
	* @example
	*
	* _.isFunction(_);
	* // => true
	*
	* _.isFunction(/abc/);
	* // => false
	*/
	function isFunction(value) {
		var tag = isObject(value) ? objectToString.call(value) : "";
		return tag == funcTag || tag == genTag;
	}
	/**
	* Checks if `value` is a valid array-like length.
	*
	* **Note:** This method is loosely based on
	* [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	* @example
	*
	* _.isLength(3);
	* // => true
	*
	* _.isLength(Number.MIN_VALUE);
	* // => false
	*
	* _.isLength(Infinity);
	* // => false
	*
	* _.isLength('3');
	* // => false
	*/
	function isLength(value) {
		return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}
	/**
	* Checks if `value` is the
	* [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	* of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an object, else `false`.
	* @example
	*
	* _.isObject({});
	* // => true
	*
	* _.isObject([1, 2, 3]);
	* // => true
	*
	* _.isObject(_.noop);
	* // => true
	*
	* _.isObject(null);
	* // => false
	*/
	function isObject(value) {
		var type = typeof value;
		return !!value && (type == "object" || type == "function");
	}
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return !!value && typeof value == "object";
	}
	/**
	* Checks if `value` is classified as a `String` primitive or object.
	*
	* @static
	* @since 0.1.0
	* @memberOf _
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a string, else `false`.
	* @example
	*
	* _.isString('abc');
	* // => true
	*
	* _.isString(1);
	* // => false
	*/
	function isString(value) {
		return typeof value == "string" || !isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag;
	}
	/**
	* Checks if `value` is classified as a `Symbol` primitive or object.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	* @example
	*
	* _.isSymbol(Symbol.iterator);
	* // => true
	*
	* _.isSymbol('abc');
	* // => false
	*/
	function isSymbol(value) {
		return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
	}
	/**
	* Converts `value` to a finite number.
	*
	* @static
	* @memberOf _
	* @since 4.12.0
	* @category Lang
	* @param {*} value The value to convert.
	* @returns {number} Returns the converted number.
	* @example
	*
	* _.toFinite(3.2);
	* // => 3.2
	*
	* _.toFinite(Number.MIN_VALUE);
	* // => 5e-324
	*
	* _.toFinite(Infinity);
	* // => 1.7976931348623157e+308
	*
	* _.toFinite('3.2');
	* // => 3.2
	*/
	function toFinite(value) {
		if (!value) return value === 0 ? value : 0;
		value = toNumber(value);
		if (value === INFINITY || value === -INFINITY) return (value < 0 ? -1 : 1) * MAX_INTEGER;
		return value === value ? value : 0;
	}
	/**
	* Converts `value` to an integer.
	*
	* **Note:** This method is loosely based on
	* [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to convert.
	* @returns {number} Returns the converted integer.
	* @example
	*
	* _.toInteger(3.2);
	* // => 3
	*
	* _.toInteger(Number.MIN_VALUE);
	* // => 0
	*
	* _.toInteger(Infinity);
	* // => 1.7976931348623157e+308
	*
	* _.toInteger('3.2');
	* // => 3
	*/
	function toInteger(value) {
		var result = toFinite(value), remainder = result % 1;
		return result === result ? remainder ? result - remainder : result : 0;
	}
	/**
	* Converts `value` to a number.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to process.
	* @returns {number} Returns the number.
	* @example
	*
	* _.toNumber(3.2);
	* // => 3.2
	*
	* _.toNumber(Number.MIN_VALUE);
	* // => 5e-324
	*
	* _.toNumber(Infinity);
	* // => Infinity
	*
	* _.toNumber('3.2');
	* // => 3.2
	*/
	function toNumber(value) {
		if (typeof value == "number") return value;
		if (isSymbol(value)) return NAN;
		if (isObject(value)) {
			var other = typeof value.valueOf == "function" ? value.valueOf() : value;
			value = isObject(other) ? other + "" : other;
		}
		if (typeof value != "string") return value === 0 ? value : +value;
		value = value.replace(reTrim, "");
		var isBinary = reIsBinary.test(value);
		return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
	}
	/**
	* Creates an array of the own enumerable property names of `object`.
	*
	* **Note:** Non-object values are coerced to objects. See the
	* [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	* for more details.
	*
	* @static
	* @since 0.1.0
	* @memberOf _
	* @category Object
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	* @example
	*
	* function Foo() {
	*   this.a = 1;
	*   this.b = 2;
	* }
	*
	* Foo.prototype.c = 3;
	*
	* _.keys(new Foo);
	* // => ['a', 'b'] (iteration order is not guaranteed)
	*
	* _.keys('hi');
	* // => ['0', '1']
	*/
	function keys(object) {
		return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
	}
	/**
	* Creates an array of the own enumerable string keyed property values of `object`.
	*
	* **Note:** Non-object values are coerced to objects.
	*
	* @static
	* @since 0.1.0
	* @memberOf _
	* @category Object
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property values.
	* @example
	*
	* function Foo() {
	*   this.a = 1;
	*   this.b = 2;
	* }
	*
	* Foo.prototype.c = 3;
	*
	* _.values(new Foo);
	* // => [1, 2] (iteration order is not guaranteed)
	*
	* _.values('hi');
	* // => ['h', 'i']
	*/
	function values(object) {
		return object ? baseValues(object, keys(object)) : [];
	}
	module.exports = includes;
}));
//#endregion
//#region node_modules/lodash.isboolean/index.js
var require_lodash_isboolean = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* lodash 3.0.3 (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	* Available under MIT license <https://lodash.com/license>
	*/
	/** `Object#toString` result references. */
	var boolTag = "[object Boolean]";
	/**
	* Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var objectToString = Object.prototype.toString;
	/**
	* Checks if `value` is classified as a boolean primitive or object.
	*
	* @static
	* @memberOf _
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	* @example
	*
	* _.isBoolean(false);
	* // => true
	*
	* _.isBoolean(null);
	* // => false
	*/
	function isBoolean(value) {
		return value === true || value === false || isObjectLike(value) && objectToString.call(value) == boolTag;
	}
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return !!value && typeof value == "object";
	}
	module.exports = isBoolean;
}));
//#endregion
//#region node_modules/lodash.isinteger/index.js
var require_lodash_isinteger = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* lodash (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright jQuery Foundation and other contributors <https://jquery.org/>
	* Released under MIT license <https://lodash.com/license>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	*/
	/** Used as references for various `Number` constants. */
	var INFINITY = Infinity, MAX_INTEGER = 17976931348623157e292, NAN = NaN;
	/** `Object#toString` result references. */
	var symbolTag = "[object Symbol]";
	/** Used to match leading and trailing whitespace. */
	var reTrim = /^\s+|\s+$/g;
	/** Used to detect bad signed hexadecimal string values. */
	var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
	/** Used to detect binary string values. */
	var reIsBinary = /^0b[01]+$/i;
	/** Used to detect octal string values. */
	var reIsOctal = /^0o[0-7]+$/i;
	/** Built-in method references without a dependency on `root`. */
	var freeParseInt = parseInt;
	/**
	* Used to resolve the
	* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var objectToString = Object.prototype.toString;
	/**
	* Checks if `value` is an integer.
	*
	* **Note:** This method is based on
	* [`Number.isInteger`](https://mdn.io/Number/isInteger).
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an integer, else `false`.
	* @example
	*
	* _.isInteger(3);
	* // => true
	*
	* _.isInteger(Number.MIN_VALUE);
	* // => false
	*
	* _.isInteger(Infinity);
	* // => false
	*
	* _.isInteger('3');
	* // => false
	*/
	function isInteger(value) {
		return typeof value == "number" && value == toInteger(value);
	}
	/**
	* Checks if `value` is the
	* [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	* of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an object, else `false`.
	* @example
	*
	* _.isObject({});
	* // => true
	*
	* _.isObject([1, 2, 3]);
	* // => true
	*
	* _.isObject(_.noop);
	* // => true
	*
	* _.isObject(null);
	* // => false
	*/
	function isObject(value) {
		var type = typeof value;
		return !!value && (type == "object" || type == "function");
	}
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return !!value && typeof value == "object";
	}
	/**
	* Checks if `value` is classified as a `Symbol` primitive or object.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	* @example
	*
	* _.isSymbol(Symbol.iterator);
	* // => true
	*
	* _.isSymbol('abc');
	* // => false
	*/
	function isSymbol(value) {
		return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
	}
	/**
	* Converts `value` to a finite number.
	*
	* @static
	* @memberOf _
	* @since 4.12.0
	* @category Lang
	* @param {*} value The value to convert.
	* @returns {number} Returns the converted number.
	* @example
	*
	* _.toFinite(3.2);
	* // => 3.2
	*
	* _.toFinite(Number.MIN_VALUE);
	* // => 5e-324
	*
	* _.toFinite(Infinity);
	* // => 1.7976931348623157e+308
	*
	* _.toFinite('3.2');
	* // => 3.2
	*/
	function toFinite(value) {
		if (!value) return value === 0 ? value : 0;
		value = toNumber(value);
		if (value === INFINITY || value === -INFINITY) return (value < 0 ? -1 : 1) * MAX_INTEGER;
		return value === value ? value : 0;
	}
	/**
	* Converts `value` to an integer.
	*
	* **Note:** This method is loosely based on
	* [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to convert.
	* @returns {number} Returns the converted integer.
	* @example
	*
	* _.toInteger(3.2);
	* // => 3
	*
	* _.toInteger(Number.MIN_VALUE);
	* // => 0
	*
	* _.toInteger(Infinity);
	* // => 1.7976931348623157e+308
	*
	* _.toInteger('3.2');
	* // => 3
	*/
	function toInteger(value) {
		var result = toFinite(value), remainder = result % 1;
		return result === result ? remainder ? result - remainder : result : 0;
	}
	/**
	* Converts `value` to a number.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to process.
	* @returns {number} Returns the number.
	* @example
	*
	* _.toNumber(3.2);
	* // => 3.2
	*
	* _.toNumber(Number.MIN_VALUE);
	* // => 5e-324
	*
	* _.toNumber(Infinity);
	* // => Infinity
	*
	* _.toNumber('3.2');
	* // => 3.2
	*/
	function toNumber(value) {
		if (typeof value == "number") return value;
		if (isSymbol(value)) return NAN;
		if (isObject(value)) {
			var other = typeof value.valueOf == "function" ? value.valueOf() : value;
			value = isObject(other) ? other + "" : other;
		}
		if (typeof value != "string") return value === 0 ? value : +value;
		value = value.replace(reTrim, "");
		var isBinary = reIsBinary.test(value);
		return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
	}
	module.exports = isInteger;
}));
//#endregion
//#region node_modules/lodash.isnumber/index.js
var require_lodash_isnumber = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* lodash 3.0.3 (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	* Available under MIT license <https://lodash.com/license>
	*/
	/** `Object#toString` result references. */
	var numberTag = "[object Number]";
	/**
	* Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var objectToString = Object.prototype.toString;
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return !!value && typeof value == "object";
	}
	/**
	* Checks if `value` is classified as a `Number` primitive or object.
	*
	* **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are classified
	* as numbers, use the `_.isFinite` method.
	*
	* @static
	* @memberOf _
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	* @example
	*
	* _.isNumber(3);
	* // => true
	*
	* _.isNumber(Number.MIN_VALUE);
	* // => true
	*
	* _.isNumber(Infinity);
	* // => true
	*
	* _.isNumber('3');
	* // => false
	*/
	function isNumber(value) {
		return typeof value == "number" || isObjectLike(value) && objectToString.call(value) == numberTag;
	}
	module.exports = isNumber;
}));
//#endregion
//#region node_modules/lodash.isplainobject/index.js
var require_lodash_isplainobject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* lodash (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright jQuery Foundation and other contributors <https://jquery.org/>
	* Released under MIT license <https://lodash.com/license>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	*/
	/** `Object#toString` result references. */
	var objectTag = "[object Object]";
	/**
	* Checks if `value` is a host object in IE < 9.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a host object, else `false`.
	*/
	function isHostObject(value) {
		var result = false;
		if (value != null && typeof value.toString != "function") try {
			result = !!(value + "");
		} catch (e) {}
		return result;
	}
	/**
	* Creates a unary function that invokes `func` with its argument transformed.
	*
	* @private
	* @param {Function} func The function to wrap.
	* @param {Function} transform The argument transform.
	* @returns {Function} Returns the new function.
	*/
	function overArg(func, transform) {
		return function(arg) {
			return func(transform(arg));
		};
	}
	/** Used for built-in method references. */
	var funcProto = Function.prototype, objectProto = Object.prototype;
	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	/** Used to infer the `Object` constructor. */
	var objectCtorString = funcToString.call(Object);
	/**
	* Used to resolve the
	* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var objectToString = objectProto.toString;
	/** Built-in value references. */
	var getPrototype = overArg(Object.getPrototypeOf, Object);
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return !!value && typeof value == "object";
	}
	/**
	* Checks if `value` is a plain object, that is, an object created by the
	* `Object` constructor or one with a `[[Prototype]]` of `null`.
	*
	* @static
	* @memberOf _
	* @since 0.8.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
	* @example
	*
	* function Foo() {
	*   this.a = 1;
	* }
	*
	* _.isPlainObject(new Foo);
	* // => false
	*
	* _.isPlainObject([1, 2, 3]);
	* // => false
	*
	* _.isPlainObject({ 'x': 0, 'y': 0 });
	* // => true
	*
	* _.isPlainObject(Object.create(null));
	* // => true
	*/
	function isPlainObject(value) {
		if (!isObjectLike(value) || objectToString.call(value) != objectTag || isHostObject(value)) return false;
		var proto = getPrototype(value);
		if (proto === null) return true;
		var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
		return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
	}
	module.exports = isPlainObject;
}));
//#endregion
//#region node_modules/lodash.isstring/index.js
var require_lodash_isstring = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* lodash 4.0.1 (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	* Available under MIT license <https://lodash.com/license>
	*/
	/** `Object#toString` result references. */
	var stringTag = "[object String]";
	/**
	* Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var objectToString = Object.prototype.toString;
	/**
	* Checks if `value` is classified as an `Array` object.
	*
	* @static
	* @memberOf _
	* @type Function
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	* @example
	*
	* _.isArray([1, 2, 3]);
	* // => true
	*
	* _.isArray(document.body.children);
	* // => false
	*
	* _.isArray('abc');
	* // => false
	*
	* _.isArray(_.noop);
	* // => false
	*/
	var isArray = Array.isArray;
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return !!value && typeof value == "object";
	}
	/**
	* Checks if `value` is classified as a `String` primitive or object.
	*
	* @static
	* @memberOf _
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	* @example
	*
	* _.isString('abc');
	* // => true
	*
	* _.isString(1);
	* // => false
	*/
	function isString(value) {
		return typeof value == "string" || !isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag;
	}
	module.exports = isString;
}));
//#endregion
//#region node_modules/lodash.once/index.js
var require_lodash_once = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* lodash (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright jQuery Foundation and other contributors <https://jquery.org/>
	* Released under MIT license <https://lodash.com/license>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	*/
	/** Used as the `TypeError` message for "Functions" methods. */
	var FUNC_ERROR_TEXT = "Expected a function";
	/** Used as references for various `Number` constants. */
	var INFINITY = Infinity, MAX_INTEGER = 17976931348623157e292, NAN = NaN;
	/** `Object#toString` result references. */
	var symbolTag = "[object Symbol]";
	/** Used to match leading and trailing whitespace. */
	var reTrim = /^\s+|\s+$/g;
	/** Used to detect bad signed hexadecimal string values. */
	var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
	/** Used to detect binary string values. */
	var reIsBinary = /^0b[01]+$/i;
	/** Used to detect octal string values. */
	var reIsOctal = /^0o[0-7]+$/i;
	/** Built-in method references without a dependency on `root`. */
	var freeParseInt = parseInt;
	/**
	* Used to resolve the
	* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var objectToString = Object.prototype.toString;
	/**
	* Creates a function that invokes `func`, with the `this` binding and arguments
	* of the created function, while it's called less than `n` times. Subsequent
	* calls to the created function return the result of the last `func` invocation.
	*
	* @static
	* @memberOf _
	* @since 3.0.0
	* @category Function
	* @param {number} n The number of calls at which `func` is no longer invoked.
	* @param {Function} func The function to restrict.
	* @returns {Function} Returns the new restricted function.
	* @example
	*
	* jQuery(element).on('click', _.before(5, addContactToList));
	* // => Allows adding up to 4 contacts to the list.
	*/
	function before(n, func) {
		var result;
		if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
		n = toInteger(n);
		return function() {
			if (--n > 0) result = func.apply(this, arguments);
			if (n <= 1) func = void 0;
			return result;
		};
	}
	/**
	* Creates a function that is restricted to invoking `func` once. Repeat calls
	* to the function return the value of the first invocation. The `func` is
	* invoked with the `this` binding and arguments of the created function.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Function
	* @param {Function} func The function to restrict.
	* @returns {Function} Returns the new restricted function.
	* @example
	*
	* var initialize = _.once(createApplication);
	* initialize();
	* initialize();
	* // => `createApplication` is invoked once
	*/
	function once(func) {
		return before(2, func);
	}
	/**
	* Checks if `value` is the
	* [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	* of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an object, else `false`.
	* @example
	*
	* _.isObject({});
	* // => true
	*
	* _.isObject([1, 2, 3]);
	* // => true
	*
	* _.isObject(_.noop);
	* // => true
	*
	* _.isObject(null);
	* // => false
	*/
	function isObject(value) {
		var type = typeof value;
		return !!value && (type == "object" || type == "function");
	}
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return !!value && typeof value == "object";
	}
	/**
	* Checks if `value` is classified as a `Symbol` primitive or object.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	* @example
	*
	* _.isSymbol(Symbol.iterator);
	* // => true
	*
	* _.isSymbol('abc');
	* // => false
	*/
	function isSymbol(value) {
		return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
	}
	/**
	* Converts `value` to a finite number.
	*
	* @static
	* @memberOf _
	* @since 4.12.0
	* @category Lang
	* @param {*} value The value to convert.
	* @returns {number} Returns the converted number.
	* @example
	*
	* _.toFinite(3.2);
	* // => 3.2
	*
	* _.toFinite(Number.MIN_VALUE);
	* // => 5e-324
	*
	* _.toFinite(Infinity);
	* // => 1.7976931348623157e+308
	*
	* _.toFinite('3.2');
	* // => 3.2
	*/
	function toFinite(value) {
		if (!value) return value === 0 ? value : 0;
		value = toNumber(value);
		if (value === INFINITY || value === -INFINITY) return (value < 0 ? -1 : 1) * MAX_INTEGER;
		return value === value ? value : 0;
	}
	/**
	* Converts `value` to an integer.
	*
	* **Note:** This method is loosely based on
	* [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to convert.
	* @returns {number} Returns the converted integer.
	* @example
	*
	* _.toInteger(3.2);
	* // => 3
	*
	* _.toInteger(Number.MIN_VALUE);
	* // => 0
	*
	* _.toInteger(Infinity);
	* // => 1.7976931348623157e+308
	*
	* _.toInteger('3.2');
	* // => 3
	*/
	function toInteger(value) {
		var result = toFinite(value), remainder = result % 1;
		return result === result ? remainder ? result - remainder : result : 0;
	}
	/**
	* Converts `value` to a number.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to process.
	* @returns {number} Returns the number.
	* @example
	*
	* _.toNumber(3.2);
	* // => 3.2
	*
	* _.toNumber(Number.MIN_VALUE);
	* // => 5e-324
	*
	* _.toNumber(Infinity);
	* // => Infinity
	*
	* _.toNumber('3.2');
	* // => 3.2
	*/
	function toNumber(value) {
		if (typeof value == "number") return value;
		if (isSymbol(value)) return NAN;
		if (isObject(value)) {
			var other = typeof value.valueOf == "function" ? value.valueOf() : value;
			value = isObject(other) ? other + "" : other;
		}
		if (typeof value != "string") return value === 0 ? value : +value;
		value = value.replace(reTrim, "");
		var isBinary = reIsBinary.test(value);
		return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
	}
	module.exports = once;
}));
//#endregion
//#region node_modules/jsonwebtoken/sign.js
var require_sign = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var timespan = require_timespan();
	var PS_SUPPORTED = require_psSupported();
	var validateAsymmetricKey = require_validateAsymmetricKey();
	var jws = require_jws();
	var includes = require_lodash_includes();
	var isBoolean = require_lodash_isboolean();
	var isInteger = require_lodash_isinteger();
	var isNumber = require_lodash_isnumber();
	var isPlainObject = require_lodash_isplainobject();
	var isString = require_lodash_isstring();
	var once = require_lodash_once();
	var { KeyObject, createSecretKey, createPrivateKey } = __require("crypto");
	var SUPPORTED_ALGS = [
		"RS256",
		"RS384",
		"RS512",
		"ES256",
		"ES384",
		"ES512",
		"HS256",
		"HS384",
		"HS512",
		"none"
	];
	if (PS_SUPPORTED) SUPPORTED_ALGS.splice(3, 0, "PS256", "PS384", "PS512");
	var sign_options_schema = {
		expiresIn: {
			isValid: function(value) {
				return isInteger(value) || isString(value) && value;
			},
			message: "\"expiresIn\" should be a number of seconds or string representing a timespan"
		},
		notBefore: {
			isValid: function(value) {
				return isInteger(value) || isString(value) && value;
			},
			message: "\"notBefore\" should be a number of seconds or string representing a timespan"
		},
		audience: {
			isValid: function(value) {
				return isString(value) || Array.isArray(value);
			},
			message: "\"audience\" must be a string or array"
		},
		algorithm: {
			isValid: includes.bind(null, SUPPORTED_ALGS),
			message: "\"algorithm\" must be a valid string enum value"
		},
		header: {
			isValid: isPlainObject,
			message: "\"header\" must be an object"
		},
		encoding: {
			isValid: isString,
			message: "\"encoding\" must be a string"
		},
		issuer: {
			isValid: isString,
			message: "\"issuer\" must be a string"
		},
		subject: {
			isValid: isString,
			message: "\"subject\" must be a string"
		},
		jwtid: {
			isValid: isString,
			message: "\"jwtid\" must be a string"
		},
		noTimestamp: {
			isValid: isBoolean,
			message: "\"noTimestamp\" must be a boolean"
		},
		keyid: {
			isValid: isString,
			message: "\"keyid\" must be a string"
		},
		mutatePayload: {
			isValid: isBoolean,
			message: "\"mutatePayload\" must be a boolean"
		},
		allowInsecureKeySizes: {
			isValid: isBoolean,
			message: "\"allowInsecureKeySizes\" must be a boolean"
		},
		allowInvalidAsymmetricKeyTypes: {
			isValid: isBoolean,
			message: "\"allowInvalidAsymmetricKeyTypes\" must be a boolean"
		}
	};
	var registered_claims_schema = {
		iat: {
			isValid: isNumber,
			message: "\"iat\" should be a number of seconds"
		},
		exp: {
			isValid: isNumber,
			message: "\"exp\" should be a number of seconds"
		},
		nbf: {
			isValid: isNumber,
			message: "\"nbf\" should be a number of seconds"
		}
	};
	function validate(schema, allowUnknown, object, parameterName) {
		if (!isPlainObject(object)) throw new Error("Expected \"" + parameterName + "\" to be a plain object.");
		Object.keys(object).forEach(function(key) {
			const validator = schema[key];
			if (!validator) {
				if (!allowUnknown) throw new Error("\"" + key + "\" is not allowed in \"" + parameterName + "\"");
				return;
			}
			if (!validator.isValid(object[key])) throw new Error(validator.message);
		});
	}
	function validateOptions(options) {
		return validate(sign_options_schema, false, options, "options");
	}
	function validatePayload(payload) {
		return validate(registered_claims_schema, true, payload, "payload");
	}
	var options_to_payload = {
		"audience": "aud",
		"issuer": "iss",
		"subject": "sub",
		"jwtid": "jti"
	};
	var options_for_objects = [
		"expiresIn",
		"notBefore",
		"noTimestamp",
		"audience",
		"issuer",
		"subject",
		"jwtid"
	];
	module.exports = function(payload, secretOrPrivateKey, options, callback) {
		if (typeof options === "function") {
			callback = options;
			options = {};
		} else options = options || {};
		const isObjectPayload = typeof payload === "object" && !Buffer.isBuffer(payload);
		const header = Object.assign({
			alg: options.algorithm || "HS256",
			typ: isObjectPayload ? "JWT" : void 0,
			kid: options.keyid
		}, options.header);
		function failure(err) {
			if (callback) return callback(err);
			throw err;
		}
		if (!secretOrPrivateKey && options.algorithm !== "none") return failure(/* @__PURE__ */ new Error("secretOrPrivateKey must have a value"));
		if (secretOrPrivateKey != null && !(secretOrPrivateKey instanceof KeyObject)) try {
			secretOrPrivateKey = createPrivateKey(secretOrPrivateKey);
		} catch (_) {
			try {
				secretOrPrivateKey = createSecretKey(typeof secretOrPrivateKey === "string" ? Buffer.from(secretOrPrivateKey) : secretOrPrivateKey);
			} catch (_) {
				return failure(/* @__PURE__ */ new Error("secretOrPrivateKey is not valid key material"));
			}
		}
		if (header.alg.startsWith("HS") && secretOrPrivateKey.type !== "secret") return failure(/* @__PURE__ */ new Error(`secretOrPrivateKey must be a symmetric key when using ${header.alg}`));
		else if (/^(?:RS|PS|ES)/.test(header.alg)) {
			if (secretOrPrivateKey.type !== "private") return failure(/* @__PURE__ */ new Error(`secretOrPrivateKey must be an asymmetric key when using ${header.alg}`));
			if (!options.allowInsecureKeySizes && !header.alg.startsWith("ES") && secretOrPrivateKey.asymmetricKeyDetails !== void 0 && secretOrPrivateKey.asymmetricKeyDetails.modulusLength < 2048) return failure(/* @__PURE__ */ new Error(`secretOrPrivateKey has a minimum key size of 2048 bits for ${header.alg}`));
		}
		if (typeof payload === "undefined") return failure(/* @__PURE__ */ new Error("payload is required"));
		else if (isObjectPayload) {
			try {
				validatePayload(payload);
			} catch (error) {
				return failure(error);
			}
			if (!options.mutatePayload) payload = Object.assign({}, payload);
		} else {
			const invalid_options = options_for_objects.filter(function(opt) {
				return typeof options[opt] !== "undefined";
			});
			if (invalid_options.length > 0) return failure(/* @__PURE__ */ new Error("invalid " + invalid_options.join(",") + " option for " + typeof payload + " payload"));
		}
		if (typeof payload.exp !== "undefined" && typeof options.expiresIn !== "undefined") return failure(/* @__PURE__ */ new Error("Bad \"options.expiresIn\" option the payload already has an \"exp\" property."));
		if (typeof payload.nbf !== "undefined" && typeof options.notBefore !== "undefined") return failure(/* @__PURE__ */ new Error("Bad \"options.notBefore\" option the payload already has an \"nbf\" property."));
		try {
			validateOptions(options);
		} catch (error) {
			return failure(error);
		}
		if (!options.allowInvalidAsymmetricKeyTypes) try {
			validateAsymmetricKey(header.alg, secretOrPrivateKey);
		} catch (error) {
			return failure(error);
		}
		const timestamp = payload.iat || Math.floor(Date.now() / 1e3);
		if (options.noTimestamp) delete payload.iat;
		else if (isObjectPayload) payload.iat = timestamp;
		if (typeof options.notBefore !== "undefined") {
			try {
				payload.nbf = timespan(options.notBefore, timestamp);
			} catch (err) {
				return failure(err);
			}
			if (typeof payload.nbf === "undefined") return failure(/* @__PURE__ */ new Error("\"notBefore\" should be a number of seconds or string representing a timespan eg: \"1d\", \"20h\", 60"));
		}
		if (typeof options.expiresIn !== "undefined" && typeof payload === "object") {
			try {
				payload.exp = timespan(options.expiresIn, timestamp);
			} catch (err) {
				return failure(err);
			}
			if (typeof payload.exp === "undefined") return failure(/* @__PURE__ */ new Error("\"expiresIn\" should be a number of seconds or string representing a timespan eg: \"1d\", \"20h\", 60"));
		}
		Object.keys(options_to_payload).forEach(function(key) {
			const claim = options_to_payload[key];
			if (typeof options[key] !== "undefined") {
				if (typeof payload[claim] !== "undefined") return failure(/* @__PURE__ */ new Error("Bad \"options." + key + "\" option. The payload already has an \"" + claim + "\" property."));
				payload[claim] = options[key];
			}
		});
		const encoding = options.encoding || "utf8";
		if (typeof callback === "function") {
			callback = callback && once(callback);
			jws.createSign({
				header,
				privateKey: secretOrPrivateKey,
				payload,
				encoding
			}).once("error", callback).once("done", function(signature) {
				if (!options.allowInsecureKeySizes && /^(?:RS|PS)/.test(header.alg) && signature.length < 256) return callback(/* @__PURE__ */ new Error(`secretOrPrivateKey has a minimum key size of 2048 bits for ${header.alg}`));
				callback(null, signature);
			});
		} else {
			let signature = jws.sign({
				header,
				payload,
				secret: secretOrPrivateKey,
				encoding
			});
			if (!options.allowInsecureKeySizes && /^(?:RS|PS)/.test(header.alg) && signature.length < 256) throw new Error(`secretOrPrivateKey has a minimum key size of 2048 bits for ${header.alg}`);
			return signature;
		}
	};
}));
//#endregion
//#region electron/ipc/_guard.ts
var import_jsonwebtoken = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		decode: require_decode(),
		verify: require_verify(),
		sign: require_sign(),
		JsonWebTokenError: require_JsonWebTokenError(),
		NotBeforeError: require_NotBeforeError(),
		TokenExpiredError: require_TokenExpiredError()
	};
})))(), 1);
function requireAdmin() {
	const user = getCurrentUser();
	if (!user) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
	if (user.role !== "admin") throw new Error("FORBIDDEN: غير مسموح بالوصول لغير المسؤولين / Forbidden");
}
//#endregion
//#region electron/ipc/authIPC.ts
var currentUserSession = null;
function getCurrentUser() {
	return currentUserSession;
}
ipcMain.handle("auth:login", async (_event, { username, password }) => {
	try {
		const user = getDb().prepare("SELECT * FROM users WHERE username = ?").get(username);
		if (!user) throw new Error("USER_NOT_FOUND");
		if (user.is_active === 0) throw new Error("USER_DEACTIVATED");
		if (!await bcryptjs_default.compare(password, user.password)) throw new Error("INVALID_PASSWORD");
		const userData = {
			id: user.id,
			username: user.username,
			role: user.role,
			name: user.name,
			is_active: user.is_active,
			created_at: user.created_at
		};
		const token = import_jsonwebtoken.default.sign({
			id: user.id,
			username: user.username,
			role: user.role
		}, getJwtSecret(), { expiresIn: "30d" });
		currentUserSession = userData;
		return {
			user: userData,
			token
		};
	} catch (error) {
		console.error("Login error:", error);
		if (error.message === "USER_NOT_FOUND" || error.message === "INVALID_PASSWORD") throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة / Invalid username or password");
		else if (error.message === "USER_DEACTIVATED") throw new Error("تم إلغاء تنشيط هذا الحساب / This account has been deactivated");
		throw new Error(error.message || "فشلت عملية تسجيل الدخول / Authentication failed");
	}
});
ipcMain.handle("auth:logout", () => {
	currentUserSession = null;
	return { ok: true };
});
ipcMain.handle("auth:current", () => {
	return currentUserSession ? { user: currentUserSession } : null;
});
/**
* auth:restore — Restore a session from a previously issued JWT (persisted in the
* renderer). Verifies the token, reloads the user from the DB, and re-establishes
* the main-process session so it survives app restarts.
*/
ipcMain.handle("auth:restore", async (_event, { token }) => {
	try {
		if (!token) return null;
		const payload = import_jsonwebtoken.default.verify(token, getJwtSecret());
		const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(payload.id);
		if (!user || user.is_active === 0) {
			currentUserSession = null;
			return null;
		}
		const userData = {
			id: user.id,
			username: user.username,
			role: user.role,
			name: user.name,
			is_active: user.is_active,
			created_at: user.created_at
		};
		currentUserSession = userData;
		return { user: userData };
	} catch {
		currentUserSession = null;
		return null;
	}
});
ipcMain.handle("users:list", async () => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT id, username, role, name, is_active, created_at FROM users").all();
	} catch (error) {
		console.error("Failed to list users:", error);
		throw new Error(error.message || "Failed to list users");
	}
});
ipcMain.handle("users:create", async (_event, { username, password, role, name }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!username || !password || !role) throw new Error("اسم المستخدم وكلمة المرور والصلاحية مطلوبة / Username, password, and role are required");
		if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) throw new Error("اسم المستخدم موجود بالفعل / Username already exists");
		const hashedPassword = await bcryptjs_default.hash(password, 10);
		const result = db.prepare(`
      INSERT INTO users (username, password, role, name, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, hashedPassword, role, name || null);
		return {
			id: Number(result.lastInsertRowid),
			username,
			role,
			name,
			is_active: 1
		};
	} catch (error) {
		console.error("Failed to create user:", error);
		throw new Error(error.message || "Failed to create user");
	}
});
ipcMain.handle("users:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!id || !patch) throw new Error("User ID and patch data are required");
		if (!db.prepare("SELECT * FROM users WHERE id = ?").get(id)) throw new Error("المستخدم غير موجود / User not found");
		let query = "UPDATE users SET ";
		const params = [];
		if (patch.username !== void 0) {
			if (db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(patch.username, id)) throw new Error("اسم المستخدم موجود بالفعل / Username already exists");
			query += "username = ?, ";
			params.push(patch.username);
		}
		if (patch.password !== void 0 && patch.password.trim() !== "") {
			const hashedPassword = await bcryptjs_default.hash(patch.password, 10);
			query += "password = ?, ";
			params.push(hashedPassword);
		}
		if (patch.role !== void 0) {
			query += "role = ?, ";
			params.push(patch.role);
		}
		if (patch.name !== void 0) {
			query += "name = ?, ";
			params.push(patch.name);
		}
		if (patch.is_active !== void 0) {
			const currentUser = getCurrentUser();
			if (currentUser && currentUser.id === id && patch.is_active === 0) throw new Error("لا يمكن إلغاء تنشيط حسابك الحالي / Cannot deactivate your own active session");
			query += "is_active = ?, ";
			params.push(patch.is_active);
		}
		if (params.length === 0) return db.prepare("SELECT id, username, role, name, is_active, created_at FROM users WHERE id = ?").get(id);
		query = query.slice(0, -2);
		query += " WHERE id = ?";
		params.push(id);
		db.prepare(query).run(...params);
		return db.prepare("SELECT id, username, role, name, is_active, created_at FROM users WHERE id = ?").get(id);
	} catch (error) {
		console.error("Failed to update user:", error);
		throw new Error(error.message || "Failed to update user");
	}
});
ipcMain.handle("users:deactivate", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		const currentUser = getCurrentUser();
		if (currentUser && currentUser.id === id) throw new Error("لا يمكن إلغاء تنشيط حسابك الحالي / Cannot deactivate your own active session");
		db.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(id);
		return { ok: true };
	} catch (error) {
		console.error("Failed to deactivate user:", error);
		throw new Error(error.message || "Failed to deactivate user");
	}
});
//#endregion
//#region electron/services/statementService.ts
function getChildStatement(child, existingPayments, currentDate) {
	const arabicMonths = [
		"يناير",
		"فبراير",
		"مارس",
		"أبريل",
		"مايو",
		"يونيو",
		"يوليو",
		"أغسطس",
		"سبتمبر",
		"أكتوبر",
		"نوفمبر",
		"ديسمبر"
	];
	const regDate = new Date(child.reg_date);
	let startYear = regDate.getFullYear();
	let startMonth = regDate.getMonth();
	if (isNaN(startYear) || isNaN(startMonth)) {
		const now = /* @__PURE__ */ new Date();
		startYear = now.getFullYear();
		startMonth = now.getMonth();
	}
	const endYear = currentDate.getFullYear();
	const endMonth = currentDate.getMonth();
	const statementMonths = [];
	let currY = startYear;
	let currM = startMonth;
	if (startYear > endYear || startYear === endYear && startMonth > endMonth) statementMonths.push({
		month: arabicMonths[startMonth],
		year: startYear
	});
	else while (currY < endYear || currY === endYear && currM <= endMonth) {
		statementMonths.push({
			month: arabicMonths[currM],
			year: currY
		});
		currM++;
		if (currM > 11) {
			currM = 0;
			currY++;
		}
	}
	const paymentMap = /* @__PURE__ */ new Map();
	for (const p of existingPayments) {
		const key = `${p.year}-${p.month}`;
		paymentMap.set(key, p);
	}
	const rows = statementMonths.map(({ month, year }) => {
		const key = `${year}-${month}`;
		const existing = paymentMap.get(key);
		if (existing) return {
			month,
			year,
			service: existing.service,
			unit: existing.unit,
			quantity: existing.quantity,
			price: existing.price,
			total: existing.total,
			paid: existing.paid,
			balance: existing.balance,
			status: existing.status,
			notes: existing.notes || ""
		};
		else return {
			month,
			year,
			service: child.service,
			unit: child.unit,
			quantity: 0,
			price: child.price,
			total: 0,
			paid: 0,
			balance: 0,
			status: "unpaid",
			notes: ""
		};
	});
	rows.sort((a, b) => {
		if (a.year !== b.year) return b.year - a.year;
		const idxA = arabicMonths.indexOf(a.month);
		return arabicMonths.indexOf(b.month) - idxA;
	});
	let totalInvoiced = 0;
	let totalCollected = 0;
	let totalBalance = 0;
	for (const row of rows) {
		totalInvoiced += row.total;
		totalCollected += row.paid;
		totalBalance += row.balance;
	}
	return {
		child: {
			id: child.id,
			name: child.name,
			guardian: child.guardian,
			guardian_phone: child.guardian_phone,
			service: child.service,
			unit: child.unit,
			price: child.price,
			reg_date: child.reg_date,
			is_active: child.is_active
		},
		rows,
		summary: {
			activeMonths: statementMonths.length,
			totalInvoiced: Number(totalInvoiced.toFixed(2)),
			totalCollected: Number(totalCollected.toFixed(2)),
			totalBalance: Number(totalBalance.toFixed(2))
		}
	};
}
//#endregion
//#region electron/ipc/childrenIPC.ts
function checkAuth$3() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
ipcMain.handle("children:get", async (_event, { search, service, activeOnly }) => {
	try {
		checkAuth$3();
		const db = getDb();
		let query = "SELECT * FROM children WHERE 1=1";
		const params = [];
		if (search && search.trim() !== "") {
			const searchPattern = `%${search.trim()}%`;
			query += " AND (name LIKE ? OR guardian LIKE ? OR guardian_phone LIKE ? OR child_phone LIKE ? OR national_id LIKE ?)";
			params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
		}
		if (service) {
			query += " AND service = ?";
			params.push(service);
		}
		if (activeOnly !== false) query += " AND is_active = 1";
		query += " ORDER BY name ASC";
		return db.prepare(query).all(...params);
	} catch (error) {
		console.error("Failed to get children:", error);
		throw new Error(error.message || "Failed to get children");
	}
});
ipcMain.handle("children:add", async (_event, childInput) => {
	try {
		requireAdmin();
		const db = getDb();
		const { name, guardian, guardian_phone, child_phone, national_id, service, unit, price, reg_date, notes } = childInput;
		if (!name || !guardian || !guardian_phone || !service || !unit || price === void 0 || !reg_date) throw new Error("جميع الحقول الإلزامية مطلوبة / Missing required fields");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO children (
        name, guardian, guardian_phone, child_phone, national_id, 
        service, unit, price, reg_date, notes, 
        is_active, created_at, updated_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
    `).run(name, guardian, guardian_phone, child_phone || null, national_id || null, service, unit, price, reg_date, notes || null, now, now);
		const createdId = Number(result.lastInsertRowid);
		return db.prepare("SELECT * FROM children WHERE id = ?").get(createdId);
	} catch (error) {
		console.error("Failed to add child:", error);
		throw new Error(error.message || "Failed to add child");
	}
});
ipcMain.handle("children:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!id || !patch) throw new Error("Child ID and patch data are required");
		if (!db.prepare("SELECT id FROM children WHERE id = ?").get(id)) throw new Error("الطفل غير موجود / Child not found");
		let query = "UPDATE children SET ";
		const params = [];
		for (const key of [
			"name",
			"guardian",
			"guardian_phone",
			"child_phone",
			"national_id",
			"service",
			"unit",
			"price",
			"reg_date",
			"notes",
			"is_active"
		]) if (patch[key] !== void 0) {
			query += `${key} = ?, `;
			params.push(patch[key]);
		}
		if (params.length === 0) return db.prepare("SELECT * FROM children WHERE id = ?").get(id);
		query += "updated_at = ?, synced = 0";
		params.push((/* @__PURE__ */ new Date()).toISOString());
		query += " WHERE id = ?";
		params.push(id);
		db.prepare(query).run(...params);
		return db.prepare("SELECT * FROM children WHERE id = ?").get(id);
	} catch (error) {
		console.error("Failed to update child:", error);
		throw new Error(error.message || "Failed to update child");
	}
});
ipcMain.handle("children:deactivate", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!db.prepare("SELECT id FROM children WHERE id = ?").get(id)) throw new Error("الطفل غير موجود / Child not found");
		db.prepare("UPDATE children SET is_active = 0, updated_at = ?, synced = 0 WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
		return { ok: true };
	} catch (error) {
		console.error("Failed to deactivate child:", error);
		throw new Error(error.message || "Failed to deactivate child");
	}
});
ipcMain.handle("children:statement", async (_event, { childId }) => {
	try {
		checkAuth$3();
		if (!childId) throw new Error("Child ID is required");
		const db = getDb();
		const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
		if (!child) throw new Error("الطفل غير موجود / Child not found");
		return getChildStatement(child, db.prepare("SELECT * FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
	} catch (error) {
		console.error("Failed to get child statement:", error);
		throw new Error(error.message || "Failed to get child statement");
	}
});
//#endregion
//#region electron/ipc/paymentsIPC.ts
function calculatePayment(quantity, price, paid) {
	const total = Number((quantity * price).toFixed(2));
	const balance = Number((total - paid).toFixed(2));
	let status = "unpaid";
	if (paid > 0) if (paid >= total) status = "paid";
	else status = "partial";
	return {
		total,
		balance,
		status
	};
}
function checkAuth$2() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
ipcMain.handle("payments:get", async (_event, { month, year }) => {
	try {
		checkAuth$2();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		const payments = db.prepare(`
      SELECT p.*, c.name as child_name 
      FROM payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.month = ? AND p.year = ?
      ORDER BY c.name ASC
    `).all(month, year);
		let totalInvoiced = 0;
		let totalCollected = 0;
		let arrears = 0;
		for (const p of payments) {
			totalInvoiced += p.total;
			totalCollected += p.paid;
			if (p.balance > 0) arrears += p.balance;
		}
		return {
			payments,
			summary: {
				totalInvoiced: Number(totalInvoiced.toFixed(2)),
				totalCollected: Number(totalCollected.toFixed(2)),
				arrears: Number(arrears.toFixed(2))
			}
		};
	} catch (error) {
		console.error("Failed to get payments:", error);
		throw new Error(error.message || "Failed to get payments");
	}
});
ipcMain.handle("payments:generate", async (_event, { month, year }) => {
	try {
		checkAuth$2();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		const activeChildren = db.prepare("SELECT * FROM children WHERE is_active = 1").all();
		let createdCount = 0;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const checkStmt = db.prepare("SELECT id FROM payments WHERE child_id = ? AND month = ? AND year = ?");
		const insertStmt = db.prepare(`
      INSERT INTO payments (
        child_id, month, year, service, unit, quantity, price, total, paid, balance, status, created_at, updated_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0)
    `);
		db.transaction(() => {
			for (const child of activeChildren) if (!checkStmt.get(child.id, month, year)) {
				const quantity = 1;
				const { total, balance, status } = calculatePayment(quantity, child.price, 0);
				insertStmt.run(child.id, month, year, child.service, child.unit, quantity, child.price, total, balance, status, now, now);
				createdCount++;
			}
		})();
		return { created: createdCount };
	} catch (error) {
		console.error("Failed to generate payments:", error);
		throw new Error(error.message || "Failed to generate payments");
	}
});
ipcMain.handle("payments:update", async (_event, { id, quantity, paid, notes }) => {
	try {
		checkAuth$2();
		const db = getDb();
		if (!id) throw new Error("Payment ID is required");
		const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(id);
		if (!payment) throw new Error("سجل الدفع غير موجود / Payment record not found");
		const newQuantity = quantity !== void 0 ? Number(quantity) : payment.quantity;
		const newPaid = paid !== void 0 ? Number(paid) : payment.paid;
		const newNotes = notes !== void 0 ? notes : payment.notes;
		const { total, balance, status } = calculatePayment(newQuantity, payment.price, newPaid);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      UPDATE payments 
      SET quantity = ?, paid = ?, total = ?, balance = ?, status = ?, notes = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(newQuantity, newPaid, total, balance, status, newNotes, now, id);
		return db.prepare(`
      SELECT p.*, c.name as child_name
      FROM payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.id = ?
    `).get(id);
	} catch (error) {
		console.error("Failed to update payment:", error);
		throw new Error(error.message || "Failed to update payment");
	}
});
ipcMain.handle("payments:bulkPay", async (_event, { ids }) => {
	try {
		checkAuth$2();
		const db = getDb();
		if (!ids || !Array.isArray(ids) || ids.length === 0) throw new Error("Payment IDs array is required");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		let updatedCount = 0;
		const loadStmt = db.prepare("SELECT * FROM payments WHERE id = ?");
		const updateStmt = db.prepare(`
      UPDATE payments
      SET paid = total, balance = 0, status = 'paid', updated_at = ?, synced = 0
      WHERE id = ?
    `);
		db.transaction(() => {
			for (const id of ids) if (loadStmt.get(id)) {
				updateStmt.run(now, id);
				updatedCount++;
			}
		})();
		return { updated: updatedCount };
	} catch (error) {
		console.error("Failed to bulk pay payments:", error);
		throw new Error(error.message || "Failed to process bulk payments");
	}
});
//#endregion
//#region electron/ipc/salariesIPC.ts
ipcMain.handle("employees:get", async () => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT * FROM employees ORDER BY name ASC").all();
	} catch (error) {
		console.error("Failed to get employees:", error);
		throw new Error(error.message || "Failed to get employees");
	}
});
ipcMain.handle("employees:add", async (_event, employeeInput) => {
	try {
		requireAdmin();
		const db = getDb();
		const { name, role, base_salary, housing = 0, transport = 0 } = employeeInput;
		if (!name || !role || base_salary === void 0) throw new Error("جميع الحقول الإلزامية مطلوبة / Missing required fields");
		const netSalary = Number(base_salary) + Number(housing) + Number(transport);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO employees (name, role, base_salary, housing, transport, net_salary, is_active, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
    `).run(name, role, Number(base_salary), Number(housing), Number(transport), netSalary, now, now);
		const createdId = Number(result.lastInsertRowid);
		return db.prepare("SELECT * FROM employees WHERE id = ?").get(createdId);
	} catch (error) {
		console.error("Failed to add employee:", error);
		throw new Error(error.message || "Failed to add employee");
	}
});
ipcMain.handle("employees:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!id || !patch) throw new Error("Employee ID and patch are required");
		const emp = db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
		if (!emp) throw new Error("الموظف غير موجود / Employee not found");
		const name = patch.name !== void 0 ? patch.name : emp.name;
		const role = patch.role !== void 0 ? patch.role : emp.role;
		const base_salary = patch.base_salary !== void 0 ? Number(patch.base_salary) : emp.base_salary;
		const housing = patch.housing !== void 0 ? Number(patch.housing) : emp.housing;
		const transport = patch.transport !== void 0 ? Number(patch.transport) : emp.transport;
		const netSalary = base_salary + housing + transport;
		db.prepare(`
      UPDATE employees
      SET name = ?, role = ?, base_salary = ?, housing = ?, transport = ?, net_salary = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(name, role, base_salary, housing, transport, netSalary, (/* @__PURE__ */ new Date()).toISOString(), id);
		return db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
	} catch (error) {
		console.error("Failed to update employee:", error);
		throw new Error(error.message || "Failed to update employee");
	}
});
ipcMain.handle("employees:deactivate", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!db.prepare("SELECT id FROM employees WHERE id = ?").get(id)) throw new Error("الموظف غير موجود / Employee not found");
		db.prepare("UPDATE employees SET is_active = 0, updated_at = ?, synced = 0 WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
		return { ok: true };
	} catch (error) {
		console.error("Failed to deactivate employee:", error);
		throw new Error(error.message || "Failed to deactivate employee");
	}
});
ipcMain.handle("salary:get", async (_event, { month, year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		return db.prepare(`
      SELECT 
        COALESCE(s.id, -e.id) as id,
        e.id as employee_id,
        e.name as employee_name,
        e.role as employee_role,
        e.net_salary as net_salary,
        COALESCE(s.month, ?) as month,
        COALESCE(s.year, ?) as year,
        COALESCE(s.bonus, 0) as bonus,
        COALESCE(s.deductions, 0) as deductions,
        COALESCE(s.actual_paid, e.net_salary) as actual_paid,
        s.paid_date,
        s.paid_date as pay_date,
        s.notes
      FROM employees e
      LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
      WHERE e.is_active = 1 OR s.id IS NOT NULL
      ORDER BY e.name ASC
    `).all(month, year, month, year);
	} catch (error) {
		console.error("Failed to get salary payments:", error);
		throw new Error(error.message || "Failed to get salary payments");
	}
});
ipcMain.handle("salary:update", async (_event, { employee_id, month, year, bonus = 0, deductions = 0, paid_date = null, notes = null }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!employee_id || !month || !year) throw new Error("Employee ID, month, and year are required");
		const emp = db.prepare("SELECT net_salary FROM employees WHERE id = ?").get(employee_id);
		if (!emp) throw new Error("الموظف غير موجود / Employee not found");
		const actualPaid = Number(emp.net_salary) + Number(bonus) - Number(deductions);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      INSERT INTO salary_payments (employee_id, month, year, bonus, deductions, actual_paid, paid_date, notes, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(employee_id, month, year) DO UPDATE SET
        bonus = excluded.bonus,
        deductions = excluded.deductions,
        actual_paid = excluded.actual_paid,
        paid_date = excluded.paid_date,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        synced = 0
    `).run(employee_id, month, Number(year), Number(bonus), Number(deductions), actualPaid, paid_date, notes, now);
		return db.prepare(`
      SELECT s.*, s.paid_date as pay_date, e.name as employee_name, e.role as employee_role
      FROM salary_payments s
      JOIN employees e ON s.employee_id = e.id
      WHERE s.employee_id = ? AND s.month = ? AND s.year = ?
    `).get(employee_id, month, year);
	} catch (error) {
		console.error("Failed to update salary payment:", error);
		throw new Error(error.message || "Failed to update salary payment");
	}
});
//#endregion
//#region electron/ipc/expensesIPC.ts
var arabicMonths$4 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
/**
* expenses:get
* Returns all expense rows for a given year (12 months × all distinct items).
* Items with no recorded amount appear with amount=0.
* Admin only.
*/
ipcMain.handle("expenses:get", async (_event, { year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!year) throw new Error("Year is required");
		const items = db.prepare("SELECT DISTINCT item, category FROM expenses ORDER BY item ASC").all();
		if (items.length === 0) return [];
		const rows = db.prepare("SELECT * FROM expenses WHERE year = ? ORDER BY item ASC").all(year);
		const result = [];
		for (const { item, category } of items) for (const month of arabicMonths$4) {
			const found = rows.find((r) => r.item === item && r.month === month);
			if (found) result.push(found);
			else result.push({
				id: 0,
				item,
				month,
				year: Number(year),
				amount: 0,
				category: category ?? null,
				notes: null,
				created_at: "",
				synced: 0
			});
		}
		return result;
	} catch (error) {
		console.error("Failed to get expenses:", error);
		throw new Error(error.message || "Failed to get expenses");
	}
});
/**
* expenses:update
* Upsert a single expense row for (item, month, year).
* Admin only.
*/
ipcMain.handle("expenses:update", async (_event, { item, month, year, amount, category = null, notes = null }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!item || !month || !year) throw new Error("Item, month, and year are required");
		const amountNum = Number(amount);
		if (isNaN(amountNum) || amountNum < 0) throw new Error("Invalid amount value");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      INSERT INTO expenses (item, month, year, amount, category, notes, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(item, month, year) DO UPDATE SET
        amount = excluded.amount,
        category = excluded.category,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        synced = 0
    `).run(item, month, Number(year), amountNum, category, notes, now, now);
		return db.prepare("SELECT * FROM expenses WHERE item = ? AND month = ? AND year = ?").get(item, month, Number(year));
	} catch (error) {
		console.error("Failed to update expense:", error);
		throw new Error(error.message || "Failed to update expense");
	}
});
/**
* expenses:addItem
* Registers a new expense item name so it shows in the 12-month grid.
* Creates a placeholder row for the current year/current month (amount=0).
* Admin only.
*/
ipcMain.handle("expenses:addItem", async (_event, { item, category = null }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!item || !item.trim()) throw new Error("Item name is required");
		const itemName = item.trim();
		if (db.prepare("SELECT id FROM expenses WHERE item = ?").get(itemName)) throw new Error(`بند "${itemName}" موجود مسبقاً / Item "${itemName}" already exists`);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const year = (/* @__PURE__ */ new Date()).getFullYear();
		db.transaction(() => {
			for (const month of arabicMonths$4) db.prepare(`
          INSERT OR IGNORE INTO expenses (item, month, year, amount, category, notes, created_at, updated_at, synced)
          VALUES (?, ?, ?, 0, ?, NULL, ?, ?, 0)
        `).run(itemName, month, year, category, now, now);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to add expense item:", error);
		throw new Error(error.message || "Failed to add expense item");
	}
});
/**
* expenses:removeItem
* Removes all expense rows for a given item name (all months/years).
* Admin only.
*/
ipcMain.handle("expenses:removeItem", async (_event, { item }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!item || !item.trim()) throw new Error("Item name is required");
		db.prepare("DELETE FROM expenses WHERE item = ?").run(item.trim());
		return { ok: true };
	} catch (error) {
		console.error("Failed to remove expense item:", error);
		throw new Error(error.message || "Failed to remove expense item");
	}
});
//#endregion
//#region electron/ipc/targetIPC.ts
var arabicMonths$3 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
function calcRequiredRevenue(totalExpenses, targetProfitPct) {
	if (targetProfitPct >= 1 || targetProfitPct < 0) return totalExpenses;
	return Number((totalExpenses / (1 - targetProfitPct)).toFixed(2));
}
function calcGap(requiredRevenue, collected) {
	return Number(Math.max(0, requiredRevenue - collected).toFixed(2));
}
function calcCoveragePct(collected, requiredRevenue) {
	if (requiredRevenue <= 0) return 1;
	return Number(Math.min(1, collected / requiredRevenue).toFixed(4));
}
/**
* target:get { year }
* Returns a per-month array of target data for a given year:
* - month, expenses, salaries, totalExpenses
* - targetRequired (revenue needed to hit profit target)
* - collected (amount actually collected)
* - gap
* - coveragePct
* - status: 'met' | 'missed'
*
* Admin only.
*/
ipcMain.handle("target:get", async (_event, { year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!year) throw new Error("Year is required");
		const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get();
		const targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : .2;
		const result = [];
		for (const month of arabicMonths$3) {
			const payments = db.prepare("SELECT paid FROM payments WHERE month = ? AND year = ?").all(month, year);
			const expenses = db.prepare("SELECT amount FROM expenses WHERE month = ? AND year = ?").all(month, year);
			const salaries = db.prepare("SELECT actual_paid FROM salary_payments WHERE month = ? AND year = ?").all(month, year);
			const collected = payments.reduce((s, p) => s + p.paid, 0);
			const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
			const salariesTotal = salaries.reduce((s, s2) => s + s2.actual_paid, 0);
			const totalExpenses = expensesTotal + salariesTotal;
			const targetRequired = calcRequiredRevenue(totalExpenses, targetProfitPct);
			const gap = calcGap(targetRequired, collected);
			const coveragePct = calcCoveragePct(collected, targetRequired);
			result.push({
				month,
				collected: Number(collected.toFixed(2)),
				expenses: Number(expensesTotal.toFixed(2)),
				salaries: Number(salariesTotal.toFixed(2)),
				totalExpenses: Number(totalExpenses.toFixed(2)),
				targetRequired,
				gap,
				coveragePct,
				status: gap === 0 ? "met" : "missed"
			});
		}
		return {
			rows: result,
			targetProfitPct,
			annualCollected: Number(result.reduce((s, r) => s + r.collected, 0).toFixed(2)),
			annualExpenses: Number(result.reduce((s, r) => s + r.totalExpenses, 0).toFixed(2)),
			annualTargetRequired: Number(result.reduce((s, r) => s + r.targetRequired, 0).toFixed(2)),
			annualGap: Number(result.reduce((s, r) => s + r.gap, 0).toFixed(2))
		};
	} catch (error) {
		console.error("Failed to get target data:", error);
		throw new Error(error.message || "Failed to get target data");
	}
});
/**
* target:calc { distribution }
* Computes projected revenue and coverage for a custom service distribution.
* distribution: { حضانة?: number, استضافة?: number, جلسة?: number }
* Admin only.
*/
ipcMain.handle("target:calc", async (_event, { distribution, month, year }) => {
	try {
		requireAdmin();
		const db = getDb();
		const settings = db.prepare("SELECT key, value FROM settings").all();
		const settingMap = {};
		for (const s of settings) settingMap[s.key] = s.value;
		const pricing = {
			حضانة: Number(settingMap["nursery_monthly"] || 2500),
			استضافة: Number(settingMap["hosting_monthly"] || 3e3),
			جلسة: Number(settingMap["session_hourly"] || 100)
		};
		let projectedRevenue = 0;
		const unitsNeeded = {};
		for (const [service, count] of Object.entries(distribution)) {
			const price = pricing[service] ?? 0;
			projectedRevenue += count * price;
		}
		projectedRevenue = Number(projectedRevenue.toFixed(2));
		let targetRequired = 0;
		if (month && year) {
			const expenses = db.prepare("SELECT amount FROM expenses WHERE month = ? AND year = ?").all(month, year);
			const salaries = db.prepare("SELECT actual_paid FROM salary_payments WHERE month = ? AND year = ?").all(month, year);
			const totalExp = expenses.reduce((s, e) => s + e.amount, 0) + salaries.reduce((s, s2) => s + s2.actual_paid, 0);
			const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get();
			targetRequired = calcRequiredRevenue(totalExp, targetProfitRow ? Number(targetProfitRow.value) : .2);
		}
		const coveragePct = targetRequired > 0 ? Number(Math.min(1, projectedRevenue / targetRequired).toFixed(4)) : 0;
		const services = Object.keys(pricing);
		for (const service of services) {
			const price = pricing[service];
			if (price > 0 && targetRequired > 0) unitsNeeded[service] = Math.ceil(targetRequired / (services.length * price));
			else unitsNeeded[service] = 0;
		}
		return {
			projectedRevenue,
			targetRequired,
			coveragePct,
			unitsNeeded,
			pricing
		};
	} catch (error) {
		console.error("Failed to calc target:", error);
		throw new Error(error.message || "Failed to calculate target");
	}
});
//#endregion
//#region electron/ipc/settingsIPC.ts
ipcMain.handle("settings:get", () => {
	try {
		const rows = getDb().prepare("SELECT key, value FROM settings").all();
		const settingsRecord = {};
		for (const row of rows) settingsRecord[row.key] = row.value;
		return settingsRecord;
	} catch (error) {
		console.error("Failed to get settings:", error);
		throw new Error(error.message || "Failed to retrieve settings");
	}
});
ipcMain.handle("settings:update", (_event, settings) => {
	try {
		requireAdmin();
		const db = getDb();
		const updateStmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
		db.transaction(() => {
			for (const [key, value] of Object.entries(settings)) updateStmt.run(key, value);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to update settings:", error);
		throw new Error(error.message || "Failed to update settings");
	}
});
//#endregion
//#region electron/ipc/brandingIPC.ts
function getBrandingSettings(db) {
	const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'brand_%'").all();
	const record = {};
	for (const row of rows) record[row.key] = row.value;
	return record;
}
ipcMain.handle("branding:get", () => {
	try {
		return getBrandingSettings(getDb());
	} catch (error) {
		console.error("Failed to get branding settings:", error);
		throw new Error(error.message || "Failed to retrieve branding settings");
	}
});
ipcMain.handle("branding:save", (_event, brandingData) => {
	try {
		requireAdmin();
		const db = getDb();
		const updateStmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
		db.transaction(() => {
			for (const [key, value] of Object.entries(brandingData)) if (key.startsWith("brand_")) updateStmt.run(key, value);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to save branding:", error);
		throw new Error(error.message || "Failed to save branding");
	}
});
ipcMain.handle("branding:upload-logo", async () => {
	try {
		requireAdmin();
		const result = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [{
				name: "Images",
				extensions: [
					"png",
					"jpg",
					"jpeg",
					"svg"
				]
			}]
		});
		if (result.canceled || result.filePaths.length === 0) return null;
		const srcPath = result.filePaths[0];
		const ext = path.extname(srcPath);
		const destName = `logo_${Date.now()}${ext}`;
		const brandingDir = path.join(app.getPath("userData"), "branding");
		if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
		const destPath = path.join(brandingDir, destName);
		fs.copyFileSync(srcPath, destPath);
		return { path: `branding/${destName}` };
	} catch (error) {
		console.error("Failed to upload logo:", error);
		throw new Error(error.message || "Failed to upload logo");
	}
});
ipcMain.handle("branding:upload-icon", async () => {
	try {
		requireAdmin();
		const result = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [{
				name: "Icons",
				extensions: [
					"ico",
					"png",
					"icns"
				]
			}]
		});
		if (result.canceled || result.filePaths.length === 0) return null;
		const srcPath = result.filePaths[0];
		const ext = path.extname(srcPath);
		const destName = `icon_${Date.now()}${ext}`;
		const brandingDir = path.join(app.getPath("userData"), "branding");
		if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
		const destPath = path.join(brandingDir, destName);
		fs.copyFileSync(srcPath, destPath);
		return { path: `branding/${destName}` };
	} catch (error) {
		console.error("Failed to upload icon:", error);
		throw new Error(error.message || "Failed to upload icon");
	}
});
ipcMain.handle("branding:reset", () => {
	try {
		requireAdmin();
		const db = getDb();
		const defaultBranding = {
			brand_app_name: "أكاديمية زين الدين",
			brand_org_name: "مركز زين الدين للتوحد ونمو الطفل",
			brand_tagline: "رعاية متميزة وتنمية مهارات طفلك",
			brand_primary_color: "#0f766e",
			brand_accent_color: "#f59e0b",
			brand_phone: "+20 123 456 7890",
			brand_address: "القاهرة، مصر",
			brand_email: "info@zaineldeen.com",
			brand_show_logo_sidebar: "1",
			brand_show_logo_login: "1",
			brand_show_logo_export: "1",
			brand_logo_path: "",
			brand_icon_path: ""
		};
		const updateStmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
		db.transaction(() => {
			for (const [key, value] of Object.entries(defaultBranding)) updateStmt.run(key, value);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to reset branding:", error);
		throw new Error(error.message || "Failed to reset branding");
	}
});
//#endregion
//#region electron/services/exportHeader.ts
function getExportHeader() {
	const rows = getDb().prepare("SELECT key, value FROM settings WHERE key LIKE 'brand_%'").all();
	const settings = {};
	for (const r of rows) settings[r.key] = r.value;
	const logoRelPath = settings["brand_logo_path"] || "branding/logo.png";
	const logoPath = path.isAbsolute(logoRelPath) ? logoRelPath : path.join(app.getPath("userData"), logoRelPath);
	return {
		appName: settings["brand_app_name"] || "أكاديمية زين الدين",
		orgName: settings["brand_org_name"] || "مركز زين الدين للتوحد ونمو الطفل",
		tagline: settings["brand_tagline"] || "رعاية متميزة وتنمية مهارات طفلك",
		phone: settings["brand_phone"] || "+20 123 456 7890",
		address: settings["brand_address"] || "القاهرة، مصر",
		email: settings["brand_email"] || "info@zaineldeen.com",
		logoPath: fs.existsSync(logoPath) ? logoPath : "",
		primaryColor: settings["brand_primary_color"] || "#0f766e",
		accentColor: settings["brand_accent_color"] || "#f59e0b",
		showLogo: settings["brand_show_logo_export"] !== "0"
	};
}
//#endregion
//#region electron/services/exportService.ts
var arabicMonths$2 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
var englishMonths$1 = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
var FONT_FAMILY = "Segoe UI";
var HEADER_FILL = {
	type: "pattern",
	pattern: "solid",
	fgColor: { argb: "FFE2E8F0" }
};
var SUBHEADER_FILL = {
	type: "pattern",
	pattern: "solid",
	fgColor: { argb: "FFF1F5F9" }
};
var BORDER_STYLE = {
	top: {
		style: "thin",
		color: { argb: "FFCBD5E1" }
	},
	left: {
		style: "thin",
		color: { argb: "FFCBD5E1" }
	},
	bottom: {
		style: "thin",
		color: { argb: "FFCBD5E1" }
	},
	right: {
		style: "thin",
		color: { argb: "FFCBD5E1" }
	}
};
function getStatusStyle(valStr) {
	const normalStatus = valStr.toLowerCase();
	if (normalStatus === "paid" || normalStatus === "نشط" || normalStatus === "active" || normalStatus === "met" || normalStatus === "target_met" || normalStatus === "مكتمل" || normalStatus === "ناجح") return {
		fill: {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFECFDF5" }
		},
		font: {
			name: FONT_FAMILY,
			color: { argb: "FF065F46" },
			bold: true
		}
	};
	if (normalStatus === "unpaid" || normalStatus === "غير نشط" || normalStatus === "inactive" || normalStatus === "missed" || normalStatus === "target_missed" || normalStatus === "عجز" || normalStatus === "غير مكتمل") return {
		fill: {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFFEF2F2" }
		},
		font: {
			name: FONT_FAMILY,
			color: { argb: "FF991B1B" },
			bold: true
		}
	};
	if (normalStatus === "partial" || normalStatus === "جزئي") return {
		fill: {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFFDF6B2" }
		},
		font: {
			name: FONT_FAMILY,
			color: { argb: "FF723B10" },
			bold: true
		}
	};
	return null;
}
function writeBrandingHeader(worksheet, workbook, brand, lang, titleText) {
	worksheet.views = [{
		showGridLines: true,
		rightToLeft: lang === "ar"
	}];
	if (brand.showLogo && brand.logoPath && fs.existsSync(brand.logoPath)) try {
		const logoId = workbook.addImage({
			filename: brand.logoPath,
			extension: "png"
		});
		worksheet.addImage(logoId, {
			tl: {
				col: 0,
				row: 0
			},
			ext: {
				width: 90,
				height: 60
			}
		});
	} catch (e) {
		console.error("Failed to embed logo in Excel:", e);
	}
	const row1 = worksheet.getRow(1);
	row1.height = 30;
	const titleCell = worksheet.getCell(lang === "ar" ? "D1" : "B1");
	titleCell.value = brand.orgName;
	titleCell.font = {
		name: FONT_FAMILY,
		size: 16,
		bold: true,
		color: { argb: "FF0F766E" }
	};
	const row2 = worksheet.getRow(2);
	row2.height = 20;
	const taglineCell = worksheet.getCell(lang === "ar" ? "D2" : "B2");
	taglineCell.value = brand.tagline;
	taglineCell.font = {
		name: FONT_FAMILY,
		size: 10,
		italic: true,
		color: { argb: "FF64748B" }
	};
	const row3 = worksheet.getRow(3);
	row3.height = 18;
	const contactsCell = worksheet.getCell(lang === "ar" ? "D3" : "B3");
	contactsCell.value = `${lang === "ar" ? "هاتف:" : "Tel:"} ${brand.phone} | ${lang === "ar" ? "عنوان:" : "Addr:"} ${brand.address} | ${lang === "ar" ? "بريد:" : "Email:"} ${brand.email}`;
	contactsCell.font = {
		name: FONT_FAMILY,
		size: 9,
		color: { argb: "FF64748B" }
	};
	const row5 = worksheet.getRow(5);
	row5.height = 25;
	const docTitleCell = worksheet.getCell("A5");
	docTitleCell.value = titleText;
	docTitleCell.font = {
		name: FONT_FAMILY,
		size: 14,
		bold: true,
		color: { argb: "FF1E293B" }
	};
	return 6;
}
function autofitColumns(worksheet, minWidth = 12) {
	worksheet.columns.forEach((column) => {
		let maxLength = 0;
		column.eachCell?.({ includeEmpty: true }, (cell) => {
			if (cell.value) {
				const valStr = cell.value.toString();
				if (valStr.length > maxLength) maxLength = valStr.length;
			}
		});
		column.width = Math.max(minWidth, maxLength + 4);
	});
}
function formatGridData(worksheet, startRow, currencyCols = [], percentCols = [], statusColIdx = -1) {
	worksheet.eachRow((row, rowNumber) => {
		if (rowNumber < startRow) return;
		row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
			cell.font = cell.font || {
				name: FONT_FAMILY,
				size: 10
			};
			cell.border = BORDER_STYLE;
			if (currencyCols.includes(colNumber)) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
			if (percentCols.includes(colNumber)) {
				cell.numFmt = "0%";
				cell.alignment = { horizontal: "right" };
			}
		});
		if (statusColIdx > 0) {
			const statusCell = row.getCell(statusColIdx);
			if (statusCell && statusCell.value) {
				const style = getStatusStyle(statusCell.value.toString());
				if (style) {
					statusCell.fill = style.fill;
					statusCell.font = style.font;
				}
			}
		}
	});
}
function generateMonthSheet(worksheet, workbook, brand, month, year, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `مطالبات شهر ${month} لسنة ${year}` : `Billing Sheet: ${month} ${year}`);
	const headers = lang === "ar" ? [
		"اسم الطفل 👶",
		"ولي الأمر 👤",
		"الهاتف 📞",
		"الخدمة ⚙️",
		"الوحدة 📦",
		"الكمية 🔢",
		"السعر 💰",
		"الإجمالي 💵",
		"المحصل ✅",
		"المتأخرات ⚠️",
		"الحالة 📊",
		"ملاحظات 📝"
	] : [
		"Child Name 👶",
		"Guardian 👤",
		"Phone 📞",
		"Service ⚙️",
		"Unit 📦",
		"Qty 🔢",
		"Price 💰",
		"Total 💵",
		"Paid ✅",
		"Arrears ⚠️",
		"Status 📊",
		"Notes 📝"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true,
			color: { argb: "FF1E293B" }
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const payments = db.prepare(`
    SELECT p.id, c.name as child_name, c.guardian, c.guardian_phone, p.service, p.unit, p.quantity, p.price, p.total, p.paid, p.balance, p.status, p.notes
    FROM payments p
    JOIN children c ON p.child_id = c.id
    WHERE p.month = ? AND p.year = ?
  `).all(month, year);
	let currentRow = startRow + 1;
	for (const p of payments) {
		const rowValues = [
			p.child_name,
			p.guardian,
			p.guardian_phone,
			p.service,
			p.unit,
			p.quantity,
			p.price,
			p.total,
			p.paid,
			p.balance,
			p.status,
			p.notes || ""
		];
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	if (payments.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		const labelCol = 1;
		totalRow.getCell(labelCol).value = lang === "ar" ? "إجمالي المحاسبة" : "Totals";
		totalRow.getCell(labelCol).font = {
			name: FONT_FAMILY,
			size: 11,
			bold: true
		};
		const totalFormulaCol = 8;
		const paidFormulaCol = 9;
		const balanceFormulaCol = 10;
		totalRow.getCell(totalFormulaCol).value = { formula: `SUM(H${startRow + 1}:H${currentRow - 1})` };
		totalRow.getCell(paidFormulaCol).value = { formula: `SUM(I${startRow + 1}:I${currentRow - 1})` };
		totalRow.getCell(balanceFormulaCol).value = { formula: `SUM(J${startRow + 1}:J${currentRow - 1})` };
		for (let c = 1; c <= 12; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if ([
				totalFormulaCol,
				paidFormulaCol,
				balanceFormulaCol
			].includes(c)) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	formatGridData(worksheet, startRow + 1, [
		7,
		8,
		9,
		10
	], [], 11);
	autofitColumns(worksheet);
}
function generateChildrenSheet(worksheet, workbook, brand, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? "سجل بيانات الأطفال المسجلين" : "Children Roster");
	const headers = lang === "ar" ? [
		"اسم الطفل",
		"ولي الأمر",
		"هاتف ولي الأمر",
		"هاتف الطفل",
		"الرقم القومي",
		"الخدمة الأساسية",
		"الوحدة المحتسبة",
		"السعر المتفق عليه",
		"تاريخ التسجيل",
		"الحالة",
		"ملاحظات"
	] : [
		"Child Name",
		"Guardian",
		"Guardian Phone",
		"Child Phone",
		"National ID",
		"Default Service",
		"Billing Unit",
		"Agreed Price",
		"Reg Date",
		"Status",
		"Notes"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const children = db.prepare("SELECT name, guardian, guardian_phone, child_phone, national_id, service, unit, price, reg_date, is_active, notes FROM children").all();
	let currentRow = startRow + 1;
	for (const c of children) {
		const statusStr = c.is_active ? lang === "ar" ? "نشط" : "Active" : lang === "ar" ? "غير نشط" : "Inactive";
		const rowValues = [
			c.name,
			c.guardian,
			c.guardian_phone,
			c.child_phone || "",
			c.national_id || "",
			c.service,
			c.unit,
			c.price,
			c.reg_date,
			statusStr,
			c.notes || ""
		];
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	formatGridData(worksheet, startRow + 1, [8], [], 10);
	autofitColumns(worksheet);
}
function generateSalariesSheet(worksheet, workbook, brand, month, year, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `رواتب ومكافآت الموظفين لشهر ${month} لسنة ${year}` : `Employee Payroll: ${month} ${year}`);
	const headers = lang === "ar" ? [
		"اسم الموظف",
		"الوظيفة / الصلاحية",
		"الراتب الأساسي",
		"بدل السكن",
		"بدل الانتقال",
		"صافي الراتب المستحق",
		"مكافآت الشهر",
		"خصومات الشهر",
		"المدفوع الفعلي",
		"تاريخ الصرف",
		"ملاحظات"
	] : [
		"Employee Name",
		"Role",
		"Base Salary",
		"Housing Allow",
		"Transport Allow",
		"Net Salary",
		"Bonuses",
		"Deductions",
		"Actual Paid",
		"Pay Date",
		"Notes"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const payroll = db.prepare(`
    SELECT e.name, e.role, e.base_salary, e.housing, e.transport, e.net_salary,
           s.bonus, s.deductions, s.actual_paid, s.paid_date as pay_date, s.notes
    FROM employees e
    LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
    WHERE e.is_active = 1 OR s.id IS NOT NULL
  `).all(month, year);
	let currentRow = startRow + 1;
	for (const p of payroll) {
		const bonus = p.bonus || 0;
		const deductions = p.deductions || 0;
		const actualPaid = p.actual_paid !== null && p.actual_paid !== void 0 ? p.actual_paid : p.net_salary || 0;
		const rowValues = [
			p.name,
			p.role === "admin" ? lang === "ar" ? "مسؤول" : "Admin" : lang === "ar" ? "موظف" : "Employee",
			p.base_salary,
			p.housing,
			p.transport,
			p.net_salary,
			bonus,
			deductions,
			actualPaid,
			p.pay_date || "",
			p.notes || ""
		];
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	if (payroll.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "إجمالي الرواتب والمنصرف" : "Total Payroll";
		totalRow.getCell(3).value = { formula: `SUM(C${startRow + 1}:C${currentRow - 1})` };
		totalRow.getCell(4).value = { formula: `SUM(D${startRow + 1}:D${currentRow - 1})` };
		totalRow.getCell(5).value = { formula: `SUM(E${startRow + 1}:E${currentRow - 1})` };
		totalRow.getCell(6).value = { formula: `SUM(F${startRow + 1}:F${currentRow - 1})` };
		totalRow.getCell(7).value = { formula: `SUM(G${startRow + 1}:G${currentRow - 1})` };
		totalRow.getCell(8).value = { formula: `SUM(H${startRow + 1}:H${currentRow - 1})` };
		totalRow.getCell(9).value = { formula: `SUM(I${startRow + 1}:I${currentRow - 1})` };
		for (let c = 1; c <= 11; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if (c >= 3 && c <= 9) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	formatGridData(worksheet, startRow + 1, [
		3,
		4,
		5,
		6,
		7,
		8,
		9
	]);
	autofitColumns(worksheet);
}
function generateEmployeesSheet(worksheet, workbook, brand, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? "سجل الموظفين" : "Employees Roster");
	const headers = lang === "ar" ? [
		"اسم الموظف",
		"الوظيفة",
		"الراتب الأساسي",
		"بدل السكن",
		"بدل الانتقال",
		"صافي الراتب",
		"الحالة"
	] : [
		"Employee Name",
		"Role",
		"Base Salary",
		"Housing Allow",
		"Transport Allow",
		"Net Salary",
		"Status"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const employees = db.prepare(`
    SELECT name, role, base_salary, housing, transport, net_salary, is_active
    FROM employees
    ORDER BY is_active DESC, name ASC
  `).all();
	let currentRow = startRow + 1;
	for (const e of employees) {
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = [
			e.name,
			e.role,
			e.base_salary,
			e.housing,
			e.transport,
			e.net_salary,
			e.is_active === 1 ? lang === "ar" ? "نشط" : "Active" : lang === "ar" ? "غير نشط" : "Inactive"
		];
		dataRow.height = 20;
		currentRow++;
	}
	if (employees.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "الإجمالي" : "Totals";
		totalRow.getCell(3).value = { formula: `SUM(C${startRow + 1}:C${currentRow - 1})` };
		totalRow.getCell(4).value = { formula: `SUM(D${startRow + 1}:D${currentRow - 1})` };
		totalRow.getCell(5).value = { formula: `SUM(E${startRow + 1}:E${currentRow - 1})` };
		totalRow.getCell(6).value = { formula: `SUM(F${startRow + 1}:F${currentRow - 1})` };
		for (let c = 1; c <= 7; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if (c >= 3 && c <= 6) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	formatGridData(worksheet, startRow + 1, [
		3,
		4,
		5,
		6
	]);
	autofitColumns(worksheet);
}
function generateExpensesSheet(worksheet, workbook, brand, year, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `بيان المصاريف التشغيلية السنوية لسنة ${year}` : `Annual Expenses Sheet: ${year}`);
	const headers = [
		lang === "ar" ? "بند المصاريف" : "Expense Item",
		lang === "ar" ? "التصنيف" : "Category",
		...arabicMonths$2.map((m, idx) => lang === "ar" ? m : englishMonths$1[idx]),
		lang === "ar" ? "الإجمالي السنوي" : "Annual Total"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const items = db.prepare("SELECT DISTINCT item, category FROM expenses WHERE year = ? UNION SELECT DISTINCT item, category FROM expenses").all(year);
	let currentRow = startRow + 1;
	for (const it of items) {
		const rowValues = [it.item, it.category || ""];
		for (const m of arabicMonths$2) {
			const expenseRow = db.prepare("SELECT amount FROM expenses WHERE item = ? AND month = ? AND year = ?").get(it.item, m, year);
			rowValues.push(expenseRow ? expenseRow.amount : 0);
		}
		rowValues.push({ formula: `SUM(C${currentRow}:N${currentRow})` });
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	if (items.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "إجمالي المصاريف الشهرية" : "Monthly Cost Sum";
		for (let c = 3; c <= 15; c++) {
			const colLetter = worksheet.getColumn(c).letter;
			totalRow.getCell(c).value = { formula: `SUM(${colLetter}${startRow + 1}:${colLetter}${currentRow - 1})` };
		}
		for (let c = 1; c <= 15; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if (c >= 3) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	const currencyColumns = Array.from({ length: 13 }, (_, i) => i + 3);
	formatGridData(worksheet, startRow + 1, currencyColumns);
	autofitColumns(worksheet);
}
function generateChildStatementSheet(worksheet, workbook, brand, childId, lang) {
	const db = getDb();
	const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
	if (!child) throw new Error(`Child not found with ID: ${childId}`);
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `كشف حساب الطفل: ${child.name}` : `Account Statement: ${child.name}`);
	const detailsRow1 = worksheet.getRow(startRow);
	detailsRow1.height = 20;
	detailsRow1.getCell(1).value = lang === "ar" ? "اسم ولي الأمر:" : "Guardian:";
	detailsRow1.getCell(2).value = child.guardian;
	detailsRow1.getCell(4).value = lang === "ar" ? "الهاتف:" : "Phone:";
	detailsRow1.getCell(5).value = child.guardian_phone;
	const detailsRow2 = worksheet.getRow(startRow + 1);
	detailsRow2.height = 20;
	detailsRow2.getCell(1).value = lang === "ar" ? "الخدمة الأساسية:" : "Service:";
	detailsRow2.getCell(2).value = child.service;
	detailsRow2.getCell(4).value = lang === "ar" ? "تاريخ التسجيل:" : "Reg Date:";
	detailsRow2.getCell(5).value = child.reg_date;
	for (const r of [startRow, startRow + 1]) {
		const row = worksheet.getRow(r);
		row.getCell(1).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true,
			color: { argb: "FF64748B" }
		};
		row.getCell(4).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true,
			color: { argb: "FF64748B" }
		};
		row.getCell(2).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		row.getCell(5).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
	}
	const tableHeaderRowIdx = startRow + 3;
	const headers = lang === "ar" ? [
		"الشهر",
		"السنة",
		"الخدمة المقدمة",
		"الكمية",
		"السعر",
		"الإجمالي المطلوب",
		"المبلغ المدفوع",
		"المتأخرات / الرصيد",
		"الحالة",
		"ملاحظات"
	] : [
		"Month",
		"Year",
		"Service",
		"Quantity",
		"Price",
		"Total Invoiced",
		"Amount Paid",
		"Balance / Credit",
		"Status",
		"Notes"
	];
	const headerRow = worksheet.getRow(tableHeaderRowIdx);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const statement = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status, notes FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
	let currentRow = tableHeaderRowIdx + 1;
	for (const p of statement.rows) {
		const rowValues = [
			translateMonthName(p.month, lang),
			p.year,
			p.service,
			p.quantity,
			p.price,
			p.total,
			p.paid,
			p.balance,
			p.status,
			p.notes || ""
		];
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	if (statement.rows.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "إجمالي الحساب التراكمي" : "Cumulative Totals";
		totalRow.getCell(6).value = { formula: `SUM(F${tableHeaderRowIdx + 1}:F${currentRow - 1})` };
		totalRow.getCell(7).value = { formula: `SUM(G${tableHeaderRowIdx + 1}:G${currentRow - 1})` };
		totalRow.getCell(8).value = { formula: `SUM(H${tableHeaderRowIdx + 1}:H${currentRow - 1})` };
		for (let c = 1; c <= 10; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if ([
				6,
				7,
				8
			].includes(c)) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	formatGridData(worksheet, tableHeaderRowIdx + 1, [
		5,
		6,
		7,
		8
	], [], 9);
	autofitColumns(worksheet);
}
function translateMonthName(mAr, lang) {
	if (lang === "ar") return mAr;
	const idx = arabicMonths$2.indexOf(mAr);
	return idx !== -1 ? englishMonths$1[idx] : mAr;
}
async function buildExcelFile(type, params, savePath) {
	const { month, year, childId, lang = "ar" } = params;
	const workbook = new ExcelJS.Workbook();
	const brand = getExportHeader();
	if (type === "month") {
		const sheetName = lang === "ar" ? `${month} ${year}` : `${month}_${year}`;
		generateMonthSheet(workbook.addWorksheet(sheetName), workbook, brand, month, year, lang);
	} else if (type === "child") generateChildStatementSheet(workbook.addWorksheet(lang === "ar" ? "كشف الحساب" : "Statement"), workbook, brand, Number(childId), lang);
	else if (type === "salaries") {
		const sheetName = lang === "ar" ? "الرواتب" : "Salaries";
		generateSalariesSheet(workbook.addWorksheet(sheetName), workbook, brand, month, year, lang);
	} else if (type === "expenses") {
		const sheetName = lang === "ar" ? "المصاريف" : "Expenses";
		generateExpensesSheet(workbook.addWorksheet(sheetName), workbook, brand, year, lang);
	} else if (type === "employees") {
		const sheetName = lang === "ar" ? "الموظفون" : "Employees";
		generateEmployeesSheet(workbook.addWorksheet(sheetName), workbook, brand, lang);
	} else if (type === "full") {
		const wsDash = workbook.addWorksheet(lang === "ar" ? "لوحة القيادة" : "Dashboard");
		wsDash.views = [{
			showGridLines: true,
			rightToLeft: lang === "ar"
		}];
		const startRow = writeBrandingHeader(wsDash, workbook, brand, lang, lang === "ar" ? "الملخص المالي السنوي العام" : "Annual Summary Dashboard");
		wsDash.getCell(`A${startRow}`).value = lang === "ar" ? "تحليل السنة المالية:" : "Fiscal Year Analysis:";
		wsDash.getCell(`A${startRow}`).font = {
			name: FONT_FAMILY,
			size: 11,
			bold: true
		};
		wsDash.getCell(`B${startRow}`).value = year;
		const db = getDb();
		const payRows = db.prepare("SELECT total, paid, balance FROM payments WHERE year = ?").all(year);
		const expRows = db.prepare("SELECT amount FROM expenses WHERE year = ?").all(year);
		const salRows = db.prepare("SELECT actual_paid FROM salary_payments WHERE year = ?").all(year);
		const invoiced = payRows.reduce((s, r) => s + r.total, 0);
		const collected = payRows.reduce((s, r) => s + r.paid, 0);
		const arrears = payRows.reduce((s, r) => s + Math.max(0, r.balance), 0);
		const expTotal = expRows.reduce((s, r) => s + r.amount, 0);
		const salTotal = salRows.reduce((s, r) => s + r.actual_paid, 0);
		const netProfit = collected - (expTotal + salTotal);
		const collectionRate = invoiced > 0 ? collected / invoiced : 0;
		const wsDashValues = [
			[lang === "ar" ? "إجمالي المطلوب سداده" : "Total Invoiced", invoiced],
			[lang === "ar" ? "إجمالي المبالغ المحصلة" : "Total Collected", collected],
			[lang === "ar" ? "إجمالي المتأخرات المستحقة" : "Outstanding Arrears", arrears],
			[lang === "ar" ? "إجمالي المصاريف التشغيلية" : "Operational Cost", expTotal],
			[lang === "ar" ? "إجمالي المرتبات المنصرفة" : "Employee Salaries", salTotal],
			[lang === "ar" ? "صافي الأرباح المحققة" : "Net Annual Profit", netProfit],
			[lang === "ar" ? "معدل التحصيل السنوي" : "Annual Collection Rate", collectionRate]
		];
		let rIdx = startRow + 2;
		for (const [lbl, val] of wsDashValues) {
			wsDash.getCell(`A${rIdx}`).value = lbl;
			wsDash.getCell(`B${rIdx}`).value = val;
			wsDash.getCell(`A${rIdx}`).font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			wsDash.getCell(`B${rIdx}`).font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			wsDash.getCell(`A${rIdx}`).border = BORDER_STYLE;
			wsDash.getCell(`B${rIdx}`).border = BORDER_STYLE;
			if (lbl === (lang === "ar" ? "معدل التحصيل السنوي" : "Annual Collection Rate")) wsDash.getCell(`B${rIdx}`).numFmt = "0%";
			else wsDash.getCell(`B${rIdx}`).numFmt = "#,##0.00";
			rIdx++;
		}
		autofitColumns(wsDash);
		generateChildrenSheet(workbook.addWorksheet(lang === "ar" ? "الأطفال" : "Children"), workbook, brand, lang);
		generateSalariesSheet(workbook.addWorksheet(lang === "ar" ? "الرواتب" : "Salaries"), workbook, brand, "ديسمبر", year, lang);
		generateExpensesSheet(workbook.addWorksheet(lang === "ar" ? "المصاريف" : "Expenses"), workbook, brand, year, lang);
		for (const m of arabicMonths$2) generateMonthSheet(workbook.addWorksheet(m), workbook, brand, m, year, lang);
	}
	await workbook.xlsx.writeFile(savePath);
}
//#endregion
//#region node_modules/arabic-persian-reshaper/PersianShaper.js
var require_PersianShaper = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Node Arabic & Persian String Reshaper by Shen Yiming (https://github.com/soimy/arabic-persian-reshaper)
	* Forked from (https://github.com/font-store/persian-reshaper)
	* Based on (https://raw.github.com/Accorpa/Arabic-Converter-From-and-To-Arabic-Presentation-Forms-B/)
	*/
	var charsMap = [
		[
			1569,
			65152,
			null,
			null,
			null
		],
		[
			1570,
			65153,
			null,
			null,
			65154
		],
		[
			1571,
			65155,
			null,
			null,
			65156
		],
		[
			1572,
			65157,
			null,
			null,
			65158
		],
		[
			1573,
			65159,
			null,
			null,
			65160
		],
		[
			1574,
			65161,
			65163,
			65164,
			65162
		],
		[
			1575,
			65165,
			null,
			null,
			65166
		],
		[
			1576,
			65167,
			65169,
			65170,
			65168
		],
		[
			1577,
			65171,
			null,
			null,
			65172
		],
		[
			1578,
			65173,
			65175,
			65176,
			65174
		],
		[
			1579,
			65177,
			65179,
			65180,
			65178
		],
		[
			1580,
			65181,
			65183,
			65184,
			65182
		],
		[
			1581,
			65185,
			65187,
			65188,
			65186
		],
		[
			1582,
			65189,
			65191,
			65192,
			65190
		],
		[
			1583,
			65193,
			null,
			null,
			65194
		],
		[
			1584,
			65195,
			null,
			null,
			65196
		],
		[
			1585,
			65197,
			null,
			null,
			65198
		],
		[
			1586,
			65199,
			null,
			null,
			65200
		],
		[
			1688,
			64394,
			null,
			null,
			64395
		],
		[
			1587,
			65201,
			65203,
			65204,
			65202
		],
		[
			1588,
			65205,
			65207,
			65208,
			65206
		],
		[
			1589,
			65209,
			65211,
			65212,
			65210
		],
		[
			1590,
			65213,
			65215,
			65216,
			65214
		],
		[
			1591,
			65217,
			65219,
			65220,
			65218
		],
		[
			1592,
			65221,
			65223,
			65224,
			65222
		],
		[
			1593,
			65225,
			65227,
			65228,
			65226
		],
		[
			1594,
			65229,
			65231,
			65232,
			65230
		],
		[
			1600,
			1600,
			1600,
			1600,
			1600
		],
		[
			1601,
			65233,
			65235,
			65236,
			65234
		],
		[
			1602,
			65237,
			65239,
			65240,
			65238
		],
		[
			1603,
			65241,
			65243,
			65244,
			65242
		],
		[
			1604,
			65245,
			65247,
			65248,
			65246
		],
		[
			1605,
			65249,
			65251,
			65252,
			65250
		],
		[
			1606,
			65253,
			65255,
			65256,
			65254
		],
		[
			1607,
			65257,
			65259,
			65260,
			65258
		],
		[
			1608,
			65261,
			null,
			null,
			65262
		],
		[
			1609,
			65263,
			null,
			null,
			65264
		],
		[
			1610,
			65265,
			65267,
			65268,
			65266
		],
		[
			1740,
			64508,
			64510,
			64511,
			64509
		],
		[
			1670,
			64378,
			64380,
			64381,
			64379
		],
		[
			1662,
			64342,
			64344,
			64345,
			64343
		],
		[
			1711,
			64402,
			64404,
			64405,
			64403
		],
		[
			1705,
			64398,
			64400,
			64401,
			64399
		]
	], combCharsMap = [[
		[1604, 1575],
		65275,
		null,
		null,
		65276
	]], transChars = [
		1552,
		1554,
		1555,
		1556,
		1557,
		1611,
		1612,
		1613,
		1614,
		1615,
		1616,
		1617,
		1618,
		1619,
		1620,
		1621,
		1622,
		1623,
		1624,
		1648,
		1750,
		1751,
		1752,
		1753,
		1754,
		1755,
		1756,
		1759,
		1760,
		1761,
		1762,
		1763,
		1764,
		1767,
		1768,
		1770,
		1771,
		1772,
		1773
	];
	function CharacterMapContains(c) {
		for (var i = 0; i < charsMap.length; ++i) if (charsMap[i][0] == c) return true;
		return false;
	}
	function GetCharRep(c) {
		for (var i = 0; i < charsMap.length; ++i) if (charsMap[i][0] == c) return charsMap[i];
		return false;
	}
	function GetCombCharRep(c1, c2) {
		for (var i = 0; i < combCharsMap.length; ++i) if (combCharsMap[i][0][0] == c1 && combCharsMap[i][0][1] == c2) return combCharsMap[i];
		return false;
	}
	function IsTransparent(c) {
		for (var i = 0; i < transChars.length; ++i) if (transChars[i] == c) return true;
		return false;
	}
	function convertArabic(normal) {
		var crep, combcrep, shaped = "";
		for (var i = 0; i < normal.length; ++i) {
			var current = normal.charCodeAt(i);
			if (CharacterMapContains(current)) {
				var prev = null, next = null, prevID = i - 1, nextID = i + 1;
				for (; prevID >= 0; --prevID) if (!IsTransparent(normal.charCodeAt(prevID))) break;
				prev = prevID >= 0 ? normal.charCodeAt(prevID) : null;
				crep = prev ? GetCharRep(prev) : false;
				if (crep[2] == null && crep[3] == null) prev = null;
				for (; nextID < normal.length; ++nextID) if (!IsTransparent(normal.charCodeAt(nextID))) break;
				next = nextID <= normal.length ? normal.charCodeAt(nextID) : null;
				crep = next ? GetCharRep(next) : false;
				if (crep[3] == null && crep[4] == null) next = null;
				if (current == 1604 && next != null && (next == 1570 || next == 1571 || next == 1573 || next == 1575)) {
					combcrep = GetCombCharRep(current, next);
					if (prev != null) shaped += String.fromCharCode(combcrep[4]);
					else shaped += String.fromCharCode(combcrep[1]);
					i = i + 1;
					continue;
				}
				crep = GetCharRep(current);
				if (prev != null && next != null && crep[3] != null) {
					shaped += String.fromCharCode(crep[3]);
					continue;
				} else if (prev != null && crep[4] != null) {
					shaped += String.fromCharCode(crep[4]);
					continue;
				} else if (next != null && crep[2] != null) {
					shaped += String.fromCharCode(crep[2]);
					continue;
				} else shaped += String.fromCharCode(crep[1]);
			} else shaped += String.fromCharCode(current);
		}
		return shaped;
	}
	exports.convertArabic = convertArabic;
	function convertArabicBack(apfb) {
		var toReturn = "", selectedChar;
		theLoop: for (var i = 0; i < apfb.length; ++i) {
			selectedChar = apfb.charCodeAt(i);
			for (var j = 0; j < charsMap.length; ++j) if (charsMap[j][4] == selectedChar || charsMap[j][2] == selectedChar || charsMap[j][1] == selectedChar || charsMap[j][3] == selectedChar) {
				toReturn += String.fromCharCode(charsMap[j][0]);
				continue theLoop;
			}
			for (var j = 0; j < combCharsMap.length; ++j) if (combCharsMap[j][4] == selectedChar || combCharsMap[j][2] == selectedChar || combCharsMap[j][1] == selectedChar || combCharsMap[j][3] == selectedChar) {
				toReturn += String.fromCharCode(combCharsMap[j][0][0]) + String.fromCharCode(combCharsMap[j][0][1]);
				continue theLoop;
			}
			toReturn += String.fromCharCode(selectedChar);
		}
		return toReturn;
	}
	exports.convertArabicBack = convertArabicBack;
}));
//#endregion
//#region node_modules/arabic-persian-reshaper/ArabicShaper.js
var require_ArabicShaper = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	*
	*	Edited By Alex Clay to add Arabic characters not included in Persian.
	*	https://github.com/alex-clay/arabic-persian-reshaper
	*
	* Node Arabic & Persian String Reshaper by Shen Yiming (https://github.com/soimy/arabic-persian-reshaper)
	* Forked from (https://github.com/font-store/persian-reshaper)
	* Based on (https://raw.github.com/Accorpa/Arabic-Converter-From-and-To-Arabic-Presentation-Forms-B/)
	*/
	var charsMap = [
		[
			1569,
			65152,
			null,
			null,
			null
		],
		[
			1570,
			65153,
			null,
			null,
			65154
		],
		[
			1571,
			65155,
			null,
			null,
			65156
		],
		[
			1572,
			65157,
			null,
			null,
			65158
		],
		[
			1573,
			65159,
			null,
			null,
			65160
		],
		[
			1574,
			65161,
			65163,
			65164,
			65162
		],
		[
			1575,
			65165,
			null,
			null,
			65166
		],
		[
			1576,
			65167,
			65169,
			65170,
			65168
		],
		[
			1577,
			65171,
			null,
			null,
			65172
		],
		[
			1578,
			65173,
			65175,
			65176,
			65174
		],
		[
			1579,
			65177,
			65179,
			65180,
			65178
		],
		[
			1580,
			65181,
			65183,
			65184,
			65182
		],
		[
			1581,
			65185,
			65187,
			65188,
			65186
		],
		[
			1582,
			65189,
			65191,
			65192,
			65190
		],
		[
			1583,
			65193,
			null,
			null,
			65194
		],
		[
			1584,
			65195,
			null,
			null,
			65196
		],
		[
			1585,
			65197,
			null,
			null,
			65198
		],
		[
			1586,
			65199,
			null,
			null,
			65200
		],
		[
			1688,
			64394,
			null,
			null,
			64395
		],
		[
			1587,
			65201,
			65203,
			65204,
			65202
		],
		[
			1588,
			65205,
			65207,
			65208,
			65206
		],
		[
			1589,
			65209,
			65211,
			65212,
			65210
		],
		[
			1590,
			65213,
			65215,
			65216,
			65214
		],
		[
			1591,
			65217,
			65219,
			65220,
			65218
		],
		[
			1592,
			65221,
			65223,
			65224,
			65222
		],
		[
			1593,
			65225,
			65227,
			65228,
			65226
		],
		[
			1594,
			65229,
			65231,
			65232,
			65230
		],
		[
			1600,
			1600,
			1600,
			1600,
			1600
		],
		[
			1601,
			65233,
			65235,
			65236,
			65234
		],
		[
			1602,
			65237,
			65239,
			65240,
			65238
		],
		[
			1603,
			65241,
			65243,
			65244,
			65242
		],
		[
			1604,
			65245,
			65247,
			65248,
			65246
		],
		[
			1605,
			65249,
			65251,
			65252,
			65250
		],
		[
			1606,
			65253,
			65255,
			65256,
			65254
		],
		[
			1607,
			65257,
			65259,
			65260,
			65258
		],
		[
			1608,
			65261,
			null,
			null,
			65262
		],
		[
			1609,
			65263,
			64488,
			64489,
			64509
		],
		[
			1610,
			65265,
			65267,
			65268,
			65266
		],
		[
			1740,
			64508,
			64510,
			64511,
			65264
		],
		[
			1670,
			64378,
			64380,
			64381,
			64379
		],
		[
			1662,
			64342,
			64344,
			64345,
			64343
		],
		[
			1711,
			64402,
			64404,
			64405,
			64403
		],
		[
			1705,
			64398,
			64400,
			64401,
			64399
		]
	], combCharsMap = [
		[
			[1604, 1570],
			65269,
			null,
			null,
			65270
		],
		[
			[1604, 1571],
			65271,
			null,
			null,
			65272
		],
		[
			[1604, 1573],
			65273,
			null,
			null,
			65274
		],
		[
			[1604, 1575],
			65275,
			null,
			null,
			65276
		]
	], transChars = [
		1552,
		1554,
		1555,
		1556,
		1557,
		1611,
		1612,
		1613,
		1614,
		1615,
		1616,
		1617,
		1618,
		1619,
		1620,
		1621,
		1622,
		1623,
		1624,
		1648,
		1750,
		1751,
		1752,
		1753,
		1754,
		1755,
		1756,
		1759,
		1760,
		1761,
		1762,
		1763,
		1764,
		1767,
		1768,
		1770,
		1771,
		1772,
		1773
	];
	function CharacterMapContains(c) {
		for (var i = 0; i < charsMap.length; ++i) if (charsMap[i][0] == c) return true;
		return false;
	}
	function GetCharRep(c) {
		for (var i = 0; i < charsMap.length; ++i) if (charsMap[i][0] == c) return charsMap[i];
		return false;
	}
	function GetCombCharRep(c1, c2) {
		for (var i = 0; i < combCharsMap.length; ++i) if (combCharsMap[i][0][0] == c1 && combCharsMap[i][0][1] == c2) return combCharsMap[i];
		return false;
	}
	function IsTransparent(c) {
		for (var i = 0; i < transChars.length; ++i) if (transChars[i] == c) return true;
		return false;
	}
	function convertArabic(normal) {
		var crep, combcrep, shaped = "";
		for (var i = 0; i < normal.length; ++i) {
			var current = normal.charCodeAt(i);
			if (CharacterMapContains(current)) {
				var prev = null, next = null, prevID = i - 1, nextID = i + 1;
				for (; prevID >= 0; --prevID) if (!IsTransparent(normal.charCodeAt(prevID))) break;
				prev = prevID >= 0 ? normal.charCodeAt(prevID) : null;
				crep = prev ? GetCharRep(prev) : false;
				if (crep[2] == null && crep[3] == null) prev = null;
				for (; nextID < normal.length; ++nextID) if (!IsTransparent(normal.charCodeAt(nextID))) break;
				next = nextID <= normal.length ? normal.charCodeAt(nextID) : null;
				crep = next ? GetCharRep(next) : false;
				if (crep[3] == null && crep[4] == null) next = null;
				if (current == 1604 && next != null && (next == 1570 || next == 1571 || next == 1573 || next == 1575)) {
					combcrep = GetCombCharRep(current, next);
					if (prev != null) shaped += String.fromCharCode(combcrep[4]);
					else shaped += String.fromCharCode(combcrep[1]);
					i = i + 1;
					continue;
				}
				crep = GetCharRep(current);
				if (prev != null && next != null && crep[3] != null) {
					shaped += String.fromCharCode(crep[3]);
					continue;
				} else if (prev != null && crep[4] != null) {
					shaped += String.fromCharCode(crep[4]);
					continue;
				} else if (next != null && crep[2] != null) {
					shaped += String.fromCharCode(crep[2]);
					continue;
				} else shaped += String.fromCharCode(crep[1]);
			} else shaped += String.fromCharCode(current);
		}
		return shaped;
	}
	exports.convertArabic = convertArabic;
	function convertArabicBack(apfb) {
		var toReturn = "", selectedChar;
		theLoop: for (var i = 0; i < apfb.length; ++i) {
			selectedChar = apfb.charCodeAt(i);
			for (var j = 0; j < charsMap.length; ++j) if (charsMap[j][4] == selectedChar || charsMap[j][2] == selectedChar || charsMap[j][1] == selectedChar || charsMap[j][3] == selectedChar) {
				toReturn += String.fromCharCode(charsMap[j][0]);
				continue theLoop;
			}
			for (var j = 0; j < combCharsMap.length; ++j) if (combCharsMap[j][4] == selectedChar || combCharsMap[j][2] == selectedChar || combCharsMap[j][1] == selectedChar || combCharsMap[j][3] == selectedChar) {
				toReturn += String.fromCharCode(combCharsMap[j][0][0]) + String.fromCharCode(combCharsMap[j][0][1]);
				continue theLoop;
			}
			toReturn += String.fromCharCode(selectedChar);
		}
		return toReturn;
	}
	exports.convertArabicBack = convertArabicBack;
}));
//#endregion
//#region electron/services/pdfService.ts
var import_arabic_persian_reshaper = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		PersianShaper: require_PersianShaper(),
		ArabicShaper: require_ArabicShaper()
	};
})))(), 1);
var arabicMonths$1 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
var englishMonths = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
function shapeText(text) {
	if (text === null || text === void 0) return "";
	const str = String(text);
	if (!/[\u0600-\u06FF]/.test(str)) return str;
	return import_arabic_persian_reshaper.default.default.ArabicShaper.convertArabic(str).split(" ").map((word) => {
		if (/[\u0600-\u06FF\uFE70-\uFEFF]/.test(word)) return word.split("").reverse().join("");
		return word;
	}).reverse().join(" ");
}
function getPdfHeader(brand, lang, titleText) {
	const isAr = lang === "ar";
	const headerContent = [];
	const infoCol = {
		stack: [
			{
				text: shapeText(brand.orgName),
				fontSize: 15,
				bold: true,
				color: brand.primaryColor
			},
			{
				text: shapeText(brand.tagline),
				fontSize: 9,
				italic: true,
				color: "#64748b",
				margin: [
					0,
					2,
					0,
					4
				]
			},
			{
				text: shapeText(`${isAr ? "هاتف:" : "Tel:"} ${brand.phone} | ${isAr ? "عنوان:" : "Addr:"} ${brand.address}`),
				fontSize: 8,
				color: "#64748b"
			},
			{
				text: shapeText(`${isAr ? "بريد:" : "Email:"} ${brand.email}`),
				fontSize: 8,
				color: "#64748b"
			}
		],
		alignment: isAr ? "right" : "left"
	};
	if (brand.showLogo && brand.logoPath && fs.existsSync(brand.logoPath)) headerContent.push({
		columns: isAr ? [infoCol, {
			image: brand.logoPath,
			width: 70,
			height: 45,
			alignment: "left"
		}] : [{
			image: brand.logoPath,
			width: 70,
			height: 45,
			alignment: "left"
		}, infoCol],
		columnGap: 15,
		margin: [
			0,
			0,
			0,
			15
		]
	});
	else headerContent.push(infoCol);
	headerContent.push({
		canvas: [{
			type: "line",
			x1: 0,
			y1: 5,
			x2: isAr ? 762 : 515,
			y2: 5,
			lineWidth: 1.5,
			strokeColor: brand.primaryColor
		}],
		margin: [
			0,
			0,
			0,
			15
		]
	});
	headerContent.push({
		text: shapeText(titleText),
		fontSize: 13,
		bold: true,
		alignment: isAr ? "right" : "left",
		margin: [
			0,
			0,
			0,
			15
		]
	});
	return headerContent;
}
var formatCurrency = (val, lang) => {
	return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
		style: "currency",
		currency: "EGP",
		maximumFractionDigits: 0
	}).format(val);
};
function getStatusColor(status) {
	const normalStatus = status.toLowerCase();
	if (normalStatus === "paid" || normalStatus === "active" || normalStatus === "نشط" || normalStatus === "met" || normalStatus === "target_met" || normalStatus === "مكتمل" || normalStatus === "ناجح") return "#059669";
	if (normalStatus === "unpaid" || normalStatus === "inactive" || normalStatus === "غير نشط" || normalStatus === "missed" || normalStatus === "target_missed" || normalStatus === "عجز" || normalStatus === "غير مكتمل") return "#dc2626";
	return "#d97706";
}
function buildPdfFile(type, params, savePath) {
	return new Promise((resolve, reject) => {
		try {
			const db = getDb();
			const brand = getExportHeader();
			const { month, year, childId, lang = "ar" } = params;
			const isAr = lang === "ar";
			const fontsDir = path.join(app.getPath("userData"), "branding/fonts");
			const printer = new PdfPrinter({ Cairo: {
				normal: path.join(fontsDir, "Cairo-Regular.ttf"),
				bold: path.join(fontsDir, "Cairo-Bold.ttf"),
				italic: path.join(fontsDir, "Cairo-Regular.ttf"),
				bolditalic: path.join(fontsDir, "Cairo-Bold.ttf")
			} });
			let pageOrientation = "portrait";
			if ([
				"full",
				"month",
				"salaries",
				"expenses",
				"employees"
			].includes(type)) pageOrientation = "landscape";
			const docDefinition = {
				pageOrientation,
				pageSize: "A4",
				pageMargins: [
					40,
					40,
					40,
					40
				],
				defaultStyle: {
					font: "Cairo",
					fontSize: 9,
					alignment: isAr ? "right" : "left"
				},
				content: [],
				footer: (currentPage, pageCount) => {
					return {
						text: shapeText(`${isAr ? "صفحة" : "Page"} ${currentPage} / ${pageCount}`),
						alignment: "center",
						fontSize: 8,
						color: "#94a3b8",
						margin: [
							0,
							10,
							0,
							0
						]
					};
				}
			};
			if (type === "month") {
				const title = isAr ? `مطالبات واشتراكات شهر ${month} لسنة ${year}` : `Billing Sheet: ${month} ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const payments = db.prepare(`
          SELECT c.name as child_name, c.guardian, c.guardian_phone, p.service, p.unit, p.quantity, p.price, p.total, p.paid, p.balance, p.status, p.notes
          FROM payments p
          JOIN children c ON p.child_id = c.id
          WHERE p.month = ? AND p.year = ?
        `).all(month, year);
				const body = [(isAr ? [
					"اسم الطفل",
					"ولي الأمر",
					"الهاتف",
					"الخدمة",
					"الوحدة",
					"الكمية",
					"السعر",
					"الإجمالي",
					"المدفوع",
					"المتأخرات",
					"الحالة"
				] : [
					"Child Name",
					"Guardian",
					"Phone",
					"Service",
					"Unit",
					"Qty",
					"Price",
					"Total",
					"Paid",
					"Arrears",
					"Status"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let totalInvoiced = 0;
				let totalCollected = 0;
				let arrears = 0;
				for (const p of payments) {
					totalInvoiced += p.total;
					totalCollected += p.paid;
					arrears += p.balance;
					body.push([
						{
							text: shapeText(p.child_name),
							bold: false,
							fillColor: "",
							color: "",
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(p.guardian),
							bold: false,
							fillColor: "",
							color: "",
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(p.guardian_phone),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.service),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.unit),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.quantity),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(p.price, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.total, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.paid, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.balance, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(p.status),
							bold: true,
							fillColor: "",
							color: getStatusColor(p.status),
							alignment: "center"
						}
					]);
				}
				body.push([
					{
						text: shapeText(isAr ? "إجمالي المحاسبة" : "Totals"),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: shapeText(formatCurrency(totalInvoiced, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(totalCollected, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(arrears, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"*",
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "child") {
				const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
				if (!child) throw new Error("Child not found");
				const title = isAr ? `كشف حساب الطفل: ${child.name}` : `Account Statement: ${child.name}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				docDefinition.content.push({
					margin: [
						0,
						0,
						0,
						15
					],
					table: {
						widths: ["*", "*"],
						body: [[{
							text: shapeText(`${isAr ? "ولي الأمر:" : "Guardian:"} ${child.guardian}`),
							bold: true
						}, {
							text: shapeText(`${isAr ? "الهاتف:" : "Phone:"} ${child.guardian_phone}`),
							bold: true
						}], [{
							text: shapeText(`${isAr ? "الخدمة الأساسية:" : "Service:"} ${child.service}`),
							bold: true
						}, {
							text: shapeText(`${isAr ? "تاريخ التسجيل:" : "Reg Date:"} ${child.reg_date}`),
							bold: true
						}]]
					},
					layout: "noBorders"
				});
				const statement = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
				const body = [(isAr ? [
					"الشهر",
					"السنة",
					"الخدمة المقدمة",
					"الكمية",
					"السعر",
					"الإجمالي المطلـوب",
					"المبلغ المدفوع",
					"المتأخرات",
					"الحالة"
				] : [
					"Month",
					"Year",
					"Service",
					"Qty",
					"Price",
					"Invoiced",
					"Paid",
					"Balance",
					"Status"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let totalInvoiced = 0;
				let totalCollected = 0;
				let totalBalance = 0;
				for (const p of statement.rows) {
					totalInvoiced += p.total;
					totalCollected += p.paid;
					totalBalance += p.balance;
					const mIdx = arabicMonths$1.indexOf(p.month);
					const mStr = isAr ? p.month : mIdx !== -1 ? englishMonths[mIdx] : p.month;
					body.push([
						{
							text: shapeText(mStr),
							bold: false,
							fillColor: "",
							color: "",
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(p.year),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.service),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.quantity),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(p.price, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.total, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.paid, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.balance, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(p.status),
							bold: true,
							fillColor: "",
							color: getStatusColor(p.status),
							alignment: "center"
						}
					]);
				}
				body.push([
					{
						text: shapeText(isAr ? "إجمالي الحساب التراكمي" : "Totals"),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: shapeText(formatCurrency(totalInvoiced, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(totalCollected, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(totalBalance, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"auto",
							"auto",
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "salaries") {
				const title = isAr ? `مرتبات ومكافآت الموظفين لشهر ${month} لسنة ${year}` : `Employee Payroll: ${month} ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const payroll = db.prepare(`
          SELECT e.name, e.role, e.base_salary, e.housing, e.transport, e.net_salary,
                 s.bonus, s.deductions, s.actual_paid, s.paid_date as pay_date
          FROM employees e
          LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
          WHERE e.is_active = 1 OR s.id IS NOT NULL
        `).all(month, year);
				const body = [(isAr ? [
					"اسم الموظف",
					"الدور",
					"الراتب الأساسي",
					"بدل سكن",
					"بدل انتقال",
					"صافي الراتب",
					"مكافآت",
					"خصومات",
					"المدفوع الفعلي",
					"تاريخ الصرف"
				] : [
					"Employee Name",
					"Role",
					"Base Salary",
					"Housing",
					"Transport",
					"Net Salary",
					"Bonuses",
					"Deductions",
					"Actual Paid",
					"Pay Date"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let sumPaid = 0;
				for (const p of payroll) {
					const actualPaid = p.actual_paid !== null && p.actual_paid !== void 0 ? p.actual_paid : p.net_salary;
					sumPaid += actualPaid;
					body.push([
						{
							text: shapeText(p.name),
							bold: false,
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(p.role === "admin" ? isAr ? "مسؤول" : "Admin" : isAr ? "موظف" : "Employee"),
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(p.base_salary, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.housing, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.transport, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.net_salary, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.bonus || 0, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.deductions || 0, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(actualPaid, lang)),
							bold: true,
							alignment: "right"
						},
						{
							text: shapeText(p.pay_date || ""),
							alignment: "center"
						}
					]);
				}
				body.push([
					{
						text: shapeText(isAr ? "إجمالي منصرف الرواتب" : "Total Payroll"),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: shapeText(formatCurrency(sumPaid, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "employees") {
				const title = isAr ? "سجل الموظفين" : "Employees Roster";
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const employees = db.prepare(`
          SELECT name, role, base_salary, housing, transport, net_salary, is_active
          FROM employees
          ORDER BY is_active DESC, name ASC
        `).all();
				const body = [(isAr ? [
					"اسم الموظف",
					"الوظيفة",
					"الراتب الأساسي",
					"بدل سكن",
					"بدل انتقال",
					"صافي الراتب",
					"الحالة"
				] : [
					"Employee Name",
					"Role",
					"Base Salary",
					"Housing",
					"Transport",
					"Net Salary",
					"Status"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let sumBase = 0, sumHousing = 0, sumTransport = 0, sumNet = 0;
				for (const e of employees) {
					if (e.is_active === 1) {
						sumBase += e.base_salary || 0;
						sumHousing += e.housing || 0;
						sumTransport += e.transport || 0;
						sumNet += e.net_salary || 0;
					}
					body.push([
						{
							text: shapeText(e.name),
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(e.role),
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(e.base_salary, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(e.housing, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(e.transport, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(e.net_salary, lang)),
							bold: true,
							alignment: "right"
						},
						{
							text: shapeText(e.is_active === 1 ? isAr ? "نشط" : "Active" : isAr ? "غير نشط" : "Inactive"),
							alignment: "center"
						}
					]);
				}
				body.push([
					{
						text: shapeText(isAr ? "الإجمالي (النشطون)" : "Totals (active)"),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: shapeText(formatCurrency(sumBase, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(sumHousing, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(sumTransport, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(sumNet, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "expenses") {
				const title = isAr ? `تقرير المصاريف التشغيلية السنوية لسنة ${year}` : `Annual Expenses: ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const items = db.prepare("SELECT DISTINCT item, category FROM expenses WHERE year = ? UNION SELECT DISTINCT item, category FROM expenses").all(year);
				const monthsHeaders = arabicMonths$1.map((m, idx) => isAr ? m : englishMonths[idx]);
				const body = [[
					isAr ? "البند" : "Item",
					isAr ? "التصنيف" : "Category",
					...monthsHeaders,
					isAr ? "الإجمالي" : "Total"
				].map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let grandTotal = 0;
				const colTotals = Array(12).fill(0);
				for (const it of items) {
					const row = [{
						text: shapeText(it.item),
						bold: false,
						alignment: isAr ? "right" : "left"
					}, {
						text: shapeText(it.category || ""),
						alignment: "center"
					}];
					let itemTotal = 0;
					for (let mIdx = 0; mIdx < arabicMonths$1.length; mIdx++) {
						const m = arabicMonths$1[mIdx];
						const exp = db.prepare("SELECT amount FROM expenses WHERE item = ? AND month = ? AND year = ?").get(it.item, m, year);
						const amount = exp ? exp.amount : 0;
						row.push({
							text: shapeText(formatCurrency(amount, lang)),
							alignment: "right"
						});
						itemTotal += amount;
						colTotals[mIdx] += amount;
					}
					row.push({
						text: shapeText(formatCurrency(itemTotal, lang)),
						bold: true,
						alignment: "right"
					});
					body.push(row);
					grandTotal += itemTotal;
				}
				const totalRow = [{
					text: shapeText(isAr ? "المجموع الشهري" : "Monthly Totals"),
					bold: true,
					fillColor: "#f1f5f9",
					alignment: isAr ? "right" : "left"
				}, {
					text: "",
					fillColor: "#f1f5f9"
				}];
				for (const colSum of colTotals) totalRow.push({
					text: shapeText(formatCurrency(colSum, lang)),
					bold: true,
					fillColor: "#f1f5f9",
					alignment: "right"
				});
				totalRow.push({
					text: shapeText(formatCurrency(grandTotal, lang)),
					bold: true,
					fillColor: "#f8fafc",
					alignment: "right"
				});
				body.push(totalRow);
				const widths = [
					"*",
					"auto",
					...Array(12).fill("auto"),
					"auto"
				];
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths,
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "full") {
				const coverTitle = isAr ? `التقرير السنوي الشامل لسنة ${year}` : `Full Annual Report: ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, coverTitle));
				const payRows = db.prepare("SELECT total, paid, balance FROM payments WHERE year = ?").all(year);
				const expRows = db.prepare("SELECT amount FROM expenses WHERE year = ?").all(year);
				const salRows = db.prepare("SELECT actual_paid FROM salary_payments WHERE year = ?").all(year);
				const invoiced = payRows.reduce((s, r) => s + r.total, 0);
				const collected = payRows.reduce((s, r) => s + r.paid, 0);
				const arrears = payRows.reduce((s, r) => s + Math.max(0, r.balance), 0);
				const expTotal = expRows.reduce((s, r) => s + r.amount, 0);
				const salTotal = salRows.reduce((s, r) => s + r.actual_paid, 0);
				const netProfit = collected - (expTotal + salTotal);
				const collectionRate = invoiced > 0 ? collected / invoiced : 0;
				docDefinition.content.push({
					text: shapeText(isAr ? "البيانات المالية السنوية التراكمية" : "Annual Financial Cumulative Summary"),
					fontSize: 12,
					bold: true,
					margin: [
						0,
						10,
						0,
						10
					]
				});
				const summaryTable = {
					widths: ["*", "*"],
					body: [
						[{
							text: shapeText(isAr ? "المؤشر المالي" : "Key Performance Indicator"),
							bold: true,
							fillColor: brand.primaryColor,
							color: "#ffffff"
						}, {
							text: shapeText(isAr ? "القيمة الإجمالية" : "Total Value"),
							bold: true,
							fillColor: brand.primaryColor,
							color: "#ffffff"
						}],
						[shapeText(isAr ? "إجمالي المطلوب سداده" : "Total Invoiced"), shapeText(formatCurrency(invoiced, lang))],
						[shapeText(isAr ? "إجمالي المبالغ المحصلة" : "Total Collected"), shapeText(formatCurrency(collected, lang))],
						[shapeText(isAr ? "إجمالي المتأخرات المستحقة" : "Outstanding Arrears"), shapeText(formatCurrency(arrears, lang))],
						[shapeText(isAr ? "إجمالي المصاريف التشغيلية" : "Operational Cost"), shapeText(formatCurrency(expTotal, lang))],
						[shapeText(isAr ? "إجمالي المرتبات المنصرفة" : "Employee Salaries"), shapeText(formatCurrency(salTotal, lang))],
						[shapeText(isAr ? "صافي الأرباح المحققة" : "Net Annual Profit"), shapeText(formatCurrency(netProfit, lang))],
						[shapeText(isAr ? "معدل التحصيل السنوي" : "Annual Collection Rate"), shapeText(`${Math.round(collectionRate * 100)}%`)]
					]
				};
				docDefinition.content.push({
					table: summaryTable,
					margin: [
						0,
						0,
						0,
						20
					]
				});
				docDefinition.content.push({
					text: "",
					pageBreak: "after"
				});
				docDefinition.content.push(...getPdfHeader(brand, lang, isAr ? "قائمة سجلات الأطفال" : "Children Records List"));
				const kids = db.prepare("SELECT name, guardian, guardian_phone, service, price, reg_date FROM children").all();
				const kidBody = [(isAr ? [
					"اسم الطفل",
					"ولي الأمر",
					"رقم الهاتف",
					"الخدمة",
					"السعر",
					"تاريخ التسجيل"
				] : [
					"Child Name",
					"Guardian",
					"Phone",
					"Service",
					"Price",
					"Reg Date"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				for (const k of kids) kidBody.push([
					shapeText(k.name),
					shapeText(k.guardian),
					shapeText(k.guardian_phone),
					shapeText(k.service),
					shapeText(formatCurrency(k.price, lang)),
					shapeText(k.reg_date)
				]);
				docDefinition.content.push({ table: {
					headerRows: 1,
					widths: [
						"*",
						"*",
						"auto",
						"auto",
						"auto",
						"auto"
					],
					body: kidBody
				} });
				docDefinition.content.push({
					text: "",
					pageBreak: "after"
				});
				for (let mIdx = 0; mIdx < arabicMonths$1.length; mIdx++) {
					const m = arabicMonths$1[mIdx];
					const mTitle = isAr ? `مطالبات شهر ${m} لسنة ${year}` : `Billing Sheet: ${englishMonths[mIdx]} ${year}`;
					docDefinition.content.push(...getPdfHeader(brand, lang, mTitle));
					const payments = db.prepare(`
            SELECT c.name as child_name, p.service, p.quantity, p.price, p.total, p.paid, p.balance, p.status
            FROM payments p
            JOIN children c ON p.child_id = c.id
            WHERE p.month = ? AND p.year = ?
          `).all(m, year);
					const body = [(isAr ? [
						"اسم الطفل",
						"الخدمة",
						"الكمية",
						"السعر",
						"الإجمالي",
						"المدفوع",
						"المتأخرات",
						"الحالة"
					] : [
						"Child Name",
						"Service",
						"Qty",
						"Price",
						"Total",
						"Paid",
						"Arrears",
						"Status"
					]).map((h) => ({
						text: shapeText(h),
						bold: true,
						fillColor: brand.primaryColor,
						color: "#ffffff",
						alignment: "center"
					}))];
					let totalM = 0;
					let collectedM = 0;
					let arrearsM = 0;
					for (const p of payments) {
						totalM += p.total;
						collectedM += p.paid;
						arrearsM += p.balance;
						body.push([
							{
								text: shapeText(p.child_name),
								alignment: isAr ? "right" : "left"
							},
							{
								text: shapeText(p.service),
								alignment: "center"
							},
							{
								text: shapeText(p.quantity),
								alignment: "center"
							},
							{
								text: shapeText(formatCurrency(p.price, lang)),
								alignment: "right"
							},
							{
								text: shapeText(formatCurrency(p.total, lang)),
								alignment: "right"
							},
							{
								text: shapeText(formatCurrency(p.paid, lang)),
								alignment: "right"
							},
							{
								text: shapeText(formatCurrency(p.balance, lang)),
								alignment: "right"
							},
							{
								text: shapeText(p.status),
								bold: true,
								color: getStatusColor(p.status),
								alignment: "center"
							}
						]);
					}
					body.push([
						{
							text: shapeText(isAr ? "المجموع" : "Total"),
							bold: true,
							fillColor: "#f1f5f9",
							alignment: isAr ? "right" : "left"
						},
						{
							text: "",
							fillColor: "#f1f5f9"
						},
						{
							text: "",
							fillColor: "#f1f5f9"
						},
						{
							text: "",
							fillColor: "#f1f5f9"
						},
						{
							text: shapeText(formatCurrency(totalM, lang)),
							bold: true,
							fillColor: "#f1f5f9",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(collectedM, lang)),
							bold: true,
							fillColor: "#f1f5f9",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(arrearsM, lang)),
							bold: true,
							fillColor: "#f1f5f9",
							alignment: "right"
						},
						{
							text: "",
							fillColor: "#f1f5f9"
						}
					]);
					docDefinition.content.push({ table: {
						headerRows: 1,
						widths: [
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					} });
					if (mIdx < arabicMonths$1.length - 1) docDefinition.content.push({
						text: "",
						pageBreak: "after"
					});
				}
			}
			const pdfDoc = printer.createPdfKitDocument(docDefinition);
			const writeStream = fs.createWriteStream(savePath);
			pdfDoc.pipe(writeStream);
			writeStream.on("finish", () => {
				resolve();
			});
			writeStream.on("error", (err) => {
				reject(err);
			});
			pdfDoc.end();
		} catch (e) {
			reject(e);
		}
	});
}
//#endregion
//#region electron/ipc/exportIPC.ts
function checkAuth$1() {
	const user = getCurrentUser();
	if (!user) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
	return user;
}
async function executeExport(type, params, defaultFilename) {
	const isAr = params.lang === "ar";
	const filters = params.format === "xlsx" ? [{
		name: "Excel Workbook (*.xlsx)",
		extensions: ["xlsx"]
	}] : [{
		name: "PDF Document (*.pdf)",
		extensions: ["pdf"]
	}];
	const result = await dialog.showSaveDialog({
		title: isAr ? "حفظ ملف التصدير" : "Save Exported File",
		defaultPath: defaultFilename,
		filters
	});
	if (result.canceled || !result.filePath) return null;
	const savePath = result.filePath;
	if (params.format === "xlsx") await buildExcelFile(type, params, savePath);
	else await buildPdfFile(type, params, savePath);
	return { filePath: savePath };
}
ipcMain.handle("export:full", async (_event, { year, format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `التقرير_السنوي_الشامل_${year}.${format}` : `full_annual_report_${year}.${format}`;
		return await executeExport("full", {
			year,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run full export:", error);
		throw new Error(error.message || "Failed to complete full database export");
	}
});
ipcMain.handle("export:month", async (_event, { month, year, format, lang }) => {
	try {
		checkAuth$1();
		const filename = lang === "ar" ? `مطالبات_${month}_${year}.${format}` : `billing_${month}_${year}.${format}`;
		return await executeExport("month", {
			month,
			year,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run month payments export:", error);
		throw new Error(error.message || "Failed to export monthly payments");
	}
});
ipcMain.handle("export:child", async (_event, { childId, format, lang }) => {
	try {
		checkAuth$1();
		const filename = lang === "ar" ? `كشف_حساب_طفل_${childId}.${format}` : `child_statement_${childId}.${format}`;
		return await executeExport("child", {
			childId,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run child statement export:", error);
		throw new Error(error.message || "Failed to export child statement");
	}
});
ipcMain.handle("export:salaries", async (_event, { month, year, format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `رواتب_${month}_${year}.${format}` : `payroll_${month}_${year}.${format}`;
		return await executeExport("salaries", {
			month,
			year,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run salaries export:", error);
		throw new Error(error.message || "Failed to export payroll report");
	}
});
ipcMain.handle("export:employees", async (_event, { format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `سجل_الموظفين.${format}` : `employees_roster.${format}`;
		return await executeExport("employees", {
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run employees export:", error);
		throw new Error(error.message || "Failed to export employees roster");
	}
});
ipcMain.handle("export:expenses", async (_event, { year, format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `مصاريف_تشغيلية_${year}.${format}` : `expenses_report_${year}.${format}`;
		return await executeExport("expenses", {
			year,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run expenses export:", error);
		throw new Error(error.message || "Failed to export expenses report");
	}
});
//#endregion
//#region electron/ipc/storageIPC.ts
/**
* storage:stats
* Returns counts for all major tables and database file size.
* Admin only.
*/
ipcMain.handle("storage:stats", async () => {
	try {
		requireAdmin();
		const db = getDb();
		const counts = {
			users: db.prepare("SELECT COUNT(*) as c FROM users").get().c,
			children: db.prepare("SELECT COUNT(*) as c FROM children").get().c,
			payments: db.prepare("SELECT COUNT(*) as c FROM payments").get().c,
			employees: db.prepare("SELECT COUNT(*) as c FROM employees").get().c,
			salary_payments: db.prepare("SELECT COUNT(*) as c FROM salary_payments").get().c,
			expenses: db.prepare("SELECT COUNT(*) as c FROM expenses").get().c
		};
		let sizeBytes = 0;
		try {
			const dbPath = path.join(app.getPath("userData"), "nursery.db");
			if (fs.existsSync(dbPath)) sizeBytes = fs.statSync(dbPath).size;
		} catch {}
		return {
			counts,
			sizeBytes
		};
	} catch (error) {
		console.error("storage:stats error:", error);
		throw new Error(error.message || "Failed to retrieve storage stats");
	}
});
/**
* storage:backup
* Opens a save dialog and copies the current DB file to the chosen path.
* Admin only.
*/
ipcMain.handle("storage:backup", async () => {
	try {
		requireAdmin();
		const dbPath = path.join(app.getPath("userData"), "nursery.db");
		const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const result = await dialog.showSaveDialog({
			defaultPath: `nursery-backup-${timestamp}.db`,
			filters: [{
				name: "SQLite Database",
				extensions: ["db"]
			}]
		});
		if (result.canceled || !result.filePath) throw new Error("Backup cancelled");
		fs.copyFileSync(dbPath, result.filePath);
		return { path: result.filePath };
	} catch (error) {
		console.error("storage:backup error:", error);
		throw new Error(error.message || "Failed to backup database");
	}
});
/**
* storage:restore
* Opens a file picker and replaces the current DB with the selected backup.
* Admin only.
*/
ipcMain.handle("storage:restore", async (_event, { path: restorePath }) => {
	try {
		requireAdmin();
		let sourcePath = restorePath;
		if (!sourcePath) {
			const result = await dialog.showOpenDialog({
				properties: ["openFile"],
				filters: [{
					name: "SQLite Database",
					extensions: ["db"]
				}]
			});
			if (result.canceled || result.filePaths.length === 0) throw new Error("Restore cancelled");
			sourcePath = result.filePaths[0];
		}
		if (!fs.existsSync(sourcePath)) throw new Error("Backup file not found");
		const dbPath = path.join(app.getPath("userData"), "nursery.db");
		const backupPath = `${dbPath}.pre-restore-${Date.now()}.bak`;
		fs.copyFileSync(dbPath, backupPath);
		closeDb();
		fs.copyFileSync(sourcePath, dbPath);
		initDb();
		return {
			ok: true,
			restoredFrom: sourcePath
		};
	} catch (error) {
		console.error("storage:restore error:", error);
		throw new Error(error.message || "Failed to restore database");
	}
});
/**
* storage:import
* Opens an Excel workbook file picker and imports data from the original workbook format.
* Admin only.
*/
ipcMain.handle("storage:import", async (_event, args) => {
	try {
		requireAdmin();
		let filePath = args?.path;
		if (!filePath) {
			const result = await dialog.showOpenDialog({
				properties: ["openFile"],
				filters: [{
					name: "Excel Workbook",
					extensions: ["xlsx", "xls"]
				}]
			});
			if (result.canceled || result.filePaths.length === 0) throw new Error("Import cancelled");
			filePath = result.filePaths[0];
		}
		const { importFromWorkbook } = await import("./importService-cLa7WluD.js");
		return { imported: await importFromWorkbook(filePath) };
	} catch (error) {
		console.error("storage:import error:", error);
		throw new Error(error.message || "Failed to import workbook");
	}
});
/**
* storage:clear
* Truncates all data tables. Requires explicit confirm:true.
* Admin only.
*/
ipcMain.handle("storage:clear", async (_event, { confirm }) => {
	try {
		requireAdmin();
		if (!confirm) throw new Error("Explicit confirmation required to clear data");
		const db = getDb();
		db.transaction(() => {
			db.prepare("DELETE FROM payments").run();
			db.prepare("DELETE FROM salary_payments").run();
			db.prepare("DELETE FROM expenses").run();
			db.prepare("DELETE FROM sync_log").run();
			db.prepare("DELETE FROM children").run();
			db.prepare("DELETE FROM employees").run();
		})();
		return { ok: true };
	} catch (error) {
		console.error("storage:clear error:", error);
		throw new Error(error.message || "Failed to clear data");
	}
});
/**
* storage:audit
* Returns last 50 sync log entries (audit log).
* Admin only.
*/
ipcMain.handle("storage:audit", async () => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT id, action, table_name AS entity_type, record_id, status, error, synced_at AS created_at FROM sync_log ORDER BY id DESC LIMIT 50").all();
	} catch (error) {
		console.error("storage:audit error:", error);
		throw new Error(error.message || "Failed to retrieve audit log");
	}
});
//#endregion
//#region electron/services/mongoSync.ts
/**
* mongoSync.ts — Mongoose models for cloud sync collections.
*
* Each model mirrors the SQLite table structure.
* The _id in MongoDB is the SQLite id (integer) to enable deterministic conflict resolution.
*
* Fields synced to MongoDB match the SQLite columns plus an updated_at timestamp.
*/
var isConnected = false;
var connectionError = null;
async function convertSrvToStandardUri(uri) {
	if (!uri.startsWith("mongodb+srv://")) return uri;
	try {
		const { Resolver } = promises;
		const resolver = new Resolver();
		resolver.setServers(["8.8.8.8", "8.8.4.4"]);
		const url = new URL(uri);
		const hostname = url.hostname;
		const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`);
		if (!srvRecords || srvRecords.length === 0) throw new Error("No SRV records found");
		const txtOptions = (await resolver.resolveTxt(hostname)).flat().join("&");
		const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(",");
		const credentials = url.username ? `${url.username}:${url.password}@` : "";
		const searchParams = new URLSearchParams(url.search);
		const txtParams = new URLSearchParams(txtOptions);
		for (const [key, value] of txtParams) if (!searchParams.has(key)) searchParams.set(key, value);
		searchParams.set("ssl", "true");
		return `mongodb://${credentials}${hosts}/${url.pathname.replace(/^\//, "")}?${searchParams.toString()}`;
	} catch (error) {
		console.error("Error converting SRV to standard URI, falling back to original:", error);
		return uri;
	}
}
async function connectMongo(uri) {
	if (isConnected) return;
	try {
		const finalUri = await convertSrvToStandardUri(uri);
		await mongoose.connect(finalUri, {
			serverSelectionTimeoutMS: 1e4,
			connectTimeoutMS: 1e4
		});
		isConnected = true;
		connectionError = null;
		mongoose.connection.on("disconnected", () => {
			isConnected = false;
		});
	} catch (err) {
		isConnected = false;
		connectionError = err.message || "Failed to connect to MongoDB";
		throw new Error(connectionError || "Failed to connect to MongoDB");
	}
}
async function disconnectMongo() {
	if (!isConnected) return;
	await mongoose.disconnect();
	isConnected = false;
}
function getConnectionStatus() {
	return {
		connected: isConnected,
		error: connectionError
	};
}
var sharedOptions = {
	versionKey: false,
	_id: false
};
var childSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	name: String,
	guardian: String,
	guardian_phone: String,
	child_phone: String,
	national_id: String,
	service: String,
	unit: String,
	price: Number,
	reg_date: String,
	notes: String,
	is_active: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ChildModel = mongoose.models["sync_children"] || mongoose.model("sync_children", childSchema);
var paymentSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	child_id: Number,
	service: String,
	unit: String,
	quantity: Number,
	price: Number,
	month: String,
	year: Number,
	total: Number,
	paid: Number,
	balance: Number,
	status: String,
	notes: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var PaymentModel = mongoose.models["sync_payments"] || mongoose.model("sync_payments", paymentSchema);
var employeeSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	name: String,
	role: String,
	base_salary: Number,
	housing: Number,
	transport: Number,
	net_salary: Number,
	is_active: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var EmployeeModel = mongoose.models["sync_employees"] || mongoose.model("sync_employees", employeeSchema);
var salaryPaymentSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	employee_id: Number,
	month: String,
	year: Number,
	bonus: Number,
	deductions: Number,
	actual_paid: Number,
	paid_date: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var SalaryPaymentModel = mongoose.models["sync_salary_payments"] || mongoose.model("sync_salary_payments", salaryPaymentSchema);
var expenseSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	item: String,
	month: String,
	year: Number,
	amount: Number,
	category: String,
	notes: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ExpenseModel = mongoose.models["sync_expenses"] || mongoose.model("sync_expenses", expenseSchema);
var SYNC_ENTITIES = [
	{
		name: "children",
		model: ChildModel,
		table: "children"
	},
	{
		name: "payments",
		model: PaymentModel,
		table: "payments"
	},
	{
		name: "employees",
		model: EmployeeModel,
		table: "employees"
	},
	{
		name: "salary_payments",
		model: SalaryPaymentModel,
		table: "salary_payments"
	},
	{
		name: "expenses",
		model: ExpenseModel,
		table: "expenses"
	}
];
//#endregion
//#region electron/ipc/syncIPC.ts
function resolveConflict(local, cloud) {
	const localTs = local.updated_at ? new Date(local.updated_at).getTime() : 0;
	const cloudTs = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;
	if (cloudTs > localTs) return "cloud";
	if (localTs > cloudTs) return "local";
	return local.id >= cloud.id ? "local" : "cloud";
}
function logSync(action, entityType, recordId, status, error = null) {
	try {
		getDb().prepare(`
      INSERT INTO sync_log (action, table_name, record_id, status, error, synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(action, entityType, String(recordId), status, error, (/* @__PURE__ */ new Date()).toISOString());
	} catch {}
}
function getMongoUri() {
	try {
		return getDb().prepare("SELECT value FROM settings WHERE key = 'sync_mongo_uri'").get()?.value || process.env.MONGO_URI || null;
	} catch {
		return process.env.MONGO_URI || null;
	}
}
/**
* sync:connect — Connect to MongoDB with given URI.
* Saves URI to settings. Admin only.
*/
ipcMain.handle("sync:connect", async (_event, { uri }) => {
	try {
		requireAdmin();
		if (!uri || !uri.startsWith("mongodb")) throw new Error("Invalid MongoDB URI. Must start with mongodb:// or mongodb+srv://");
		getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("sync_mongo_uri", uri);
		await connectMongo(uri);
		logSync("connect", "connection", "mongodb", "success");
		return { connected: true };
	} catch (error) {
		logSync("connect", "connection", "mongodb", "error", error.message);
		console.error("sync:connect error:", error);
		throw new Error(error.message || "Failed to connect to MongoDB");
	}
});
/**
* sync:disconnect — Disconnect from MongoDB.
* Admin only.
*/
ipcMain.handle("sync:disconnect", async () => {
	try {
		requireAdmin();
		await disconnectMongo();
		return { connected: false };
	} catch (error) {
		console.error("sync:disconnect error:", error);
		throw new Error(error.message || "Failed to disconnect");
	}
});
/**
* sync:status — Returns sync status: connection, pending counts per entity.
* Admin only.
*/
ipcMain.handle("sync:status", async () => {
	try {
		requireAdmin();
		const db = getDb();
		const { connected, error } = getConnectionStatus();
		const pending = {};
		for (const entity of SYNC_ENTITIES) {
			const row = db.prepare(`SELECT COUNT(*) as c FROM ${entity.table} WHERE synced = 0`).get();
			pending[entity.name] = row?.c ?? 0;
		}
		const mongoUri = getMongoUri();
		const lastLogRow = db.prepare("SELECT synced_at AS created_at, status, action FROM sync_log ORDER BY id DESC LIMIT 1").get();
		return {
			connected,
			error,
			uri: mongoUri ? "***configured***" : null,
			pending,
			lastSync: lastLogRow || null
		};
	} catch (error) {
		console.error("sync:status error:", error);
		throw new Error(error.message || "Failed to get sync status");
	}
});
/**
* sync:push — Push all unsynced records to MongoDB.
* Admin only. Graceful: reports pushed/failed counts per entity.
*/
ipcMain.handle("sync:push", async () => {
	try {
		requireAdmin();
		const db = getDb();
		const { connected } = getConnectionStatus();
		if (!connected) {
			const mongoUri = getMongoUri();
			if (!mongoUri) throw new Error("No MongoDB URI configured. Please connect first.");
			await connectMongo(mongoUri);
		}
		const results = {};
		const now = (/* @__PURE__ */ new Date()).toISOString();
		for (const entity of SYNC_ENTITIES) {
			const unsynced = db.prepare(`SELECT * FROM ${entity.table} WHERE synced = 0`).all();
			let pushed = 0;
			let failed = 0;
			for (const record of unsynced) try {
				await entity.model.findOneAndUpdate({ id: record.id }, {
					...record,
					updated_at: record.updated_at || now
				}, {
					upsert: true,
					new: true
				});
				db.prepare(`UPDATE ${entity.table} SET synced = 1 WHERE id = ?`).run(record.id);
				logSync("push", entity.name, record.id, "success");
				pushed++;
			} catch (err) {
				logSync("push", entity.name, record.id, "error", err.message);
				failed++;
			}
			results[entity.name] = {
				pushed,
				failed
			};
		}
		return { results };
	} catch (error) {
		logSync("push", "all", "batch", "error", error.message);
		console.error("sync:push error:", error);
		throw new Error(error.message || "Push failed");
	}
});
/**
* sync:pull — Pull records from MongoDB that are newer than local.
* Applies conflict resolution (most-recent updated_at wins, id tie-break).
* Admin only.
*/
ipcMain.handle("sync:pull", async () => {
	try {
		requireAdmin();
		const db = getDb();
		const { connected } = getConnectionStatus();
		if (!connected) {
			const mongoUri = getMongoUri();
			if (!mongoUri) throw new Error("No MongoDB URI configured.");
			await connectMongo(mongoUri);
		}
		const results = {};
		for (const entity of SYNC_ENTITIES) {
			let pulled = 0;
			let skipped = 0;
			let failed = 0;
			try {
				const cloudRecords = await entity.model.find({}).lean();
				for (const cloud of cloudRecords) {
					const cloudRecord = cloud;
					try {
						const local = db.prepare(`SELECT * FROM ${entity.table} WHERE id = ?`).get(cloudRecord.id);
						if (!local) {
							const columns = Object.keys(cloudRecord).filter((k) => k !== "_id");
							const placeholders = columns.map(() => "?").join(", ");
							const values = columns.map((c) => cloudRecord[c]);
							db.prepare(`INSERT OR IGNORE INTO ${entity.table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...values);
							logSync("pull-insert", entity.name, cloudRecord.id, "success");
							pulled++;
						} else if (resolveConflict(local, cloudRecord) === "cloud") {
							const columns = Object.keys(cloudRecord).filter((k) => k !== "_id" && k !== "id");
							const setClause = columns.map((c) => `${c} = ?`).join(", ");
							const values = columns.map((c) => cloudRecord[c]);
							values.push(cloudRecord.id);
							db.prepare(`UPDATE ${entity.table} SET ${setClause}, synced = 1 WHERE id = ?`).run(...values);
							logSync("pull-update", entity.name, cloudRecord.id, "success");
							pulled++;
						} else {
							logSync("pull-skip", entity.name, cloudRecord.id, "skipped");
							skipped++;
						}
					} catch (err) {
						logSync("pull", entity.name, cloudRecord.id, "error", err.message);
						failed++;
					}
				}
			} catch (err) {
				logSync("pull", entity.name, "batch", "error", err.message);
			}
			results[entity.name] = {
				pulled,
				skipped,
				failed
			};
		}
		return { results };
	} catch (error) {
		logSync("pull", "all", "batch", "error", error.message);
		console.error("sync:pull error:", error);
		throw new Error(error.message || "Pull failed");
	}
});
var autoSyncTimer = null;
function startAutoSync(intervalMs) {
	if (autoSyncTimer) clearInterval(autoSyncTimer);
	autoSyncTimer = setInterval(async () => {
		const { connected } = getConnectionStatus();
		if (!connected) return;
		try {
			if ((getDb().prepare("SELECT COUNT(*) as c FROM children WHERE synced = 0").get()?.c ?? 0) > 0) {
				const handler = ipcMain.listeners?.("sync:push")?.[0];
				if (typeof handler === "function") await handler({});
			}
		} catch (err) {
			console.error("Auto-sync error:", err);
		}
	}, intervalMs);
}
function stopAutoSync() {
	if (autoSyncTimer) {
		clearInterval(autoSyncTimer);
		autoSyncTimer = null;
	}
}
/**
* sync:auto-sync — Enable/disable auto-sync and set the interval.
* Admin only.
*/
ipcMain.handle("sync:auto-sync", async (_event, { enabled, intervalMinutes = 30 }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (enabled) {
			startAutoSync(intervalMinutes * 60 * 1e3);
			db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("sync_auto_interval", String(intervalMinutes));
			return {
				autoSync: true,
				intervalMinutes
			};
		} else {
			stopAutoSync();
			db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("sync_auto_interval", "0");
			return { autoSync: false };
		}
	} catch (error) {
		console.error("sync:auto-sync error:", error);
		throw new Error(error.message || "Failed to configure auto-sync");
	}
});
//#endregion
//#region electron/ipc/dashboardIPC.ts
var arabicMonths = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
function calculateDashboard(payments, expenses, salaries, targetProfitPct) {
	let invoiced = 0;
	let collected = 0;
	let arrears = 0;
	for (const p of payments) {
		invoiced += p.total;
		collected += p.paid;
		if (p.balance > 0) arrears += p.balance;
	}
	const collectionRate = invoiced > 0 ? Number((collected / invoiced).toFixed(2)) : 0;
	let expensesTotal = 0;
	for (const e of expenses) expensesTotal += e.amount;
	let salariesTotal = 0;
	for (const s of salaries) salariesTotal += s.actual_paid;
	const netProfit = Number((collected - (expensesTotal + salariesTotal)).toFixed(2));
	const totalExpenses = expensesTotal + salariesTotal;
	const targetRequired = targetProfitPct < 1 ? Number((totalExpenses / (1 - targetProfitPct)).toFixed(2)) : 0;
	const gap = Number(Math.max(0, targetRequired - collected).toFixed(2));
	return {
		invoiced: Number(invoiced.toFixed(2)),
		collected: Number(collected.toFixed(2)),
		arrears: Number(arrears.toFixed(2)),
		collectionRate,
		expensesTotal: Number(expensesTotal.toFixed(2)),
		salariesTotal: Number(salariesTotal.toFixed(2)),
		netProfit,
		targetRequired,
		gap
	};
}
function checkAuth() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
ipcMain.handle("dashboard:get", async (_event, { month, year }) => {
	try {
		checkAuth();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get();
		const targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : .2;
		const payments = db.prepare("SELECT total, paid, balance, service FROM payments WHERE month = ? AND year = ?").all(month, year);
		const kpi = calculateDashboard(payments, db.prepare("SELECT amount FROM expenses WHERE month = ? AND year = ?").all(month, year), db.prepare("SELECT actual_paid FROM salary_payments WHERE month = ? AND year = ?").all(month, year), targetProfitPct);
		const revenueByService = [
			"حضانة",
			"استضافة",
			"جلسة"
		].map((srv) => {
			const collectedSrv = payments.filter((p) => p.service === srv).reduce((sum, p) => sum + p.paid, 0);
			return {
				service: srv,
				collected: Number(collectedSrv.toFixed(2))
			};
		});
		const summary12Month = [];
		for (const m of arabicMonths) {
			const mKpi = calculateDashboard(db.prepare("SELECT total, paid, balance FROM payments WHERE month = ? AND year = ?").all(m, year), db.prepare("SELECT amount FROM expenses WHERE month = ? AND year = ?").all(m, year), db.prepare("SELECT actual_paid FROM salary_payments WHERE month = ? AND year = ?").all(m, year), targetProfitPct);
			const totalExp = mKpi.expensesTotal + mKpi.salariesTotal;
			summary12Month.push({
				month: m,
				collected: mKpi.collected,
				expenses: totalExp,
				netProfit: mKpi.netProfit,
				status: mKpi.collected >= mKpi.targetRequired ? "target_met" : "target_missed"
			});
		}
		const alerts = [];
		if (kpi.gap > 0 && kpi.collected > 0) alerts.push({
			type: "warning",
			messageAr: `عجز في تحقيق الأهداف الماليّة بمقدار ${kpi.gap} ج.م لهذا الشهر`,
			messageEn: `Financial target shortfall of ${kpi.gap} EGP this month`
		});
		if (kpi.arrears > 0) alerts.push({
			type: "danger",
			messageAr: `هناك متأخرات مستحقة بقيمة ${kpi.arrears} ج.م على الأطفال هذا الشهر`,
			messageEn: `There are outstanding arrears of ${kpi.arrears} EGP this month`
		});
		if (kpi.collectionRate < .8 && kpi.invoiced > 0) {
			const pct = Math.round(kpi.collectionRate * 100);
			alerts.push({
				type: "info",
				messageAr: `نسبة تحصيل الاشتراكات منخفضة (${pct}%)`,
				messageEn: `Low collection rate of (${pct}%)`
			});
		}
		return {
			kpis: {
				invoiced: kpi.invoiced,
				collected: kpi.collected,
				arrears: kpi.arrears,
				collectionRate: kpi.collectionRate,
				expensesTotal: kpi.expensesTotal,
				salariesTotal: kpi.salariesTotal,
				netProfit: kpi.netProfit
			},
			target: {
				required: kpi.targetRequired,
				collected: kpi.collected,
				gap: kpi.gap,
				status: kpi.gap === 0 && kpi.targetRequired > 0 ? "met" : "missed"
			},
			summary12Month,
			revenueByService,
			alerts
		};
	} catch (error) {
		console.error("Failed to get dashboard data:", error);
		throw new Error(error.message || "Failed to retrieve dashboard data");
	}
});
//#endregion
//#region electron/main.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
protocol.registerSchemesAsPrivileged([{
	scheme: "asset",
	privileges: {
		secure: true,
		standard: true,
		supportFetchAPI: true
	}
}]);
var mainWindow = null;
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 960,
		minHeight: 600,
		icon: path.join(__dirname, "../assets/branding/icon.png"),
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, "preload.cjs")
		},
		title: "نظام إدارة الحضانة ومركز التوحد | Nursery & Autism Center Management System"
	});
	mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
		console.error("PRELOAD ERROR at", preloadPath, "->", error);
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}
app.whenReady().then(async () => {
	const configCheck = checkRequiredConfig();
	if (!configCheck.ok) {
		console.error("FATAL CONFIG ERROR:", configCheck.error);
		dialog.showErrorBox("Configuration Error / خطأ في الإعداد", configCheck.error || "Invalid configuration");
		app.quit();
		return;
	}
	try {
		const db = initDb();
		runMigrations(db);
		await seedDatabase(db);
		console.log("Database initialized, migrated and seeded successfully!");
		const brandingDir = path.join(app.getPath("userData"), "branding");
		if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
		const defaultLogoSrc = path.join(__dirname, "../assets/default-branding/logo.png");
		const defaultIconSrc = path.join(__dirname, "../assets/default-branding/icon.png");
		const destLogo = path.join(brandingDir, "logo.png");
		const destIcon = path.join(brandingDir, "icon.png");
		if (fs.existsSync(defaultLogoSrc) && !fs.existsSync(destLogo)) fs.copyFileSync(defaultLogoSrc, destLogo);
		if (fs.existsSync(defaultIconSrc) && !fs.existsSync(destIcon)) fs.copyFileSync(defaultIconSrc, destIcon);
		const fontsDir = path.join(brandingDir, "fonts");
		if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
		const defaultFontRegularSrc = path.join(__dirname, "../assets/branding/fonts/Cairo-Regular.ttf");
		const defaultFontBoldSrc = path.join(__dirname, "../assets/branding/fonts/Cairo-Bold.ttf");
		const destFontRegular = path.join(fontsDir, "Cairo-Regular.ttf");
		const destFontBold = path.join(fontsDir, "Cairo-Bold.ttf");
		if (fs.existsSync(defaultFontRegularSrc) && !fs.existsSync(destFontRegular)) fs.copyFileSync(defaultFontRegularSrc, destFontRegular);
		if (fs.existsSync(defaultFontBoldSrc) && !fs.existsSync(destFontBold)) fs.copyFileSync(defaultFontBoldSrc, destFontBold);
		const currentLogo = db.prepare("SELECT value FROM settings WHERE key = 'brand_logo_path'").get();
		if (!currentLogo || !currentLogo.value) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('brand_logo_path', 'branding/logo.png')").run();
		const currentIcon = db.prepare("SELECT value FROM settings WHERE key = 'brand_icon_path'").get();
		if (!currentIcon || !currentIcon.value) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('brand_icon_path', 'branding/icon.png')").run();
		const mongoUri = getMongoUri();
		if (mongoUri) {
			console.log("Connecting to MongoDB on startup...");
			connectMongo(mongoUri).then(() => console.log("Successfully connected to MongoDB on startup.")).catch((err) => console.error("Failed to connect to MongoDB on startup:", err.message));
		}
		const autoIntervalRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_auto_interval'").get();
		const savedInterval = Number(autoIntervalRow?.value ?? 0);
		if (savedInterval > 0) startAutoSync(savedInterval * 60 * 1e3);
	} catch (error) {
		console.error("Failed to initialize database or branding assets:", error);
	}
	protocol.handle("asset", (request) => {
		try {
			const cleanPath = decodeURIComponent(request.url.slice(8)).replace(/^\/+/, "");
			const absolutePath = path.isAbsolute(cleanPath) ? cleanPath : path.join(app.getPath("userData"), cleanPath);
			return net.fetch(pathToFileURL(absolutePath).toString());
		} catch (err) {
			console.error("Asset protocol error:", err);
			return new Response("Asset not found", { status: 404 });
		}
	});
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	closeDb();
	if (process.platform !== "darwin") app.quit();
});
//#endregion
export {};

//# sourceMappingURL=main.js.map