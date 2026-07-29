# Vendored dependencies

These files are third-party libraries copied in verbatim. They were previously
loaded from CDNs at runtime, which exposed every visitor to four external hosts
and made the site's availability depend on theirs.

Do not edit them. To update, re-download from the source URL below and bump the
version here in the same commit.

| File | Library | Version | License | Source |
| --- | --- | --- | --- | --- |
| `jquery.min.js` | jQuery | 3.7.1 | MIT | https://code.jquery.com/jquery-3.7.1.min.js |
| `js.cookie.js` | js-cookie | 2.2.1 | MIT | https://cdn.jsdelivr.net/npm/js-cookie@2.2.1/src/js.cookie.js |
| `jquery-lang.js` | jquery-lang-js | master | MIT | https://cdn.jsdelivr.net/gh/Irrelon/jquery-lang-js/js/jquery-lang.js |
| `zxcvbn.js` | zxcvbn | 4.4.2 | MIT | https://cdn.jsdelivr.net/npm/zxcvbn@4.4.2/dist/zxcvbn.js |

## Attribution

All four are MIT licensed, which requires the copyright notice to travel with
the code. `jquery.min.js`, `js.cookie.js` and `jquery-lang.js` carry their own
banners. **`zxcvbn.js` does not** — its dist build ships without one — so its
notice is reproduced here to keep the redistribution compliant:

> Copyright (c) 2012-2016 Dan Wheeler and Dropbox, Inc.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.

Full texts: [jQuery](https://jquery.org/license/) ·
[js-cookie](https://github.com/js-cookie/js-cookie/blob/main/LICENSE) ·
[jquery-lang-js](https://github.com/Irrelon/jquery-lang-js) ·
[zxcvbn](https://github.com/dropbox/zxcvbn/blob/master/LICENSE.txt)

## Notes

`js-cookie` is not used directly by this project. `jquery-lang-js` calls
`Cookies.get`/`Cookies.set` to remember the visitor's language, so removing it
would silently break language persistence.

`jquery-lang-js` is pinned to whatever `master` served when it was fetched —
upstream publishes no tagged releases. It is the one file here that Dependabot
cannot track.
