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
	['adds special characters on demand', '?length=200&Special=true', res => {
		assert.match(res.body.password, /[~!@#$%^&*()=+\[\]{};:,.<>/?]/);
	}],
	['drops digits when Num=false', '?length=200&Num=false', res => {
		assert.doesNotMatch(res.body.password, /[0-9]/);
	}],
	['excludes ambiguous characters by default', '?length=200', res => {
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
	}]
];

const server = spawn(process.execPath, [path.join(__dirname, '..', 'passwordgenerator.js')], {
	env: {...process.env, PORT},
	stdio: ['ignore', 'inherit', 'inherit']
});
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
