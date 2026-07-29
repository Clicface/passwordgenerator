# Vendored dependencies

Third-party code copied in verbatim, rather than fetched from a CDN at
runtime. Do not edit these files. To update, re-download from the source URL
and bump the version here in the same commit.

| File | Library | Version | License | Source |
| --- | --- | --- | --- | --- |
| `zxcvbn.js` | zxcvbn | 4.4.2 | MIT | https://cdn.jsdelivr.net/npm/zxcvbn@4.4.2/dist/zxcvbn.js |

## Attribution

zxcvbn is MIT licensed, and MIT requires the copyright notice to travel with
the code. Its dist build ships **without** a banner, so the notice is
reproduced here to keep the redistribution compliant:

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

Full text: https://github.com/dropbox/zxcvbn/blob/master/LICENSE.txt

## What used to be here

jQuery, js-cookie and jquery-lang-js were removed once `js/i18n.js` replaced
the translation library. They came to 110 KB to translate twelve strings, and
jquery-lang-js was pinned to an untagged upstream commit that Dependabot could
not track. zxcvbn is the only third-party code left, and it earns its place —
password strength estimation is not something to reimplement.
