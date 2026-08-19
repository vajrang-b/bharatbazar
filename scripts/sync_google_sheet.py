#!/usr/bin/env python3
"""
Bharath Bazar Google Sheets Live Sync Script
=============================================
Fetches live data from public Google Sheet (Sheet 1) via Google Visualization CSV endpoint,
saves a copy to data/google_sheet_export.csv, sanitizes barcode IDs, and updates 
docs/multilingual_dictionary.csv (with explicit Aisle & Rack columns), 
docs/product_names.json, and data/product_names.txt.

Google Sheet URL:
https://docs.google.com/spreadsheets/d/1FfX4peTRN4RwfAQabV1jbogbQXESOTauEVyQHjaGJhA/edit?usp=sharing
"""

import os
import io
import json
import csv
import re
import urllib.request

SPREADSHEET_ID = "1FfX4peTRN4RwfAQabV1jbogbQXESOTauEVyQHjaGJhA"
GVIZ_CSV_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

RAW_EXPORT_PATH = os.path.join(PROJECT_ROOT, "data", "google_sheet_export.csv")
CSV_PATH = os.path.join(PROJECT_ROOT, "docs", "multilingual_dictionary.csv")
JSON_PATH = os.path.join(PROJECT_ROOT, "docs", "product_names.json")
TXT_PATH = os.path.join(PROJECT_ROOT, "data", "product_names.txt")

def clean_slug(s):
    if not s or not isinstance(s, str):
        return ""
    s = s.replace('\ufeff', '').strip().strip('"').strip("'")
    if s.isdigit():
        return ""
    if s.startswith("24-mantra") or s.startswith("50-50"):
        return s.lower()
    
    # 1. Strip leading barcode numbers
    s = re.sub(r"^\d+[-\s]*", "", s)
    # 2. Strip trailing long barcode numbers (> 5 digits)
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

def fetch_and_save_raw_csv():
    print(f"📡 Fetching live data from Google Sheet ({SPREADSHEET_ID})...")
    req = urllib.request.Request(GVIZ_CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        csv_bytes = resp.read()
    
    os.makedirs(os.path.dirname(RAW_EXPORT_PATH), exist_ok=True)
    with open(RAW_EXPORT_PATH, "wb") as f:
        f.write(csv_bytes)
    print(f"📥 Saved raw Google Sheet download to: {RAW_EXPORT_PATH}")
    
    return csv_bytes.decode("utf-8")

def main():
    csv_text = fetch_and_save_raw_csv()
    reader = csv.reader(io.StringIO(csv_text))
    header = next(reader, None)
    
    dict_map = {}
    total_parsed = 0
    
    for row in reader:
        if not row:
            continue
        total_parsed += 1
        
        # Expected Header: ['asile', 'Rack number', 'key', 'en', 'te', 'hi', 'keywords']
        if len(row) >= 7:
            aisle_raw = row[0].strip()
            rack_raw = row[1].strip()
            key_raw = row[2].strip()
            en_raw = row[3].strip()
            te_raw = row[4].strip()
            hi_raw = row[5].strip()
            kw_raw = row[6].strip()
        elif len(row) >= 5:
            aisle_raw = ""
            rack_raw = ""
            key_raw = row[0].strip()
            en_raw = row[1].strip()
            te_raw = row[2].strip()
            hi_raw = row[3].strip()
            kw_raw = row[4].strip()
        else:
            continue
            
        k = clean_slug(key_raw)
        if not k:
            continue
        en = clean_title(en_raw)
        te = te_raw.strip()
        hi = hi_raw.strip()
        kw = kw_raw.strip()
        aisle = aisle_raw if aisle_raw.isdigit() else ""
        rack = rack_raw if rack_raw.isdigit() else ""
        
        dict_map[k] = [k, en, te, hi, kw, aisle, rack]

    dict_rows = list(dict_map.values())
    dict_rows.sort(key=lambda x: x[0])
    
    # Write to docs/multilingual_dictionary.csv with 7 columns
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "en", "te", "hi", "keywords", "aisle", "rack"])
        writer.writerows(dict_rows)
    print(f"💾 Saved {len(dict_rows)} clean entries with Aisle & Rack data to {CSV_PATH}.")

    # Merge new keys into docs/product_names.json and data/product_names.txt
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            slugs = json.load(f)
        seen = set(slugs)
        new_count = 0
        for k in dict_map.keys():
            if k not in seen:
                seen.add(k)
                slugs.append(k)
                new_count += 1
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(slugs, f, indent=2)
        print(f"💾 Updated {JSON_PATH} (Total: {len(slugs)} slugs | Added {new_count} new).")

    if os.path.exists(TXT_PATH):
        with open(TXT_PATH, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        seen = set(lines)
        for k in dict_map.keys():
            if k not in seen:
                seen.add(k)
                lines.append(k)
        with open(TXT_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"💾 Updated {TXT_PATH} (Total: {len(lines)} lines).")

    print("🎉 Google Sheet sync complete!")

if __name__ == "__main__":
    main()
