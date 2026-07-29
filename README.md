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

## Running it

There is nothing to run — open `index.html`. No server, no build step.

## Tests

```sh
node test/generator.js   # the generator itself
node test/browser.js     # drives index.html in headless Chromium
```

Neither pulls in a test framework. The browser test speaks the DevTools
protocol over Node's built-in WebSocket, so it needs **Node 22+** and any
Chromium or Chrome on `PATH` (or `CHROME_BIN`).

CI runs both on Node 24, lints with ESLint, scans with CodeQL, and fails on
any `npm audit` advisory.

## Layout

```
index.html              the app
css/  js/  langpack/    styles, generator, translations
js/vendor/              third-party libraries, copied in rather than fetched
test/                   generator and front-end tests
api/                    optional, not deployed — see below
```

## The `api/` directory

An Express wrapper around the same generator. **It is not deployed and the
page does not use it** — generation happens entirely in the browser, which is
why the page can promise that no password crosses the network.

It is kept because it still runs and is still tested, but be clear about the
trade-off before hosting it: an HTTP password generator means the password is
produced on a server, travels over the wire, and passes through whatever logs
sit in between. Generating in the browser avoids all of that.

`npm --prefix api test` still exercises it, and CI still runs those tests.

## Credits

- [zxcvbn](https://github.com/dropbox/zxcvbn) — strength estimation
- [jquery-lang-js](https://github.com/Irrelon/jquery-lang-js) — translations
- [Original jQuery snippet](http://onwebdev.blogspot.com/2011/08/jquery-generate-random-password.html) this grew from

## License

MIT — see [LICENSE](LICENSE).

The libraries under `js/vendor/` keep their own licences; see
[js/vendor/README.md](js/vendor/README.md).
