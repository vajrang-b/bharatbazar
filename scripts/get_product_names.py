#!/usr/bin/env python3
"""
Bharath Bazar Product Names Extractor
======================================
Instantly fetches all product names / slugs from Wayback Machine CDX API 
for bharathbazaronline.com without scraping slow page HTML.

Usage:
    python3 get_product_names.py
"""

import json
import urllib.request
from urllib.parse import unquote

CDX_URL = "http://web.archive.org/cdx/search/cdx?url=bharathbazaronline.com/products/*&output=json&fl=original&filter=statuscode:200"
HEADERS = {"User-Agent": "Mozilla/5.0"}


def get_all_product_names():
    print("Fetching product names from Wayback Machine CDX API...")
    req = urllib.request.Request(CDX_URL, headers=HEADERS)
    
    product_slugs = set()
    
    with urllib.request.urlopen(req) as resp:
        rows = json.loads(resp.read().decode("utf-8"))
        print(f"Retrieved {len(rows)-1} total index entries from CDX API.")
        
        for r in rows[1:]:
            orig_url = r[0]
            clean_url = orig_url.split("?")[0].rstrip("/")
            if "/products/" in clean_url:
                slug = clean_url.split("/products/")[-1]
                slug = unquote(slug).strip()
                if slug:
                    product_slugs.add(slug)

    sorted_slugs = sorted(list(product_slugs))
    print(f"\nSuccessfully extracted {len(sorted_slugs)} unique product names!")
    
    # Save to product_names.txt (one per line)
    with open("product_names.txt", "w", encoding="utf-8") as f:
        for slug in sorted_slugs:
            f.write(slug + "\n")
    print("Saved product names to 'product_names.txt'")

    # Save to product_names.json
    with open("product_names.json", "w", encoding="utf-8") as f:
        json.dump(sorted_slugs, f, indent=2)
    print("Saved product names to 'product_names.json'")

    print("\nSample Product Names:")
    for name in sorted_slugs[:25]:
        print(f" - {name}")


if __name__ == "__main__":
    get_all_product_names()
