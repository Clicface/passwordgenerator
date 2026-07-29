const express = require('express');
const app = express();
const cors = require('cors');
const zxcvbn = require('zxcvbn');
require('dotenv').config()

const pwdgenres = require('./../js/passwordgenerator.js');
app.use(express.json());

app.get('/generate', cors(), (req, res)=>{
	let {length = 8, AlphaLower = true, AlphaUpper = true, Num = true, HypenDashUnderscore = false, Special = false, Ambiguous = false} = req.query;
	
	length = !isNaN(length) == true ? length : 8;
	AlphaLower = AlphaLower.toString().toLowerCase() == 'false' ? false : true;
	AlphaUpper = AlphaUpper.toString().toLowerCase() == 'false' ? false : true;
	Num = Num.toString().toLowerCase() == 'false' ? false : true;
	HypenDashUnderscore = HypenDashUnderscore.toString().toLowerCase() == 'true' ? true : false;
	Special = Special.toString().toLowerCase() == 'true' ? true : false;
	Ambiguous = Ambiguous.toString().toLowerCase() == 'true' ? true : false;
	
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