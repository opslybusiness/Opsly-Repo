"""
Migration script to create the fraud_detections table.
Run this script to add the fraud_detections table to your database.
"""
from app.database import engine, Base
from app.models import FraudDetection
from sqlalchemy import inspect

def migrate_add_fraud_detection():
    """Create the fraud_detections table if it doesn't exist."""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if 'fraud_detections' in existing_tables:
        print("Table 'fraud_detections' already exists. Skipping migration.")
        return
    
    print("Creating 'fraud_detections' table...")
    FraudDetection.__table__.create(bind=engine, checkfirst=True)
    print("Successfully created 'fraud_detections' table")

if __name__ == "__main__":
    migrate_add_fraud_detection()

