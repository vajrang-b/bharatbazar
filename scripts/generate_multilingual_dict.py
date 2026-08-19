#!/usr/bin/env python3
"""
Bharath Bazar Multilingual Dictionary Generator & Auditor via Local Ollama (Docker)
===================================================================================
Connects to local Docker Ollama (e.g. deepseek-r1:32b, llama3.1:8b, qwen2.5-coder:14b)
to generate & audit high-precision Telugu and Hindi transliterations.

Modes:
  1. Generation Mode: Fast extraction of new product entries.
  2. Review / Audit Mode (--review): Uses DeepSeek-R1 32B reasoning engine to audit,
     verify etymology, fix typos, and remove hallucinations from existing dictionary CSV!

Usage:
    # Generate new entries:
    python3 scripts/generate_multilingual_dict.py --model llama3.1:8b --batch-size 5

    # Run DeepSeek-R1 32B Quality Audit Review on existing entries:
    python3 scripts/generate_multilingual_dict.py --review --model deepseek-r1:32b --batch-size 5
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

PREFERRED_MODELS = ["deepseek-r1:32b", "llama3.1:8b", "qwen2.5-coder:14b", "gemma2:latest", "phi3.5:latest", "llama3.2:latest"]

SYSTEM_PROMPT = """You are an expert native linguist and Indian grocery store catalog manager.
Your task is to accurately translate and transliterate Indian supermarket product names into Telugu and Hindi.

CRITICAL TRANSLATION RULES (ZERO HALLUCINATION):
1. Translate ONLY what the product name specifies.
2. DO NOT use generic filler words like "Pasupu" or "Haldi" UNLESS the product is explicitly turmeric.
3. Output MUST be a valid JSON array of objects with NO markdown formatting or commentary.
Each object keys:
- "key": product slug string
- "en": Clean English Title
- "te": Telugu Transliteration and Script, e.g. "Dondakaya (దొండకాయ)"
- "hi": Hindi Transliteration and Script, e.g. "Tindora (टिंडोरा)"
- "keywords": pipe-separated lowercase search terms
"""

REVIEW_PROMPT = """You are DeepSeek-R1, a high-reasoning linguistic audit AI.
Review the following Indian grocery store product dictionary entries for accuracy, etymology, and correctness in Telugu & Hindi transliterations.

INSTRUCTIONS:
1. Examine each dictionary item:
   - Is English clean and proper capitalization?
   - Is Telugu accurate with proper script?
   - Is Hindi accurate with proper script?
   - Are keywords relevant search terms (no random filler words like pasupu on samosa)?
2. If an entry has errors or hallucinations, FIX IT. If it is already correct, keep it intact.
3. Return ONLY a valid JSON array of audited objects with exact keys ("key", "en", "te", "hi", "keywords"). No reasoning text or markdown outside JSON.

Dictionary Entries To Audit:
{entries_json}
"""

def select_best_model(requested_model=None):
    try:
        url = f"{OLLAMA_URL}/api/tags"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            available = [m.get("name") for m in data.get("models", [])]
            print(f"Connected to local Ollama Docker at {OLLAMA_URL}")
            print(f"Available local models: {', '.join(available[:8])}")

            if requested_model and (requested_model in available or f"{requested_model}:latest" in available):
                print(f"Using requested model: '{requested_model}'")
                return requested_model

            for pref in PREFERRED_MODELS:
                for av in available:
                    if pref in av or av in pref:
                        print(f"Selected model: '{av}'")
                        return av
            
            non_embed = [m for m in available if "embed" not in m]
            if non_embed:
                return non_embed[0]
            return "llama3.1:8b"
    except Exception as e:
        print(f"ERROR connecting to Ollama at {OLLAMA_URL}: {e}")
        sys.exit(1)

def load_existing_dictionary():
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
    print(f"Loaded {len(existing)} dictionary entries from CSV.")
    return existing

def query_ollama(model_name, prompt):
    url = f"{OLLAMA_URL}/api/generate"
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1
        }
    }
    
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json"})
    
    with urllib.request.urlopen(req, timeout=300) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res.get("response", "").strip()

def parse_ollama_json(raw_text):
    clean = raw_text.strip()

    # Strip reasoning tags if present (e.g. DeepSeek-R1 <think> ... </think>)
    if "<think>" in clean and "</think>" in clean:
        end_think = clean.find("</think>")
        if end_think != -1:
            clean = clean[end_think + 8:].strip()

    if "```" in clean:
        lines = clean.split("\n")
        cleaned_lines = []
        in_block = False
        for line in lines:
            if line.strip().startswith("```"):
                in_block = not in_block
                continue
            if in_block or not line.strip().startswith("```"):
                cleaned_lines.append(line)
        clean = "\n".join(cleaned_lines).strip()

    start = clean.find("[")
    end = clean.rfind("]")
    if start != -1 and end != -1:
        clean = clean[start:end+1]
    
    try:
        return json.loads(clean)
    except Exception as e:
        print(f"  Warning: JSON parse issue: {e}")
        return []

def save_dictionary_to_csv(dictionary_map):
    os.makedirs(os.path.dirname(DICTIONARY_CSV_PATH), exist_ok=True)
    with open(DICTIONARY_CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "en", "te", "hi", "keywords"])
        for item in sorted(dictionary_map.values(), key=lambda x: x["key"]):
            writer.writerow([item["key"], item["en"], item["te"], item["hi"], item["keywords"]])
    print(f"💾 Saved {len(dictionary_map)} entries to {DICTIONARY_CSV_PATH}.")

def run_review_pass(model_name, batch_size=5, max_items=None):
    """DeepSeek-R1 Reasoning Audit Pass on existing CSV entries."""
    print(f"\n🧠 Starting DeepSeek-R1 32B Quality Audit Pass using '{model_name}'...")
    dictionary_map = load_existing_dictionary()
    items = list(dictionary_map.values())

    if max_items:
        items = items[:max_items]

    total = len(items)
    audited_count = 0

    for i in range(0, total, batch_size):
        batch = items[i:i+batch_size]
        print(f"\n🧠 Auditing batch {i//batch_size + 1}/{(total + batch_size - 1)//batch_size} ({len(batch)} items)...")
        
        prompt = REVIEW_PROMPT.format(entries_json=json.dumps(batch, indent=2))
        try:
            raw_res = query_ollama(model_name, prompt)
            audited_entries = parse_ollama_json(raw_res)

            for entry in audited_entries:
                if isinstance(entry, dict) and "key" in entry:
                    key = str(entry["key"]).strip().lower()
                    dictionary_map[key] = {
                        "key": key,
                        "en": str(entry.get("en", "")),
                        "te": str(entry.get("te", "")),
                        "hi": str(entry.get("hi", "")),
                        "keywords": str(entry.get("keywords", key))
                    }
                    audited_count += 1

            save_dictionary_to_csv(dictionary_map)
            print(f"  Successfully audited batch ({audited_count}/{total} audited).")
        except Exception as e:
            print(f"  Error auditing batch starting at index {i}: {e}")
            continue

    print(f"\n✅ Audit complete! Updated dictionary saved to: {DICTIONARY_CSV_PATH}")

def main():
    parser = argparse.ArgumentParser(description="High-accuracy Indian language dictionary generator & DeepSeek-R1 auditor.")
    parser.add_argument("--model", default=None, help="Ollama model name (e.g. deepseek-r1:32b, llama3.1:8b, qwen2.5-coder:14b)")
    parser.add_argument("--batch-size", type=int, default=5, help="Number of items per batch request (default: 5)")
    parser.add_argument("--max-items", type=int, default=None, help="Limit total items to process")
    parser.add_argument("--review", action="store_true", help="Run DeepSeek-R1 32B Reasoning Audit Pass on existing CSV dictionary")
    args = parser.parse_args()

    model_name = select_best_model(args.model)

    if args.review:
        run_review_pass(model_name, batch_size=args.batch_size, max_items=args.max_items)
        return

    with open(PRODUCT_NAMES_PATH, "r", encoding="utf-8") as f:
        slugs = json.load(f)

    dictionary_map = load_existing_dictionary()
    unprocessed = [s for s in slugs if s.lower() not in dictionary_map]
    print(f"Remaining unprocessed product slugs: {len(unprocessed)}")

    if args.max_items:
        unprocessed = unprocessed[:args.max_items]

    if not unprocessed:
        print("All products are fully processed!")
        return

    batch_size = args.batch_size
    total_unprocessed = len(unprocessed)

    for i in range(0, total_unprocessed, batch_size):
        batch_slugs = unprocessed[i:i+batch_size]
        print(f"\n⚡ Processing batch {i//batch_size + 1}/{(total_unprocessed + batch_size - 1)//batch_size} ({len(batch_slugs)} items) via '{model_name}'...")

        prompt = SYSTEM_PROMPT + "\n\nInput Product Slugs:\n" + json.dumps(batch_slugs, indent=2)
        
        try:
            raw_res = query_ollama(model_name, prompt)
            entries = parse_ollama_json(raw_res)
            
            added = 0
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
                    added += 1

            print(f"  Extracted {added} entries.")
            save_dictionary_to_csv(dictionary_map)

        except Exception as e:
            print(f"  Error processing batch: {e}")
            continue

    print(f"\n🎉 Completed! Dictionary saved at: {DICTIONARY_CSV_PATH}")

if __name__ == "__main__":
    main()
