"""
Migration: add Google OAuth columns to users.
Run once from backend folder: python -m app.migrate_add_google_columns
"""
from sqlalchemy import text

from app.database import engine

COLUMNS = [
    (
        "google_access_token",
        "ALTER TABLE users ADD COLUMN google_access_token TEXT",
    ),
    (
        "google_refresh_token",
        "ALTER TABLE users ADD COLUMN google_refresh_token TEXT",
    ),
    (
        "google_token_expires_at",
        "ALTER TABLE users ADD COLUMN google_token_expires_at TIMESTAMP WITH TIME ZONE",
    ),
    (
        "google_email",
        "ALTER TABLE users ADD COLUMN google_email VARCHAR(255)",
    ),
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_users_google_email ON users (google_email)",
]


def migrate():
    with engine.connect() as conn:
        for col_name, alter_sql in COLUMNS:
            exists = conn.execute(
                text(
                    """
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'users'
                      AND column_name = :col
                    """
                ),
                {"col": col_name},
            ).fetchone()

            if exists:
                print(f"  Column '{col_name}' already exists - skipping.")
            else:
                conn.execute(text(alter_sql))
                print(f"  Added column '{col_name}'.")

        for idx_sql in INDEXES:
            conn.execute(text(idx_sql))
            print(f"  Index applied: {idx_sql[:60]}...")

        conn.commit()
    print("Google columns migration complete.")


if __name__ == "__main__":
    migrate()
