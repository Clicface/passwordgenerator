// Math.random() is not a CSPRNG: V8 runs xorshift128+, whose internal state can
// be recovered from a handful of observed outputs, which would let an attacker
// who sees one password predict the next. crypto.getRandomValues() has been in
// every browser since IE11 and in Node since 18, so there is no fallback here
// on purpose -- silently degrading to Math.random() is how a password generator
// ends up insecure without anyone noticing.
function secureRandomIndex(max) {
	// Browsers expose crypto globally. Node only does so from 19 on: under 18,
	// the floor this package declares, globalThis.crypto is undefined in a
	// normal script, so fall back to the crypto module's webcrypto. Both are
	// the same CSPRNG -- this is a lookup difference, not a weaker source.
	var csprng = null;
	if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
		csprng = globalThis.crypto;
	} else if (typeof require === 'function') {
		try { csprng = require('crypto').webcrypto || null; } catch (err) { csprng = null; }
	}
	if (!csprng || !csprng.getRandomValues) throw new Error('No cryptographically secure random source available');
	// Rejection sampling. Taking a raw 32-bit value modulo max would favour the
	// first (2^32 % max) characters of the alphabet -- a small bias, but a free
	// one to remove.
	var limit = Math.floor(4294967296 / max) * max;
	var buf = new Uint32Array(1);
	var value;
	do {
		csprng.getRandomValues(buf);
		value = buf[0];
	} while (value >= limit);
	return value % max;
}

function generateRandomPassword(length, AlphaLower, AlphaUpper, Num, HypenDashUnderscore, Special, Ambiguous) {
	length = typeof length !== 'undefined' ? length : 8;
	AlphaLower = typeof AlphaLower !== 'undefined' ? AlphaLower : true;
	AlphaUpper = typeof AlphaUpper !== 'undefined' ? AlphaUpper : true;
	Num = typeof Num !== 'undefined' ? Num : true;
	HypenDashUnderscore = typeof HypenDashUnderscore !== 'undefined' ? HypenDashUnderscore : false;
	Special = typeof Special !== 'undefined' ? Special : false;
	Ambiguous = typeof Ambiguous !== 'undefined' ? Ambiguous : false;
	var password = '';
	var chars = '';
	if (AlphaLower) chars += 'abcdefghjkmnpqrstuvwxyz';
	if (AlphaUpper) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
	if (Num) chars += '23456789';
	if (HypenDashUnderscore) chars += '-_';
	if (Special) chars += '~!@#$%^&*()=+[]{};:,.<>/?';
	if (AlphaLower && Ambiguous) chars += 'iol';
	if (AlphaLower && Ambiguous) chars += 'IO';
	if (Num && Ambiguous) chars += '01';
	if (!AlphaLower && !Num && Ambiguous) chars += 'iolIO01';
	// Signalled as an error rather than returned in-band: this module also runs
	// server-side, where `window` does not exist and where an error message
	// returned as if it were a password would be served as one. The message
	// doubles as the langpack key so callers can translate it.
	if (chars === '') throw new Error('Please make at least one selection');
	var list = chars.split('');
	var len = list.length, i = 0;
	do {
		i++;
		var index = secureRandomIndex(len);
		password += list[index];
	} while(i < length);
	return password;
};

if (typeof module !== 'undefined') module.exports = {generateRandomPassword};