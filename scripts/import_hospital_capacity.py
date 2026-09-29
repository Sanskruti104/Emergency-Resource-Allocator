#!/usr/bin/env python3
"""
Import Hospital Weekly Respiratory & Capacity Dataset (Kaggle Historical Data) into MongoDB.
Architecture: Kaggle CSV -> Transform -> MongoDB (hospital_capacity_benchmarks collection) -> Surge Benchmarks

Requirements:
- Validates capacity and date fields
- Null-safe type casting
- Idempotent upserts on { region, weekEndingDate }
- Reads MONGODB_URI from environment / .env.local
- Supports --dry-run
"""

import os
import sys
import argparse
import logging
from datetime import datetime
import pandas as pd
import numpy as np
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("CapacityImporter")

# Load environment configuration
load_dotenv(".env.local")

CSV_PATH = os.path.join("Datasets", "raw_weekly_hospital_respiratory_data_2020_2024.csv")
COLLECTION_NAME = "hospital_capacity_benchmarks"

def get_mongo_client(uri: str):
    try:
        from pymongo import MongoClient, UpdateOne
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        return client, UpdateOne
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        return None, None

def safe_float(val, default=0.0):
    if pd.isna(val) or val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    if pd.isna(val) or val is None or val == "":
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default

def transform_row(row: dict) -> dict:
    raw_date = str(row.get("Week Ending Date", "")).strip()
    if not raw_date:
        raise ValueError("Missing Week Ending Date")
    
    try:
        week_date = datetime.strptime(raw_date, "%Y-%m-%d")
    except Exception:
        week_date = datetime.fromisoformat(raw_date)

    region = str(row.get("Geographic aggregation", "")).strip().upper()
    if not region:
        raise ValueError("Missing Geographic aggregation (region)")

    total_inpatient = safe_int(row.get("Number of Inpatient Beds"))
    occupied_inpatient = safe_int(row.get("Number of Inpatient Beds Occupied"))
    total_icu = safe_int(row.get("Number of ICU Beds"))
    occupied_icu = safe_int(row.get("Number of ICU Beds Occupied"))

    inpatient_occ = safe_float(row.get("Percent Inpatient Beds Occupied"))
    icu_occ = safe_float(row.get("Percent ICU Beds Occupied"))

    covid_pts = safe_int(row.get("Total Patients Hospitalized with COVID-19"))
    flu_pts = safe_int(row.get("Total Patients Hospitalized with Influenza"))
    rsv_pts = safe_int(row.get("Total Patients Hospitalized with RSV"))

    doc = {
        "region": region,
        "weekEndingDate": week_date,
        "totalInpatientBeds": total_inpatient,
        "occupiedInpatientBeds": occupied_inpatient,
        "totalIcuBeds": total_icu,
        "occupiedIcuBeds": occupied_icu,
        "inpatientOccupancyRate": round(inpatient_occ, 4),
        "icuOccupancyRate": round(icu_occ, 4),
        "respiratorySurge": {
            "covid": covid_pts,
            "influenza": flu_pts,
            "rsv": rsv_pts,
            "totalRespiratory": covid_pts + flu_pts + rsv_pts
        },
        "reportingHospitals": {
            "inpatientReporting": safe_int(row.get("Number Hospitals Reporting Number of Inpatient Beds")),
            "icuReporting": safe_int(row.get("Number Hospitals Reporting Number of ICU Beds "))
        },
        "metadata": {
            "source": "kaggle_weekly_respiratory_2020_2024",
            "importedAt": datetime.utcnow()
        }
    }
    return doc

def import_capacity_data(dry_run: bool = False, batch_size: int = 2000):
    if not os.path.exists(CSV_PATH):
        logger.error(f"Capacity CSV not found at: {CSV_PATH}")
        sys.exit(1)

    logger.info(f"Reading Capacity dataset from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, low_memory=False)
    total_rows = len(df)
    logger.info(f"Loaded {total_rows} capacity records from CSV.")

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
            collection = db[COLLECTION_NAME]
            # Ensure compound unique index to prevent duplicate weeks per region
            collection.create_index([("region", 1), ("weekEndingDate", 1)], unique=True)
            collection.create_index("weekEndingDate")
            collection.create_index("icuOccupancyRate")
            logger.info(f"Verified MongoDB indexes for {COLLECTION_NAME}")

    valid_docs = []
    error_count = 0
    skipped_count = 0
    inserted_count = 0

    logger.info("Validating and transforming capacity records...")
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

    logger.info(f"Executing idempotent bulk upserts into MongoDB collection '{COLLECTION_NAME}'...")
    collection = db[COLLECTION_NAME]

    for i in range(0, len(valid_docs), batch_size):
        batch = valid_docs[i:i + batch_size]
        operations = [
            UpdateOne(
                {"region": doc["region"], "weekEndingDate": doc["weekEndingDate"]},
                {"$setOnInsert": doc},
                upsert=True
            )
            for doc in batch
        ]
        try:
            result = collection.bulk_write(operations, ordered=False)
            inserted_count += (result.upserted_count + result.inserted_count)
            skipped_count += (len(batch) - result.upserted_count - result.inserted_count)
            logger.info(f"Processed batch {i // batch_size + 1}: {len(batch)} items (Upserted: {result.upserted_count})")
        except Exception as e:
            logger.error(f"Bulk write error in batch {i // batch_size + 1}: {e}")
            error_count += len(batch)

    client.close()
    logger.info("=== Capacity Import Complete ===")
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
    parser = argparse.ArgumentParser(description="Import Hospital Capacity Benchmarks into MongoDB")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing to database")
    parser.add_argument("--batch-size", type=int, default=2000, help="Batch size for bulk write")
    args = parser.parse_args()

    import_capacity_data(dry_run=args.dry_run, batch_size=args.batch_size)
