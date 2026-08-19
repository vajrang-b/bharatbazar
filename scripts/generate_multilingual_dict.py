#!/usr/bin/env python3
"""
Bharath Bazar Multilingual Dictionary Generator via Local Ollama (Docker)
==========================================================================
Uses local Ollama Docker LLM instance (e.g. llama3.2, qwen2.5, phi3) to automatically
generate Telugu and Hindi transliterations & search keywords for all 2,300+ 
Bharath Bazar product slugs in docs/product_names.json and update docs/multilingual_dictionary.csv.

Usage:
    python3 scripts/generate_multilingual_dict.py --model llama3.2:latest --batch-size 10
"""

import os
import sys
import json
import csv
import argparse
import urllib.request
import urllib.error

OLLAMA_URL = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

PRODUCT_NAMES_PATH = os.path.join(PROJECT_ROOT, "docs", "product_names.json")
DICTIONARY_CSV_PATH = os.path.join(PROJECT_ROOT, "docs", "multilingual_dictionary.csv")

DEFAULT_MODEL = "llama3.2:latest"

PROMPT_TEMPLATE = """You are an expert Indian supermarket catalog translator specializing in Telugu and Hindi transliteration.
Given a list of product slugs from an Indian grocery store, provide accurate Telugu and Hindi transliterations and common search keywords.

Return ONLY a JSON array of objects, with NO Markdown formatting or markdown codeblocks. Each object must have these exact keys:
- "key": (the product slug as given)
- "en": (clean English name, e.g. "Turmeric Powder")
- "te": (Telugu transliteration & script, e.g. "Pasupu (పసుపు)")
- "hi": (Hindi transliteration & script, e.g. "Haldi (हल्दी)")
- "keywords": (pipe-separated search keywords in lowercase, e.g. "turmeric|haldi|pasupu|powder")

Input Products:
{product_list_json}
"""

def check_ollama_status(model_name):
    """Check if local Docker Ollama is reachable and model is available."""
    try:
        url = f"{OLLAMA_URL}/api/tags"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = [m.get("name") for m in data.get("models", [])]
            print(f"Connected to Ollama Docker at {OLLAMA_URL}")
            print(f"Available local models: {', '.join(models[:6])}...")
            
            if model_name not in models and f"{model_name}:latest" not in models:
                # Pick first available model if requested not present
                available = [m for m in models if "embed" not in m]
                if available:
                    fallback = available[0]
                    print(f"Model '{model_name}' not found. Falling back to available model: '{fallback}'")
                    return fallback
            return model_name
    except Exception as e:
        print(f"ERROR: Cannot connect to local Docker Ollama at {OLLAMA_URL}: {e}")
        print("Ensure Ollama container is running (e.g. docker run -d -p 11434:11434 --name ollama ollama/ollama)")
        sys.exit(1)

def load_existing_dictionary():
    """Load existing entries from docs/multilingual_dictionary.csv to avoid redundant Ollama calls."""
    existing = {}
    if os.path.exists(DICTIONARY_CSV_PATH):
        with open(DICTIONARY_CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for row in reader:
                if row and len(row) >= 5:
                    key = row[0].strip().lower()
                    existing[key] = {
                        "key": key,
                        "en": row[1].strip(),
                        "te": row[2].strip(),
                        "hi": row[3].strip(),
                        "keywords": row[4].strip()
                    }
    print(f"Loaded {len(existing)} existing dictionary entries from CSV.")
    return existing

def query_ollama(model_name, prompt):
    """Send prompt to local Ollama docker endpoint."""
    url = f"{OLLAMA_URL}/api/generate"
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }
    
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json"})
    
    with urllib.request.urlopen(req, timeout=120) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res.get("response", "").strip()

def parse_ollama_json_response(raw_text):
    """Clean markdown codeblocks if present and parse JSON."""
    clean = raw_text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()
    
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        print(f"  Warning: JSON decode error: {e}. Attempting substring extraction...")
        start = clean.find("[")
        end = clean.rfind("]")
        if start != -1 and end != -1:
            try:
                return json.loads(clean[start:end+1])
            except Exception:
                pass
        return []

def save_dictionary_to_csv(dictionary_map):
    """Save updated dictionary entries to docs/multilingual_dictionary.csv."""
    os.makedirs(os.path.dirname(DICTIONARY_CSV_PATH), exist_ok=True)
    with open(DICTIONARY_CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "en", "te", "hi", "keywords"])
        for item in sorted(dictionary_map.values(), key=lambda x: x["key"]):
            writer.writerow([item["key"], item["en"], item["te"], item["hi"], item["keywords"]])
    print(f"💾 Updated {DICTIONARY_CSV_PATH} ({len(dictionary_map)} total entries).")

def main():
    parser = argparse.ArgumentParser(description="Generate Indian regional language transliterations using local Ollama model.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Ollama model name (default: {DEFAULT_MODEL})")
    parser.add_argument("--batch-size", type=int, default=10, help="Number of products per LLM batch request (default: 10)")
    parser.add_argument("--max-items", type=int, default=None, help="Limit total items to process (for testing)")
    args = parser.parse_args()

    active_model = check_ollama_status(args.model)

    if not os.path.exists(PRODUCT_NAMES_PATH):
        print(f"ERROR: Product names file not found at {PRODUCT_NAMES_PATH}")
        sys.exit(1)

    with open(PRODUCT_NAMES_PATH, "r", encoding="utf-8") as f:
        slugs = json.load(f)

    print(f"Loaded {len(slugs)} total product slugs from docs/product_names.json.")

    dictionary_map = load_existing_dictionary()
    
    # Filter out already existing slugs
    unprocessed_slugs = [s for s in slugs if s.lower() not in dictionary_map]
    print(f"Unprocessed product slugs remaining: {len(unprocessed_slugs)}")

    if args.max_items:
        unprocessed_slugs = unprocessed_slugs[:args.max_items]
        print(f"Processing limited to first {args.max_items} items.")

    if not unprocessed_slugs:
        print("All products are already localized in multilingual_dictionary.csv!")
        return

    batch_size = args.batch_size
    total_unprocessed = len(unprocessed_slugs)

    for i in range(0, total_unprocessed, batch_size):
        batch_slugs = unprocessed_slugs[i:i+batch_size]
        print(f"\n⚡ Processing batch {i//batch_size + 1}/{(total_unprocessed + batch_size - 1)//batch_size} ({len(batch_slugs)} items) via '{active_model}'...")

        prompt = PROMPT_TEMPLATE.format(product_list_json=json.dumps(batch_slugs, indent=2))
        
        try:
            raw_response = query_ollama(active_model, prompt)
            entries = parse_ollama_json_response(raw_response)
            
            added_count = 0
            for entry in entries:
                if isinstance(entry, dict) and "key" in entry:
                    key = str(entry["key"]).strip().lower()
                    dictionary_map[key] = {
                        "key": key,
                        "en": str(entry.get("en", "")),
                        "te": str(entry.get("te", "")),
                        "hi": str(entry.get("hi", "")),
                        "keywords": str(entry.get("keywords", key))
                    }
                    added_count += 1

            print(f"  Successfully extracted {added_count} multilingual entries.")
            
            # Incremental save every batch
            save_dictionary_to_csv(dictionary_map)

        except Exception as e:
            print(f"  Error processing batch starting at index {i}: {e}")
            continue

    print(f"\n🎉 Completed! Multilingual dictionary updated at: {DICTIONARY_CSV_PATH}")

if __name__ == "__main__":
    main()
