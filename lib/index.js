/**
 * dsh-usage-cute — server half.
 *
 * Registers four read-only, loopback-only endpoints on the web server:
 *   GET /api/usage-cute/balance   — balance for one account (?account=<id>)
 *   GET /api/usage-cute/accounts  — switchable balance accounts (ids + names only)
 *   GET /api/usage-cute/usage     — per-day token usage across every session
 *   GET /api/usage-cute/logo.png  — the cute mascot (improved-1.png)
 *
 * Provider config is read from the harness settings (`llm-deepseek` and
 * `llm-pi-ai`); API keys are resolved through the credentials seam at request
 * time — nothing is stored by this plugin, and key values never leave the
 * server.
 *
 * @module dsh-usage-cute
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { applyUsageDelta, createUsageState, renderUsage, totalTokens } from "./usage.js";

/** Stable Cordis plugin name. */
const name = "usage-cute";

/** Services required before this plugin activates. */
const inject = ["webServer", "credentials", "settings", "sessions", "sessionPersistence"];

const BALANCE_PATH = "/api/usage-cute/balance";
const ACCOUNTS_PATH = "/api/usage-cute/accounts";
const USAGE_PATH = "/api/usage-cute/usage";
const LOGO_PATH = "/api/usage-cute/logo.png";
const UPSTREAM_TIMEOUT_MS = 15000;

/** Credential refs starting with this prefix are offered as DeepSeek accounts. */
const TOKEN_PREFIX = "DEEPSEEK_API_KEY";

/** Default DeepSeek connection facts when the settings namespace is absent. */
const DEEPSEEK_DEFAULTS = {
	apiKeyEnv: "DEEPSEEK_API_KEY",
	baseURL: "https://api.deepseek.com"
};

let logoBuffer = null;
let logoLoaded = null;

/** Read (and cache) the mascot PNG shipped with this package. */
async function logoBytes() {
	if (logoBuffer !== null) return logoBuffer;
	if (logoLoaded === null) {
		logoLoaded = readFile(new URL("../assets/logo.png", import.meta.url)).then((buffer) => {
			logoBuffer = buffer;
			return buffer;
		}).catch((error) => {
			logoLoaded = null;
			throw error;
		});
	}
	return logoLoaded;
}

/** Write a JSON response. */
function json(res, status, value) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-cache"
	});
	res.end(body);
}

/**
 * Loopback fence on the PEER SOCKET address: the request must come from a
 * loopback interface (IPv4-mapped IPv6 is normalized). The Host header is
 * kept as an additional check, never the deciding one.
 */
function isLoopbackAddress(address) {
	if (typeof address !== "string") return false;
	const a = address.toLowerCase();
	if (a === "::1") return true;
	const ipv4 = a.startsWith("::ffff:") ? a.slice(7) : a;
	const octets = ipv4.split(".");
	return octets.length === 4 && octets[0] === "127" && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function hostNameOf(value) {
	if (typeof value !== "string") return null;
	const host = value.trim().toLowerCase();
	if (host.startsWith("[")) {
		const close = host.indexOf("]");
		if (close <= 1) return null;
		const suffix = host.slice(close + 1);
		if (suffix !== "" && !/^:\d+$/.test(suffix)) return null;
		return host.slice(1, close);
	}
	const firstColon = host.indexOf(":");
	const lastColon = host.lastIndexOf(":");
	if (firstColon !== lastColon) return host;
	if (lastColon === -1) return host.replace(/\.$/, "");
	if (!/^\d+$/.test(host.slice(lastColon + 1))) return null;
	return host.slice(0, lastColon).replace(/\.$/, "");
}

/** Reject anything that is not a loopback GET from an expected Host. */
function rejectForeignCaller(req, res) {
	if (req.method !== "GET") {
		json(res, 405, { ok: false, error: "method-not-allowed" });
		return true;
	}
	const peer = req.socket?.remoteAddress;
	if (!isLoopbackAddress(peer)) {
		json(res, 403, { ok: false, error: "forbidden" });
		return true;
	}
	const host = hostNameOf(req.headers.host);
	if (host !== null && host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
		json(res, 403, { ok: false, error: "forbidden" });
		return true;
	}
	return false;
}

/** Resolve a credential reference through the harness credentials seam. */
async function resolveCredential(ctx, ref) {
	try {
		const credentials = ctx.get("credentials") ?? ctx.credentials;
		if (credentials === void 0 || typeof credentials.resolve !== "function") return "";
		const hit = await credentials.resolve(ref);
		return typeof hit?.value === "string" ? hit.value.trim() : "";
	} catch {
		return "";
	}
}

/** Enumerate the official DeepSeek route from the harness settings. */
function deepseekProvider(ctx) {
	const settings = ctx.get("settings");
	const deepseek = settings?.get?.("llm-deepseek");
	if (deepseek !== null && typeof deepseek === "object") {
		return {
			apiKeyEnv: typeof deepseek.apiKeyEnv === "string" && deepseek.apiKeyEnv.length > 0 ? deepseek.apiKeyEnv : DEEPSEEK_DEFAULTS.apiKeyEnv,
			baseURL: typeof deepseek.baseURL === "string" && deepseek.baseURL.length > 0 ? deepseek.baseURL : DEEPSEEK_DEFAULTS.baseURL
		};
	}
	return { ...DEEPSEEK_DEFAULTS };
}

/** GET a JSON payload from `url` with a Bearer key and a timeout. */
async function fetchWithKey(url, apiKey) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
	let response;
	try {
		response = await fetch(url, {
			headers: { authorization: `Bearer ${apiKey}` },
			signal: controller.signal
		});
	} finally {
		clearTimeout(timer);
	}
	return response;
}

/** Map a provider base URL to a known balance scheme, or null. */
function balanceSchemeOf(baseURL) {
	if (typeof baseURL !== "string" || baseURL.length === 0) return null;
	try {
		const host = new URL(baseURL).hostname.toLowerCase();
		if (host.includes("siliconflow")) return "siliconflow";
	} catch {
		// unparsable base URL — no scheme
	}
	return null;
}

/** Read `DEEPSEEK_API_KEY*` credential refs from the credentials file. */
async function deepseekTokenRefs(ctx) {
	const provider = deepseekProvider(ctx);
	const refs = new Set([provider.apiKeyEnv]);
	try {
		const file = join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), ".credentials.yaml");
		const text = await readFile(file, "utf8");
		for (const line of text.split("\n")) {
			const match = /^([A-Za-z0-9_]+):/.exec(line.trim());
			if (match !== null && match[1].startsWith(TOKEN_PREFIX)) refs.add(match[1]);
		}
	} catch {
		// missing/unreadable credentials file — default ref only
	}
	return [...refs].sort();
}

/**
 * List switchable balance accounts: every DeepSeek key plus every pi-ai
 * provider that resolves to a known balance scheme (SiliconFlow today).
 * Only account ids / key names are returned — values never leave the server.
 */
async function listAccounts(ctx) {
	const provider = deepseekProvider(ctx);
	const accounts = [];
	for (const ref of await deepseekTokenRefs(ctx)) {
		accounts.push({
			id: `deepseek-official:${ref}`,
			provider: "deepseek-official",
			displayName: ref === provider.apiKeyEnv ? "DeepSeek（默认）" : `DeepSeek · ${ref}`,
			ref,
			baseURL: provider.baseURL,
			scheme: "deepseek",
			isDefault: ref === provider.apiKeyEnv
		});
	}
	const settings = ctx.get("settings");
	const pi = settings?.get?.("llm-pi-ai");
	if (pi !== void 0 && pi !== null && typeof pi === "object" && pi.providers !== void 0 && typeof pi.providers === "object") {
		for (const [route, profile] of Object.entries(pi.providers)) {
			if (profile === null || typeof profile !== "object") continue;
			const baseURL = typeof profile.baseURL === "string" && profile.baseURL.length > 0 ? profile.baseURL : "";
			const ref = typeof profile.apiKeyEnv === "string" && profile.apiKeyEnv.length > 0 ? profile.apiKeyEnv : "";
			const scheme = balanceSchemeOf(baseURL);
			if (scheme === null || ref === "") continue;
			const displayName = typeof profile.displayName === "string" && profile.displayName.length > 0 ? profile.displayName : route;
			accounts.push({
				id: `${route}:${ref}`,
				provider: route,
				displayName: scheme === "siliconflow" ? `${displayName}（硅基流动）` : displayName,
				ref,
				baseURL,
				scheme,
				isDefault: false
			});
		}
	}
	return accounts;
}

/** Resolve one account id (`<provider>:<ref>`) to its full descriptor. */
async function resolveAccount(ctx, accountId) {
	if (typeof accountId !== "string" || accountId.length === 0) return null;
	const accounts = await listAccounts(ctx);
	return accounts.find((account) => account.id === accountId) ?? null;
}

/** Map an HTTP status to a structured error result, or null when OK. */
function balanceStatusError(status, account) {
	if (status === 401 || status === 403) {
		return { ok: false, error: "unauthorized", message: `balance check rejected (HTTP ${status}) — is ${account.ref} valid?`, account: account.id };
	}
	if (status === 429) {
		return { ok: false, error: "rate-limited", message: "the provider is rate limiting balance checks; retry later.", account: account.id };
	}
	if (status >= 400) {
		return { ok: false, error: "failed", message: `balance endpoint returned HTTP ${status}`, account: account.id };
	}
	return null;
}

/** Join a base URL and a path without losing a path prefix on the base. */
function joinUrl(baseURL, path) {
	return baseURL.replace(/\/+$/, "") + path;
}

/** DeepSeek: GET {origin}/user/balance — CNY balance_infos entry. */
async function queryDeepseekBalance(account, apiKey) {
	const response = await fetchWithKey(joinUrl(account.baseURL, "/user/balance"), apiKey);
	const statusError = balanceStatusError(response.status, account);
	if (statusError !== null) return statusError;
	const payload = await response.json().catch(() => null);
	if (payload === null) return { ok: false, error: "invalid-response", message: "balance endpoint returned non-JSON", account: account.id };
	const infos = Array.isArray(payload?.balance_infos) ? payload.balance_infos : [];
	const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
	return {
		ok: true,
		account: account.id,
		balance: {
			isAvailable: payload?.is_available === true,
			currency: info?.currency ?? "CNY",
			total: info?.total_balance ?? void 0,
			granted: info?.granted_balance ?? void 0,
			toppedUp: info?.topped_up_balance ?? void 0
		},
		fetchedAt: Date.now()
	};
}

/** SiliconFlow: GET {base}/user/info — data.totalBalance / data.chargeBalance. */
async function querySiliconflowBalance(account, apiKey) {
	const response = await fetchWithKey(joinUrl(account.baseURL, "/user/info"), apiKey);
	const statusError = balanceStatusError(response.status, account);
	if (statusError !== null) return statusError;
	const payload = await response.json().catch(() => null);
	if (payload === null) return { ok: false, error: "invalid-response", message: "balance endpoint returned non-JSON", account: account.id };
	const data = payload?.data ?? {};
	const total = data?.totalBalance !== void 0 ? Number(data.totalBalance) : void 0;
	const charge = data?.chargeBalance !== void 0 ? Number(data.chargeBalance) : void 0;
	const available = data?.balance !== void 0 ? Number(data.balance) : void 0;
	return {
		ok: true,
		account: account.id,
		balance: {
			isAvailable: available !== void 0 ? available > 0 : payload?.status === true,
			currency: "CNY",
			total: Number.isFinite(total) ? total : void 0,
			granted: void 0,
			toppedUp: Number.isFinite(charge) ? charge : void 0
		},
		fetchedAt: Date.now()
	};
}

/**
 * Query one account's balance by its balance scheme.
 * @param ctx - plugin context.
 * @param accountId - `<provider>:<ref>` account id (empty string = none).
 * @returns `{ ok, account?, balance?, error?, message?, fetchedAt? }`
 */
async function fetchBalance(ctx, accountId) {
	const account = await resolveAccount(ctx, accountId);
	if (account === null) {
		return { ok: false, error: "unknown-account", message: `account "${accountId}" is not configured` };
	}
	const apiKey = await resolveCredential(ctx, account.ref);
	if (apiKey === "") {
		return { ok: false, error: "no-credential", message: `${account.ref} is not configured (edit ~/.dsh/.credentials.yaml)`, account: account.id };
	}
	try {
		if (account.scheme === "deepseek") return await queryDeepseekBalance(account, apiKey);
		if (account.scheme === "siliconflow") return await querySiliconflowBalance(account, apiKey);
		return { ok: false, error: "unsupported", message: `${account.provider} has no public balance interface`, account: account.id };
	} catch (error) {
		ctx.logger.warn(`usage-cute: balance query for ${account.id} failed: ${String(error)}`);
		return { ok: false, error: "failed", message: error instanceof Error ? error.message : String(error), account: account.id };
	}
}

/**
 * Collect per-day usage across live and persisted sessions. Simple version:
 * refold every session from scratch on each request (local single-user
 * harness — logs are small).
 */
async function collectUsage(ctx) {
	const byDay = new Map();
	const live = ctx.get("sessions");
	if (live !== void 0) {
		for (const session of live.list()) {
			const state = createUsageState();
			applyUsageDelta(state, session.events ?? []);
			mergeDays(byDay, state.days);
		}
	}
	const persistence = ctx.get("sessionPersistence");
	if (persistence !== void 0) {
		let metas = [];
		try {
			if (typeof persistence.listSnapshots === "function") {
				const snapshots = await persistence.listSnapshots();
				metas = snapshots.map((entry) => entry.header);
			} else if (typeof persistence.list === "function") {
				metas = await persistence.list();
			}
		} catch (error) {
			ctx.logger.warn(`usage-cute: session listing failed: ${String(error)}`);
		}
		for (const meta of metas) {
			try {
				const { events } = await persistence.readFrom(meta.id, 0);
				const state = createUsageState();
				applyUsageDelta(state, events ?? []);
				mergeDays(byDay, state.days);
			} catch (error) {
				ctx.logger.warn(`usage-cute: reading persisted session "${meta.id}" failed: ${String(error)}`);
			}
		}
	}
	return renderUsage(byDay);
}

function mergeDays(target, source) {
	for (const [day, models] of source) {
		let targetDay = target.get(day);
		if (targetDay === void 0) {
			targetDay = new Map();
			target.set(day, targetDay);
		}
		for (const [model, buckets] of models) {
			const existing = targetDay.get(model);
			if (existing === void 0) {
				targetDay.set(model, { ...buckets });
			} else {
				existing.inputTokens += buckets.inputTokens;
				existing.outputTokens += buckets.outputTokens;
				existing.cacheReadTokens += buckets.cacheReadTokens;
				existing.cacheWriteTokens += buckets.cacheWriteTokens;
			}
		}
	}
}

/** Summarize usage into today / this month / all-time plus the day list. */
function summarize(rendered) {
	const todayKey = new Date();
	const monthPrefix = `${todayKey.getFullYear()}-${String(todayKey.getMonth() + 1).padStart(2, "0")}`;
	let today = 0;
	let month = 0;
	let total = 0;
	for (const day of rendered.days) {
		total += day.totalTokens;
		if (day.day.startsWith(monthPrefix)) month += day.totalTokens;
		if (day.day === `${monthPrefix}-${String(todayKey.getDate()).padStart(2, "0")}`) today = day.totalTokens;
	}
	return { today, month, total, days: rendered.days };
}

async function handleBalance(ctx, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		const url = new URL(req.url ?? "/", "http://x");
		const account = url.searchParams.get("account");
		const result = await fetchBalance(ctx, account ?? "");
		json(res, 200, result);
	} catch (error) {
		ctx.logger.warn(`usage-cute: balance fetch failed: ${String(error)}`);
		json(res, 502, { ok: false, error: "failed", message: error instanceof Error ? error.message : String(error) });
	}
}

async function handleAccounts(ctx, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		const accounts = await listAccounts(ctx);
		json(res, 200, { ok: true, accounts });
	} catch (error) {
		ctx.logger.warn(`usage-cute: account enumeration failed: ${String(error)}`);
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

async function handleUsage(ctx, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		const rendered = await collectUsage(ctx);
		json(res, 200, { ok: true, ...summarize(rendered), fetchedAt: Date.now() });
	} catch (error) {
		ctx.logger.warn(`usage-cute: usage aggregation failed: ${String(error)}`);
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

async function handleLogo(ctx, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		const bytes = await logoBytes();
		res.writeHead(200, {
			"content-type": "image/png",
			"content-length": bytes.length,
			"cache-control": "public, max-age=3600"
		});
		res.end(bytes);
	} catch (error) {
		ctx.logger.warn(`usage-cute: logo fetch failed: ${String(error)}`);
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

const Config = {
	"~standard": {
		version: 1,
		vendor: "dsh-usage-cute",
		validate(value) {
			return { value: value ?? {} };
		}
	}
};

/** Plugin body: register the exact routes. */
async function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: BALANCE_PATH,
		handler: (req, res) => handleBalance(ctx, req, res)
	}), "usage-cute: balance route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: ACCOUNTS_PATH,
		handler: (req, res) => handleAccounts(ctx, req, res)
	}), "usage-cute: accounts route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: USAGE_PATH,
		handler: (req, res) => handleUsage(ctx, req, res)
	}), "usage-cute: usage route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: LOGO_PATH,
		handler: (req, res) => handleLogo(ctx, req, res)
	}), "usage-cute: logo route");
}

export { apply, Config, inject, name, BALANCE_PATH, ACCOUNTS_PATH, USAGE_PATH, LOGO_PATH, totalTokens };
