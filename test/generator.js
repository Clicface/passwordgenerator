// Unit tests for the shared generator in js/passwordgenerator.js.
// Run with: node test/generator.js
const assert = require('assert');
const path = require('path');

const {generateRandomPassword} = require(path.join(__dirname, '..', 'js', 'passwordgenerator.js'));

const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const AMBIGUOUS = 'iolIO01';

let failures = 0;
let total = 0;
function run(name, fn) {
	total++;
	try { fn(); console.log(`ok - ${name}`); }
	catch (err) { failures++; console.error(`FAIL - ${name}\n      ${err.message}`); }
}

run('does not draw from Math.random', () => {
	// The direct guard: pin Math.random to a constant. A generator built on it
	// would return the same character repeated; a CSPRNG-backed one will not.
	const real = Math.random;
	Math.random = () => 0.5;
	try {
		const pwd = generateRandomPassword(64, true, true, true, false, false, false);
		const distinct = new Set(pwd).size;
		assert.ok(distinct > 5, `only ${distinct} distinct characters with Math.random pinned: "${pwd}"`);
	} finally {
		Math.random = real;
	}
});

run('works when globalThis.crypto is absent, as on node 18', () => {
	// Node only exposes crypto globally from 19 on. Under 18 -- the declared
	// engines floor -- a normal script sees globalThis.crypto as undefined, so
	// the module has to reach the crypto module instead. Simulated here so the
	// path is covered whichever Node version runs the suite.
	const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
	try {
		if (original) Object.defineProperty(globalThis, 'crypto', {value: undefined, configurable: true});
		const pwd = generateRandomPassword(32, true, true, true, false, false, false);
		assert.strictEqual(pwd.length, 32);
		assert.ok(new Set(pwd).size > 5, `suspiciously uniform output: "${pwd}"`);
	} finally {
		if (original) Object.defineProperty(globalThis, 'crypto', original);
	}
});

run('honours the requested length', () => {
	for (const n of [1, 3, 8, 64, 120]) {
		assert.strictEqual(generateRandomPassword(n, true, true, true, false, false, false).length, n);
	}
});

run('draws only from the selected classes', () => {
	const lower = generateRandomPassword(400, true, false, false, false, false, false);
	assert.match(lower, new RegExp(`^[${LOWER}]+$`));

	const digits = generateRandomPassword(400, false, false, true, false, false, false);
	assert.match(digits, new RegExp(`^[${DIGITS}]+$`));

	const mixed = generateRandomPassword(400, true, true, true, false, false, false);
	assert.match(mixed, new RegExp(`^[${LOWER}${UPPER}${DIGITS}]+$`));
});

run('excludes ambiguous characters unless asked', () => {
	const without = generateRandomPassword(400, true, true, true, false, false, false);
	for (const c of AMBIGUOUS) assert.ok(!without.includes(c), `found ambiguous "${c}"`);

	const with_ = generateRandomPassword(2000, true, true, true, false, false, true);
	assert.ok(AMBIGUOUS.split('').some(c => with_.includes(c)), 'Ambiguous=true produced none of them');
});

run('throws when every class is disabled', () => {
	assert.throws(
		() => generateRandomPassword(8, false, false, false, false, false, false),
		/Please make at least one selection/
	);
});

run('spreads roughly evenly across the alphabet', () => {
	// Rejection sampling should leave no character starved or favoured. With
	// 23000 draws over 23 lowercase letters the expected count is 1000 each;
	// a modulo-biased generator skews the first few by a visible margin.
	const pwd = generateRandomPassword(23000, true, false, false, false, false, false);
	const counts = {};
	for (const c of pwd) counts[c] = (counts[c] || 0) + 1;
	assert.strictEqual(Object.keys(counts).length, LOWER.length, 'some characters never appeared');
	const values = Object.values(counts);
	const min = Math.min(...values), max = Math.max(...values);
	// Generous bounds: this must not go flaky, it only needs to catch a real skew.
	assert.ok(min > 700, `least frequent character appeared ${min} times, expected ~1000`);
	assert.ok(max < 1300, `most frequent character appeared ${max} times, expected ~1000`);
});

run('does not repeat itself', () => {
	const seen = new Set();
	for (let i = 0; i < 200; i++) seen.add(generateRandomPassword(16, true, true, true, false, false, false));
	assert.strictEqual(seen.size, 200, `${200 - seen.size} collision(s) in 200 draws`);
});

console.log(failures ? `\n${failures} generator test(s) failed` : `\n${total} generator test(s) passed`);
process.exit(failures ? 1 : 0);
