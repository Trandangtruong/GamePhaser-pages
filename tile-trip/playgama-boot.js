/* Playgama Bridge boot: CDN + local fallback, then initialize() for QA Tool. */
(function () {
	window.__PLATFORM__ = 'playgama';
	/* Mỗi lần load/reload iframe — cho phép game_ready lại từ scene. */
	window.__playgamaGameReadySent = false;
	window.__playgamaGameplayReady = false;

	function inferPlatformId() {
		try {
			var url = new URL(window.location.href);
			var existing = url.searchParams.get('platform_id');
			if (existing) return existing;
			var ref = '';
			try {
				ref = document.referrer || '';
			} catch (err) {
				ref = '';
			}
			if (/developer\.playgama\.com/i.test(ref) || /qa\.playgama/i.test(ref)) {
				return 'qa_tool';
			}
			if (window.parent !== window) {
				var host = window.location.hostname;
				if (host !== 'localhost' && host !== '127.0.0.1') return 'qa_tool';
			}
		} catch (err2) {
			/* ignore */
		}
		return null;
	}

	function stampPlatformId(id) {
		if (!id) return;
		try {
			var url = new URL(window.location.href);
			if (url.searchParams.get('platform_id')) return;
			url.searchParams.set('platform_id', id);
			history.replaceState(null, '', url.toString());
		} catch (err) {
			/* ignore */
		}
	}

	function sendGameReadyOnce() {
		if (window.__playgamaGameReadySent) return;
		window.__playgamaGameReadySent = true;
		try {
			var sdk = window.bridge;
			if (typeof sdk?.setGameLoadingProgress === 'function') {
				sdk.setGameLoadingProgress(100);
			}
			sdk?.platform?.sendMessage?.('game_ready');
		} catch (err) {
			/* ignore */
		}
	}

	window.__playgamaSendGameReady = sendGameReadyOnce;

	function startInitialize(resolve, reject) {
		var sdk = window.bridge;
		if (!sdk || typeof sdk.initialize !== 'function') {
			reject(new Error('Playgama Bridge missing'));
			return;
		}
		stampPlatformId(inferPlatformId());
		try {
			sdk.engine = 'javascript';
		} catch (err) {
			/* ignore */
		}
		sdk
			.initialize({ configFilePath: './playgama-bridge-config.json' })
			.then(function () {
				resolve();
			})
			.catch(reject);
	}

	window.__playgamaInitPromise = new Promise(function (resolve, reject) {
		var settled = false;
		var usedFallback = false;

		function doneOk() {
			if (settled) return;
			settled = true;
			/* Một frame để QA parent kịp subscribe postMessage. */
			requestAnimationFrame(function () {
				setTimeout(function () {
					startInitialize(resolve, reject);
				}, 50);
			});
		}

		function loadScript(src, isFallback) {
			var el = document.createElement('script');
			el.src = src;
			el.async = false;
			el.onload = doneOk;
			el.onerror = function () {
				if (!isFallback && !usedFallback) {
					usedFallback = true;
					loadScript('./playgama-bridge.js', true);
					return;
				}
				if (!settled) {
					settled = true;
					reject(new Error('Failed to load Playgama Bridge'));
				}
			};
			document.head.appendChild(el);
		}

		loadScript('https://bridge.playgama.com/v2/stable/playgama-bridge.js', false);
		setTimeout(function () {
			if (settled) return;
			if (window.bridge && typeof window.bridge.initialize === 'function') {
				doneOk();
				return;
			}
			if (!usedFallback) {
				usedFallback = true;
				loadScript('./playgama-bridge.js', true);
			}
		}, 2000);
	});
})();
