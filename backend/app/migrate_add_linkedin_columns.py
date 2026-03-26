"""
Migration: add LinkedIn OAuth / posting columns to users.
Run once from backend folder: python -m app.migrate_add_linkedin_columns
"""
from sqlalchemy import text

from app.database import engine

COLUMNS = [
    (
        "linkedin_access_token",
        "ALTER TABLE users ADD COLUMN linkedin_access_token TEXT",
    ),
    (
        "linkedin_refresh_token",
        "ALTER TABLE users ADD COLUMN linkedin_refresh_token TEXT",
    ),
    (
        "linkedin_token_expires_at",
        "ALTER TABLE users ADD COLUMN linkedin_token_expires_at TIMESTAMP WITH TIME ZONE",
    ),
    (
        "linkedin_person_id",
        "ALTER TABLE users ADD COLUMN linkedin_person_id VARCHAR(128)",
    ),
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_users_linkedin_person_id ON users (linkedin_person_id)",
]


def migrate():
    with engine.connect() as conn:
        for col_name, alter_sql in COLUMNS:
            exists = conn.execute(
                text("""
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'users'
                      AND column_name = :col
                """),
                {"col": col_name},
            ).fetchone()

            if exists:
                print(f"  Column '{col_name}' already exists — skipping.")
            else:
                conn.execute(text(alter_sql))
                print(f"  Added column '{col_name}'.")

        for idx_sql in INDEXES:
            conn.execute(text(idx_sql))
            print(f"  Index applied: {idx_sql[:60]}...")

        conn.commit()
    print("LinkedIn columns migration complete.")


if __name__ == "__main__":
    migrate()
