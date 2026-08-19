#!/usr/bin/env python3
"""
Bharath Bazar Automated Multilingual Pipeline
========================================================================================
Complete End-to-End Pipeline:
  1. Reads product catalog slugs from docs/product_names.json.
  2. Stage 1 (Generation): Generates initial Telugu & Hindi transliterations via llama3.1:8b (or qwen2.5-coder).
  3. Stage 2 (Validation): Audits & verifies translations using DeepSeek-R1 32B reasoning engine.
  4. Stage 3 (Persistence): Writes final verified entries into docs/multilingual_dictionary.csv.

Usage:
    # Run full automated pipeline across all items:
    python3 scripts/generate_multilingual_dict.py

    # Run fast generation mode without DeepSeek audit wait:
    python3 scripts/generate_multilingual_dict.py --fast

    # Run pipeline on a sample of 10 items:
    python3 scripts/generate_multilingual_dict.py --max-items 10
"""

import os
import sys
import json
import csv
import argparse
import urllib.request
import urllib.error
import socket

OLLAMA_URL = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

PRODUCT_NAMES_PATH = os.path.join(PROJECT_ROOT, "docs", "product_names.json")
DICTIONARY_CSV_PATH = os.path.join(PROJECT_ROOT, "docs", "multilingual_dictionary.csv")

GENERATOR_MODEL = "llama3.1:8b"
VALIDATOR_MODEL = "deepseek-r1:32b"

SYSTEM_PROMPT_GENERATE = """You are an Indian supermarket catalog translator.
Given a list of product slugs, provide Telugu and Hindi transliterations and search keywords.

CRITICAL RULES:
1. Translate ONLY what the product name specifies.
2. DO NOT use generic filler words like "Pasupu" or "Haldi" UNLESS the product is explicitly turmeric.
3. Return ONLY a valid JSON array of objects with keys: "key", "en", "te", "hi", "keywords".
No Markdown codeblocks or commentary outside JSON.
"""

SYSTEM_PROMPT_VALIDATE = """You are DeepSeek-R1, a high-reasoning linguistic audit AI for Indian grocery catalogs.
Review and validate the following candidate product transliterations for etymology, spelling, and zero-hallucination accuracy.

AUDIT INSTRUCTIONS:
1. Check English title, Telugu script/transliteration, and Hindi script/transliteration.
2. Fix any typos or incorrect terms (e.g. remove "pasupu" if product is not turmeric).
3. Return ONLY a valid JSON array of audited objects with exact keys ("key", "en", "te", "hi", "keywords"). No text outside JSON.

Candidate Entries To Audit:
{entries_json}
"""

def query_ollama(model_name, prompt, timeout=600):
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
    
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res.get("response", "").strip()

def parse_ollama_json(raw_text):
    clean = raw_text.strip()

    # Remove DeepSeek-R1 reasoning <think> ... </think> tags if present
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
    return existing

def save_dictionary_to_csv(dictionary_map):
    os.makedirs(os.path.dirname(DICTIONARY_CSV_PATH), exist_ok=True)
    with open(DICTIONARY_CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "en", "te", "hi", "keywords"])
        for item in sorted(dictionary_map.values(), key=lambda x: x["key"]):
            writer.writerow([item["key"], item["en"], item["te"], item["hi"], item["keywords"]])
    print(f"💾 Updated {len(dictionary_map)} entries in {DICTIONARY_CSV_PATH}.")

def run_automated_pipeline(gen_model, val_model, batch_size=5, max_items=None, fast_mode=False):
    """Executes 3-Stage Pipeline: Read -> Generate -> DeepSeek Validate -> Write CSV."""
    print("=" * 70)
    print("🚀 BHARATH BAZAR AUTOMATED MULTILINGUAL PIPELINE")
    print(f"   Stage 1: Read Catalog (docs/product_names.json)")
    print(f"   Stage 2: Generate via '{gen_model}'")
    if not fast_mode:
        print(f"   Stage 3: Validate via DeepSeek-R1 '{val_model}'")
    print(f"   Stage 4: Write Verified Entries to docs/multilingual_dictionary.csv")
    print("=" * 70)

    if not os.path.exists(PRODUCT_NAMES_PATH):
        print(f"ERROR: {PRODUCT_NAMES_PATH} not found.")
        sys.exit(1)

    with open(PRODUCT_NAMES_PATH, "r", encoding="utf-8") as f:
        slugs = json.load(f)

    dictionary_map = load_existing_dictionary()
    unprocessed = [s for s in slugs if s.lower() not in dictionary_map]
    print(f"Total catalog slugs: {len(slugs)} | Existing verified entries: {len(dictionary_map)} | Unprocessed: {len(unprocessed)}")

    if max_items:
        unprocessed = unprocessed[:max_items]

    if not unprocessed:
        print("🎉 All catalog products are already processed and verified!")
        return

    total_unprocessed = len(unprocessed)

    for i in range(0, total_unprocessed, batch_size):
        batch_slugs = unprocessed[i:i+batch_size]
        print(f"\n🔄 Pipeline Batch {i//batch_size + 1}/{(total_unprocessed + batch_size - 1)//batch_size} ({len(batch_slugs)} items):")

        # --- STAGE 1: GENERATION ---
        print(f"  ⚡ Step 1: Generating candidates via '{gen_model}'...")
        try:
            gen_prompt = SYSTEM_PROMPT_GENERATE + "\nInput Slugs:\n" + json.dumps(batch_slugs, indent=2)
            raw_gen = query_ollama(gen_model, gen_prompt, timeout=300)
            candidates = parse_ollama_json(raw_gen)
        except Exception as e:
            print(f"  ⚠️ Generation error: {e}. Skipping batch.")
            continue

        if not candidates:
            print(f"  ⚠️ Warning: Generation returned empty result for batch. Skipping.")
            continue

        final_entries = candidates

        # --- STAGE 2: DEEPSEEK-R1 VALIDATION (IF NOT FAST MODE) ---
        if not fast_mode:
            print(f"  🧠 Step 2: Validating etymology & accuracy via DeepSeek-R1 '{val_model}'...")
            try:
                val_prompt = SYSTEM_PROMPT_VALIDATE.format(entries_json=json.dumps(candidates, indent=2))
                raw_val = query_ollama(val_model, val_prompt, timeout=600)
                validated_entries = parse_ollama_json(raw_val)
                if validated_entries:
                    final_entries = validated_entries
            except (TimeoutError, socket.timeout, Exception) as e:
                print(f"  ⚠️ DeepSeek validation timed out or deferred ({e}). Saving Stage 1 candidates.")

        # --- STAGE 3: PERSISTENCE ---
        added_count = 0
        for entry in final_entries:
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

        print(f"  ✅ Step 3: Saved {added_count} entries.")
        save_dictionary_to_csv(dictionary_map)

    print(f"\n🎉 Pipeline Complete! Total entries in CSV: {len(dictionary_map)}")

def main():
    parser = argparse.ArgumentParser(description="Bharath Bazar Multilingual Pipeline.")
    parser.add_argument("--gen-model", default=GENERATOR_MODEL, help=f"Generator model (default: {GENERATOR_MODEL})")
    parser.add_argument("--val-model", default=VALIDATOR_MODEL, help=f"Validator model (default: {VALIDATOR_MODEL})")
    parser.add_argument("--batch-size", type=int, default=5, help="Batch size per request (default: 5)")
    parser.add_argument("--max-items", type=int, default=None, help="Limit total items to process")
    parser.add_argument("--fast", action="store_true", help="Fast mode: skips DeepSeek reasoning wait and persists Stage 1 generation directly")
    args = parser.parse_args()

    run_automated_pipeline(
        gen_model=args.gen_model,
        val_model=args.val_model,
        batch_size=args.batch_size,
        max_items=args.max_items,
        fast_mode=args.fast
    )

if __name__ == "__main__":
    main()
