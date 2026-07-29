// Smoke test: boots the API in a child process and checks /generate answers
// sanely. No test framework, no extra dependency - it runs anywhere `node` does.
const assert = require('assert');
const http = require('http');
const path = require('path');
const {spawn} = require('child_process');

const PORT = process.env.TEST_PORT || 3099;
const BASE = `http://127.0.0.1:${PORT}`;

function get(query) {
	return new Promise((resolve, reject) => {
		http.get(`${BASE}/generate${query}`, res => {
			let body = '';
			res.on('data', chunk => body += chunk);
			res.on('end', () => {
				try {
					resolve({status: res.statusCode, body: JSON.parse(body)});
				} catch (err) {
					reject(new Error(`invalid JSON for ${query}: ${body}`));
				}
			});
		}).on('error', reject);
	});
}

function waitForServer(attempts = 50) {
	return get('').then(() => true, err => {
		if (attempts <= 0) throw new Error(`server never came up: ${err.message}`);
		return new Promise(r => setTimeout(r, 100)).then(() => waitForServer(attempts - 1));
	});
}

const tests = [
	['defaults to a 8 char alphanumeric password', '', res => {
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.password.length, 8);
		assert.match(res.body.password, /^[a-zA-Z0-9]+$/);
	}],
	['honours the length parameter', '?length=32', res => {
		assert.strictEqual(res.body.password.length, 32);
	}],
	['adds special characters on demand', '?length=120&Special=true', res => {
		assert.match(res.body.password, /[~!@#$%^&*()=+\[\]{};:,.<>/?]/);
	}],
	['drops digits when Num=false', '?length=120&Num=false', res => {
		assert.doesNotMatch(res.body.password, /[0-9]/);
	}],
	['excludes ambiguous characters by default', '?length=120', res => {
		assert.doesNotMatch(res.body.password, /[ilIO01]/);
	}],
	['returns a zxcvbn score', '?length=24&Special=true', res => {
		assert.ok(Number.isInteger(res.body.score), `score was ${res.body.score}`);
		assert.ok(res.body.score >= 0 && res.body.score <= 4);
	}],
	['never repeats a password', '?length=24', async res => {
		const other = await get('?length=24');
		assert.notStrictEqual(res.body.password, other.body.password);
	}],
	['rejects an empty character set with a 400', '?AlphaLower=false&AlphaUpper=false&Num=false', res => {
		assert.strictEqual(res.status, 400);
		assert.strictEqual(res.body.error, 'Please make at least one selection');
		assert.ok(!('password' in res.body), 'an error must not be served as a password');
	}],
	['never leaks a stack trace', '?AlphaLower=false&AlphaUpper=false&Num=false', res => {
		assert.doesNotMatch(JSON.stringify(res.body), /at Object\.|ReferenceError|\/home\/|node_modules/);
	}],
	['stays up after a rejected request', '?length=16', res => {
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.password.length, 16);
	}],
	['clamps an oversized length', '?length=100000000', res => {
		assert.strictEqual(res.body.password.length, 120);
	}],
	['clamps a below-minimum length', '?length=0', res => {
		assert.strictEqual(res.body.password.length, 3);
	}],
	['clamps a negative length', '?length=-5', res => {
		assert.strictEqual(res.body.password.length, 3);
	}],
	['falls back to the default on a non-numeric length', '?length=abc', res => {
		assert.strictEqual(res.body.password.length, 8);
	}],
	['answers an oversized length quickly', '?length=100000000', async () => {
		// Guards the DoS directly: unclamped, this request never returned at all.
		const started = process.hrtime.bigint();
		await get('?length=100000000');
		const ms = Number(process.hrtime.bigint() - started) / 1e6;
		assert.ok(ms < 2000, `took ${Math.round(ms)}ms, expected well under 2000ms`);
	}],
	['starts without printing anything to stdout', '', () => {
		// dotenv 17 prints a banner carrying a rotating third-party ad unless
		// quiet is set. Nothing here should write to stdout at all.
		assert.strictEqual(serverStdout.trim(), '', `server wrote to stdout:\n${serverStdout}`);
	}]
];

// stdout is captured rather than inherited so a test can assert the server
// starts silently. stderr stays inherited so real crashes remain visible.
let serverStdout = '';
const server = spawn(process.execPath, [path.join(__dirname, '..', 'passwordgenerator.js')], {
	env: {...process.env, PORT},
	stdio: ['ignore', 'pipe', 'inherit']
});
server.stdout.on('data', chunk => serverStdout += chunk);
server.on('error', err => {
	console.error(`failed to start the server: ${err.message}`);
	process.exit(1);
});

(async () => {
	let failures = 0;
	try {
		await waitForServer();
		for (const [name, query, check] of tests) {
			try {
				await check(await get(query));
				console.log(`ok - ${name}`);
			} catch (err) {
				failures++;
				console.error(`FAIL - ${name}\n      ${err.message}`);
			}
		}
	} catch (err) {
		failures++;
		console.error(err.message);
	} finally {
		server.kill();
	}
	console.log(failures ? `\n${failures} test(s) failed` : `\n${tests.length} test(s) passed`);
	process.exit(failures ? 1 : 0);
})();
