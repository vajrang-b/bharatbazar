#!/usr/bin/env python3
"""
Bharath Bazar Google Sheets Live Sync
======================================
Syncs Google Sheet 1 directly into the single unified database:
  docs/multilingual_dictionary.csv

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
GVIZ_CSV_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
CSV_PATH = os.path.join(PROJECT_ROOT, "docs", "multilingual_dictionary.csv")

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

def load_existing_csv():
    d = {}
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            for r in reader:
                if r and len(r) >= 5:
                    k = clean_slug(r[0])
                    if not k:
                        continue
                    d[k] = [k, clean_title(r[1]), r[2].strip(), r[3].strip(),
                            r[4].strip(),
                            r[5].strip() if len(r) >= 6 else "",
                            r[6].strip() if len(r) >= 7 else ""]
    return d

def main():
    print(f"📡 Fetching from Google Sheet...")
    req = urllib.request.Request(GVIZ_CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        csv_text = resp.read().decode("utf-8")

    dict_map = load_existing_csv()

    reader = csv.reader(io.StringIO(csv_text))
    next(reader, None)

    count = 0
    for row in reader:
        if not row or len(row) < 5:
            continue
        # Header: asile, Rack number, key, en, te, hi, keywords
        if len(row) >= 7:
            aisle_raw, rack_raw, key_raw, en_raw, te_raw, hi_raw, kw_raw = row[0:7]
        else:
            aisle_raw, rack_raw = "", ""
            key_raw, en_raw, te_raw, hi_raw, kw_raw = row[0:5]

        k = clean_slug(key_raw)
        if not k:
            continue
        en = clean_title(en_raw) or format_title(k)
        aisle = aisle_raw.strip() if aisle_raw.strip().isdigit() else ""
        rack = rack_raw.strip() if rack_raw.strip().isdigit() else ""
        dict_map[k] = [k, en, te_raw.strip(), hi_raw.strip(), kw_raw.strip(), aisle, rack]
        count += 1

    rows = sorted(dict_map.values(), key=lambda x: x[0])

    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "en", "te", "hi", "keywords", "aisle", "rack"])
        writer.writerows(rows)

    print(f"💾 {len(rows)} products in {CSV_PATH} ({count} synced from Sheet).")
    print("🎉 Done!")

if __name__ == "__main__":
    main()
