"""
eventscout/storage/migrate_locations.py
======================================
Deterministic, idempotent migration script to normalize location metadata in MongoDB,
data/events.json, and frontend/public/fallback_events.json.

Safety Guarantees:
- Deterministic: Always produces identical output for identical input.
- Idempotent: Subsequent runs produce 0 modifications.
- Safe: Never deletes documents or invents non-existent locations.
- Dry-run by default: Only persists changes when --apply is passed.
"""

import argparse
import json
import logging
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Tuple

from pymongo import UpdateOne

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from eventscout.database.mongodb import EventDatabase
from eventscout.utils.location_utils import (
    classify_event_location,
    normalize_event_location,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MigrateLocations")


def plan_migration(docs: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Counter, Counter]:
    """
    Plans updates for documents requiring location normalization.
    Returns:
        (updates_list, before_cat_counter, after_cat_counter)
    """
    updates = []
    before_cats = Counter()
    after_cats = Counter()

    for doc in docs:
        old_cat = classify_event_location(doc)
        before_cats[old_cat] += 1

        norm = normalize_event_location(doc)

        new_doc = dict(doc)
        new_doc.update(norm)
        new_cat = classify_event_location(new_doc)
        after_cats[new_cat] += 1

        # Check if fields differ
        diff = {}
        for k in ("mode", "mode_location", "city", "country", "location"):
            old_val = doc.get(k)
            new_val = norm.get(k)
            if old_val != new_val:
                diff[k] = {"before": old_val, "after": new_val}

        if diff:
            updates.append({
                "_id": doc["_id"],
                "title": doc.get("title", "Untitled"),
                "source": doc.get("source", "unknown"),
                "diff": diff,
                "norm": norm,
                "old_cat": old_cat,
                "new_cat": new_cat,
            })

    return updates, before_cats, after_cats


def apply_mongo_migration(db: EventDatabase, updates: List[Dict[str, Any]]) -> int:
    """
    Executes idempotent bulk write operations to apply normalized fields to MongoDB.
    """
    if not updates:
        logger.info("No documents need updating in MongoDB.")
        return 0

    col = db.get_collection()
    operations = [
        UpdateOne(
            {"_id": u["_id"]},
            {"$set": u["norm"]},
        )
        for u in updates
    ]

    result = col.bulk_write(operations, ordered=False)
    logger.info("MongoDB migration applied: %d modified, %d matched.", result.modified_count, result.matched_count)
    return result.modified_count


def normalize_json_file(file_path: Path) -> int:
    """
    Normalizes location metadata in a JSON events array file.
    """
    if not file_path.exists():
        logger.warning("File %s does not exist, skipping.", file_path)
        return 0

    with open(file_path, "r", encoding="utf-8") as f:
        events = json.load(f)

    changed = 0
    normalized_events = []
    for ev in events:
        norm = normalize_event_location(ev)
        diff = any(ev.get(k) != norm.get(k) for k in ("mode", "mode_location", "city", "country", "location"))
        if diff:
            changed += 1
            ev.update(norm)
        normalized_events.append(ev)

    if changed > 0:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(normalized_events, f, indent=2, ensure_ascii=False)
        logger.info("Normalized %d/%d events in %s", changed, len(events), file_path)
    else:
        logger.info("All %d events in %s already normalized.", len(events), file_path)

    return changed


def main():
    parser = argparse.ArgumentParser(description="Deterministic location normalization migration for EventScout.")
    parser.add_argument("--apply", action="store_true", help="Persist changes to MongoDB and JSON files. Default is dry-run.")
    args = parser.parse_args()

    logger.info("Starting EventScout location normalization (%s mode)...", "APPLY" if args.apply else "DRY-RUN")

    db = EventDatabase()
    raw_docs = db.find_all()
    logger.info("Retrieved %d events from MongoDB.", len(raw_docs))

    updates, before_cats, after_cats = plan_migration(raw_docs)

    print("\n" + "=" * 70)
    print("LOCATION NORMALIZATION AUDIT")
    print("=" * 70)
    print(f"Total events analyzed: {len(raw_docs)}")
    print(f"Events requiring normalization: {len(updates)}")
    print("\n--- CATEGORY DISTRIBUTION ---")
    for cat in ["Hyderabad", "India", "USA", "Online", "Other"]:
        b_cnt = before_cats.get(cat, 0)
        a_cnt = after_cats.get(cat, 0)
        change_str = f"({'+' if a_cnt >= b_cnt else ''}{a_cnt - b_cnt})"
        print(f"  {cat:15s}: Before = {b_cnt:3d}  |  After = {a_cnt:3d}  {change_str}")

    print("\n--- SAMPLE MODIFICATIONS (Up to 15) ---")
    for i, u in enumerate(updates[:15]):
        print(f"\n[{i+1}] {u['title'][:55]} ({u['source']})")
        print(f"    Category: {u['old_cat']} -> {u['new_cat']}")
        for k, v in u["diff"].items():
            print(f"    {k:14s}: {repr(v['before'])} -> {repr(v['after'])}")

    if not args.apply:
        print("\n" + "=" * 70)
        print("DRY-RUN COMPLETE. No changes were written.")
        print("To persist these updates to MongoDB and JSON files, rerun with: --apply")
        print("=" * 70)
        return

    # Apply to MongoDB
    applied_count = apply_mongo_migration(db, updates)

    # Normalize JSON fallback files
    json_path1 = REPO_ROOT / "data" / "events.json"
    json_path2 = REPO_ROOT / "frontend" / "public" / "fallback_events.json"

    normalize_json_file(json_path1)
    normalize_json_file(json_path2)

    print("\n" + "=" * 70)
    print(f"MIGRATION APPLIED SUCCESSFULLY! {applied_count} records updated in MongoDB.")
    print("=" * 70)


if __name__ == "__main__":
    main()
