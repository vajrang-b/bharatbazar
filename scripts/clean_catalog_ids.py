#!/usr/bin/env python3
"""
Bharath Bazar Catalog Barcode ID Sanitizer (UTF-8 BOM Cleaned)
================================================================
Strips unnecessary numeric UPC/Shopify barcode ID prefixes (e.g. 011433151474tindora-bulk -> tindora-bulk)
across data/product_names.txt, docs/product_names.json, and docs/multilingual_dictionary.csv.
"""

import os
import json
import csv
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

TXT_PATH = os.path.join(PROJECT_ROOT, "data", "product_names.txt")
JSON_PATH = os.path.join(PROJECT_ROOT, "docs", "product_names.json")
CSV_PATH = os.path.join(PROJECT_ROOT, "docs", "multilingual_dictionary.csv")

def clean_slug(s):
    if not s or not isinstance(s, str):
        return ""
    # Strip UTF-8 BOM, spaces, and quotes
    s = s.replace('\ufeff', '').strip().strip('"').strip("'")
    if s.isdigit():
        return ""
    if s.startswith("24-mantra") or s.startswith("50-50"):
        return s.lower()
    
    # 1. Strip leading barcode numbers (e.g. 011433150deep -> deep, 149yellow -> yellow)
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

def main():
    print("🧹 Cleaning UPC Barcode IDs across all dataset files (BOM-handled)...")

    # 1. Clean data/product_names.txt
    if os.path.exists(TXT_PATH):
        with open(TXT_PATH, "r", encoding="utf-8-sig") as f:
            lines = [l.strip() for l in f if l.strip()]
        
        clean_lines = []
        seen = set()
        for l in lines:
            cs = clean_slug(l)
            if cs and cs not in seen:
                seen.add(cs)
                clean_lines.append(cs)
        
        with open(TXT_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(clean_lines) + "\n")
        print(f"  ✅ Cleaned data/product_names.txt: {len(lines)} -> {len(clean_lines)} lines.")

    # 2. Clean docs/product_names.json
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "r", encoding="utf-8-sig") as f:
            slugs = json.load(f)
        
        clean_slugs = []
        seen = set()
        for s in slugs:
            cs = clean_slug(s)
            if cs and cs not in seen:
                seen.add(cs)
                clean_slugs.append(cs)
        
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(clean_slugs, f, indent=2)
        print(f"  ✅ Cleaned docs/product_names.json: {len(slugs)} -> {len(clean_slugs)} slugs.")

    # 3. Clean docs/multilingual_dictionary.csv
    if os.path.exists(CSV_PATH):
        dict_rows = []
        seen = set()
        with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for row in reader:
                if row and len(row) >= 5:
                    k = clean_slug(row[0])
                    if not k or k in seen:
                        continue
                    seen.add(k)
                    en = clean_title(row[1])
                    te = row[2].strip()
                    hi = row[3].strip()
                    kw = row[4].strip()
                    dict_rows.append([k, en, te, hi, kw])
        
        dict_rows.sort(key=lambda x: x[0])
        with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["key", "en", "te", "hi", "keywords"])
            writer.writerows(dict_rows)
        print(f"  ✅ Cleaned docs/multilingual_dictionary.csv: {len(dict_rows)} clean entries.")

    print("🎉 All catalog files sanitized successfully!")

if __name__ == "__main__":
    main()
