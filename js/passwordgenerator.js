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
	if (chars == '') return window.lang.convert('Please make at least one selection');
	var list = chars.split('');
	var len = list.length, i = 0;
	do {
		i++;
		var index = Math.floor(Math.random() * len);
		password += list[index];
	} while(i < length);
	return password;
};

if (typeof module !== 'undefined') module.exports = {generateRandomPassword};