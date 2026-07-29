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

// Unchecking every character class is what makes the generator refuse to run.
const UNCHECK_ALL = `['#alphalower_chars_checkbox','#alphaupper_chars_checkbox','#num_chars_checkbox',
	'#hyphen_dash_underscore','#special_chars_checkbox','#ambiguous_chars_checkbox']
	.forEach(function(s){ jQuery(s).prop('checked', false); });`;

const generateWithNoCharset = `(function(){
	window.__err = [];
	window.addEventListener('error', function(e){ window.__err.push(String(e.message)); });
	${UNCHECK_ALL}
	var thrown = null;
	try { jQuery('#generate').click(); } catch (e) { thrown = String(e); }
	return JSON.stringify({
		field: jQuery('#password-container-top').text(),
		visible: jQuery('#password-container').is(':visible'),
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

		// jQuery, zxcvbn and jquery-lang all come from CDNs, so a slow or
		// flaky network makes the page never finish loading through no fault
		// of the code. Reload and wait again rather than failing on the first
		// blip -- but still fail eventually, since a genuinely broken script
		// URL or SRI hash in index.html looks exactly the same from here.
		const libsReady = async () => evaluate(
			'typeof window.jQuery === "function" && typeof window.zxcvbn === "function" && typeof window.lang === "object"'
		).catch(() => false);

		let ready = false;
		for (let attempt = 1; attempt <= 3 && !ready; attempt++) {
			for (let i = 0; i < 120 && !ready; i++) {
				ready = await libsReady();
				if (!ready) await sleep(250);
			}
			if (!ready && attempt < 3) {
				console.error(`  CDN scripts not up after 30s, reloading (attempt ${attempt + 1}/3)`);
				await send('Page.navigate', {url});
				await sleep(1000);
			}
		}
		assert.ok(ready, 'jQuery, zxcvbn and jquery-lang never loaded after 3 attempts — CDN unreachable, or a script URL/SRI hash in index.html is wrong');

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

		await run('generating with a character class still returns a password', async () => {
			const field = await evaluate(`(function(){
				jQuery('#alphalower_chars_checkbox').prop('checked', true);
				jQuery('#length_chars_select').val(20);
				jQuery('#generate').click();
				return jQuery('#password-container-top').text();
			})()`);
			assert.strictEqual(field.length, 20, `got "${field}"`);
			assert.match(field, /^[a-z]+$/);
		});

		await run('typing a length drives the slider and the generated password', async () => {
			const out = JSON.parse(await evaluate(`(function(){
				jQuery('#length_value').val(37).trigger('change');
				jQuery('#generate').click();
				return JSON.stringify({
					slider: jQuery('#length_chars_select').val(),
					produced: jQuery('#password-container-top').text().length
				});
			})()`));
			assert.strictEqual(out.slider, '37', 'the slider did not follow the typed value');
			assert.strictEqual(out.produced, 37, 'the password did not use the typed length');
		});

		await run('the slider drives the number box back', async () => {
			const shown = await evaluate(`(function(){
				jQuery('#length_chars_select').val(64).trigger('input');
				return jQuery('#length_value').val();
			})()`);
			assert.strictEqual(shown, '64');
		});

		await run('a typed length outside the bounds is pulled back in', async () => {
			const out = JSON.parse(await evaluate(`(function(){
				jQuery('#length_value').val(9999).trigger('change');
				var high = {box: jQuery('#length_value').val(), slider: jQuery('#length_chars_select').val()};
				jQuery('#length_value').val(1).trigger('change');
				return JSON.stringify({high: high, low: {box: jQuery('#length_value').val(), slider: jQuery('#length_chars_select').val()}});
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
