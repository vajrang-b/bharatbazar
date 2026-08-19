#!/usr/bin/env python3
"""Populate the categories column in product_data.csv using local Ollama.

This keeps the category metadata in the same CSV as the product rows, while still
allowing a local model to validate or fill category choices for rows that do not
have an explicit category yet.
"""

import csv
import json
import os
import re
from pathlib import Path
from urllib import request, error

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "docs" / "product_data.csv"

CATEGORY_MAP = {
    1: "Spices & Masala",
    2: "Atta, Rice & Grains",
    3: "Frozen Foods",
    4: "Snacks & Sweets",
    5: "Dairy, Oils & Ghee",
    6: "Pickles, Sauces & Instant",
    7: "Tea & Beverages",
    8: "Personal Care & Household",
}

CATEGORY_NAMES = list(CATEGORY_MAP.values())
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5-coder:3b"


def parse_csv_row(row):
    return {k: (v or "").strip() for k, v in row.items()}


def infer_category_from_aisle(aisle_raw):
    try:
        aisle = int(str(aisle_raw).strip())
    except (TypeError, ValueError):
        return ""
    return CATEGORY_MAP.get(aisle, "")


def ask_ollama(title, aisle_name=None):
    aisle_hint = f" Existing aisle: {aisle_name}." if aisle_name else ""
    prompt = (
        "You are classifying supermarket products into one of these exact category labels only. "
        "Return only the category name without any extra text.\n\n"
        f"Category labels: {', '.join(CATEGORY_NAMES)}\n\n"
        f"Product title: {title}{aisle_hint}\n\n"
        "Choose the single best match."
    )

    payload = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.0, "top_p": 0.2},
    }).encode("utf-8")

    req = request.Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"})
    try:
        with request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (error.URLError, TimeoutError, ValueError):
        return ""

    text = (body.get("response") or "").strip()
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text).strip().strip('"').strip("'")
    for label in CATEGORY_NAMES:
        if text.lower() == label.lower():
            return label
        if text.lower().startswith(label.lower()):
            return label
    return ""


def update_csv():
    with CSV_PATH.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    fieldnames = list(rows[0].keys()) if rows else [
        "en", "te", "hi", "keywords", "categories", "aisle", "rack"
    ]
    if "categories" not in fieldnames:
        fieldnames.insert(4, "categories")

    updated = []
    filled = 0
    need_llm = 0

    for row in rows:
        r = parse_csv_row(row)
        category = (r.get("categories") or "").strip()

        if not category:
            aisle_guess = r.get("aisle", "")
            category = infer_category_from_aisle(aisle_guess)

        if not category:
            title = r.get("en") or r.get("key") or ""
            aisle_name = infer_category_from_aisle(r.get("aisle", ""))
            category = ask_ollama(title, aisle_name)
            need_llm += 1

        if category:
            filled += 1
        else:
            category = "General" if r.get("aisle") else "Uncategorized"

        r["categories"] = category
        updated.append(r)

    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(updated)

    print(f"Updated categories for {filled} rows; LLM fallback used for {need_llm} rows.")


if __name__ == "__main__":
    update_csv()
