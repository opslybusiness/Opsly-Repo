"""
Migration script to create the user_documents table for voice-bot file tracking.
Run once: python -m app.migrate_add_user_documents_table
"""
from app.database import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        exists = conn.execute(text("""
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'user_documents'
        """)).fetchone()

        if exists:
            print("Table 'user_documents' already exists — skipping.")
            return

        conn.execute(text("""
            CREATE TABLE user_documents (
                id            SERIAL PRIMARY KEY,
                user_id       UUID        NOT NULL,
                filename      VARCHAR     NOT NULL,
                storage_path  VARCHAR     NOT NULL,
                uploaded_at   TIMESTAMP   DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "CREATE INDEX ix_user_documents_user_id     ON user_documents(user_id)"
        ))
        conn.execute(text(
            "CREATE INDEX ix_user_documents_uploaded_at ON user_documents(uploaded_at)"
        ))
        conn.commit()
        print("Table 'user_documents' created successfully.")


if __name__ == "__main__":
    migrate()
