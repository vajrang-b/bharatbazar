# Bharath Bazar Mobile Store Locator - AI Agent & Architecture Guide

Welcome to the **Bharath Bazar Mobile Store Locator** repository! This document serves as a reference manual for AI agents and human developers maintaining or extending this repository.

---

## 📌 Repository Overview

This project is a high-performance, mobile-first web application designed for internal store staff and customers to quickly locate items within the **Bharath Bazar** supermarket.

- **Target Host**: GitHub Pages (`https://vajrang-b.github.io/bharatbazar/`)
- **Repository URL**: `https://github.com/vajrang-b/bharatbazar`
- **Tech Stack**: Pure HTML5, Vanilla CSS3 (Custom Design System), JavaScript (ES6+), Zero Heavy Framework Dependencies.
- **Dataset**: `product_data.csv` (Contains 2,244 live product records synced from Google Sheets) & `store_map.json` (428 mapped rack coordinates).

> ⚠️ **Agent note — do not bulk-read data files.** `docs/json/product_data.csv` and
> `store_workbook.xlsx` are large generated datasets, not source code. Never open them in full
> (e.g. `cat`/`Read` on the whole file). Read only the first 2-3 lines (e.g. `head -n 3`) to
> confirm the header/column schema, then work against that schema — use `grep`/`awk`/a short
> script for anything that needs to inspect actual rows.

---

## 📁 Key File Structure

```
bharathbazar/
├── docs/                       # Production Web App (Hosted via GitHub Pages /docs)
│   ├── css/
│   │   └── index.css           # Dark theme design system (Saffron #E65100 & Emerald #1B5E20)
│   ├── scripts/
│   │   ├── app.js              # Modular UI application controller & search engine logic
│   │   └── route-optimizer.js  # Shopping route optimizer engine
│   ├── json/
│   │   ├── product_data.csv    # 2,244 live products from Google Sheet sync
│   │   ├── store_map.json      # Visual 2D floorplan layout & rack coordinates
│   │   └── store_aisles.json   # Store aisle & rack matrix fallback configuration
│   ├── index.html              # Mobile SPA structure & bottom navigation
│   ├── map-editor.html         # Standalone 2D Visual Map Studio & Editor
│   ├── manifest.json           # PWA Web App manifest
│   ├── sw.js                   # Service Worker offline caching
│   ├── privacy-policy.html     # Privacy Policy page
│   └── cookie-policy.html      # Cookie Policy page
├── scripts/                    # Automation & Scraping Tooling
│   ├── sync_google_sheet.py    # Google Sheets live catalog & floorplan sync
│   ├── get_product_names.py    # Python Wayback Machine CDX API scraper script
│   └── scraper.py              # Extended product detail scraper
├── AGENTS.md                   # AI Agent architecture guide & reference
└── README.md                   # Project README & GitHub Pages deployment instructions
```

---

## 🌐 Multilingual Search Engine (`MULTILINGUAL_DICTIONARY`)

Customers and staff often search for products using Telugu or Hindi transliterations instead of exact English product names. The dictionary in `app.js` maps regional language terms directly to product keywords:

| English Keyword | Telugu Transliteration | Hindi Transliteration | Resolved Products |
| :--- | :--- | :--- | :--- |
| **Turmeric** | `Pasupu` (పసుపు) | `Haldi` (हल्दी) | Spices Aisle 1 (Turmeric Powder, Laxmi Haldi) |
| **Cumin** | `Jilakarra` (జిలకర) | `Jeera` (జీరా) | Spices Aisle 1 (Cumin Seeds, Jeera Powder) |
| **Coriander** | `Dhaniyalu` / `Kotthimera` | `Dhania` | Spices Aisle 1 (Coriander Seeds / Powder) |
| **Curd / Yogurt** | `Perugu` (పెరుగు) | `Dahi` (దही) | Dairy Aisle 5 & Frozen Aisle 3 |
| **Jaggery** | `Bellam` (బెల్లం) | `Gud` (गुड़) | Snacks & Sweets Aisle 4 |
| **Rice** | `Biyyam` (బియ్యం) | `Chawal` (चावल) | Grains & Atta Aisle 2 |
| **Ghee** | `Neyyi` (నెయ్యి) | `Ghee` (घी) | Dairy, Oils & Ghee Aisle 5 |

---

## 🏬 Store Layout Matrix (8 Aisles x 428 Racks)

Products are dynamically mapped across **8 Aisles**, with up to **62 individual rack positions** per aisle:

1. **Aisle 1**: Spices & Masala (`🌶️`)
2. **Aisle 2**: Atta, Rice & Grains (`🌾`)
3. **Aisle 3**: Frozen Foods (`❄️`)
4. **Aisle 4**: Snacks & Sweets (`🍬`)
5. **Aisle 5**: Dairy, Oils & Ghee (`🧈`)
6. **Aisle 6**: Pickles, Sauces & Instant (`🫙`)
7. **Aisle 7**: Tea & Beverages (`☕`)
8. **Aisle 8**: Personal Care & Household (`🧼`)

---

## 🔒 Read-only Public Site

- The public site (`docs/index.html`) is **read-only**: visitors can search and view product locations but cannot edit them.
- Aisle/rack changes are made only in the Google Sheet, which syncs to `docs/json/product_data.csv` hourly via GitHub Actions.
- Do not add in-page edit controls or `localStorage` location overrides to the public page. The old `bharath_bazar_location_overrides` key is ignored.

---

## 🚀 GitHub Pages Deployment Steps

To deploy updates to GitHub Pages:

1. Commit changes to main branch:
   ```bash
   git add .
   git commit -m "Update mobile store locator"
   git push origin main
   ```
2. Enable GitHub Pages:
   - Go to `https://github.com/vajrang-b/bharatbazar/settings/pages`
   - Source: **Deploy from a branch**
   - Branch: `main` / `root`
   - Save.

Site will be live at: `https://vajrang-b.github.io/bharatbazar/`
