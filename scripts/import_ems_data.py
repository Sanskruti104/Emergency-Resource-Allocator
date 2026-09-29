#!/usr/bin/env python3
"""
Import EMS Events Dataset (Kaggle Historical Incident Data) into MongoDB.
Architecture: Kaggle CSV -> Transform -> MongoDB (ems_events collection) -> Simulation Engine

Requirements:
- Validates every record before insert
- Safely handles malformed rows
- Idempotent upserts to prevent duplicates
- Never hardcodes credentials; reads MONGODB_URI from .env.local
- Supports --dry-run
"""

import os
import sys
import argparse
import logging
from datetime import datetime
import pandas as pd
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("EMSImporter")

# Load environment configuration
load_dotenv(".env.local")

CSV_PATH = os.path.join("Datasets", "ems_events_20000.csv")
COLLECTION_NAME = "ems_events"

def get_mongo_client(uri: str):
    try:
        from pymongo import MongoClient, UpdateOne
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        # Verify connection
        client.admin.command("ping")
        return client, UpdateOne
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        return None, None

def transform_row(row: dict) -> dict:
    """Validate and transform a raw CSV row into standard MongoDB document."""
    event_id = str(row.get("event_id", "")).strip()
    if not event_id:
        raise ValueError("Missing event_id")

    # Parse ISO timestamp
    raw_ts = str(row.get("timestamp", "")).strip()
    try:
        ts = datetime.fromisoformat(raw_ts)
    except Exception:
        ts = datetime.utcnow()

    # Vitals validation
    sbp = int(row.get("sbp", 0))
    hr = int(row.get("heart_rate", 0))
    spo2 = int(row.get("spo2", 0))
    gcs = int(row.get("gcs", 0))

    if sbp < 30 or sbp > 300:
        raise ValueError(f"Invalid SBP value: {sbp}")
    if hr < 20 or hr > 250:
        raise ValueError(f"Invalid heart rate: {hr}")

    condition = str(row.get("condition", "")).strip().lower()
    triage_priority = str(row.get("triage_priority", "")).strip().upper()

    doc = {
        "eventId": event_id,
        "timestamp": ts,
        "condition": condition,
        "chiefComplaint": str(row.get("chief_complaint", "")).strip(),
        "patient": {
            "age": int(row.get("age", 0)),
            "gender": str(row.get("gender", "unknown")).strip().lower()
        },
        "vitals": {
            "sbp": sbp,
            "heartRate": hr,
            "spo2": spo2,
            "gcs": gcs
        },
        "triagePriority": triage_priority,
        "targetHospitalType": str(row.get("hospital_type", "")).strip(),
        "benchmarkHospitalId": str(row.get("hospital_id", "")).strip(),
        "metadata": {
            "source": "kaggle_ems_events_20000",
            "importedAt": datetime.utcnow()
        }
    }
    return doc

def import_ems_data(dry_run: bool = False, batch_size: int = 2000):
    if not os.path.exists(CSV_PATH):
        logger.error(f"Dataset CSV not found at: {CSV_PATH}")
        sys.exit(1)

    logger.info(f"Reading EMS dataset from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    total_rows = len(df)
    logger.info(f"Loaded {total_rows} raw records from CSV.")

    mongo_uri = os.getenv("MONGODB_URI", "")
    if not mongo_uri or mongo_uri == "YOUR_MONGODB_URI":
        logger.warning("MONGODB_URI not configured. Forcing --dry-run mode.")
        dry_run = True

    client, UpdateOne = None, None
    db = None
    if not dry_run:
        client, UpdateOne = get_mongo_client(mongo_uri)
        if not client:
            logger.warning("Could not establish live MongoDB connection. Switching to dry-run mode.")
            dry_run = True
        else:
            try:
                db = client.get_default_database()
            except Exception:
                db = None
            if db is None:
                db = client["meddecision"]
            # Ensure indexes
            collection = db[COLLECTION_NAME]
            collection.create_index("eventId", unique=True)
            collection.create_index("triagePriority")
            collection.create_index("condition")
            collection.create_index("timestamp")
            logger.info(f"Verified MongoDB indexes for {COLLECTION_NAME}")

    valid_docs = []
    error_count = 0
    skipped_count = 0
    inserted_count = 0

    logger.info("Validating and transforming rows...")
    for idx, row in df.iterrows():
        try:
            doc = transform_row(row.to_dict())
            valid_docs.append(doc)
        except Exception as e:
            error_count += 1
            if error_count <= 5:
                logger.warning(f"Row {idx} malformed: {e}")

    logger.info(f"Validation summary: {len(valid_docs)} valid records, {error_count} malformed rows.")

    if dry_run:
        logger.info("[DRY RUN COMPLETE] No records were written to MongoDB.")
        logger.info(f"Summary: Total: {total_rows}, Valid: {len(valid_docs)}, Errors: {error_count}")
        return {
            "total": total_rows,
            "valid": len(valid_docs),
            "inserted": 0,
            "skipped": len(valid_docs),
            "errors": error_count,
            "dry_run": True
        }

    # Live Bulk Upsert in Batches
    logger.info(f"Executing idempotent bulk upserts into MongoDB collection '{COLLECTION_NAME}'...")
    collection = db[COLLECTION_NAME]

    for i in range(0, len(valid_docs), batch_size):
        batch = valid_docs[i:i + batch_size]
        operations = [
            UpdateOne(
                {"eventId": doc["eventId"]},
                {"$setOnInsert": doc},
                upsert=True
            )
            for doc in batch
        ]
        try:
            result = collection.bulk_write(operations, ordered=False)
            inserted_count += (result.upserted_count + result.inserted_count)
            # Existing records not modified
            skipped_count += (len(batch) - result.upserted_count - result.inserted_count)
            logger.info(f"Processed batch {i // batch_size + 1}: {len(batch)} items (Upserted: {result.upserted_count})")
        except Exception as e:
            logger.error(f"Bulk write error in batch {i // batch_size + 1}: {e}")
            error_count += len(batch)

    client.close()
    logger.info("=== Import Complete ===")
    logger.info(f"Total processed: {total_rows}")
    logger.info(f"Inserted / Upserted: {inserted_count}")
    logger.info(f"Skipped (Already existed): {skipped_count}")
    logger.info(f"Errors: {error_count}")

    return {
        "total": total_rows,
        "valid": len(valid_docs),
        "inserted": inserted_count,
        "skipped": skipped_count,
        "errors": error_count,
        "dry_run": False
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Kaggle EMS Events into MongoDB")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing to database")
    parser.add_argument("--batch-size", type=int, default=2000, help="Batch size for bulk write")
    args = parser.parse_args()

    import_ems_data(dry_run=args.dry_run, batch_size=args.batch_size)
