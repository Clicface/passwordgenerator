<h1 align="center">passwordgenerator</h1>

<p align="center">
  Generate random passwords in the browser, with live strength estimation.
</p>

<p align="center">
  <a href="https://github.com/Clicface/passwordgenerator/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/Clicface/passwordgenerator/actions/workflows/ci.yml/badge.svg">
  </a>
  <a href="https://nodejs.org">
    <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18-5FA04E?logo=node.js&logoColor=white">
  </a>
  <a href="https://expressjs.com">
    <img alt="Express" src="https://img.shields.io/badge/express-5.x-000000?logo=express&logoColor=white">
  </a>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <a href="https://passwordgenerator.clicface.com">
    <img alt="Live demo" src="https://img.shields.io/badge/demo-live-brightgreen">
  </a>
</p>

<p align="center">
  <b><a href="https://passwordgenerator.clicface.com">passwordgenerator.clicface.com</a></b>
</p>

---

Originally built for [Clicface](https://www.clicface.com) customers. The page is
plain static HTML and JavaScript; the optional API exposes the same generator
over HTTP.

## Features

- **Cryptographically secure** — draws from `crypto.getRandomValues`, with rejection sampling so no character is favoured
- **Configurable** — pick length and which character classes to draw from
- **Ambiguity-aware** — excludes `i l I O 0 1` by default, opt back in if you want them
- **Strength estimation** — scored live with [zxcvbn](https://github.com/dropbox/zxcvbn)
- **Multi-language** — English and French, via [jquery-lang-js](https://github.com/Irrelon/jquery-lang-js)
- **No build step** — open `index.html` and it works

## API

A small Express service exposing the same generator. CORS is enabled.

### `GET /generate`

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `length` | integer | `8` | Must be **3–120**. Omit it for the default; supplying anything else is a `400`. |
| `AlphaLower` | boolean | `true` | `abcdefghjkmnpqrstuvwxyz` |
| `AlphaUpper` | boolean | `true` | `ABCDEFGHJKLMNPQRSTUVWXYZ` |
| `Num` | boolean | `true` | `23456789` |
| `HypenDashUnderscore` | boolean | `false` | `-_` — note the spelling, it is the wire format |
| `Special` | boolean | `false` | `~!@#$%^&*()=+[]{};:,.<>/?` |
| `Ambiguous` | boolean | `false` | Adds `i o l I O 0 1` back to the pool |

Booleans are read asymmetrically, matching the original behaviour: parameters
that default to `true` are disabled only by the literal string `false`, and
parameters that default to `false` are enabled only by the literal string
`true`. Anything else keeps the default.

**200** — a password and its zxcvbn score (`0` weakest, `4` strongest):

```console
$ curl 'http://localhost:3000/generate?length=16&Special=true'
{"password":"ud!wYTQ9v5!m8{Rc","score":4}
```

**400** — the request asked for something impossible. Bad input is answered,
not quietly substituted: returning 120 characters to a caller who asked for
1000 would hide the bug on their side.

```console
$ curl 'http://localhost:3000/generate?AlphaLower=false&AlphaUpper=false&Num=false'
{"error":"Please make at least one selection"}

$ curl 'http://localhost:3000/generate?length=1000'
{"error":"length must be between 3 and 120"}

$ curl 'http://localhost:3000/generate?length=abc'
{"error":"length must be an integer"}
```

**429** — too many requests from one address, with `Retry-After` in seconds:

```console
$ curl 'http://localhost:3000/generate'
{"error":"Too many requests"}
```

Default 60 requests per minute per IP, tunable with `RATE_LIMIT_MAX` and
`RATE_LIMIT_WINDOW_MS`. Counted per process, so several instances each get
their own allowance. Behind a reverse proxy set `TRUST_PROXY` — without it
every visitor is rate-limited as one, and with it set carelessly a client can
forge `X-Forwarded-For` and dodge the limit.

## Running it

The front-end needs no server — open `index.html`. For the API:

```sh
cd api
npm install
npm start          # PORT=3000 by default, override with .env or the environment
```

## Tests

```sh
npm --prefix api test   # API: boots the server and exercises /generate
node test/browser.js    # Front-end: drives index.html in headless Chromium
```

Neither suite pulls in a test framework. The browser test speaks the DevTools
protocol over Node's built-in WebSocket, so it needs **Node 22+** and any
Chromium or Chrome on `PATH` (or `CHROME_BIN`). The API suite runs on Node 18+.

CI runs both on Node 24, plus the API suite on Node 18 to keep the declared
`engines` floor honest, and fails on any `npm audit` advisory.

## Layout

```
index.html              the app
css/  js/  langpack/    styles, generator, translations
api/                    Express service wrapping js/passwordgenerator.js
api/test/smoke.js       API tests
test/browser.js         front-end tests
```

`js/passwordgenerator.js` is shared: the browser loads it directly and the API
requires it, so the two can never drift apart.

## Credits

- [zxcvbn](https://github.com/dropbox/zxcvbn) — strength estimation
- [jquery-lang-js](https://github.com/Irrelon/jquery-lang-js) — translations
- [Original jQuery snippet](http://onwebdev.blogspot.com/2011/08/jquery-generate-random-password.html) this grew from

## License

MIT — see [LICENSE](LICENSE).

The libraries under `js/vendor/` keep their own licences; see
[js/vendor/README.md](js/vendor/README.md).
