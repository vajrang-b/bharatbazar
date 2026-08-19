#!/usr/bin/env python3
"""
Bharath Bazar Google Sheets Live Sync
======================================
Syncs Google Sheet 1 directly into the single unified database:
  docs/product_data.csv

Schema: key,en,te,hi,keywords,aisle,rack

Google Sheet:
  https://docs.google.com/spreadsheets/d/1FfX4peTRN4RwfAQabV1jbogbQXESOTauEVyQHjaGJhA/edit
"""

import os
import io
import csv
import re
import urllib.request

SPREADSHEET_ID = "1FfX4peTRN4RwfAQabV1jbogbQXESOTauEVyQHjaGJhA"
DIRECT_EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv"
GVIZ_CSV_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
CSV_PATH = os.path.join(PROJECT_ROOT, "docs", "product_data.csv")

def clean_slug(s):
    if not s or not isinstance(s, str):
        return ""
    s = s.replace('\ufeff', '').strip().strip('"').strip("'")
    if s.isdigit():
        return ""
    if s.startswith("24-mantra") or s.startswith("50-50"):
        return s.lower()
    s = re.sub(r"^\d+[-\s]*", "", s)
    s = re.sub(r"[-\s]*\d{5,}$", "", s)
    s = re.sub(r"([a-zA-Z]+)\d{5,}$", r"\1", s)
    s = s.strip("-").lower()
    return s if len(s) > 1 and not s.isdigit() else ""

def clean_title(t):
    if not t or not isinstance(t, str):
        return ""
    t = t.replace('\ufeff', '').strip().strip('"').strip("'")
    if t.startswith("24 Mantra") or t.startswith("50-50"):
        return t
    t = re.sub(r"^\d+[-\s]*", "", t)
    return t.strip()

def format_title(slug):
    return ' '.join(w.capitalize() for w in slug.split('-'))

def generate_slug(value):
    if not value or not isinstance(value, str):
        return ""
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value


def looks_like_keyword_blob(value):
    text = (value or "").strip()
    if not text:
        return False
    if text.startswith("[") and text.endswith("]"):
        return True
    if "|" in text:
        pieces = [p.strip() for p in text.split("|") if p.strip()]
        return len(pieces) >= 2 and all(re.match(r"^[a-zA-Z0-9\s\-_/]+$", piece) for piece in pieces)
    return False


def is_valid_product_row(row):
    if not row:
        return False
    values = [str(v or "").strip() for v in row]
    if len(values) < 3:
        return False
    if not any(values[:3]):
        return False

    en, te, hi = values[0], values[1] if len(values) > 1 else "", values[2] if len(values) > 2 else ""
    if looks_like_keyword_blob(en) or looks_like_keyword_blob(te) or looks_like_keyword_blob(hi):
        return False
    if en.lower() in {"uncategorized", "spices & masala", "snacks & sweets", "dairy, oils & ghee"} and not te and not hi:
        return False
    return True


def load_existing_csv():
    d = {}
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            idx = {name.strip().lower(): i for i, name in enumerate(header or [])}
            for r in reader:
                if not r:
                    continue

                has_key = "key" in idx
                if has_key and len(r) > 0:
                    k = clean_slug(r[idx["key"]]) if idx["key"] < len(r) else ""
                else:
                    en = r[idx["en"]].strip() if "en" in idx and idx["en"] < len(r) else ""
                    k = generate_slug(en)

                if not k:
                    continue

                en_pos = idx["en"] if "en" in idx else 0
                te_pos = idx["te"] if "te" in idx else 1
                hi_pos = idx["hi"] if "hi" in idx else 2
                keywords_pos = idx["keywords"] if "keywords" in idx else 3
                categories_pos = idx["categories"] if "categories" in idx else 4
                aisle_pos = idx["aisle"] if "aisle" in idx else (5 if "key" in idx else 5)
                rack_pos = idx["rack"] if "rack" in idx else 6

                row_en = r[en_pos].strip() if en_pos < len(r) else ""
                row_te = r[te_pos].strip() if te_pos < len(r) else ""
                row_hi = r[hi_pos].strip() if hi_pos < len(r) else ""
                row_keywords = r[keywords_pos].strip() if keywords_pos < len(r) else ""
                row_categories = r[categories_pos].strip() if categories_pos < len(r) else ""
                row_aisle = r[aisle_pos].strip() if aisle_pos < len(r) else ""
                row_rack = r[rack_pos].strip() if rack_pos < len(r) else ""

                d[k] = [k, clean_title(row_en or row_te or row_hi or k), row_te, row_hi, row_keywords, row_categories, row_aisle, row_rack]
    return d

def download_google_sheet_csv():
    print("📡 Downloading CSV from Google Sheet export URL...")

    download_urls = [DIRECT_EXPORT_URL, GVIZ_CSV_URL]
    last_error = None

    for url in download_urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="replace")
        except Exception as exc:
            last_error = exc
            print(f"⚠️ Download failed for {url}: {exc}")

    raise RuntimeError(f"Unable to download Google Sheet CSV using any known endpoint. Last error: {last_error}")


def normalize_header_name(name):
    value = (name or "").strip().lower().replace("\ufeff", "")
    aliases = {
        "key": "key",
        "slug": "key",
        "product_key": "key",
        "english": "en",
        "en": "en",
        "name": "en",
        "product_name": "en",
        "telugu": "te",
        "te": "te",
        "hindi": "hi",
        "hi": "hi",
        "keywords": "keywords",
        "category": "categories",
        "categories": "categories",
        "category_name": "categories",
        "aisle": "aisle",
        "rack": "rack",
        "aisle_name": "aisle",
        "rack_no": "rack",
    }
    return aliases.get(value, value)


def normalize_row_from_header(row, header_names):
    record = {}
    for index, raw_name in enumerate(header_names):
        key = normalize_header_name(raw_name)
        value = row[index].strip() if index < len(row) else ""
        if key:
            record[key] = value
    return record


def main():
    csv_text = download_google_sheet_csv()
    if not csv_text.strip():
        raise RuntimeError("Downloaded CSV is empty.")

    cleaned_csv = csv_text.strip()
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(cleaned_csv)
        if not cleaned_csv.endswith("\n"):
            f.write("\n")

    row_count = max(0, len([line for line in cleaned_csv.splitlines() if line.strip()]) - 1)
    print(f"📥 Downloaded {row_count} product rows to {CSV_PATH}")
    print("🎉 Done — no local data merge or rewrite logic applied.")

if __name__ == "__main__":
    main()
