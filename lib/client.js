/**
 * dsh-usage-cute — browser half.
 *
 * Hand-written `__ModuleLoader__` bundle (no build step): a sidebar footer
 * action that opens a floating panel showing the DeepSeek balance and daily
 * token usage, dressed up with the cute mascot (improved-1.png) served by the
 * server half. Data comes from the loopback-only endpoints via same-origin
 * fetch.
 */
window.__ModuleLoader__.load({
	id: "dsh-usage-cute",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region css — cute & round
		const css = [
			".uc_layer{flex:none;align-items:center;width:100%;height:49px;margin:8px 0 0;display:flex;position:relative}",
			".uc_footerButtons{align-items:center;width:100%;display:flex}",
			".uc_badge{width:100%;height:49px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:14px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden;transition:background .15s}",
			".uc_badge:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}",
			".uc_badge[data-active]{background:var(--dsw-alias-interactive-bg-hover)}",
			".uc_badgeLogo{width:30px;height:30px;flex:none;border-radius:50%;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,.18);transition:transform .2s}",
			".uc_badge:hover .uc_badgeLogo{transform:rotate(-8deg) scale(1.08)}",
			".uc_badgeLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden;font-size:13px}",
			".uc_badgeAmount{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;flex:none;font-size:12px;font-weight:600;line-height:16px}",
			".uc_badgeOk{color:var(--dsw-alias-state-success-primary)}",
			".uc_badgeBad{color:var(--dsw-alias-state-error-primary)}",
			".uc_badgeCount{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;font-size:12px;line-height:16px}",
			".uc_layer.uc_rail{width:36px;height:36px;margin:0}",
			".uc_layer.uc_rail .uc_badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}",
			".uc_layer.uc_rail .uc_footerButtons{flex-direction:column;gap:2px}",
			".uc_panel{z-index:100;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));width:420px;max-width:calc(100vw - 24px);max-height:74vh;box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:18px;flex-direction:column;display:flex;position:fixed;overflow:hidden;animation:uc_pop .18s ease;will-change:left,top}",
			".uc_panel[data-dragging]{box-shadow:var(--dsw-shadow-lv3)}",
			"@keyframes uc_pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}",
			".uc_header{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);background:linear-gradient(135deg,color-mix(in srgb,#ff9ad5 10%,transparent),color-mix(in srgb,#8ec5ff 10%,transparent));flex:none;justify-content:space-between;align-items:center;min-height:52px;padding:8px 12px;display:flex;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}",
			".uc_panel[data-dragging] .uc_header{cursor:grabbing}",
			".uc_headerLeft{align-items:center;gap:10px;display:flex}",
			".uc_headerLogo{width:38px;height:38px;flex:none;border-radius:12px;object-fit:cover;box-shadow:0 3px 10px rgba(0,0,0,.2)}",
			".uc_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px;display:flex;flex-direction:column}",
			".uc_titleSub{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;font-weight:400}",
			".uc_headerActions{align-items:center;gap:2px;display:flex}",
			".uc_iconButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;padding:0;display:inline-flex;transition:background .15s}",
			".uc_iconButton:hover{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}",
			".uc_body{flex:1;min-height:0;padding:12px 14px 14px;overflow-y:auto}",
			".uc_section{margin-top:12px}",
			".uc_section:first-child{margin-top:0}",
			".uc_sectionTitle{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin:0 0 8px;display:flex;align-items:center;gap:5px}",
			".uc_note{color:var(--dsw-alias-label-tertiary);margin:4px 0;font-size:12px;line-height:18px}",
			".uc_error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:10px;justify-content:space-between;align-items:flex-start;gap:8px;margin:4px 0;padding:8px 10px;font-size:12px;line-height:18px;display:flex}",
			".uc_retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;text-decoration:underline}",
			".uc_balanceCard{box-sizing:border-box;border:1px solid color-mix(in srgb,#ff9ad5 30%,transparent);background:linear-gradient(135deg,color-mix(in srgb,#ff9ad5 14%,transparent),color-mix(in srgb,#8ec5ff 14%,transparent));border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden}",
			".uc_balanceMain{align-items:baseline;gap:8px;display:flex}",
			".uc_balanceCurrency{color:var(--dsw-alias-label-secondary);font-size:14px;font-weight:600}",
			".uc_balanceAmount{color:var(--dsw-alias-label-primary);font-size:26px;font-weight:700;line-height:32px;font-variant-numeric:tabular-nums}",
			".uc_balanceStatus{align-items:center;gap:5px;font-size:12px;line-height:18px;display:inline-flex;margin-left:auto}",
			".uc_pill{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-fill-l2);border-radius:999px;padding:2px 8px;font-size:10px;line-height:16px;white-space:nowrap}",
			".uc_pill[data-status=ok]{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent)}",
			".uc_pill[data-status=bad]{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}",
			".uc_tokenPicker{align-items:center;gap:8px;margin:2px 0 8px;font-size:12px;line-height:18px;display:flex}",
			".uc_tokenPickerLabel{color:var(--dsw-alias-label-tertiary);flex:none}",
			".uc_tokenSelect{box-sizing:border-box;min-width:0;flex:1;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:4px 6px;font:inherit;font-size:12px;line-height:18px;cursor:pointer}",
			".uc_balanceRows{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:3px;font-size:12px;line-height:18px;display:flex}",
			".uc_balanceRow{justify-content:space-between;display:flex}",
			".uc_balanceRow b{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;font-weight:600}",
			".uc_statsRow{display:flex;gap:8px}",
			".uc_stat{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;flex:1;flex-direction:column;gap:2px;padding:9px 10px;display:flex;background:color-mix(in srgb,#ffd9ef 5%,transparent)}",
			".uc_statValue{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:700;line-height:22px;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".uc_statLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
			".uc_hitCaption{color:var(--dsw-alias-label-tertiary);margin-top:6px;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			".uc_hitCaption b{color:var(--dsw-alias-label-secondary);font-weight:600}",
			".uc_bars{display:flex;gap:6px;align-items:flex-end;height:64px;padding:4px 2px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".uc_barCol{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}",
			".uc_bar{width:100%;max-width:20px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#ffb3d9,#ff8ac2);min-height:3px;transition:height .25s ease,opacity .2s}",
			".uc_barCol:hover .uc_bar{background:linear-gradient(180deg,#8ec5ff,#6ea8ff)}",
			".uc_bar[data-zero]{background:var(--dsw-alias-fill-l2);opacity:.6}",
			".uc_barLabel{color:var(--dsw-alias-label-caption);font-size:9px;line-height:12px;font-variant-numeric:tabular-nums;white-space:nowrap;transform:scale(.92)}",
			".uc_updated{color:var(--dsw-alias-label-caption);margin-top:10px;font-size:10px;line-height:14px;text-align:center;font-variant-numeric:tabular-nums}",
			".uc_loading{color:var(--dsw-alias-label-tertiary);margin:10px 0;font-size:12px;line-height:18px;display:flex;align-items:center;gap:8px}",
			".uc_spin{animation:uc_spin 1s linear infinite}",
			"@keyframes uc_spin{to{transform:rotate(360deg)}}"
		].join("");

		const tagId = "dsh-usage-cute/styles";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-usage-cute";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region helpers
		const BALANCE_URL = "/api/usage-cute/balance";
		const ACCOUNTS_URL = "/api/usage-cute/accounts";
		const USAGE_URL = "/api/usage-cute/usage";
		const LOGO_URL = "/api/usage-cute/logo.png";
		const ACCOUNT_STORAGE_KEY = "dsh-usage-cute:account";

		/** Promise-guarded fetch so concurrent clicks share one request. */
		function createLoader() {
			let active = null;
			return (url) => {
				if (active !== null) return active;
				active = fetch(url, { headers: { accept: "application/json" } })
					.then((response) => {
						if (!response.ok) throw new Error("HTTP " + response.status);
						return response.json();
					})
					.finally(() => {
						active = null;
					});
				return active;
			};
		}

		function fmtTokens(value) {
			if (value === void 0 || value === null) return "—";
			return Number(value).toLocaleString("en-US");
		}

		function fmtMoney(value) {
			if (value === void 0 || value === null) return "—";
			return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		}

		function fmtTime(value) {
			if (value === void 0 || value === null) return "—";
			const date = new Date(value);
			return date.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
		}

		function dayLabel(day) {
			const today = new Date();
			const key = day;
			const parts = key.split("-");
			const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
			const tKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
			if (key === tKey) return "今天";
			return String(d.getMonth() + 1) + "/" + String(d.getDate()).padStart(2, "0");
		}

		function maxTokens(days) {
			let max = 0;
			for (const day of days) {
				if (day.totalTokens > max) max = day.totalTokens;
			}
			return max;
		}

		//#region panel drag helpers
		const PANEL_STORAGE_KEY = "dsh-usage-cute:pos";

		function defaultPanelPos() {
			const height = typeof window !== "undefined" ? window.innerHeight : 900;
			return { x: 12, y: Math.max(8, height - 320 - 128) };
		}

		function loadPanelPos() {
			try {
				const raw = localStorage.getItem(PANEL_STORAGE_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
						return { x: parsed.x, y: parsed.y };
					}
				}
			} catch {
				// ignore
			}
			return defaultPanelPos();
		}

		function savePanelPos(pos) {
			try {
				localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(pos));
			} catch {
				// ignore
			}
		}
		//#endregion
		//#endregion

		//#region plugin body
		const NS = "usage-cute";

		function UsageCutePanel({ wide, t }) {
			const [open, setOpen] = react.useState(false);
			const [balance, setBalance] = react.useState(null);
			const [balanceError, setBalanceError] = react.useState(null);
			const [usage, setUsage] = react.useState(null);
			const [usageError, setUsageError] = react.useState(null);
			const [updatedAt, setUpdatedAt] = react.useState(null);
			const balanceLoader = react.useRef(null);
			const usageLoader = react.useRef(null);
			const [pos, setPos] = react.useState(loadPanelPos);
			const [dragging, setDragging] = react.useState(false);
			const panelRef = react.useRef(null);
			const posRef = react.useRef(pos);
			const dragRef = react.useRef(null);
			const [accounts, setAccounts] = react.useState([]);
			const [selectedAccount, setSelectedAccount] = react.useState(() => {
				try {
					return localStorage.getItem(ACCOUNT_STORAGE_KEY) ?? "";
				} catch {
					return "";
				}
			});

			if (balanceLoader.current === null) balanceLoader.current = createLoader();
			if (usageLoader.current === null) usageLoader.current = createLoader();

			const balanceUrl = selectedAccount && selectedAccount.length > 0
				? BALANCE_URL + "?account=" + encodeURIComponent(selectedAccount)
				: BALANCE_URL;

			const refresh = react.useCallback(() => {
				setBalanceError(null);
				setUsageError(null);
				balanceLoader.current(balanceUrl).then((data) => {
					setBalance(data);
					setUpdatedAt(Date.now());
				}).catch((error) => {
					setBalanceError(error instanceof Error ? error.message : String(error));
				});
				usageLoader.current(USAGE_URL).then((data) => {
					setUsage(data);
					setUpdatedAt(Date.now());
				}).catch((error) => {
					setUsageError(error instanceof Error ? error.message : String(error));
				});
			}, [balanceUrl]);

			react.useEffect(() => {
				refresh();
				const timer = setInterval(refresh, 5 * 60 * 1000);
				return () => clearInterval(timer);
			}, [refresh]);

			//#region account switcher
			react.useEffect(() => {
				let cancelled = false;
				fetch(ACCOUNTS_URL, { headers: { accept: "application/json" } })
					.then((response) => (response.ok ? response.json() : Promise.reject(new Error("HTTP " + response.status))))
					.then((data) => {
						if (!cancelled && Array.isArray(data?.accounts)) setAccounts(data.accounts);
					})
					.catch(() => {
						// account list unavailable — default account only
					});
				return () => {
					cancelled = true;
				};
			}, []);

			react.useEffect(() => {
				if (accounts.length === 0) return;
				if (accounts.some((account) => account.id === selectedAccount)) return;
				const fallback = accounts.find((account) => account.isDefault) ?? accounts[0];
				setSelectedAccount(fallback?.id ?? "");
			}, [accounts, selectedAccount]);

			react.useEffect(() => {
				try {
					localStorage.setItem(ACCOUNT_STORAGE_KEY, selectedAccount);
				} catch {
					// ignore
				}
			}, [selectedAccount]);
			//#endregion

			//#region drag
			const onHeaderPointerDown = (e) => {
				if (e.pointerType === "mouse" && e.button !== 0) return;
				if (e.target instanceof Element && e.target.closest("button")) return;
				if (!panelRef.current) return;
				dragRef.current = {
					startX: e.clientX,
					startY: e.clientY,
					origX: posRef.current.x,
					origY: posRef.current.y,
					moved: false
				};
				setDragging(true);
				try {
					e.currentTarget.setPointerCapture(e.pointerId);
				} catch {
					// ignore
				}
				e.preventDefault();
			};

			const onHeaderPointerMove = (e) => {
				const drag = dragRef.current;
				if (drag === null) return;
				const dx = e.clientX - drag.startX;
				const dy = e.clientY - drag.startY;
				if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
				drag.moved = true;
				const panel = panelRef.current;
				const panelW = panel !== null ? panel.offsetWidth : 420;
				const maxX = Math.max(8, window.innerWidth - panelW - 8);
				const maxY = Math.max(8, window.innerHeight - 56);
				const next = {
					x: Math.min(Math.max(8, Math.round(drag.origX + dx)), maxX),
					y: Math.min(Math.max(8, Math.round(drag.origY + dy)), maxY)
				};
				posRef.current = next;
				setPos(next);
			};

			const onHeaderPointerUp = () => {
				const drag = dragRef.current;
				if (drag === null) return;
				const moved = drag.moved;
				dragRef.current = null;
				setDragging(false);
				if (moved) savePanelPos(posRef.current);
			};
			//#endregion

			const days = (usage?.days ?? []).slice(-14);
			const max = maxTokens(days);
			const balanceState = balance?.balance;
			const balanceStatus = balance?.ok === true
				? (balanceState?.isAvailable === true ? "ok" : "bad")
				: "bad";
			const balanceLabel = balance?.ok === true
				? (balanceState?.isAvailable === true ? t("balance.available") : t("balance.unavailable"))
				: (balance?.error === "no-credential" ? t("balance.notConfigured")
					: balance?.error === "unauthorized" ? t("balance.unauthorized")
						: t("balance.error"));

			const badgeAmount = balance?.ok === true && balanceState?.total !== void 0
				? "¥" + fmtMoney(balanceState.total)
				: (balance?.ok === false ? "!" : "…");
			const badgeCount = usage?.ok === true ? fmtTokens(usage.today) : "";

			//#region badge
			const badge = react.createElement("button", {
				type: "button",
				className: "uc_badge",
				"data-active": open ? "" : void 0,
				onClick: () => setOpen((v) => !v),
				title: t("title"),
				"aria-label": t("title")
			},
				react.createElement("img", { className: "uc_badgeLogo", src: LOGO_URL, alt: "" }),
				wide ? react.createElement("span", { className: "uc_badgeLabel" }, t("title")) : null,
				wide ? react.createElement("span", {
					className: "uc_badgeAmount " + (balance?.ok === true ? "uc_badgeOk" : balance?.ok === false ? "uc_badgeBad" : "")
				}, badgeAmount) : null,
				wide ? react.createElement("span", { className: "uc_badgeCount" }, badgeCount) : null
			);
			//#endregion

			if (!open) {
				return react.createElement("div", { className: "uc_layer" + (wide ? "" : " uc_rail") },
					react.createElement("div", { className: "uc_footerButtons" }, badge)
				);
			}

			//#region panel
			const header = react.createElement("div", {
				className: "uc_header",
				onPointerDown: onHeaderPointerDown,
				onPointerMove: onHeaderPointerMove,
				onPointerUp: onHeaderPointerUp,
				title: t("drag.hint")
			},
				react.createElement("div", { className: "uc_headerLeft" },
					react.createElement("img", { className: "uc_headerLogo", src: LOGO_URL, alt: "", draggable: false }),
					react.createElement("div", { className: "uc_title" },
						t("title"),
						react.createElement("span", { className: "uc_titleSub" }, t("subtitle"))
					)
				),
				react.createElement("div", { className: "uc_headerActions" },
					react.createElement("button", {
						type: "button",
						className: "uc_iconButton",
						onClick: refresh,
						title: t("action.refresh"),
						"aria-label": t("action.refresh")
					}, react.createElement(primitives.IconRefreshOutline14, { size: 15 })),
					react.createElement("button", {
						type: "button",
						className: "uc_iconButton",
						onClick: () => setOpen(false),
						title: t("action.close"),
						"aria-label": t("action.close")
					}, react.createElement(primitives.IconCloseOutline16, { size: 15 }))
				)
			);

			//#region balance section
			let balanceSection;
			if (balanceError !== null) {
				balanceSection = react.createElement("div", { className: "uc_error" },
					t("balance.error") + ": " + balanceError,
					react.createElement("button", { type: "button", className: "uc_retry", onClick: refresh }, t("action.retry"))
				);
			} else if (balance === null) {
				balanceSection = react.createElement("div", { className: "uc_loading" },
					react.createElement(primitives.IconLoadingOutline16, { size: 14, className: "uc_spin" }),
					t("balance.loading")
				);
			} else if (balance?.ok !== true) {
				balanceSection = react.createElement("div", { className: "uc_error" },
					balance?.message ?? t("balance.error"),
					react.createElement("button", { type: "button", className: "uc_retry", onClick: refresh }, t("action.retry"))
				);
			} else {
				balanceSection = react.createElement("div", { className: "uc_balanceCard" },
					react.createElement("div", { className: "uc_balanceMain" },
						react.createElement("span", { className: "uc_balanceCurrency" }, "¥"),
						react.createElement("span", { className: "uc_balanceAmount" }, fmtMoney(balanceState?.total)),
						react.createElement("span", { className: "uc_balanceStatus" },
							react.createElement("span", { className: "uc_pill", "data-status": balanceStatus }, balanceLabel)
						)
					),
					react.createElement("div", { className: "uc_balanceRows" },
						react.createElement("div", { className: "uc_balanceRow" },
							react.createElement("span", null, "💰 " + t("balance.toppedUp")),
							react.createElement("b", null, fmtMoney(balanceState?.toppedUp))
						),
						react.createElement("div", { className: "uc_balanceRow" },
							react.createElement("span", null, "🎁 " + t("balance.granted")),
							react.createElement("b", null, fmtMoney(balanceState?.granted))
						)
					)
				);
			}
			//#endregion

			const accountPicker = accounts.length > 1
				? react.createElement("div", { className: "uc_tokenPicker" },
					react.createElement("span", { className: "uc_tokenPickerLabel" }, "🔑 " + t("balance.account")),
					react.createElement("select", {
						className: "uc_tokenSelect",
						value: selectedAccount,
						onChange: (e) => setSelectedAccount(e.target.value),
						title: t("balance.accountHint")
					},
						accounts.map((account) =>
							react.createElement("option", { key: account.id, value: account.id },
								account.displayName
							)
						)
					)
				)
				: null;

			//#region usage section
			let usageSection;
			if (usageError !== null) {
				usageSection = react.createElement("div", { className: "uc_error" },
					t("usage.error") + ": " + usageError,
					react.createElement("button", { type: "button", className: "uc_retry", onClick: refresh }, t("action.retry"))
				);
			} else if (usage === null) {
				usageSection = react.createElement("div", { className: "uc_loading" },
					react.createElement(primitives.IconLoadingOutline16, { size: 14, className: "uc_spin" }),
					t("usage.loading")
				);
			} else {
				const today = usage?.days?.find((d) => dayLabel(d.day) === "今天");
				const stats = [
					{ value: fmtTokens(usage.today), label: t("usage.today") },
					{ value: fmtTokens(usage.month), label: t("usage.month") },
					{ value: fmtTokens(usage.total), label: t("usage.total") }
				];
				const statChips = stats.map((stat) =>
					react.createElement("div", { className: "uc_stat", key: stat.label },
						react.createElement("div", { className: "uc_statValue" }, stat.value),
						react.createElement("div", { className: "uc_statLabel" }, stat.label)
					)
				);
				const bars = days.map((day) => {
					const height = max > 0 ? Math.max(3, Math.round((day.totalTokens / max) * 56)) : 3;
					return react.createElement("div", { className: "uc_barCol", key: day.day },
						react.createElement("div", {
							className: "uc_bar" + (day.totalTokens === 0 ? " uc_barZero" : ""),
							"data-zero": day.totalTokens === 0 ? "" : void 0,
							style: { height: height + "px" },
							title: day.day + " · " + fmtTokens(day.totalTokens) + " tokens"
						}),
						react.createElement("span", { className: "uc_barLabel" }, dayLabel(day.day))
					);
				});
				const hitRate = today?.cacheHitRate;
				usageSection = react.createElement("div", { className: "uc_section" },
					react.createElement("h4", { className: "uc_sectionTitle" }, "📊 " + t("usage.title")),
					react.createElement("div", { className: "uc_statsRow" }, statChips),
					react.createElement("div", { className: "uc_section" },
						react.createElement("h4", { className: "uc_sectionTitle" }, t("usage.recent")),
						react.createElement("div", { className: "uc_bars" }, bars)
					),
					hitRate !== null && hitRate !== void 0
						? react.createElement("div", { className: "uc_hitCaption" },
							t("usage.cacheHit") + ": ",
							react.createElement("b", null, hitRate + "%")
						)
						: null
				);
			}
			//#endregion

			const panel = react.createElement("div", {
				className: "uc_panel",
				role: "dialog",
				ref: panelRef,
				style: { left: pos.x + "px", top: pos.y + "px" },
				"data-dragging": dragging ? "" : void 0
			},
				header,
				react.createElement("div", { className: "uc_body" },
					react.createElement("div", { className: "uc_section" },
						react.createElement("h4", { className: "uc_sectionTitle" }, "💳 " + t("balance.title")),
						accountPicker,
						balanceSection
					),
					usageSection,
					react.createElement("div", { className: "uc_updated" },
						(t("panel.updatedAt") + " " + fmtTime(updatedAt ?? Date.now())) + " · " + t("panel.autoRefresh")
					)
				)
			);
			//#endregion

			return react.createElement("div", { className: "uc_layer" + (wide ? "" : " uc_rail") },
				react.createElement("div", { className: "uc_footerButtons" }, badge),
				open ? panel : null
			);
		}
		//#endregion

		//#region locales
		const zh = {
			"title": "用量 & 余额",
			"subtitle": "DeepSeek 小助手",
			"balance.title": "账户余额",
			"balance.loading": "正在查询余额…",
			"balance.error": "余额查询失败",
			"balance.notConfigured": "未配置密钥",
			"balance.unauthorized": "密钥无效",
			"balance.available": "可用",
			"balance.unavailable": "不可用",
			"balance.toppedUp": "充值余额",
			"balance.granted": "赠送余额",
			"balance.account": "账号",
			"balance.accountHint": "切换查看不同账号的余额（DeepSeek / 硅基流动）",
			"usage.title": "Token 用量",
			"usage.today": "今日",
			"usage.month": "本月",
			"usage.total": "累计",
			"usage.loading": "正在聚合用量…",
			"usage.error": "用量聚合失败",
			"usage.recent": "最近 14 天",
			"usage.cacheHit": "今日缓存命中",
			"action.refresh": "刷新",
			"action.retry": "重试",
			"action.close": "关闭",
			"panel.updatedAt": "更新于",
			"panel.autoRefresh": "每 5 分钟自动刷新",
			"drag.hint": "拖动头部可移动面板"
		};
		const en = {
			"title": "Usage & Balance",
			"subtitle": "DeepSeek sidekick",
			"balance.title": "Account balance",
			"balance.loading": "Fetching balance…",
			"balance.error": "Balance fetch failed",
			"balance.notConfigured": "No API key",
			"balance.unauthorized": "Invalid key",
			"balance.available": "Available",
			"balance.unavailable": "Unavailable",
			"balance.toppedUp": "Topped up",
			"balance.granted": "Granted",
			"balance.account": "Account",
			"balance.accountHint": "Switch the account shown (DeepSeek / SiliconFlow)",
			"usage.title": "Token usage",
			"usage.today": "Today",
			"usage.month": "This month",
			"usage.total": "All time",
			"usage.loading": "Aggregating usage…",
			"usage.error": "Usage aggregation failed",
			"usage.recent": "Last 14 days",
			"usage.cacheHit": "Today's cache hit",
			"action.refresh": "Refresh",
			"action.retry": "Retry",
			"action.close": "Close",
			"panel.updatedAt": "Updated at",
			"panel.autoRefresh": "Auto-refreshes every 5 minutes",
			"drag.hint": "Drag the header to move the panel"
		};
		//#endregion

		/** Services required by the client plugin body. */
		const inject = ["slots", "locale"];

		/**
		 * Client plugin body: register the dictionaries and the sidebar footer
		 * action.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "usage-cute: dictionaries");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "usage-cute",
				locale: NS,
				order: 10
			}, UsageCutePanel));
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.UsageCutePanel = UsageCutePanel;
		exports.fmtTokens = fmtTokens;
		exports.fmtMoney = fmtMoney;
		return module.exports;
	}
});
