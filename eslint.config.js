// Flat config (ESLint 9+). Three environments live in this repo and they do
// not share globals, so they are configured separately rather than lumped
// under a permissive catch-all that would hide real undefined-variable bugs.

const browserGlobals = {
	window: 'readonly',
	document: 'readonly',
	navigator: 'readonly',
	localStorage: 'readonly',
	fetch: 'readonly',
	Promise: 'readonly',
	Map: 'readonly',
	Event: 'readonly',
	setTimeout: 'readonly',
	clearTimeout: 'readonly',
	globalThis: 'readonly',
	Uint32Array: 'readonly',
	console: 'readonly'
};

const nodeGlobals = {
	require: 'readonly',
	module: 'writable',
	process: 'readonly',
	console: 'readonly',
	__dirname: 'readonly',
	Buffer: 'readonly',
	globalThis: 'readonly',
	setTimeout: 'readonly',
	clearTimeout: 'readonly',
	URL: 'readonly',
	WebSocket: 'readonly',
	TextDecoder: 'readonly'
};

module.exports = [
	{
		// Vendored third-party code: not ours to lint or fix.
		ignores: ['js/vendor/**', 'api/node_modules/**', 'node_modules/**']
	},
	{
		// The shared generator runs in both the browser and Node, so it gets
		// the union: anything it touches must exist in both.
		files: ['js/**/*.js'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'script',
			globals: {...browserGlobals, ...nodeGlobals}
		},
		rules: {
			// A catch binding kept for readability but unused is deliberate,
			// not an oversight -- ESLint 9 started flagging these by default.
			'no-unused-vars': ['error', {caughtErrorsIgnorePattern: '^err$'}],
			'no-undef': 'error',
			'eqeqeq': ['warn', 'smart'],
			'no-var': 'off'          // this file is deliberately ES5-compatible
		}
	},
	{
		files: ['api/**/*.js', 'test/**/*.js'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'commonjs',
			globals: nodeGlobals
		},
		rules: {
			'no-unused-vars': ['error', {argsIgnorePattern: '^(next|err)$', caughtErrorsIgnorePattern: '^err$'}],
			'no-undef': 'error',
			'eqeqeq': ['error', 'smart'],
			'prefer-const': 'warn',
			'no-empty': ['error', {allowEmptyCatch: true}]
		}
	}
];
