"""
Migration script to add Vapi voice-bot columns to the users table.
Run once: python -m app.migrate_add_vapi_columns
"""
from app.database import engine
from sqlalchemy import text


COLUMNS = [
    ("voice_bot_number",      "ALTER TABLE users ADD COLUMN voice_bot_number VARCHAR"),
    ("voice_bot_provider_sid","ALTER TABLE users ADD COLUMN voice_bot_provider_sid VARCHAR"),
    ("vapi_assistant_id",     "ALTER TABLE users ADD COLUMN vapi_assistant_id VARCHAR"),
    ("vapi_system_prompt",    "ALTER TABLE users ADD COLUMN vapi_system_prompt TEXT"),
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_users_voice_bot_number       ON users(voice_bot_number)",
    "CREATE INDEX IF NOT EXISTS ix_users_voice_bot_provider_sid ON users(voice_bot_provider_sid)",
    "CREATE INDEX IF NOT EXISTS ix_users_vapi_assistant_id      ON users(vapi_assistant_id)",
]


def migrate():
    with engine.connect() as conn:
        for col_name, alter_sql in COLUMNS:
            exists = conn.execute(text("""
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = :col
            """), {"col": col_name}).fetchone()

            if exists:
                print(f"  Column '{col_name}' already exists — skipping.")
            else:
                conn.execute(text(alter_sql))
                print(f"  Added column '{col_name}'.")

        for idx_sql in INDEXES:
            conn.execute(text(idx_sql))

        conn.commit()
        print("Migration complete.")


if __name__ == "__main__":
    migrate()
