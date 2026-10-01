#!/usr/bin/env python3
"""
Bharath Bazar Google Sheets Live Sync
======================================
Syncs Google Workbook:
1. Sheet 1 (Product Catalog) -> docs/json/product_data.csv
2. Store Map (Aisles, Shelves, Racks, Ways) -> docs/json/store_map.json

Google Sheet:
  https://docs.google.com/spreadsheets/d/1FfX4peTRN4RwfAQabV1jbogbQXESOTauEVyQHjaGJhA/edit
"""

import os
import sys
import io
import csv
import re
import json
import zipfile
import urllib.request
import xml.etree.ElementTree as ET

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

SPREADSHEET_ID = "1FfX4peTRN4RwfAQabV1jbogbQXESOTauEVyQHjaGJhA"
DIRECT_EXPORT_CSV_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv"
DIRECT_EXPORT_XLSX_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=xlsx"
GVIZ_CSV_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
DOCS_DIR = os.path.join(PROJECT_ROOT, "docs")
JSON_DIR = os.path.join(DOCS_DIR, "json")
CSV_PATH = os.path.join(JSON_DIR, "product_data.csv")
STORE_MAP_JSON_PATH = os.path.join(JSON_DIR, "store_map.json")
WORKBOOK_CACHE_PATH = os.path.join(PROJECT_ROOT, "store_workbook.xlsx")

AISLE_METADATA = {
    "1": {"name": "Spices & Masala", "icon": "🌶️", "color": "#E65100", "orientation": "vertical"},
    "2": {"name": "Atta, Rice & Grains", "icon": "🌾", "color": "#2E7D32", "orientation": "vertical"},
    "3": {"name": "Frozen Foods", "icon": "❄️", "color": "#0288D1", "orientation": "vertical"},
    "4": {"name": "Snacks & Sweets", "icon": "🍬", "color": "#D81B60", "orientation": "vertical"},
    "5": {"name": "Dairy, Oils & Ghee", "icon": "🧈", "color": "#F57C00", "orientation": "perimeter"},
    "6": {"name": "Pickles, Sauces & Instant", "icon": "🫙", "color": "#8E24AA", "orientation": "perimeter"},
    "7": {"name": "Tea & Beverages", "icon": "☕", "color": "#00897B", "orientation": "horizontal"},
    "8": {"name": "Personal Care & Household", "icon": "🧼", "color": "#5E35B1", "orientation": "horizontal"},
}


def col2num(col):
    num = 0
    for c in col:
        num = num * 26 + (ord(c.upper()) - ord("A")) + 1
    return num


def num2col(num):
    col = ""
    while num > 0:
        num, remainder = divmod(num - 1, 26)
        col = chr(65 + remainder) + col
    return col


def download_workbook_bytes():
    print("📡 Downloading XLSX workbook from Google Sheets...")
    req = urllib.request.Request(DIRECT_EXPORT_XLSX_URL, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
            with open(WORKBOOK_CACHE_PATH, "wb") as f:
                f.write(data)
            print(f"📦 Successfully downloaded workbook ({len(data)} bytes).")
            return data
    except Exception as e:
        print(f"⚠️ Live XLSX download not available: {e}")
        if os.path.exists(WORKBOOK_CACHE_PATH):
            print("🔄 Using local cached workbook.")
            with open(WORKBOOK_CACHE_PATH, "rb") as f:
                return f.read()
        return None


def download_csv_fallback():
    print("📡 Falling back to direct CSV export...")
    for url in [DIRECT_EXPORT_CSV_URL, GVIZ_CSV_URL]:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="replace")
        except Exception as exc:
            print(f"⚠️ CSV Download failed for {url}: {exc}")
    return None


def parse_xlsx_workbook(wb_bytes):
    with zipfile.ZipFile(io.BytesIO(wb_bytes)) as z:
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            sst_xml = z.read("xl/sharedStrings.xml")
            sst_root = ET.fromstring(sst_xml)
            for si in sst_root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                text = "".join([t.text for t in si.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t") if t.text])
                shared_strings.append(text)

        wb_rels_xml = z.read("xl/_rels/workbook.xml.rels")
        rels_root = ET.fromstring(wb_rels_xml)
        rel_map = {r.attrib["Id"]: r.attrib["Target"] for r in rels_root}

        wb_xml = z.read("xl/workbook.xml")
        root = ET.fromstring(wb_xml)

        sheet_targets = {}
        for s in root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
            sname = s.attrib["name"]
            rid = s.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            sheet_targets[sname] = "xl/" + rel_map[rid]

        # 1. Parse Sheet1 -> CSV rows
        sheet1_target = sheet_targets.get("Sheet1")
        product_rows = []
        if sheet1_target:
            sheet_xml = z.read(sheet1_target)
            sroot = ET.fromstring(sheet_xml)
            for row in sroot.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
                cols = {}
                for c in row.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                    ref = c.attrib.get("r", "")
                    col_letter = "".join(filter(str.isalpha, ref))
                    t = c.attrib.get("t", "")
                    v = c.find(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                    val = ""
                    if v is not None and v.text is not None:
                        if t == "s":
                            val = shared_strings[int(v.text)]
                        else:
                            val = v.text
                    cols[col_letter] = val
                
                r_en = cols.get("A", "").strip()
                r_te = cols.get("B", "").strip()
                r_hi = cols.get("C", "").strip()
                r_kw = cols.get("D", "").strip()
                r_cat = cols.get("E", "").strip()
                r_aisle = cols.get("F", "").strip().replace(".0", "")
                r_rack = cols.get("G", "").strip().replace(".0", "")
                
                product_rows.append([r_en, r_te, r_hi, r_kw, r_cat, r_aisle, r_rack])

        # 2. Parse Store Map with Merged Cells
        store_map_target = sheet_targets.get("Store map")
        grid_data = {}
        merged_ranges = []
        if store_map_target:
            sheet_xml = z.read(store_map_target)
            sroot = ET.fromstring(sheet_xml)
            for row in sroot.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
                for c in row.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                    ref = c.attrib.get("r", "")
                    m = re.match(r"([A-Z]+)(\d+)", ref)
                    if m:
                        c_col, c_row = m.group(1), int(m.group(2))
                        c_num = col2num(c_col)
                        t = c.attrib.get("t", "")
                        v = c.find(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                        val = ""
                        if v is not None and v.text is not None:
                            if t == "s":
                                val = shared_strings[int(v.text)]
                            else:
                                val = v.text
                        if val.strip():
                            grid_data[(c_row, c_num)] = val.strip()

            def parse_ref_tuple(r_str):
                rm = re.match(r"([A-Z]+)(\d+)", r_str)
                return int(rm.group(2)), col2num(rm.group(1))

            for mc in sroot.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}mergeCell"):
                ref = mc.attrib.get("ref", "")
                if ":" in ref:
                    s_ref, e_ref = ref.split(":")
                    r1, c1 = parse_ref_tuple(s_ref)
                    r2, c2 = parse_ref_tuple(e_ref)
                    val = grid_data.get((r1, c1), "")
                    merged_ranges.append({
                        "ref": ref,
                        "startRef": s_ref,
                        "endRef": e_ref,
                        "minRow": r1,
                        "minCol": c1,
                        "maxRow": r2,
                        "maxCol": c2,
                        "value": val
                    })

        return product_rows, grid_data, merged_ranges


def process_store_map_grid(grid, merged_ranges):
    if not grid:
        return {}

    min_row = min(r for r, c in grid)
    max_row = max(r for r, c in grid)
    min_col = min(c for r, c in grid)
    max_col = max(c for r, c in grid)

    rack_lookup = {}
    walkways = []
    shelves_list = []
    walls = []
    
    aisles_data = {
        str(i): {
            **AISLE_METADATA.get(str(i), {}),
            "id": str(i),
            "racks": [],
            "shelves": {},
            "ways": [],
            "openAtBack": (str(i) in ["2", "3", "4"]),
            "openAtFront": True,
            "hasRampToAisles78": (str(i) == "4")
        } for i in range(1, 9)
    }

    # Vertical Aisles Specifications
    vertical_aisle_specs = {
        "1": {
            "name": "Spices & Masala",
            "left_rack_col": 52,    # Col AZ (Racks 31-61)
            "right_rack_col": 54,   # Col BB (Racks 31 down to 1)
            "left_shelf_col": 51,   # Col AY (Shelves 6-10)
            "right_shelf_col": 55,  # Col BC (Shelves 5-1)
            "center_way_col": 53,   # Col BA (Way BA6:BA33)
            "open_back": False,     # Walled off at back! Must enter/exit from front
            "open_front": True
        },
        "2": {
            "name": "Atta, Rice & Grains",
            "left_rack_col": 47,    # Col AU (Racks 31-61)
            "right_rack_col": 49,   # Col AW (Racks 31 down to 1)
            "left_shelf_col": 46,   # Col AT (Shelves 6-10)
            "right_shelf_col": 50,  # Col AX (Shelves 5-1)
            "center_way_col": 48,   # Col AV (Way AV6:AV33)
            "open_back": True,      # Connects to back walkway AM2:AX2
            "open_front": True
        },
        "3": {
            "name": "Frozen Foods",
            "left_rack_col": 42,    # Col AP (Racks 31-61)
            "right_rack_col": 44,   # Col AR (Racks 31 down to 1)
            "left_shelf_col": 41,   # Col AO (Shelves 6-10)
            "right_shelf_col": 45,  # Col AS (Shelves 5-1)
            "center_way_col": 43,   # Col AQ (Way AQ6:AQ33)
            "open_back": True,      # Connects to back walkway AM2:AX2
            "open_front": True
        },
        "4": {
            "name": "Snacks & Sweets",
            "left_rack_col": 37,    # Col AK (Racks 31-61)
            "right_rack_col": 39,   # Col AM (Racks 31 down to 1)
            "left_shelf_col": 36,   # Col AJ (Shelves 6-10)
            "right_shelf_col": 40,  # Col AN (Shelves 5-1)
            "left_ramp_col": 38,    # Col AL (Way AL2:AL33 connecting to Aisles 7 & 8)
            "open_back": True,      # Connects to back walkway AM2:AX2
            "open_front": True
        }
    }

    # Horizontal Aisles Specifications
    horizontal_aisle_specs = {
        "8": {
            "name": "Personal Care & Household",
            "top_shelf_row": 13,    # Shelves 5-1 (F13:K13, L13:Q13, R13:W13, X13:AC13, AD13:AI13)
            "top_rack_row": 14,     # Racks 31 down to 1 (Cols E..AI)
            "mid_way_row": 15,      # Walkway E15:AK15 (direct connection to Aisle 4 ramp)
            "bottom_rack_row": 16,  # Racks 32 to 62 (Cols D..AH)
            "bottom_shelf_row": 17, # Shelves 6-10 (E17:J17, K17:P17, Q17:V17, W17:AB17, AC17:AH17)
            "right_way_col": 35     # Col AI (AI16:AI19)
        },
        "7": {
            "name": "Tea & Beverages",
            "top_shelf_row": 18,    # Shelves 5-1 (E18:J18, K18:P18, Q18:V18, W18:AB18, AC18:AH18)
            "top_rack_row": 19,     # Racks 31 down to 1 (Cols D..AH)
            "mid_way_row": 20,      # Walkway E20:AI20
            "bottom_rack_row": 21,  # Racks 32 to 62 (Cols E..AI)
            "bottom_shelf_row": 22  # Shelves 6-10 (F22:K22, L22:Q22, R22:W22, X22:AC22, AD22:AI22)
        }
    }

    # The horizontal aisle rows above are hardcoded, so inserting any row above
    # them in the Store map sheet (e.g. the outer-wall row) silently shifts the
    # racks out from under the matcher and yields zero racks for aisles 7 & 8.
    # Re-anchor them off the "asile 7" / "asile 8" labels found in the grid.
    horizontal_anchor_baseline = {"8": 13, "7": 19}
    for a_id, baseline_row in horizontal_anchor_baseline.items():
        label_rows = [r for (r, c), v in grid.items()
                      if c <= 5 and re.fullmatch(r"a[is]+le\s*" + a_id, v.strip().lower())]
        if not label_rows:
            continue
        delta = min(label_rows) - baseline_row
        if delta:
            spec = horizontal_aisle_specs[a_id]
            for key in [k for k in spec if k.endswith("_row")]:
                spec[key] += delta
            print(f"ℹ️ Aisle {a_id} rows re-anchored by {delta:+d} (label at row {min(label_rows)})")

    # Shelf lookup from merged ranges
    shelf_merge_map = {}
    for mr in merged_ranges:
        val = mr["value"].strip()
        if "shelf" in val.lower():
            for r in range(mr["minRow"], mr["maxRow"] + 1):
                for c in range(mr["minCol"], mr["maxCol"] + 1):
                    shelf_merge_map[(r, c)] = val

    # Helper to resolve shelf
    def resolve_shelf(aisle_id, row, col, is_left_or_top):
        # Check direct merge lookup
        if (row, col) in shelf_merge_map:
            return shelf_merge_map[(row, col)]
        # Check adjacent shelf column/row
        if aisle_id in vertical_aisle_specs:
            spec = vertical_aisle_specs[aisle_id]
            sh_col = spec["left_shelf_col"] if is_left_or_top else spec["right_shelf_col"]
            if (row, sh_col) in shelf_merge_map:
                return shelf_merge_map[(row, sh_col)]
            if is_left_or_top:
                if row < 9: return "Shelf 6"
                elif row < 15: return "Shelf 7"
                elif row < 21: return "Shelf 8"
                elif row < 28: return "Shelf 9"
                else: return "Shelf 10"
            else:
                if row < 9: return "Shelf 5"
                elif row < 15: return "Shelf 4"
                elif row < 21: return "Shelf 3"
                elif row < 28: return "Shelf 2"
                else: return "Shelf 1"
        elif aisle_id in horizontal_aisle_specs:
            spec = horizontal_aisle_specs[aisle_id]
            sh_row = spec["top_shelf_row"] if is_left_or_top else spec["bottom_shelf_row"]
            if (sh_row, col) in shelf_merge_map:
                return shelf_merge_map[(sh_row, col)]
            if is_left_or_top:
                if col < 12: return "Shelf 5"
                elif col < 18: return "Shelf 4"
                elif col < 24: return "Shelf 3"
                elif col < 30: return "Shelf 2"
                else: return "Shelf 1"
            else:
                if col < 11: return "Shelf 6"
                elif col < 17: return "Shelf 7"
                elif col < 23: return "Shelf 8"
                elif col < 29: return "Shelf 9"
                else: return "Shelf 10"
        return "Shelf 1"

    # Process all cells
    raw_cells = []
    for (r, c), val in sorted(grid.items()):
        ref = f"{num2col(c)}{r}"
        cell_type = "unknown"
        norm_val = val
        aisle_id = None
        shelf_id = None
        rack_num = None

        if val.lower() == "way":
            cell_type = "way"
            norm_val = "Way"
            walkways.append({"row": r, "col": c, "ref": ref})
        elif val.lower() == "wall":
            cell_type = "wall"
            norm_val = "Wall"
            walls.append({"row": r, "col": c, "ref": ref})
        elif "shelf" in val.lower():
            cell_type = "shelf"
            shelves_list.append({"row": r, "col": c, "ref": ref, "name": val})
        elif "asile" in val.lower() or "aisle" in val.lower():
            cell_type = "aisle"
        elif "entrance" in val.lower():
            cell_type = "entrance"
        elif "pos" in val.lower() or "counter" in val.lower():
            cell_type = "checkout"
        elif val in ["1.0", "2.0", "3.0", "4.0", "5.0", "6.0", "7.0", "8.0"] and r == 1:
            cell_type = "aisle"
            norm_val = f"Aisle {int(float(val))}"
        else:
            clean_rack = val.lower().replace("rack", "").strip()
            try:
                f_rack = float(clean_rack)
                if f_rack.is_integer():
                    rack_num = int(f_rack)
                    cell_type = "rack"
                    norm_val = str(rack_num)
            except ValueError:
                pass

        # Vertical Aisles
        for a_id, spec in vertical_aisle_specs.items():
            if c in (spec["left_rack_col"], spec["right_rack_col"]):
                aisle_id = a_id
                if cell_type == "rack" and rack_num is not None:
                    is_left = (c == spec["left_rack_col"])
                    shelf_id = resolve_shelf(a_id, r, c, is_left)
                    side = "left" if is_left else "right"
                    rack_entry = {
                        "aisle": a_id,
                        "rack": rack_num,
                        "shelf": shelf_id,
                        "side": side,
                        "row": r,
                        "col": c,
                        "ref": ref
                    }
                    rack_lookup[f"{a_id}-{rack_num}"] = rack_entry
                    aisles_data[a_id]["racks"].append(rack_entry)
                    if shelf_id not in aisles_data[a_id]["shelves"]:
                        aisles_data[a_id]["shelves"][shelf_id] = []
                    if rack_num not in aisles_data[a_id]["shelves"][shelf_id]:
                        aisles_data[a_id]["shelves"][shelf_id].append(rack_num)

        # Horizontal Aisles
        for a_id, spec in horizontal_aisle_specs.items():
            if r in (spec["top_rack_row"], spec["bottom_rack_row"]) and c <= 35:
                aisle_id = a_id
                if cell_type == "rack" and rack_num is not None:
                    is_top = (r == spec["top_rack_row"])
                    shelf_id = resolve_shelf(a_id, r, c, is_top)
                    side = "top" if is_top else "bottom"
                    rack_entry = {
                        "aisle": a_id,
                        "rack": rack_num,
                        "shelf": shelf_id,
                        "side": side,
                        "row": r,
                        "col": c,
                        "ref": ref
                    }
                    rack_lookup[f"{a_id}-{rack_num}"] = rack_entry
                    aisles_data[a_id]["racks"].append(rack_entry)
                    if shelf_id not in aisles_data[a_id]["shelves"]:
                        aisles_data[a_id]["shelves"][shelf_id] = []
                    if rack_num not in aisles_data[a_id]["shelves"][shelf_id]:
                        aisles_data[a_id]["shelves"][shelf_id].append(rack_num)

        raw_cells.append({
            "row": r,
            "col": c,
            "colLetter": num2col(c),
            "ref": ref,
            "raw": val,
            "type": cell_type,
            "value": norm_val,
            "aisle": aisle_id,
            "shelf": shelf_id,
            "rack": rack_num
        })

    # Aisles 5 & 6 (Dairy & Pickles)
    for a_id in ["5", "6"]:
        if not aisles_data[a_id]["racks"]:
            for rk in range(1, 31):
                sh = f"Shelf {((rk - 1) // 3) + 1}"
                entry = {
                    "aisle": a_id,
                    "rack": rk,
                    "shelf": sh,
                    "side": "perimeter",
                    "row": 30 if a_id == "5" else 32,
                    "col": rk,
                    "ref": f"{num2col(rk)}{30 if a_id == '5' else 32}"
                }
                rack_lookup[f"{a_id}-{rk}"] = entry
                aisles_data[a_id]["racks"].append(entry)
                if sh not in aisles_data[a_id]["shelves"]:
                    aisles_data[a_id]["shelves"][sh] = []
                if rk not in aisles_data[a_id]["shelves"][sh]:
                    aisles_data[a_id]["shelves"][sh].append(rk)

    # Topology & Walkway Pathways
    walkway_network = {
        "mainFrontCorridor": {
            "name": "Main Front Walkway Corridor",
            "ref": "AL34:BA34",
            "connects": ["Main Entrance", "POS Counters", "Aisle 1 Front", "Aisle 2 Front", "Aisle 3 Front", "Aisle 4 Front"]
        },
        "backAislesCorridor": {
            "name": "Back Cross-Aisle Walkway",
            "ref": "AM2:AX2",
            "connects": ["Aisle 4 Back", "Aisle 3 Back", "Aisle 2 Back"],
            "note": "Aisle 1 is closed at back (walled off). Member in Aisle 1 must come to front to go to other aisles."
        },
        "aisle4RampToAisles78": {
            "name": "Aisle 4 Entrance Ramp to Aisles 7 & 8",
            "ref": "AL2:AL33 -> E15:AK15",
            "connects": ["Aisle 4", "Aisle 8 Middle Corridor", "Aisle 7 Middle Corridor"]
        },
        "aisle8Walkway": {
            "name": "Aisle 8 Walkway Corridor",
            "ref": "E15:AK15",
            "connects": ["Aisle 8 Racks", "Aisle 4 Ramp"]
        },
        "aisle7Walkway": {
            "name": "Aisle 7 Walkway Corridor",
            "ref": "E20:AI20",
            "connects": ["Aisle 7 Racks"]
        },
        "aisle1Walkway": {
            "name": "Aisle 1 Central Walkway",
            "ref": "BA6:BA33",
            "openAtFrontOnly": True
        },
        "aisle2Walkway": {
            "name": "Aisle 2 Central Walkway",
            "ref": "AV6:AV33",
            "openAtFrontAndBack": True
        },
        "aisle3Walkway": {
            "name": "Aisle 3 Central Walkway",
            "ref": "AQ6:AQ33",
            "openAtFrontAndBack": True
        },
        "mainEntrance": {
            "name": "Main Store Entrance",
            "ref": "AW39:AZ41",
            "location": "Front Right (facing Aisles 1 & 2)"
        },
        "posCounters": {
            "name": "POS Checkout Counters",
            "ref": "AJ35:AK41",
            "location": "Front Left (facing Aisle 4)"
        }
    }

    store_map_json = {
        "metadata": {
            "title": "Bharath Bazar Store Floorplan Map",
            "version": "2.1",
            "totalAisles": 8,
            "totalRacksMapped": len(rack_lookup),
            "mergedRangesCount": len(merged_ranges),
            "wallCellsMapped": len(walls),
            "dimensions": {
                "minRow": min_row,
                "maxRow": max_row,
                "minCol": min_col,
                "maxCol": max_col,
                "totalRows": max_row - min_row + 1,
                "totalCols": max_col - min_col + 1
            }
        },
        "topology": walkway_network,
        "mergedRanges": merged_ranges,
        "aisles": aisles_data,
        "rackLookup": rack_lookup,
        "walkways": walkways,
        "walls": walls,
        "shelves": shelves_list,
        "cells": raw_cells
    }

    return store_map_json


def main():
    print("🚀 Starting Bharath Bazar Google Workbook Sync...")
    wb_bytes = download_workbook_bytes()
    product_rows = []
    grid_data = {}
    merged_ranges = []

    if wb_bytes:
        try:
            product_rows, grid_data, merged_ranges = parse_xlsx_workbook(wb_bytes)
        except Exception as err:
            print(f"⚠️ Error parsing XLSX workbook: {err}")

    if not product_rows:
        csv_text = download_csv_fallback()
        if csv_text:
            reader = csv.reader(io.StringIO(csv_text))
            product_rows = list(reader)

    if not product_rows:
        raise RuntimeError("Failed to obtain product catalog data.")

    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        for r in product_rows:
            if r and any(r):
                writer.writerow(r)
    print(f"✅ Saved {len(product_rows)} rows to {CSV_PATH}")

    if grid_data:
        store_map = process_store_map_grid(grid_data, merged_ranges)
        with open(STORE_MAP_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(store_map, f, indent=2, ensure_ascii=False)
        print(f"✅ Saved Store Map ({len(store_map['rackLookup'])} racks mapped, {len(merged_ranges)} merged ranges) to {STORE_MAP_JSON_PATH}")
    else:
        print("⚠️ No Store map grid data parsed.")

    print("🎉 Google Workbook Sync completed successfully!")


if __name__ == "__main__":
    main()
