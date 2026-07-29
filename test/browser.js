// Browser smoke test: drives index.html in headless Chromium over the DevTools
// protocol. No test framework and no npm dependency - Node's built-in WebSocket
// talks to CDP directly, and the browser is whatever the system already has.
//
// Run with: node test/browser.js
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const {spawn, spawnSync} = require('child_process');

const ROOT = path.join(__dirname, '..');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const TYPES = {
	'.html': 'text/html', '.js': 'application/javascript',
	'.css': 'text/css', '.json': 'application/json'
};

function findChrome() {
	const candidates = [process.env.CHROME_BIN, 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
	for (const c of candidates) {
		if (!c) continue;
		if (c.includes('/') && fs.existsSync(c)) return c;
		if (spawnSync('which', [c]).status === 0) return c;
	}
	throw new Error('no Chromium/Chrome binary found; set CHROME_BIN');
}

function serve() {
	const server = http.createServer((req, res) => {
		const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
		const file = path.join(ROOT, rel);
		// Keep the server inside the repo even if the page requests something odd.
		if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
			res.writeHead(404).end('not found');
			return;
		}
		res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'});
		fs.createReadStream(file).pipe(res);
	});
	return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function cdpTargets() {
	return new Promise((resolve, reject) => {
		http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, res => {
			let body = '';
			res.on('data', c => body += c);
			res.on('end', () => { try { resolve(JSON.parse(body)); } catch (err) { reject(err); } });
		}).on('error', reject);
	});
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForTarget() {
	for (let i = 0; i < 80; i++) {
		try {
			const t = (await cdpTargets()).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
			if (t) return t;
		} catch (err) { /* browser not listening yet */ }
		await sleep(250);
	}
	throw new Error('no debuggable page target appeared');
}

// Vanilla helpers for the evaluated snippets, replacing the jQuery the page
// no longer loads. Kept as source strings because they run inside the browser.
const HELPERS = `
	var $id = function (id) { return document.getElementById(id); };
	var setVal = function (id, value, eventName) {
		var el = $id(id);
		el.value = value;
		el.dispatchEvent(new Event(eventName, {bubbles: true}));
	};
	var setChecked = function (id, on) {
		var el = $id(id);
		el.checked = on;
		el.dispatchEvent(new Event('change', {bubbles: true}));
	};
`;

// Unchecking every character class is what makes the generator refuse to run.
const UNCHECK_ALL = `['alphalower_chars_checkbox','alphaupper_chars_checkbox','num_chars_checkbox',
	'hyphen_dash_underscore','special_chars_checkbox','ambiguous_chars_checkbox']
	.forEach(function(s){ setChecked(s, false); });`;

const generateWithNoCharset = `(function(){
	${HELPERS}
	window.__err = [];
	window.addEventListener('error', function(e){ window.__err.push(String(e.message)); });
	${UNCHECK_ALL}
	var thrown = null;
	try { $id('generate').click(); } catch (e) { thrown = String(e); }
	return JSON.stringify({
		field: $id('password-container-top').textContent,
		visible: $id('password-container').offsetParent !== null,
		thrown: thrown,
		errors: window.__err
	});
})()`;

(async () => {
	const server = await serve();
	const url = `http://127.0.0.1:${server.address().port}/index.html`;
	const profile = fs.mkdtempSync('/tmp/pwdgen-chrome-');
	const chrome = spawn(findChrome(), [
		'--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
		`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, url
	], {stdio: 'ignore'});

	let ws, failures = 0, total = 0;
	const run = async (name, fn) => {
		total++;
		try { await fn(); console.log(`ok - ${name}`); }
		catch (err) { failures++; console.error(`FAIL - ${name}\n      ${err.message}`); }
	};

	try {
		const target = await waitForTarget();
		ws = new WebSocket(target.webSocketDebuggerUrl);
		await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP connection failed')); });

		let id = 0;
		const pending = new Map();
		ws.onmessage = ev => {
			const msg = JSON.parse(ev.data);
			if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
		};
		const send = (method, params = {}) => new Promise(res => {
			const myId = ++id;
			pending.set(myId, res);
			ws.send(JSON.stringify({id: myId, method, params}));
		});
		const evaluate = async expression => {
			const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
			if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
			return r.result && r.result.result ? r.result.result.value : undefined;
		};

		await send('Runtime.enable');
		await send('Page.enable');

		// Readiness is probed functionally, not by timing or by the presence of
		// globals. Checking only that the libraries loaded was not enough: the
		// page wires its handlers in a script at the end of body, so a click
		// landing before that does nothing at all -- no handler, no error, an
		// empty result field. That produced a green run locally and a failure
		// in CI, where the ordering differs.
		//
		// Driving the slider and watching the number box follow proves the
		// handlers are actually attached, which is the thing the tests need.
		// zxcvbn is deliberately absent from this check: it is fetched on first
		// Generate, not at startup, so requiring it here would wait forever.
		// That is the point of the change -- the page is usable without it.
		const libsReady = async () => evaluate(`(function(){
			${HELPERS}
			if (typeof window.lang !== 'object') return false;
			setVal('length_chars_select', 77, 'input');
			return $id('length_value').value === '77';
		})()`).catch(() => false);

		let ready = false;
		for (let attempt = 1; attempt <= 3 && !ready; attempt++) {
			for (let i = 0; i < 120 && !ready; i++) {
				ready = await libsReady();
				if (!ready) await sleep(250);
			}
			if (!ready && attempt < 3) {
				console.error(`  page not interactive after 30s, reloading (attempt ${attempt + 1}/3)`);
				await send('Page.navigate', {url});
				await sleep(1000);
			}
		}
		assert.ok(ready, 'the page never became interactive after 3 attempts — a script under js/vendor is missing or broken, or index.html no longer wires the length controls');

		await run('generating with no character class shows the message instead of throwing', async () => {
			const r = JSON.parse(await evaluate(generateWithNoCharset));
			assert.strictEqual(r.thrown, null, `click threw: ${r.thrown}`);
			assert.deepStrictEqual(r.errors, [], `uncaught errors: ${r.errors.join(', ')}`);
			assert.strictEqual(r.field, 'Please make at least one selection');
			assert.ok(r.visible, 'the message container stayed hidden');
		});

		await run('the message is translated when the language changes', async () => {
			await evaluate('window.lang.change("fr")');
			// change() fetches langpack/fr.json, so the swap is not immediate.
			let translated = '';
			for (let i = 0; i < 40; i++) {
				translated = await evaluate('window.lang.translate("Please make at least one selection")');
				if (translated !== 'Please make at least one selection') break;
				await sleep(250);
			}
			const r = JSON.parse(await evaluate(generateWithNoCharset));
			assert.strictEqual(r.thrown, null, `click threw: ${r.thrown}`);
			assert.strictEqual(r.field, 'veuillez effectuer au moins un choix');
		});

		await run('switching language translates every marked element, and back', async () => {
			// The whole point of replacing jquery-lang-js: one translated string
			// proves the lookup works, not that the page swaps.
			const snapshot = `JSON.stringify(Array.from(document.body.querySelectorAll('[lang]')).map(e => e.textContent.trim()))`;
			await evaluate('window.lang.change("en")');
			await sleep(300);
			const english = JSON.parse(await evaluate(snapshot));
			assert.ok(english.length >= 10, `only ${english.length} translatable elements found`);

			await evaluate('window.lang.change("fr")');
			for (let i = 0; i < 40; i++) {
				if (await evaluate('window.lang.currentLang === "fr"')) break;
				await sleep(250);
			}
			await sleep(300);
			const french = JSON.parse(await evaluate(snapshot));
			const untranslated = english.filter((text, i) => text === french[i]);
			assert.deepStrictEqual(untranslated, [], `left in English: ${untranslated.join(' | ')}`);
			assert.strictEqual(await evaluate('document.documentElement.getAttribute("lang")'), 'fr');

			// Going back must restore the source text, not a translation of a
			// translation -- the failure mode if the originals are not captured.
			await evaluate('window.lang.change("en")');
			await sleep(400);
			assert.deepStrictEqual(JSON.parse(await evaluate(snapshot)), english, 'English was not restored exactly');
		});

		await run('the password appears without waiting for the scorer', async () => {
			// The point of loading zxcvbn on demand: generating never needed it,
			// so the password must not wait on a 400 KB download.
			const out = JSON.parse(await evaluate(`(function(){
				${HELPERS}
				setChecked('alphalower_chars_checkbox', true);
				setVal('length_chars_select', 18, 'input');
				var before = typeof window.zxcvbn;
				$id('generate').click();
				return JSON.stringify({
					zxcvbnBefore: before,
					shown: $id('password-container-top').textContent
				});
			})()`));
			assert.strictEqual(out.shown.length, 18, `got "${out.shown}" synchronously`);
			assert.ok(
				out.zxcvbnBefore === 'undefined' || out.zxcvbnBefore === 'function',
				`unexpected zxcvbn state: ${out.zxcvbnBefore}`
			);
		});

		await run('a second password is not scored by the first click', async () => {
			// The score arrives late, so a stale result must not overwrite the
			// meter for a password the visitor has already replaced.
			const out = JSON.parse(await evaluate(`(function(){
				${HELPERS}
				setChecked('alphalower_chars_checkbox', true);
				setChecked('num_chars_checkbox', true);
				setVal('length_chars_select', 4, 'input');
				$id('generate').click();
				var first = $id('password-container-top').textContent;
				setVal('length_chars_select', 40, 'input');
				$id('generate').click();
				var second = $id('password-container-top').textContent;
				// Put the digits back as they were: leaving them on made a later
				// test, which expects lowercase only, fail depending on order.
				setChecked('num_chars_checkbox', false);
				return JSON.stringify({first: first, second: second});
			})()`));
			assert.strictEqual(out.first.length, 4);
			assert.strictEqual(out.second.length, 40);

			// Let both scores land, then check the meter matches the password on
			// screen rather than the one it replaced.
			await sleep(2500);
			const final = JSON.parse(await evaluate(`JSON.stringify({
				shown: document.getElementById('password-container-top').textContent,
				score: document.getElementById('password-container-bottom').getAttribute('data-score')
			})`));
			assert.strictEqual(final.shown.length, 40, 'the displayed password changed unexpectedly');
			assert.ok(Number(final.score) >= 3, `a 40 char password scored ${final.score} — looks like the 4 char result won`);
		});

		await run('the strength label follows a language change after generating', async () => {
			// Text written at runtime used to be translated once and then left
			// behind, so switching language gave a French page with one English
			// phrase sitting in the middle of it.
			await evaluate('window.lang.change("en")');
			await sleep(300);
			await evaluate(`(function(){
				${HELPERS}
				setChecked('alphalower_chars_checkbox', true);
				setVal('length_chars_select', 24, 'input');
				$id('generate').click();
			})()`);
			// Scoring waits on zxcvbn, which is fetched on first use, so the
			// label appears a moment after the password rather than with it.
			let english = '';
			for (let i = 0; i < 60; i++) {
				english = await evaluate(`document.getElementById('strength-label').textContent`);
				if (english.length > 0) break;
				await sleep(250);
			}
			assert.ok(english.length > 0, 'no strength label was shown, even after waiting for zxcvbn');

			await evaluate('window.lang.change("fr")');
			await sleep(500);
			const french = await evaluate(`document.getElementById('strength-label').textContent`);
			assert.notStrictEqual(french, english, `strength label stayed "${english}" after switching to French`);
			assert.ok(french.length > 0, 'strength label was emptied by the language change');
		});

		await run('generating with a character class still returns a password', async () => {
			// Sets every class explicitly rather than inheriting whatever the
			// previous test left behind, so this cannot break on ordering.
			const field = await evaluate(`(function(){
				${HELPERS}
				setChecked('alphalower_chars_checkbox', true);
				['alphaupper_chars_checkbox','num_chars_checkbox','hyphen_dash_underscore',
				 'special_chars_checkbox','ambiguous_chars_checkbox']
					.forEach(function(id){ setChecked(id, false); });
				setVal('length_chars_select', 20, 'input');
				$id('generate').click();
				return $id('password-container-top').textContent;
			})()`);
			assert.strictEqual(field.length, 20, `got "${field}"`);
			assert.match(field, /^[a-z]+$/);
		});

		await run('typing a length drives the slider and the generated password', async () => {
			const out = JSON.parse(await evaluate(`(function(){
				${HELPERS}
				setVal('length_value', 37, 'change');
				$id('generate').click();
				return JSON.stringify({
					slider: $id('length_chars_select').value,
					produced: $id('password-container-top').textContent.length
				});
			})()`));
			assert.strictEqual(out.slider, '37', 'the slider did not follow the typed value');
			assert.strictEqual(out.produced, 37, 'the password did not use the typed length');
		});

		await run('the slider drives the number box back', async () => {
			const shown = await evaluate(`(function(){
				${HELPERS}
				setVal('length_chars_select', 64, 'input');
				return $id('length_value').value;
			})()`);
			assert.strictEqual(shown, '64');
		});

		await run('a typed length outside the bounds is pulled back in', async () => {
			const out = JSON.parse(await evaluate(`(function(){
				${HELPERS}
				setVal('length_value', 9999, 'change');
				var high = {box: $id('length_value').value, slider: $id('length_chars_select').value};
				setVal('length_value', 1, 'change');
				return JSON.stringify({high: high, low: {box: $id('length_value').value, slider: $id('length_chars_select').value}});
			})()`));
			assert.strictEqual(out.high.box, '120', `9999 became ${out.high.box}`);
			assert.strictEqual(out.high.slider, '120');
			assert.strictEqual(out.low.box, '3', `1 became ${out.low.box}`);
			assert.strictEqual(out.low.slider, '3');
		});
	} catch (err) {
		failures++;
		console.error(err.message);
	} finally {
		// Nothing in here may throw: an exception in a finally block replaces
		// whatever the tests actually reported with a cleanup error, which is
		// how a plain "CDN unreachable" once surfaced as an ENOTEMPTY stack.
		try { if (ws) ws.close(); } catch (err) { /* already gone */ }
		chrome.kill('SIGKILL');
		// Chrome is still flushing the profile directory when kill returns, so
		// removing it immediately races and fails with ENOTEMPTY.
		await Promise.race([
			new Promise(r => chrome.once('exit', r)),
			sleep(5000)
		]);
		server.close();
		try {
			fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
		} catch (err) {
			console.error(`  (could not remove ${profile}: ${err.code})`);
		}
	}

	console.log(failures ? `\n${failures} browser test(s) failed` : `\n${total} browser test(s) passed`);
	process.exit(failures ? 1 : 0);
})();
