"""
Migration script to add transaction_type column to existing financial_data table
Run this once to update existing tables with the new column
"""
from app.database import engine
from sqlalchemy import text

def migrate_add_transaction_type():
    """Add transaction_type column to financial_data table if it doesn't exist"""
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='financial_data' AND column_name='transaction_type'
        """))
        
        if result.fetchone():
            print("Column 'transaction_type' already exists. Migration not needed.")
            return
        
        # Add the column with default value
        conn.execute(text("""
            ALTER TABLE financial_data 
            ADD COLUMN transaction_type VARCHAR NOT NULL DEFAULT 'expense'
        """))
        
        # Create index
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_financial_data_transaction_type 
            ON financial_data(transaction_type)
        """))
        
        conn.commit()
        print("Successfully added 'transaction_type' column to financial_data table")

if __name__ == "__main__":
    migrate_add_transaction_type()



