#!/usr/bin/env python3
"""
Database connection diagnostic script.
Run this to test if the DATABASE_URL is valid and can connect.
"""
import os
import sys
from dotenv import load_dotenv

# Load .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

print("=" * 60)
print("DATABASE CONNECTION TEST")
print("=" * 60)

# 1. Check if DATABASE_URL exists
if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not set in .env file")
    sys.exit(1)

print(f"✅ DATABASE_URL found")
print(f"   (Showing first 50 chars): {DATABASE_URL[:50]}...")

# 2. Validate URL format
if not DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgres://"):
    print("❌ ERROR: DATABASE_URL doesn't start with postgresql:// or postgres://")
    sys.exit(1)

print(f"✅ DATABASE_URL format looks valid")

# 3. Check for special characters that need encoding
special_chars = {
    '?': '%3F',
    '@': '%40 (in password only)',
    ':': '%3A (in password only)',
    '/': '%2F (in password only)',
    '#': '%23'
}

# Parse the URL to check password
try:
    from urllib.parse import urlparse
    parsed = urlparse(DATABASE_URL)
    print(f"\n📋 URL Components:")
    print(f"   Scheme: {parsed.scheme}")
    print(f"   User: {parsed.username}")
    print(f"   Host: {parsed.hostname}")
    print(f"   Port: {parsed.port}")
    print(f"   Database: {parsed.path}")
    
    # Check if password contains special chars
    if parsed.password:
        print(f"   Password: (hidden for security)")
        for char, encoding in special_chars.items():
            if char in parsed.password:
                print(f"   ⚠️  WARNING: Password contains '{char}' - should be '{encoding}'")
except Exception as e:
    print(f"⚠️  Could not parse URL: {e}")

# 4. Try to import and create engine
print("\n🔧 Attempting to create SQLAlchemy engine...")
try:
    from sqlalchemy import create_engine, text
    
    # Try with psycopg (sync driver)
    db_url = DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
    
    print(f"   Using driver: psycopg")
    print(f"   Modified URL: {db_url[:50]}...")
    
    engine = create_engine(db_url, pool_pre_ping=True, echo=False)
    print(f"✅ Engine created successfully")
    
except Exception as e:
    print(f"❌ Failed to create engine: {e}")
    print(f"   Error type: {type(e).__name__}")
    sys.exit(1)

# 5. Try to connect
print("\n🔗 Attempting to connect to database...")
try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"✅ Connection successful!")
        print(f"   Query result: {result.fetchone()}")
        
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print(f"   Error type: {type(e).__name__}")
    
    # Provide helpful hints
    if "could not resolve" in str(e).lower():
        print(f"   💡 Hint: Network issue - cannot reach host. Check firewall/VPN")
    elif "refused" in str(e).lower():
        print(f"   💡 Hint: Connection refused - host is not responding on that port")
    elif "authentication" in str(e).lower() or "password" in str(e).lower():
        print(f"   💡 Hint: Authentication failed - check username/password and special characters")
    elif "timeout" in str(e).lower():
        print(f"   💡 Hint: Connection timeout - check host address and network connectivity")
    
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED - Database connection is working!")
print("=" * 60)
