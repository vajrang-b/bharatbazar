# 🛒 Bharath Bazar Mobile Store Locator

A sleek, mobile-first internal store locator web application for **Bharath Bazar**. Allows store customers and staff to search for over 2,300+ items using English, Telugu, or Hindi transliterations and immediately locate their exact Aisle (1–8) and Rack (1–30) position.

![GitHub Pages Hosted](https://img.shields.io/badge/Hosted-GitHub%20Pages-brightgreen)
![Mobile First](https://img.shields.io/badge/UI-Mobile%20First-orange)
![Multilingual](https://img.shields.io/badge/Languages-EN%20%7C%20TE%20%7C%20HI-blue)

---

## ✨ Features

- 📱 **Mobile-First App Interface**: Designed specifically for smartphone screens with bottom navigation.
- 🌐 **Multilingual Search Engine**: Search using English, Telugu (e.g. *Pasupu*, *Perugu*, *Biyyam*, *Bellam*), or Hindi (e.g. *Haldi*, *Dahi*, *Chawal*, *Jeera*) transliterations.
- 🗺️ **8 Aisles & 30 Racks Matrix**: Instant shelf floorplan visualization.
- ✨ **AI Store Navigator**: Natural language search query assistant.
- 📊 **Search Analytics & Staff PIN Override**: Track top searched items and update product locations (Default Staff PIN: `1234`).
- ⚡ **Zero Dependencies**: Pure HTML/CSS/JS ready for GitHub Pages hosting.

---

## 🌐 Live Demo & GitHub Pages Hosting

Hosted on GitHub Pages:
🔗 **https://vajrang-b.github.io/bharatbazar/**

Repository:
🐙 **https://github.com/vajrang-b/bharatbazar**

### 📁 Directory Structure & Deployment (`/docs`)

To keep developer scripts (`scripts/`) and raw data dumps (`data/`) separate from the production application, all web assets live inside the **`docs/`** directory:

- **`docs/`**: Production Web Application (`index.html`, `index.css`, `app.js`, `product_names.json`, `product_data.csv`, `store_aisles.json`).
- **`scripts/`**: Data extraction and python scraper scripts (`get_product_names.py`, `scraper.py`).
- **`data/`**: Raw product lists and backups (`product_names.txt`, `bharathbazar_products.json`).

#### Enabling GitHub Pages from `/docs`:
1. Go to **Settings** ➔ **Pages** in your GitHub repository.
2. Under **Build and deployment** ➔ **Branch**:
   - Select **`main`** branch
   - Select **`/docs`** folder
3. Click **Save**.
