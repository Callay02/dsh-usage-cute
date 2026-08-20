/**
 * dsh-usage-cute — pure per-day token-usage aggregation over session events.
 *
 * Mirrors dsh-token-meter's projection: a usage sample rides an
 * `assistant/chunk` (`data.chunk.type === "usage"`) or an `assistant/message`
 * (`data.usage`); a repeated sample for the same (turn, step) REPLACES the
 * earlier value instead of double counting it, re-attributed to the day of
 * the later event. Each sample is attributed to the model that produced it:
 * `assistant/message` carries `data.message.source.model`; usage chunks fall
 * back to the last `request/header` `data.header.config.model`; samples with
 * no model information land in the `unknown` bucket.
 *
 * Kept free of cordis imports so it can be unit-tested standalone.
 * @module dsh-usage-cute/usage
 */

/** Local-calendar `YYYY-MM-DD` key for a millisecond epoch. */
export function dayKey(timeMs) {
	const date = new Date(timeMs);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Empty token bucket. */
export function zeroBuckets() {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0
	};
}

/** Provider usage -> buckets (cache fields may be absent in some reports). */
export function bucketsOf(usage) {
	return {
		inputTokens: usage.inputTokens ?? 0,
		outputTokens: usage.outputTokens ?? 0,
		cacheReadTokens: usage.cacheReadTokens ?? 0,
		cacheWriteTokens: usage.cacheWriteTokens ?? 0
	};
}

/** Total tokens across all buckets. */
export function totalTokens(buckets) {
	return buckets.inputTokens + buckets.outputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens;
}

/** Prompt-side cache hit rate in percent (0-100, one decimal) or null. */
export function cacheHitRate(buckets) {
	const input = buckets.inputTokens ?? 0;
	const cacheRead = buckets.cacheReadTokens ?? 0;
	const cacheWrite = buckets.cacheWriteTokens ?? 0;
	const promptTokens = input + cacheRead + cacheWrite;
	if (promptTokens <= 0) return null;
	return Math.round((cacheRead / promptTokens) * 1000) / 10;
}

function addInto(target, source) {
	target.inputTokens += source.inputTokens;
	target.outputTokens += source.outputTokens;
	target.cacheReadTokens += source.cacheReadTokens;
	target.cacheWriteTokens += source.cacheWriteTokens;
	return target;
}

/** Extract the usage sample an event carries, if any. */
function sampleOf(event) {
	if (event.type === "assistant/chunk" && event.data?.chunk?.type === "usage") {
		return {
			key: `${event.data.turn}:${event.data.step}`,
			usage: event.data.chunk.usage
		};
	}
	if (event.type === "assistant/message" && event.data?.usage !== void 0) {
		return {
			key: `${event.data.turn}:${event.data.step}`,
			usage: event.data.usage
		};
	}
	return void 0;
}

/** Model name an event is attributed to, or `unknown`. */
function modelOf(event, fallback) {
	if (event.type === "assistant/message") {
		const model = event.data?.message?.source?.model;
		if (typeof model === "string" && model.length > 0) return model;
	}
	if (event.type === "request/header" && event.data?.header?.config?.model !== void 0) {
		return String(event.data.header.config.model);
	}
	return fallback ?? "unknown";
}

/**
 * Fold a list of session events into the per-day per-model state.
 * @param state - mutable `{ days, lastSample, currentModel }` accumulator.
 * @param events - event list (persisted events carry `seq`, live ones do not).
 */
export function applyUsageDelta(state, events) {
	for (const event of events) {
		if (event.type === "request/header" && event.data?.header?.config?.model !== void 0) {
			state.currentModel = String(event.data.header.config.model);
			continue;
		}
		const sample = sampleOf(event);
		if (sample === void 0) continue;
		if (state.lastSample !== null && state.lastSample.key === sample.key) {
			// Replacement: undo the previous attribution first.
			const previous = state.lastSample;
			const day = state.days.get(previous.day);
			if (day !== void 0) {
				const model = day.get(previous.model);
				if (model !== void 0) {
					subtractFrom(model, previous.buckets);
					if (totalTokens(model) === 0) day.delete(previous.model);
				}
				if (day.size === 0) state.days.delete(previous.day);
			}
		}
		const model = modelOf(event, state.currentModel);
		const key = dayKey(event.time ?? event.timestamp ?? Date.now());
		let day = state.days.get(key);
		if (day === void 0) {
			day = new Map();
			state.days.set(key, day);
		}
		let modelBuckets = day.get(model);
		if (modelBuckets === void 0) {
			modelBuckets = zeroBuckets();
			day.set(model, modelBuckets);
		}
		addInto(modelBuckets, bucketsOf(sample.usage));
		state.lastSample = {
			key: sample.key,
			day: key,
			model,
			buckets: bucketsOf(sample.usage)
		};
	}
}

function subtractFrom(target, source) {
	target.inputTokens -= source.inputTokens;
	target.outputTokens -= source.outputTokens;
	target.cacheReadTokens -= source.cacheReadTokens;
	target.cacheWriteTokens -= source.cacheWriteTokens;
	return target;
}

/** Fresh fold state. */
export function createUsageState() {
	return {
		days: new Map(),
		lastSample: null,
		currentModel: null
	};
}

/**
 * Render the fold state as a plain JSON view for the UI.
 * @returns `{ days: [{ day, totalTokens, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, cacheHitRate, models: [...] }] }`
 */
export function renderUsage(byDay) {
	const days = [...byDay.entries()]
		.map(([day, models]) => {
			const buckets = zeroBuckets();
			const modelList = [...models.entries()].map(([model, b]) => ({
				model,
				...b,
				totalTokens: totalTokens(b)
			}));
			for (const b of models.values()) addInto(buckets, b);
			return {
				day,
				totalTokens: totalTokens(buckets),
				...buckets,
				cacheHitRate: cacheHitRate(buckets),
				models: modelList
			};
		})
		.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
	return { days };
}
