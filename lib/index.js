/**
 * dsh-usage-cute — server half.
 *
 * Registers four read-only, loopback-only endpoints on the web server:
 *   GET /api/usage-cute/balance   — DeepSeek account balance (?token=<ref> to pick a key)
 *   GET /api/usage-cute/tokens    — available DeepSeek credential key names (names only)
 *   GET /api/usage-cute/usage     — per-day token usage across every session
 *   GET /api/usage-cute/logo.png  — the cute mascot (improved-1.png)
 *
 * Provider config is read from the harness settings (`llm-deepseek`); the API
 * key is resolved through the credentials seam at request time — nothing is
 * stored by this plugin.
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
const TOKENS_PATH = "/api/usage-cute/tokens";
const USAGE_PATH = "/api/usage-cute/usage";
const LOGO_PATH = "/api/usage-cute/logo.png";
const UPSTREAM_TIMEOUT_MS = 15000;

/** Credential refs starting with this prefix are offered as switchable tokens. */
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

/**
 * Query the DeepSeek balance endpoint for one credential ref.
 * @param ctx - plugin context.
 * @param explicitRef - an optional credential ref override (`?token=`); falls
 *   back to the provider's configured `apiKeyEnv`.
 * @returns `{ ok, balance?, error?, message?, fetchedAt?, token }`
 */
async function fetchDeepseekBalance(ctx, explicitRef) {
	const provider = deepseekProvider(ctx);
	const ref = typeof explicitRef === "string" && explicitRef.length > 0 ? explicitRef : provider.apiKeyEnv;
	const apiKey = await resolveCredential(ctx, ref);
	if (apiKey === "") {
		return { ok: false, error: "no-credential", message: `${ref} is not configured (edit ~/.dsh/.credentials.yaml)`, token: ref };
	}
	const url = new URL("/user/balance", provider.baseURL).href;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
	let response;
	try {
		response = await fetch(url, {
			headers: { authorization: `Bearer ${apiKey}` },
			signal: controller.signal
		});
	} catch (error) {
		return { ok: false, error: "failed", message: error instanceof Error ? error.message : String(error), token: ref };
	} finally {
		clearTimeout(timer);
	}
	if (response.status === 401 || response.status === 403) {
		return { ok: false, error: "unauthorized", message: `balance check rejected (HTTP ${response.status}) — is ${ref} valid?`, token: ref };
	}
	if (response.status === 429) {
		return { ok: false, error: "rate-limited", message: "DeepSeek is rate limiting balance checks; retry later.", token: ref };
	}
	if (!response.ok) {
		return { ok: false, error: "failed", message: `balance endpoint returned HTTP ${response.status}`, token: ref };
	}
	let payload;
	try {
		payload = await response.json();
	} catch {
		return { ok: false, error: "invalid-response", message: "balance endpoint returned non-JSON", token: ref };
	}
	const infos = Array.isArray(payload?.balance_infos) ? payload.balance_infos : [];
	const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
	return {
		ok: true,
		token: ref,
		balance: {
			isAvailable: payload?.is_available === true,
			currency: info?.currency ?? void 0,
			total: info?.total_balance ?? void 0,
			granted: info?.granted_balance ?? void 0,
			toppedUp: info?.topped_up_balance ?? void 0
		},
		fetchedAt: Date.now()
	};
}

/**
 * List switchable DeepSeek credential refs: every key in the credentials file
 * whose name starts with `DEEPSEEK_API_KEY`, with the provider's configured
 * default flagged first. Only key NAMES are returned — values never leave the
 * server.
 */
async function listTokenRefs(ctx) {
	const provider = deepseekProvider(ctx);
	const defaultRef = provider.apiKeyEnv;
	const refs = new Set([defaultRef]);
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
	const tokens = [...refs].sort().map((ref) => ({ ref, isDefault: ref === defaultRef }));
	tokens.sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0));
	return tokens;
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
		const token = url.searchParams.get("token");
		const result = await fetchDeepseekBalance(ctx, token ?? void 0);
		json(res, 200, result);
	} catch (error) {
		ctx.logger.warn(`usage-cute: balance fetch failed: ${String(error)}`);
		json(res, 502, { ok: false, error: "failed", message: error instanceof Error ? error.message : String(error) });
	}
}

async function handleTokens(ctx, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		const tokens = await listTokenRefs(ctx);
		json(res, 200, { ok: true, tokens });
	} catch (error) {
		ctx.logger.warn(`usage-cute: token enumeration failed: ${String(error)}`);
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
		path: TOKENS_PATH,
		handler: (req, res) => handleTokens(ctx, req, res)
	}), "usage-cute: tokens route");
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

export { apply, Config, inject, name, BALANCE_PATH, TOKENS_PATH, USAGE_PATH, LOGO_PATH, totalTokens };
