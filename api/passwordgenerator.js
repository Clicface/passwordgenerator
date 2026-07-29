const express = require('express');
const app = express();
const cors = require('cors');
const zxcvbn = require('zxcvbn');
// quiet silences the banner dotenv 17 prints to stdout on every load, which
// carries a rotating third-party ad and would otherwise land in the API's logs.
require('dotenv').config({quiet: true})

const pwdgenres = require('./../js/passwordgenerator.js');
app.use(express.json());

// Scoring cost grows far faster than the password itself: 120 chars scores in
// ~0.15s, 300 in ~1.3s, 500 in ~3.5s. Bounded to the range the front-end input
// already advertises (min=3 max=120), which also caps the work one request can
// ask for.
const MIN_LENGTH = 3;
const MAX_LENGTH = 120;
const DEFAULT_LENGTH = 8;

// Requests allowed per IP per window. Deliberately hand-rolled: bringing in a
// rate-limit package would add three modules to the tree `npm audit` gates,
// for logic that fits on a screen. The trade-off is that this counts per
// process -- run more than one instance and each gets its own allowance. Move
// to a shared store (or express-rate-limit) if that ever matters.
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 60;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60_000;
const hits = new Map();

// Express reports the proxy's address unless told to trust it, which would
// rate-limit every visitor as one. Off by default -- enabling it blindly lets
// a client forge X-Forwarded-For and dodge the limit entirely.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

function rateLimit(req, res, next) {
	const now = Date.now();
	// Sweep expired entries so the map cannot grow without bound: without this
	// the limiter would itself become the memory exhaustion it guards against.
	for (const [key, entry] of hits) {
		if (entry.resetAt <= now) hits.delete(key);
	}
	const ip = req.ip || 'unknown';
	let entry = hits.get(ip);
	if (!entry || entry.resetAt <= now) {
		entry = {count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS};
		hits.set(ip, entry);
	}
	entry.count++;
	if (entry.count > RATE_LIMIT_MAX) {
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
		res.set('Retry-After', String(retryAfter));
		return res.status(429).json({error: 'Too many requests'}).end();
	}
	next();
}

app.get('/generate', cors(), rateLimit, (req, res)=>{
	let {length = DEFAULT_LENGTH, AlphaLower = true, AlphaUpper = true, Num = true, HypenDashUnderscore = false, Special = false, Ambiguous = false} = req.query;

	// Omitting length keeps the default. Supplying a bad one is answered rather
	// than quietly substituted: silently returning 120 characters to a caller
	// who asked for 1000 hides a bug on their side instead of surfacing it.
	if (length !== DEFAULT_LENGTH) {
		const raw = String(length);
		length = parseInt(raw, 10);
		if (!/^-?\d+$/.test(raw.trim()) || isNaN(length)) {
			return res.status(400).json({error: 'length must be an integer'}).end();
		}
		if (length < MIN_LENGTH || length > MAX_LENGTH) {
			return res.status(400).json({error: `length must be between ${MIN_LENGTH} and ${MAX_LENGTH}`}).end();
		}
	}
	AlphaLower = AlphaLower.toString().toLowerCase() === 'false' ? false : true;
	AlphaUpper = AlphaUpper.toString().toLowerCase() === 'false' ? false : true;
	Num = Num.toString().toLowerCase() === 'false' ? false : true;
	HypenDashUnderscore = HypenDashUnderscore.toString().toLowerCase() === 'true' ? true : false;
	Special = Special.toString().toLowerCase() === 'true' ? true : false;
	Ambiguous = Ambiguous.toString().toLowerCase() === 'true' ? true : false;
	
	let pwd;
	try {
		pwd = pwdgenres.generateRandomPassword(length, AlphaLower, AlphaUpper, Num, HypenDashUnderscore, Special, Ambiguous);
	} catch (err) {
		// Disabling every character class is a bad request, not a server fault.
		return res.status(400).json({error: err.message}).end();
	}
	res.status(200).json({password: pwd, score: zxcvbn(pwd).score}).end();
})

// Without this, Express' default handler answers unexpected errors with a full
// stack trace, leaking absolute filesystem paths to the caller.
app.use((err, req, res, next)=>{
	console.error(err);
	res.status(500).json({error: 'Internal server error'}).end();
})

app.listen(process.env.PORT || 3000);