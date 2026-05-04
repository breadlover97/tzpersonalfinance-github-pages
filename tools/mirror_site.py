#!/usr/bin/env python3
import hashlib
import mimetypes
import re
import sys
from pathlib import Path
from urllib.parse import parse_qsl, quote, unquote, urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "index.original.html"
OUTPUT = ROOT / "index.html"
ASSET_ROOT = ROOT / "assets" / "mirror"
MAX_FILENAME_STEM = 96

MIRROR_HOSTS = {
    "framerusercontent.com",
    "fonts.gstatic.com",
}


def asset_path_for(url):
    parsed = urlparse(url)
    raw_path = unquote(parsed.path.lstrip("/"))
    if not raw_path or raw_path.endswith("/"):
        raw_path += "index"

    path = Path(parsed.netloc) / raw_path
    suffix = path.suffix
    stem = path.stem if suffix else path.name
    parent = path.parent

    query = parsed.query
    if query:
        readable_parts = []
        for key, value in parse_qsl(query, keep_blank_values=True):
            if key and value and len(value) <= 48 and re.fullmatch(r"[A-Za-z0-9_.-]+", value):
                readable_parts.append(f"{key}-{value}")
        if readable_parts:
            query_tag = "." + ".".join(readable_parts)
        else:
            query_tag = "." + hashlib.sha1(query.encode("utf-8")).hexdigest()[:10]
    else:
        query_tag = ""

    if not suffix:
        guessed = mimetypes.guess_extension(parsed.path) or ".bin"
        suffix = guessed

    filename_stem = f"{stem}{query_tag}"
    if len(filename_stem) > MAX_FILENAME_STEM:
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
        filename_stem = f"{filename_stem[:MAX_FILENAME_STEM - 13]}.{digest}"

    filename = f"{filename_stem}{suffix}"

    return ASSET_ROOT / parent / filename


TEXT_SUFFIXES = {".css", ".html", ".js", ".json", ".mjs", ".svg", ".txt"}


def is_text_asset(path):
    return path.suffix.lower() in TEXT_SUFFIXES


def collect_urls(text):
    candidates = set()

    patterns = [
        r"https?://[^\s\"'`{},()<>]+",
        r"url\((?:'|\")?(https?://[^)'\"`\s]+)(?:'|\")?\)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            url = match.group(1) if match.lastindex else match.group(0)
            url = url.rstrip(".,;")
            parsed = urlparse(url)
            if (
                parsed.netloc in MIRROR_HOSTS
                and parsed.path not in {"", "/"}
                and not parsed.path.endswith("/")
            ):
                candidates.add(url)

    return sorted(candidates, key=len, reverse=True)


def collect_relative_imports(text):
    candidates = set()
    patterns = [
        r"import\s*\(\s*[`'\"](\./[^`'\"]+)[`'\"]\s*\)",
        r"from\s*[`'\"](\./[^`'\"]+)[`'\"]",
    ]
    for pattern in patterns:
        candidates.update(match.group(1) for match in re.finditer(pattern, text))
    return sorted(candidates)


def download(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 0 and not is_text_asset(target):
        return "cached"
    existed = target.exists()

    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15",
            "Accept": "*/*",
        },
    )
    with urlopen(request, timeout=45) as response:
        target.write_bytes(response.read())
    return "refreshed" if existed else "downloaded"


def mirror_all(seed_html):
    queue = collect_urls(seed_html)
    seen = set()
    failures = []
    url_to_target = {}

    while queue:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)

        target = asset_path_for(url)
        try:
            status = download(url, target)
        except Exception as exc:
            failures.append((url, str(exc)))
            print(f"failed {url}: {exc}", file=sys.stderr)
            continue

        url_to_target[url] = target
        rel = target.relative_to(ROOT).as_posix()
        print(f"{status} {url} -> {rel}")

        if is_text_asset(target):
            try:
                text = target.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            for next_url in collect_urls(text):
                if next_url not in seen:
                    queue.append(next_url)
            for rel_import in collect_relative_imports(text):
                next_url = urljoin(url, rel_import)
                parsed = urlparse(next_url)
                if parsed.netloc in MIRROR_HOSTS and next_url not in seen:
                    queue.append(next_url)

    return url_to_target, failures


def rewrite_text_file(path, url_to_target):
    text = path.read_text(encoding="utf-8")
    original = text

    for url, target in sorted(url_to_target.items(), key=lambda item: len(item[0]), reverse=True):
        rel = target.relative_to(ROOT).as_posix()
        text = text.replace(url, quote(rel, safe="/._-"))

    if text != original:
        path.write_text(text, encoding="utf-8")


def rewrite_all_text(url_to_target):
    OUTPUT.write_text(SOURCE.read_text(encoding="utf-8"), encoding="utf-8")
    rewrite_text_file(OUTPUT, url_to_target)

    for path in ASSET_ROOT.rglob("*"):
        if path.is_file() and is_text_asset(path):
            try:
                rewrite_text_file(path, url_to_target)
            except UnicodeDecodeError:
                continue


def main():
    if not SOURCE.exists():
        print(f"Missing {SOURCE}", file=sys.stderr)
        return 1

    html = SOURCE.read_text(encoding="utf-8")
    url_to_target, failures = mirror_all(html)
    rewrite_all_text(url_to_target)

    print(f"\nMirrored {len(url_to_target)} assets into {ASSET_ROOT.relative_to(ROOT)}")
    if failures:
        print(f"{len(failures)} downloads failed and were left as remote URLs:", file=sys.stderr)
        for url, reason in failures:
            print(f"- {url}: {reason}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
