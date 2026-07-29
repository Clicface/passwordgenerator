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
// ~0.15s, 300 in ~1.3s, 500 in ~3.5s. Left unbounded, a single request could
// pin a CPU for minutes, so `length` is clamped to the range the front-end
// input already advertises (min=3 max=120).
const MIN_LENGTH = 3;
const MAX_LENGTH = 120;
const DEFAULT_LENGTH = 8;

app.get('/generate', cors(), (req, res)=>{
	let {length = DEFAULT_LENGTH, AlphaLower = true, AlphaUpper = true, Num = true, HypenDashUnderscore = false, Special = false, Ambiguous = false} = req.query;

	length = parseInt(length, 10);
	length = isNaN(length) ? DEFAULT_LENGTH : Math.min(Math.max(length, MIN_LENGTH), MAX_LENGTH);
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