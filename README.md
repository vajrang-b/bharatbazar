# 🛒 Bharath Bazar Mobile Store Locator

A high-performance, mobile-first internal store locator and shopping assistant web application for **Bharath Bazar** supermarket. Allows store customers and staff to search for over 2,240+ products using English, Telugu, or Hindi transliterations and immediately visualize their exact Aisle (1–8) and Rack position on an interactive 2D store map with turn-by-turn shopping route optimization.

![GitHub Pages Hosted](https://img.shields.io/badge/Hosted-GitHub%20Pages-brightgreen)
![Mobile First](https://img.shields.io/badge/UI-Mobile%20First-orange)
![Multilingual](https://img.shields.io/badge/Languages-EN%20%7C%20TE%20%7C%20HI-blue)
![PWA Offline](https://img.shields.io/badge/PWA-Offline%20Ready-purple)

---

## ✨ Features

- 📱 **Mobile-First App Interface**: Ergonomically crafted for smartphone screens with slide-out navigation, quick filter pills, and bottom search bar.
- 🌐 **Multilingual Search Engine**: Search using English, Telugu (e.g. *Pasupu*, *Perugu*, *Biyyam*, *Bellam*), or Hindi (e.g. *Haldi*, *Dahi*, *Chawal*, *Jeera*) transliterations.
- 🗺️ **Interactive 2D Store Floorplan**: Real-time visual map mapping 428 individual racks across 8 Aisles, central walkways, POS checkouts, and entrance beacons.
- 🧭 **Shopping Route Optimizer**: Enter a shopping list to generate the most efficient turn-by-turn path through the store with zero backtracking and estimated trip duration.
- 🎨 **Visual 2D Map Studio & Editor**: Standalone WYSIWYG floorplan editor (`map-editor.html`) to drag, reposition, resize, and customize store aisles and facilities.
- ⚡ **Offline-Ready Progressive Web App (PWA)**: Full Service Worker caching (`sw.js`) and Web Manifest (`manifest.json`) for installation on mobile home screens.
- 🔄 **Live Google Sheets Catalog Sync**: Automated workflow (`sync_google_sheet.py`) syncing catalog updates and workbook floorplans directly from Google Sheets.
- 🔒 **Staff Location Overrides & PIN**: Store staff can update any product's Aisle or Rack location (Default Security PIN: `1234`).
- 🧭 **Deep Link & Hash Navigation**: Bookmarkable views (`#search`, `#map`, `#route`, `#ai`) with automatic state restoration across page refreshes.

---

## 📁 Repository Directory Structure

```
bharathbazar/
├── docs/                       # Production Web App (Hosted via GitHub Pages /docs)
│   ├── css/
│   │   └── index.css           # Dark theme design system (Saffron #E65100 & Emerald #1B5E20)
│   ├── scripts/
│   │   ├── app.js              # Core UI application controller & search engine
│   │   └── route-optimizer.js  # Shopping route optimizer algorithms
│   ├── json/
│   │   ├── product_data.csv    # 2,244 live products synced from Google Sheet
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

## 🌐 Multilingual Transliteration Engine

| English Keyword | Telugu Transliteration | Hindi Transliteration | Resolved Products |
| :--- | :--- | :--- | :--- |
| **Turmeric** | `Pasupu` (పసుపు) | `Haldi` (हल्दी) | Spices Aisle 1 (Turmeric Powder, Laxmi Haldi) |
| **Cumin** | `Jilakarra` (జిలకర) | `Jeera` (जीरा) | Spices Aisle 1 (Cumin Seeds, Jeera Powder) |
| **Coriander** | `Dhaniyalu` / `Kotthimera` | `Dhania` | Spices Aisle 1 (Coriander Seeds / Powder) |
| **Curd / Yogurt** | `Perugu` (పెరుగు) | `Dahi` (దही) | Dairy Aisle 5 & Frozen Aisle 3 |
| **Jaggery** | `Bellam` (బెల్లం) | `Gud` (गुड़) | Snacks & Sweets Aisle 4 |
| **Rice** | `Biyyam` (బియ్యం) | `Chawal` (चावल) | Grains & Atta Aisle 2 |
| **Ghee** | `Neyyi` (నెయ్యి) | `Ghee` (घी) | Dairy, Oils & Ghee Aisle 5 |

---

## 🏬 Store Layout Matrix (8 Aisles x 428 Racks)

1. **Aisle 1**: Spices & Masala (`🌶️`)
2. **Aisle 2**: Atta, Rice & Grains (`🌾`)
3. **Aisle 3**: Frozen Foods (`❄️`)
4. **Aisle 4**: Snacks & Sweets (`🍬`)
5. **Aisle 5**: Dairy, Oils & Ghee (`🧈`)
6. **Aisle 6**: Pickles, Sauces & Instant (`🫙`)
7. **Aisle 7**: Tea & Beverages (`☕`)
8. **Aisle 8**: Personal Care & Household (`🧼`)

---

## 🚀 GitHub Pages Deployment

1. Push all changes to GitHub:
   ```bash
   git add .
   git commit -m "Update store locator"
   git push origin main
   ```
2. Enable GitHub Pages:
   - Go to **Repository Settings** ➔ **Pages**.
   - Source: **Deploy from a branch**.
   - Branch: **`main`** / Folder: **`/docs`**.
   - Save.

Live Application: **https://vajrang-b.github.io/bharatbazar/**

---

## 👨‍💻 Developer & Credits

Site developed by **[qaiki.com](https://qaiki.com)**.
