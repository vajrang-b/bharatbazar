#!/usr/bin/env python3
"""
Bharath Bazar Wayback Machine Product Scraper
==============================================
Fast asynchronous scraper to extract product details from archived snapshots of 
bharathbazaronline.com on archive.org (Wayback Machine).

Why it is fast:
1. Uses Wayback Machine CDX API (http://web.archive.org/cdx/search/cdx) to instantly 
   discover all product URLs without loading slow Wayback UI pages.
2. Uses aiohttp for high-concurrency async fetching and BeautifulSoup for microsecond HTML parsing.
3. Provides an optional Playwright mode (--use-playwright) for browser-based rendering if required.
"""

import argparse
import asyncio
import csv
import json
import logging
import re
import sys
import time
from urllib.parse import urlparse, parse_qs

import aiohttp
from bs4 import BeautifulSoup

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("wayback_scraper")

CDX_API_URL = "http://web.archive.org/cdx/search/cdx"
DOMAIN = "bharathbazaronline.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch_product_urls_from_cdx():
    """
    Query Wayback Machine CDX API to fetch all archived product URLs for bharathbazaronline.com
    Returns a dict mapping clean original product URL -> latest Wayback timestamp.
    """
    logger.info("Querying Wayback Machine CDX API for product URLs...")
    params = {
        "url": f"{DOMAIN}/products/*",
        "output": "json",
        "fl": "original,timestamp,statuscode,mimetype",
        "filter": "statuscode:200",
    }

    import urllib.request

    req_url = f"{CDX_API_URL}?url={params['url']}&output=json&fl={params['fl']}&filter={params['filter']}"
    req = urllib.request.Request(req_url, headers=HEADERS)

    product_map = {}
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not data or len(data) <= 1:
                logger.warning("No URLs returned by CDX API.")
                return {}

            rows = data[1:]  # skip header row
            logger.info(f"CDX API returned {len(rows)} raw snapshot records.")

            for row in rows:
                orig_url = row[0]
                timestamp = row[1]

                # Strip query parameters (e.g. ?variant=...) to get clean canonical product URL
                clean_url = orig_url.split("?")[0].rstrip("/")

                # Keep the latest timestamp for each unique product URL
                if clean_url not in product_map or timestamp > product_map[clean_url]:
                    product_map[clean_url] = timestamp

            logger.info(f"Discovered {len(product_map)} unique product URLs.")
            return product_map
    except Exception as e:
        logger.error(f"Failed to query CDX API: {e}")
        return {}


def parse_product_html(html, orig_url, archive_url):
    """
    Parse HTML content of a Wayback snapshot to extract product details.
    Prefers JSON-LD schema, with fallbacks to OpenGraph meta tags and HTML elements.
    """
    soup = BeautifulSoup(html, "html.parser")

    title = None
    price = None
    currency = "USD"
    sku = None
    brand = None
    image_url = None
    availability = None
    description = None

    # Method 1: Check JSON-LD Structured Data
    for s in soup.find_all("script", type="application/ld+json"):
        if s.string and "Product" in s.string:
            try:
                data = json.loads(s.string)
                if isinstance(data, dict) and data.get("@type") == "Product":
                    title = data.get("name")
                    description = data.get("description")
                    sku = data.get("sku")

                    images = data.get("image")
                    if isinstance(images, list) and len(images) > 0:
                        image_url = images[0]
                    elif isinstance(images, str):
                        image_url = images

                    brand_obj = data.get("brand")
                    if isinstance(brand_obj, dict):
                        brand = brand_obj.get("name")
                    elif isinstance(brand_obj, str):
                        brand = brand_obj

                    offers = data.get("offers")
                    if isinstance(offers, list) and len(offers) > 0:
                        offer = offers[0]
                    elif isinstance(offers, dict):
                        offer = offers
                    else:
                        offer = {}

                    if offer:
                        price = offer.get("price")
                        currency = offer.get("priceCurrency", "USD")
                        avail_raw = offer.get("availability", "")
                        if "InStock" in avail_raw:
                            availability = "In Stock"
                        elif "OutOfStock" in avail_raw:
                            availability = "Out of Stock"
                        else:
                            availability = avail_raw
                    break
            except Exception:
                pass

    # Method 2: OpenGraph & Meta Tag Fallbacks
    if not title:
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            title = og_title["content"].strip()
        else:
            h1 = soup.find("h1")
            if h1:
                title = h1.get_text(strip=True)

    if not price:
        og_price = soup.find("meta", property="og:price:amount")
        if og_price and og_price.get("content"):
            price = og_price["content"].strip()

    if not currency:
        og_curr = soup.find("meta", property="og:price:currency")
        if og_curr and og_curr.get("content"):
            currency = og_curr["content"].strip()

    if not image_url:
        og_img = soup.find("meta", property="og:image")
        if og_img and og_img.get("content"):
            image_url = og_img["content"].strip()

    if not description:
        meta_desc = soup.find("meta", name="description") or soup.find("meta", property="og:description")
        if meta_desc and meta_desc.get("content"):
            description = meta_desc["content"].strip()

    # Extract product slug from URL
    slug = orig_url.split("/products/")[-1] if "/products/" in orig_url else ""

    return {
        "title": title or slug.replace("-", " ").title(),
        "price": float(price) if price and str(price).replace(".", "", 1).isdigit() else price,
        "currency": currency,
        "sku": sku,
        "brand": brand or "bharath bazar",
        "availability": availability or "Unknown",
        "image_url": image_url,
        "description": description,
        "slug": slug,
        "original_url": orig_url,
        "archive_url": archive_url,
    }


async def fetch_product_async(session, semaphore, orig_url, timestamp, retries=3):
    """
    Fetch a single product snapshot asynchronously using aiohttp.
    Handles rate-limiting (503/429) with exponential backoff retries.
    """
    archive_url = f"http://web.archive.org/web/{timestamp}/{orig_url}"
    async with semaphore:
        for attempt in range(retries):
            try:
                async with session.get(archive_url, timeout=20) as resp:
                    if resp.status == 200:
                        html = await resp.text()
                        return parse_product_html(html, orig_url, archive_url)
                    elif resp.status in (429, 503, 504):
                        wait_sec = (attempt + 1) * 2
                        await asyncio.sleep(wait_sec)
                    else:
                        logger.warning(f"HTTP {resp.status} for {archive_url}")
                        return {"original_url": orig_url, "archive_url": archive_url, "error": f"HTTP {resp.status}"}
            except Exception as e:
                if attempt == retries - 1:
                    logger.warning(f"Error fetching {archive_url}: {e}")
                    return {"original_url": orig_url, "archive_url": archive_url, "error": str(e)}
                await asyncio.sleep(1)


async def scrape_all_async(product_items, concurrency=10):
    """
    Scrape all products concurrently using aiohttp.
    """
    semaphore = asyncio.Semaphore(concurrency)
    connector = aiohttp.TCPConnector(limit=concurrency * 2)

    results = []
    async with aiohttp.ClientSession(headers=HEADERS, connector=connector) as session:
        tasks = [
            fetch_product_async(session, semaphore, orig_url, ts)
            for orig_url, ts in product_items
        ]

        total = len(tasks)
        completed = 0
        for task in asyncio.as_completed(tasks):
            res = await task
            results.append(res)
            completed += 1
            if completed % 20 == 0 or completed == total:
                logger.info(f"Progress: {completed}/{total} products scraped.")

    return results


def scrape_with_playwright(product_items, limit=0):
    """
    Optional browser-based scraping using Playwright.
    Slower than async aiohttp, but handles heavy client-side Javascript.
    """
    from playwright.sync_api import sync_playwright

    logger.info("Starting Playwright browser scraping...")
    items_to_scrape = product_items[:limit] if limit > 0 else product_items

    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=HEADERS["User-Agent"])
        page = context.new_page()

        for idx, (orig_url, ts) in enumerate(items_to_scrape, 1):
            archive_url = f"http://web.archive.org/web/{ts}/{orig_url}"
            logger.info(f"[{idx}/{len(items_to_scrape)}] Playwright loading: {archive_url}")
            try:
                page.goto(archive_url, timeout=30000, wait_until="domcontentloaded")
                html = page.content()
                product = parse_product_html(html, orig_url, archive_url)
                results.append(product)
            except Exception as e:
                logger.error(f"Playwright error on {archive_url}: {e}")
                results.append({"original_url": orig_url, "archive_url": archive_url, "error": str(e)})

        browser.close()
    return results


def save_results(results, output_filename):
    """
    Save scraped products to JSON or CSV format based on file extension.
    """
    if output_filename.endswith(".csv"):
        fieldnames = [
            "title", "price", "currency", "sku", "brand",
            "availability", "image_url", "description", "slug",
            "original_url", "archive_url", "error"
        ]
        with open(output_filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in results:
                writer.writerow({k: r.get(k, "") for k in fieldnames})
    else:
        with open(output_filename, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    logger.info(f"Successfully saved {len(results)} records to {output_filename}")


def main():
    parser = argparse.ArgumentParser(
        description="Extract all product data from Wayback Machine for bharathbazaronline.com"
    )
    parser.add_argument("-o", "--output", default="bharathbazar_products.json", help="Output file path (.json or .csv)")
    parser.add_argument("-l", "--limit", type=int, default=0, help="Limit number of products to scrape (0 for all)")
    parser.add_argument("-c", "--concurrency", type=int, default=15, help="Number of concurrent requests (default: 15)")
    parser.add_argument("--use-playwright", action="store_true", help="Use Playwright headless browser instead of async HTTP")
    parser.add_argument("--export-urls-only", action="store_true", help="Export product URLs list without fetching HTML content")

    args = parser.parse_args()

    # Step 1: Query CDX API
    product_map = fetch_product_urls_from_cdx()
    if not product_map:
        logger.error("No products found. Exiting.")
        return

    items = list(product_map.items())
    if args.limit > 0:
        logger.info(f"Limiting scraping to first {args.limit} products.")
        items = items[:args.limit]

    # Step 2: Handle --export-urls-only option
    if args.export_urls_only:
        url_file = "product_urls.json"
        url_data = [{"original_url": url, "archive_url": f"http://web.archive.org/web/{ts}/{url}"} for url, ts in items]
        with open(url_file, "w") as f:
            json.dump(url_data, f, indent=2)
        logger.info(f"Saved {len(url_data)} product URLs to {url_file}")
        return

    # Step 3: Scrape product pages
    t0 = time.time()
    if args.use_playwright:
        results = scrape_with_playwright(items, limit=args.limit)
    else:
        results = asyncio.run(scrape_all_async(items, concurrency=args.concurrency))

    t1 = time.time()
    logger.info(f"Scraping completed in {t1 - t0:.2f} seconds.")

    # Step 4: Save output
    save_results(results, args.output)


if __name__ == "__main__":
    main()
