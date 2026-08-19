#!/usr/bin/env python3
"""
Bharath Bazar Google Sheets Live Sync Script
=============================================
Fetches live data from public Google Sheet (Sheet 1) via Google Visualization API,
sanitizes barcode IDs, and updates docs/multilingual_dictionary.csv, docs/product_names.json, and data/product_names.txt.

Google Sheet URL:
https://docs.google.com/spreadsheets/d/1FfX4peTRN4RwfAQabV1jbogbQXESOTauEVyQHjaGJhA/edit?usp=sharing
"""

import os
import json
import csv
import re
import urllib.request

SPREADSHEET_ID = "1FfX4peTRN4RwfAQabV1jbogbQXESOTauEVyQHjaGJhA"
GVIZ_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:json"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

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

def fetch_google_sheet_rows():
    print(f"📡 Fetching live data from Google Sheet ({SPREADSHEET_ID})...")
    req = urllib.request.Request(GVIZ_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
    
    start = raw.find("{")
    end = raw.rfind("}")
    data = json.loads(raw[start:end+1])
    
    table_rows = data.get("table", {}).get("rows", [])
    parsed_rows = []
    
    for r in table_rows:
        cells = r.get("c", [])
        row_vals = [c.get("v") if c else "" for c in cells]
        row_vals = [v for v in row_vals if v is not None]
        
        # Locate product key cell (key is slug string e.g. 'turmeric' or '24-mantra-garam-masala')
        key, en, te, hi, kw = "", "", "", "", ""
        
        for idx, val in enumerate(row_vals):
            val_str = str(val).strip()
            if not val_str or val_str.replace('.', '').isdigit():
                continue
            
            # Check if this cell is a slug key
            if re.match(r"^[a-zA-Z0-9\-_]+$", val_str) and idx + 3 < len(row_vals):
                key = val_str
                en = str(row_vals[idx+1]).strip()
                te = str(row_vals[idx+2]).strip()
                hi = str(row_vals[idx+3]).strip()
                if idx + 4 < len(row_vals):
                    kw = str(row_vals[idx+4]).strip()
                break
        
        if key:
            parsed_rows.append((key, en, te, hi, kw))
            
    print(f"✅ Downloaded {len(parsed_rows)} entries from Google Sheet.")
    return parsed_rows

def main():
    sheet_entries = fetch_google_sheet_rows()
    if not sheet_entries:
        print("⚠️ Warning: No valid entries fetched from Google Sheet.")
        return
    
    dict_map = {}
    
    # 1. Parse and sanitize entries
    for key_raw, en_raw, te_raw, hi_raw, kw_raw in sheet_entries:
        k = clean_slug(key_raw)
        if not k:
            continue
        en = clean_title(en_raw)
        te = te_raw.strip()
        hi = hi_raw.strip()
        kw = kw_raw.strip()
        dict_map[k] = [k, en, te, hi, kw]
        
    dict_rows = list(dict_map.values())
    dict_rows.sort(key=lambda x: x[0])
    
    # 2. Write to docs/multilingual_dictionary.csv
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "en", "te", "hi", "keywords"])
        writer.writerows(dict_rows)
    print(f"💾 Saved {len(dict_rows)} clean entries to {CSV_PATH}.")

    # 3. Merge new keys into docs/product_names.json and data/product_names.txt
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
