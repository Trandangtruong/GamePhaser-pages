/**
 * Ép legacy SystemJS trên máy yếu / khi ?bundle=legacy.
 * Phải chạy classic script TRƯỚC module entry (xem index-web.html).
 * Không chỉ set __BUNDLE__ — khóa modern + force load polyfill + legacy entry.
 */
(function () {
	var FORCE = null;
	try {
		var q = new URLSearchParams(location.search).get("bundle");
		if (q === "legacy") FORCE = "legacy";
		else if (q === "modern") FORCE = "modern";
	} catch (e) { /* ignore */ }

	var ua = navigator.userAgent || "";
	var weakUa =
		/Android [2-8]\./i.test(ua) ||
		/SamsungBrowser\/[1-9]\./i.test(ua) ||
		/Galaxy J|SM-J[12]/i.test(ua) ||
		typeof Symbol === "undefined" ||
		typeof Promise === "undefined";

	var wantLegacy = FORCE === "legacy" || (FORCE !== "modern" && weakUa);

	window.__BUNDLE__ = {
		force: FORCE,
		path: wantLegacy ? "legacy" : "modern",
		reason: FORCE ? "query" : weakUa ? "ua" : "default",
	};

	if (!wantLegacy) return;

	// Khóa Vite modern detection (plugin-legacy đọc cờ này).
	try {
		Object.defineProperty(window, "__vite_is_modern_browser", {
			value: false,
			writable: false,
			configurable: true,
		});
	} catch (e) {
		window.__vite_is_modern_browser = false;
	}

	function stripModern() {
		var mods = document.querySelectorAll(
			'script[type="module"][src], link[rel="modulepreload"]',
		);
		for (var i = 0; i < mods.length; i++) {
			mods[i].parentNode && mods[i].parentNode.removeChild(mods[i]);
		}
	}

	function loadScript(src, onload, onerror) {
		var s = document.createElement("script");
		s.src = src;
		s.async = false;
		s.onload = onload;
		s.onerror = onerror;
		document.head.appendChild(s);
	}

	function findLegacyEntry() {
		var scripts = document.querySelectorAll("script[nomodule][data-src], script[nomodule][src]");
		for (var i = 0; i < scripts.length; i++) {
			var el = scripts[i];
			var src = el.getAttribute("data-src") || el.getAttribute("src") || "";
			if (/polyfill/i.test(src)) continue;
			if (src) return src;
		}
		// Vite legacy thường inject System.import('./assets/index-legacy-*.js')
		var inline = document.querySelectorAll("script[nomodule]");
		for (var j = 0; j < inline.length; j++) {
			var t = inline[j].textContent || "";
			var m = t.match(/System\.import\(['"]([^'"]+)['"]\)/);
			if (m) return m[1];
		}
		return null;
	}

	function findPolyfill() {
		var scripts = document.querySelectorAll("script[nomodule][src]");
		for (var i = 0; i < scripts.length; i++) {
			var src = scripts[i].getAttribute("src") || "";
			if (/polyfill/i.test(src)) return src;
		}
		return null;
	}

	function showFail() {
		var el = document.getElementById("boot-preloader");
		if (!el) {
			el = document.createElement("div");
			el.style.cssText =
				"position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f5f2ec;padding:24px;text-align:center;font:16px sans-serif;color:#3a3632;z-index:99999";
			document.body.appendChild(el);
		}
		el.innerHTML =
			"<div>Không tải được bản legacy.<br/>Dùng <b>http://&lt;IP&gt;:5175/?perf=low&amp;debug=1&amp;bundle=legacy</b><br/>(không dùng cổng 5173 / npm run dev; 5174 thường là game khác)</div>";
	}

	function bootLegacy() {
		stripModern();
		var poly = findPolyfill();
		var entry = findLegacyEntry();
		if (!entry) {
			// Đợi Vite inject nomodule (sau parse) một nhịp
			setTimeout(function () {
				poly = findPolyfill();
				entry = findLegacyEntry();
				if (!entry) {
					showFail();
					return;
				}
				run(poly, entry);
			}, 0);
			return;
		}
		run(poly, entry);
	}

	function run(poly, entry) {
		var start = function () {
			if (typeof System !== "undefined" && System.import) {
				System.import(entry).catch(showFail);
			} else {
				loadScript(entry, null, showFail);
			}
		};
		if (poly) loadScript(poly, start, showFail);
		else start();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", bootLegacy);
	} else {
		bootLegacy();
	}

	setTimeout(function () {
		if (!document.querySelector("#game canvas")) showFail();
	}, 12000);
})();
