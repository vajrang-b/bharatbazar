# Bharath Bazar Mobile Store Locator - AI Agent & Architecture Guide

Welcome to the **Bharath Bazar Mobile Store Locator** repository! This document serves as a reference manual for AI agents and human developers maintaining or extending this repository.

---

## 📌 Repository Overview

This project is a high-performance, mobile-first web application designed for internal store staff and customers to quickly locate items within the **Bharath Bazar** supermarket.

- **Target Host**: GitHub Pages (`https://vajrang-b.github.io/bharatbazar/`)
- **Repository URL**: `https://github.com/vajrang-b/bharatbazar`
- **Tech Stack**: Pure HTML5, Vanilla CSS3 (Custom Design System), JavaScript (ES6+), Zero Heavy Framework Dependencies.
- **Dataset**: `product_names.json` (Contains 2,312 real product slugs extracted from Shopify Wayback Machine CDX API).

---

## 📁 Key File Structure

```
bharathbazar/
├── docs/                       # Production Web App (Hosted via GitHub Pages /docs)
│   ├── index.html              # Mobile SPA structure & bottom sticky navigation
│   ├── index.css               # Dark theme design system (Saffron #E65100 & Emerald #1B5E20)
│   ├── app.js                  # Modular UI application controller logic
│   ├── product_names.json      # Production JSON database of 2,312 product slugs
│   ├── multilingual_dictionary.csv # Decoupled regional language dictionary
│   └── store_aisles.json       # Decoupled store aisle & rack matrix configuration
├── scripts/                    # Automation & Scraping Tooling
│   ├── get_product_names.py    # Python Wayback Machine CDX API scraper script
│   └── scraper.py              # Extended product detail scraper
├── data/                       # Raw Data Artifacts & Backups
│   ├── product_names.txt       # Raw text file listing product slugs
│   └── bharathbazar_products.json # Sample product detail JSON dump
├── AGENTS.md                   # AI Agent architecture guide & reference
└── README.md                   # Project README & GitHub Pages deployment instructions
```

---

## 🌐 Multilingual Search Engine (`MULTILINGUAL_DICTIONARY`)

Customers and staff often search for products using Telugu or Hindi transliterations instead of exact English product names. The dictionary in `app.js` maps regional language terms directly to product keywords:

| English Keyword | Telugu Transliteration | Hindi Transliteration | Resolved Products |
| :--- | :--- | :--- | :--- |
| **Turmeric** | `Pasupu` (పసుపు) | `Haldi` (हल्दी) | Spices Aisle 1 (Turmeric Powder, Laxmi Haldi) |
| **Cumin** | `Jilakarra` (జిలకర) | `Jeera` (जीरा) | Spices Aisle 1 (Cumin Seeds, Jeera Powder) |
| **Coriander** | `Dhaniyalu` / `Kotthimera` | `Dhania` | Spices Aisle 1 (Coriander Seeds / Powder) |
| **Curd / Yogurt** | `Perugu` (పెరుగు) | `Dahi` (दही) | Dairy Aisle 5 & Frozen Aisle 3 |
| **Jaggery** | `Bellam` (బెల్లం) | `Gud` (गुड़) | Snacks & Sweets Aisle 4 |
| **Rice** | `Biyyam` (బియ్యం) | `Chawal` (चावल) | Grains & Atta Aisle 2 |
| **Ghee** | `Neyyi` (నెయ్యి) | `Ghee` (घी) | Dairy, Oils & Ghee Aisle 5 |

---

## 🏬 Store Layout Matrix (8 Aisles x 30 Racks)

Products are dynamically mapped across **8 Aisles**, each containing **30 Racks**:

1. **Aisle 1**: Spices & Masala (`🌶️`)
2. **Aisle 2**: Atta, Rice & Grains (`🌾`)
3. **Aisle 3**: Frozen Foods (`❄️`)
4. **Aisle 4**: Snacks & Sweets (`🍬`)
5. **Aisle 5**: Dairy, Oils & Ghee (`🧈`)
6. **Aisle 6**: Pickles, Sauces & Instant (`🫙`)
7. **Aisle 7**: Tea & Beverages (`☕`)
8. **Aisle 8**: Personal Care & Household (`🧼`)

---

## 🔒 Security PIN & Overrides

- Store staff can update any product's Aisle or Rack location.
- Security PIN: **`1234`** (configured in `app.js`).
- Overrides are persisted locally using browser `localStorage` under key `bharath_bazar_location_overrides`.

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
