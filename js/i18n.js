// Replaces jquery-lang-js, and with it the only reason this page needed jQuery
// and js-cookie at all -- 110 KB of libraries to translate thirteen strings.
//
// Elements carrying a `lang` attribute are translated by matching their text
// against langpack/<code>.json. The English text is the key, so the source
// markup stays readable and no id or data attribute has to be invented.
(function () {
	'use strict';

	var DEFAULT_LANG = 'en';
	var STORAGE_KEY = 'lang';

	var packs = {};        // code -> {english: translation}
	var originals = null;  // element -> its English text, captured before any swap
	var current = DEFAULT_LANG;

	function translatable() {
		// Scoped to body on purpose: document.querySelectorAll('[lang]') also
		// matches <html lang="en">, and rewriting its textContent would replace
		// the entire document with one translated string.
		return document.body.querySelectorAll('[lang]');
	}

	// Captured once, before the first swap: after that the DOM no longer holds
	// the English text, so there would be nothing left to translate *from*.
	function captureOriginals() {
		if (originals) return;
		originals = new Map();
		Array.prototype.forEach.call(translatable(), function (el) {
			originals.set(el, el.textContent.trim());
		});
	}

	function translate(text) {
		var pack = packs[current];
		if (!pack) return text;
		return Object.prototype.hasOwnProperty.call(pack, text) ? pack[text] : text;
	}

	function apply() {
		captureOriginals();
		originals.forEach(function (english, el) {
			el.textContent = translate(english);
			el.setAttribute('lang', current);
		});
		// Text written at runtime -- the strength label, the error message --
		// carries its English source in data-i18n so it follows the language
		// too. Without this the page ends up mostly French with one stray
		// English phrase, which is what the old library did.
		Array.prototype.forEach.call(document.body.querySelectorAll('[data-i18n]'), function (el) {
			el.textContent = translate(el.getAttribute('data-i18n'));
		});
		document.documentElement.setAttribute('lang', current);
	}

	// Sets text that must survive a later language change.
	function setText(el, english) {
		if (english) {
			el.setAttribute('data-i18n', english);
			el.textContent = translate(english);
		} else {
			el.removeAttribute('data-i18n');
			el.textContent = '';
		}
	}

	function load(code) {
		if (code === DEFAULT_LANG || packs[code]) return Promise.resolve();
		return fetch('langpack/' + code + '.json')
			.then(function (r) {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.json();
			})
			.then(function (data) {
				// The pack nests translations under "token"; tolerate a flat file too.
				packs[code] = data.token || data;
			})
			.catch(function (err) {
				// A missing or broken pack leaves the page in English rather than
				// blanking it -- untranslated is bad, empty is worse.
				console.error('could not load langpack for ' + code + ': ' + err.message);
			});
	}

	function change(code) {
		return load(code).then(function () {
			current = packs[code] || code === DEFAULT_LANG ? code : current;
			apply();
			try { window.localStorage.setItem(STORAGE_KEY, current); } catch (err) { /* private mode */ }
			return current;
		});
	}

	function init() {
		captureOriginals();
		var stored = null;
		try { stored = window.localStorage.getItem(STORAGE_KEY); } catch (err) { /* private mode */ }
		if (stored && stored !== DEFAULT_LANG) return change(stored);
		apply();
		return Promise.resolve(current);
	}

	window.lang = {
		translate: translate,
		setText: setText,
		change: change,
		init: init,
		get currentLang() { return current; }
	};
})();
