from app.database import Base, engine
from app.models import User, FinancialData, FraudDetection  # Import all models

def create_tables():
    # Create all tables defined in models
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")
    print("Created tables: users, financial_data, fraud_detections")

if __name__ == "__main__":
    create_tables()
