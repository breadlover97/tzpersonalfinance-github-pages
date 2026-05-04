# Tai Zhi Personal Finance Website

Static mirror of https://tzpersonalfinance.com/ prepared for GitHub Pages.

## Local preview

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080/.

## Refreshing the mirror

```sh
curl -L https://tzpersonalfinance.com/ -o index.original.html
python3 tools/mirror_site.py
```

The mirror script downloads Framer-hosted assets into `assets/mirror/` and rewrites `index.html` to use those local copies.
