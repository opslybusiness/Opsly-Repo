from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc, extract
from datetime import datetime
from typing import Optional
from uuid import UUID as UUIDType
import pandas as pd
import io
import pickle
import json
from pathlib import Path
import numpy as np

from app.database import get_db
from app.models import FinancialData, User
from app.auth import get_user_id_from_token
from app.routes.fraud_detection import check_transaction_for_fraud_internal

router = APIRouter()

# Model paths
MODELS_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_PATH = MODELS_DIR / "prophet_finance_model_latest.pkl"
METADATA_PATH = MODELS_DIR / "model_metadata_latest.json"

# Global model cache
_loaded_model = None
_model_metadata = None

def load_model():
    """Load the pre-trained Prophet model"""
    global _loaded_model, _model_metadata
    
    if _loaded_model is not None:
        return _loaded_model, _model_metadata
    
    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Model file not found at {MODEL_PATH}"
        )
    
    try:
        with open(MODEL_PATH, 'rb') as f:
            _loaded_model = pickle.load(f)
        
        if METADATA_PATH.exists():
            with open(METADATA_PATH, 'r') as f:
                _model_metadata = json.load(f)
        else:
            _model_metadata = {}
        
        print(f"✅ Model loaded from {MODEL_PATH}")
        return _loaded_model, _model_metadata
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading model: {str(e)}"
        )


@router.post("/finance/data")
def add_financial_data(
    date: str = Form(...),  # Format: "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
    amount: float = Form(...),
    category: Optional[str] = Form(None),  # Expense category
    use_chip: Optional[str] = Form(None),  # "Swipe Transaction" or "Online Transaction"
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Manually add a single expense entry.
    Required: date, amount
    Optional: category, use_chip
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")
    
    # Get or create user
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        # Auto-create user if they don't exist (they authenticated via Supabase)
        user = User(
            user_id=user_uuid,
            name=None,  # Can be updated later
            facebook_id=None,  # Can be updated when they connect Facebook
            session_token=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Validate amount (NUMERIC(15, 2) can store up to 999,999,999,999,999.99)
    max_amount = 999999999999999.99
    if abs(amount) > max_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Amount too large. Maximum allowed amount is {max_amount:,.2f}"
        )
    if abs(amount) <= 0:
        raise HTTPException(
            status_code=400,
            detail="Amount must be greater than 0"
        )

    # Parse date - supports multiple formats including datetime-local input (YYYY-MM-DDTHH:MM)
    try:
        if len(date) == 10:  # YYYY-MM-DD
            parsed_date = datetime.strptime(date, "%Y-%m-%d")
        elif 'T' in date:  # datetime-local format: YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS
            if len(date) == 16:  # YYYY-MM-DDTHH:MM
                parsed_date = datetime.strptime(date, "%Y-%m-%dT%H:%M")
            else:  # YYYY-MM-DDTHH:MM:SS
                parsed_date = datetime.strptime(date, "%Y-%m-%dT%H:%M:%S")
        else:  # YYYY-MM-DD HH:MM:SS
            parsed_date = datetime.strptime(date, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD, YYYY-MM-DDTHH:MM, or YYYY-MM-DD HH:MM:SS")

    # Validate use_chip if provided
    valid_use_chip = ["Swipe Transaction", "Chip Transaction", "Online Transaction"]
    if use_chip and use_chip not in valid_use_chip:
        raise HTTPException(
            status_code=400,
            detail=f"use_chip must be one of: {', '.join(valid_use_chip)}"
        )

    # Automatically check for fraud before creating entry
    is_fraud = None
    fraud_probability = None
    try:
        is_fraud, fraud_probability = check_transaction_for_fraud_internal(
            amount=abs(amount),
            transaction_date=parsed_date,
            use_chip=use_chip,
            category=category,
            user_uuid=user_uuid,
            db=db
        )
    except Exception as e:
        # If fraud check fails, continue anyway (don't fail the transaction)
        print(f"Error checking transaction for fraud: {str(e)}")

    # Create financial data entry with fraud detection results
    financial_entry = FinancialData(
        user_id=user_uuid,
        date=parsed_date,
        amount=abs(amount),
        category=category,
        use_chip=use_chip,
        transaction_type='expense',
        is_fraud=is_fraud,
        fraud_probability=fraud_probability
    )

    db.add(financial_entry)
    db.commit()
    db.refresh(financial_entry)

    # Determine fraud risk level
    fraud_risk = "low"
    if fraud_probability is not None:
        if fraud_probability > 0.7:
            fraud_risk = "high"
        elif fraud_probability > 0.3:
            fraud_risk = "medium"
    
    return {
        "status": "success",
        "message": "Expense added successfully",
        "data": {
            "id": financial_entry.id,
            "date": financial_entry.date.isoformat(),
            "amount": float(financial_entry.amount),
            "category": financial_entry.category,
            "use_chip": financial_entry.use_chip,
            "is_fraud": is_fraud,
            "fraud_probability": fraud_probability,
            "fraud_risk": fraud_risk
        }
    }


@router.post("/finance/data/upload")
def upload_financial_data_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Upload expense data from a CSV file.
    CSV should have columns: date, amount
    All entries will be treated as expenses.
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")
    
    # Get or create user
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        # Auto-create user if they don't exist (they authenticated via Supabase)
        user = User(
            user_id=user_uuid,
            name=None,  # Can be updated later
            facebook_id=None,  # Can be updated when they connect Facebook
            session_token=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    try:
        # Process CSV in chunks to handle large files efficiently
        CHUNK_SIZE = 10000  # Process 10k rows at a time
        BATCH_SIZE = 1000   # Insert 1k rows per database batch
        
        # Read the file content into memory first (for FastAPI UploadFile)
        # FastAPI's UploadFile might not support seek() properly
        file_content = file.file.read()
        file.file.seek(0)  # Try to reset anyway
        
        # Validate columns by reading first line
        import io
        file_stream = io.BytesIO(file_content)
        first_chunk = pd.read_csv(file_stream, nrows=1)
        
        # Validate required columns
        if 'date' not in first_chunk.columns or 'amount' not in first_chunk.columns:
            raise HTTPException(
                status_code=400, 
                detail=f"CSV must contain 'date' and 'amount' columns. Found columns: {list(first_chunk.columns)}"
            )
        
        # Optional columns: category, use_chip
        has_category = 'category' in first_chunk.columns
        has_use_chip = 'use_chip' in first_chunk.columns
        
        # Create a new stream for chunked reading
        file_stream = io.BytesIO(file_content)
        
        # Process in chunks
        added_count = 0
        fraud_detected_count = 0
        errors = []
        total_rows_processed = 0
        total_rows_read = 0
        max_amount = 999999999999999.99
        
        # For large files, skip fraud detection to speed up processing
        # You can make this configurable if needed
        skip_fraud_check = True  # Set to False if you want fraud checking (will be slower)
        
        print(f"Processing CSV in chunks of {CHUNK_SIZE} rows...")
        
        for chunk_num, chunk_df in enumerate(pd.read_csv(file_stream, chunksize=CHUNK_SIZE), 1):
            try:
                total_rows_read += len(chunk_df)
                
                # All entries are expenses
                chunk_df['transaction_type'] = 'expense'
                
                # Clean and process data
                initial_count = len(chunk_df)
                chunk_df['amount'] = chunk_df['amount'].astype(str).str.replace('$', '', regex=False)
                chunk_df['amount'] = pd.to_numeric(chunk_df['amount'], errors='coerce')
                chunk_df['date'] = pd.to_datetime(chunk_df['date'], errors='coerce')
                
                # Remove rows with invalid data
                before_dropna = len(chunk_df)
                chunk_df = chunk_df.dropna(subset=['date', 'amount'])
                after_dropna = len(chunk_df)
                
                if before_dropna != after_dropna and chunk_num == 1:
                    print(f"Chunk {chunk_num}: Dropped {before_dropna - after_dropna} rows with invalid date/amount")
                
                if chunk_df.empty:
                    if chunk_num == 1:
                        print(f"Chunk {chunk_num}: Empty after dropna - check your CSV format")
                    continue
                
                # Validate amounts
                invalid_amounts = chunk_df[chunk_df['amount'].abs() > max_amount]
                if not invalid_amounts.empty:
                    errors.append(f"Chunk {chunk_num}: Found {len(invalid_amounts)} rows with amounts exceeding maximum")
                    chunk_df = chunk_df[chunk_df['amount'].abs() <= max_amount]
                
                # Remove rows with zero amounts
                before_zero_filter = len(chunk_df)
                chunk_df = chunk_df[chunk_df['amount'].abs() > 0]
                after_zero_filter = len(chunk_df)
                
                if before_zero_filter != after_zero_filter and chunk_num == 1:
                    print(f"Chunk {chunk_num}: Dropped {before_zero_filter - after_zero_filter} rows with zero amounts")
                
                if chunk_df.empty:
                    if chunk_num == 1:
                        print(f"Chunk {chunk_num}: Empty after filtering - all rows were invalid")
                    continue
                
                # Prepare bulk insert data
                financial_entries = []
                
                for idx, row in chunk_df.iterrows():
                    try:
                        transaction_date = row['date'].to_pydatetime()
                        transaction_amount = abs(float(row['amount']))
                        
                        # Get optional fields
                        category = row.get('category') if has_category else None
                        use_chip = row.get('use_chip') if has_use_chip else None
                        
                        # Clean category and use_chip
                        if category and pd.notna(category):
                            category = str(category).strip()
                            if category == '':
                                category = None
                        else:
                            category = None
                        
                        if use_chip and pd.notna(use_chip):
                            use_chip = str(use_chip).strip()
                            if use_chip not in ["Swipe Transaction", "Chip Transaction", "Online Transaction"]:
                                use_chip = None
                        else:
                            use_chip = None
                        
                        # Fraud detection (optional, can be slow for large files)
                        is_fraud = None
                        fraud_probability = None
                        if not skip_fraud_check:
                            try:
                                is_fraud, fraud_probability = check_transaction_for_fraud_internal(
                                    amount=transaction_amount,
                                    transaction_date=transaction_date,
                                    use_chip=use_chip,
                                    category=category,
                                    user_uuid=user_uuid,
                                    db=db
                                )
                                
                                if is_fraud == 1:
                                    fraud_detected_count += 1
                            except Exception as e:
                                print(f"Error checking transaction for fraud: {str(e)}")
                        
                        # Create financial entry with fraud detection results
                        financial_entry = FinancialData(
                            user_id=user_uuid,
                            date=transaction_date,
                            amount=transaction_amount,
                            category=category,
                            use_chip=use_chip,
                            transaction_type='expense',
                            is_fraud=is_fraud,
                            fraud_probability=fraud_probability
                        )
                        financial_entries.append(financial_entry)
                        
                    except Exception as e:
                        errors.append(f"Chunk {chunk_num}, Row {idx}: {str(e)}")
                
                # Only proceed if we have entries to insert
                if not financial_entries:
                    if chunk_num == 1:
                        print(f"⚠️ Chunk {chunk_num}: No valid entries created after processing {len(chunk_df)} rows")
                        print(f"   Sample row: {chunk_df.iloc[0].to_dict() if len(chunk_df) > 0 else 'N/A'}")
                    elif chunk_num % 10 == 0:
                        print(f"Chunk {chunk_num}: No valid entries after filtering")
                    continue
                
                if chunk_num == 1:
                    print(f"✓ Chunk {chunk_num}: Created {len(financial_entries)} entries from {len(chunk_df)} rows")
                
                # Bulk insert financial entries in batches
                chunk_added = 0
                for i in range(0, len(financial_entries), BATCH_SIZE):
                    batch = financial_entries[i:i + BATCH_SIZE]
                    try:
                        for entry in batch:
                            db.add(entry)
                        db.flush()  # Flush to get IDs
                        chunk_added += len(batch)
                    except Exception as e:
                        db.rollback()
                        errors.append(f"Chunk {chunk_num}, Batch {i//BATCH_SIZE + 1}: {str(e)}")
                        print(f"Error inserting batch in chunk {chunk_num}: {str(e)}")
                        # Continue with next batch
                        continue
                
                # Commit after each chunk to avoid huge transactions
                try:
                    db.commit()
                    added_count += chunk_added
                    total_rows_processed += len(chunk_df)
                    
                    if chunk_num % 10 == 0:
                        print(f"Processed {chunk_num} chunks ({total_rows_processed:,} rows, {added_count:,} inserted)...")
                except Exception as e:
                    db.rollback()
                    errors.append(f"Chunk {chunk_num} commit failed: {str(e)}")
                    print(f"Error committing chunk {chunk_num}: {str(e)}")
                    # Continue with next chunk
                    continue
                
            except Exception as e:
                db.rollback()
                errors.append(f"Chunk {chunk_num}: {str(e)}")
                print(f"Error processing chunk {chunk_num}: {str(e)}")
                # Continue with next chunk
                continue

        print(f"\n📊 Upload Summary:")
        print(f"   Total rows read: {total_rows_read:,}")
        print(f"   Total rows processed: {total_rows_processed:,}")
        print(f"   Total rows inserted: {added_count:,}")
        print(f"   Errors: {len(errors)}")
        
        if added_count == 0 and total_rows_read > 0:
            print(f"\n⚠️ WARNING: Read {total_rows_read:,} rows but inserted 0!")
            print(f"   This usually means all rows were filtered out.")
            print(f"   Check: date format, amount format, or data validation")
            if errors:
                print(f"   First few errors: {errors[:5]}")
        
        return {
            "status": "success",
            "message": f"Successfully added {added_count} financial data entries",
            "added_count": added_count,
            "total_rows_read": total_rows_read,
            "total_rows_processed": total_rows_processed,
            "fraud_detected": fraud_detected_count,
            "errors": errors[:10] if errors else None,  # Limit errors in response
            "error_count": len(errors)
        }

    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")


@router.get("/finance/data")
def get_financial_data(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Get financial data for the authenticated user.
    Optional filters: 
    - start_date, end_date (format: YYYY-MM-DD)
    - month (1-12), year (YYYY) - filter by specific month/year
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")

    # Query financial data for user
    query = db.query(FinancialData).filter(FinancialData.user_id == user_uuid)

    # Apply month/year filter if provided
    if month is not None and year is not None:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
        # Filter by specific month/year
        query = query.filter(
            extract('year', FinancialData.date) == year,
            extract('month', FinancialData.date) == month
        )
    elif month is not None or year is not None:
        raise HTTPException(status_code=400, detail="Both month and year must be provided together")

    # Apply date filters (if not using month/year filter)
    if start_date and (month is None or year is None):
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(FinancialData.date >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")

    if end_date and (month is None or year is None):
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            # Include the entire end date
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(FinancialData.date <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")

    # Order by date descending
    query = query.order_by(desc(FinancialData.date))

    # Get total count
    total_count = query.count()

    # Apply pagination
    financial_data = query.offset(offset).limit(limit).all()

    return {
        "status": "success",
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "data": [
            {
                "id": entry.id,
                "date": entry.date.isoformat(),
                "amount": float(entry.amount),
                "category": entry.category,
                "use_chip": entry.use_chip,
                "created_at": entry.created_at.isoformat() if entry.created_at else None
            }
            for entry in financial_data
        ]
    }


@router.post("/finance/forecast")
def forecast_financial_data(
    days: int = Form(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Forecast expenses using the pre-trained Prophet model.
    Creates engineered features from: date, amount, category, use_chip
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")

    if days <= 0:
        raise HTTPException(status_code=400, detail="Days must be a positive integer")

    # Load the pre-trained model
    try:
        model, metadata = load_model()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading model: {str(e)}"
        )

    # Get all expense data for user
    financial_data = db.query(FinancialData).filter(
        FinancialData.user_id == user_uuid,
        FinancialData.transaction_type == 'expense'
    ).order_by(FinancialData.date).all()

    if not financial_data:
        raise HTTPException(
            status_code=400, 
            detail="No expense data found. Please add financial data first."
        )

    try:
        # Convert to DataFrame
        df = pd.DataFrame([
            {
                "date": entry.date,
                "amount": float(entry.amount),
                "category": entry.category or "Unknown",
                "use_chip": entry.use_chip or "Unknown"
            }
            for entry in financial_data
        ])

        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')

        # Group by month and aggregate
        monthly_df = df.groupby(pd.Grouper(key='date', freq='ME')).agg({
            'amount': ['sum', 'count', 'mean'],
            'category': lambda x: x.nunique(),  # Category diversity
            'use_chip': lambda x: (x == 'Online Transaction').sum()  # Online count
        }).reset_index()

        # Flatten column names
        monthly_df.columns = ['date', 'monthly_expense', 'transaction_count', 'avg_transaction_amount', 'category_diversity', 'online_transaction_count']
        
        # Calculate engineered features
        monthly_df['online_ratio'] = monthly_df['online_transaction_count'] / (monthly_df['transaction_count'] + 1e-6)
        
        # Temporal features
        monthly_df['month'] = monthly_df['date'].dt.month
        monthly_df['quarter'] = monthly_df['date'].dt.quarter
        monthly_df['year'] = monthly_df['date'].dt.year
        monthly_df['is_month_end'] = (monthly_df['date'].dt.day >= 28).astype(int)
        monthly_df['is_holiday_season'] = ((monthly_df['month'] == 11) | (monthly_df['month'] == 12)).astype(int)
        
        # Aggregates: Moving averages
        monthly_df['ma_3_month'] = monthly_df['monthly_expense'].rolling(window=3, min_periods=1).mean()
        monthly_df['ma_6_month'] = monthly_df['monthly_expense'].rolling(window=6, min_periods=1).mean()
        monthly_df['ma_12_month'] = monthly_df['monthly_expense'].rolling(window=12, min_periods=1).mean()
        monthly_df['transaction_count_ma3'] = monthly_df['transaction_count'].rolling(window=3, min_periods=1).mean()
        monthly_df['avg_transaction_ma3'] = monthly_df['avg_transaction_amount'].rolling(window=3, min_periods=1).mean()
        
        # Trends: Growth rates
        monthly_df['mom_growth'] = monthly_df['monthly_expense'].pct_change()
        monthly_df['mom_growth_3m_avg'] = monthly_df['mom_growth'].rolling(window=3, min_periods=1).mean()
        
        # Trends: Volatility
        monthly_df['volatility_3m'] = monthly_df['monthly_expense'].rolling(window=3, min_periods=1).std()
        
        # Recurring: Online ratio moving average
        monthly_df['online_ratio_ma3'] = monthly_df['online_ratio'].rolling(window=3, min_periods=1).mean()
        
        # Fill NaN values
        feature_cols = [col for col in monthly_df.columns if col not in ['date', 'monthly_expense']]
        for col in feature_cols:
            monthly_df[col] = monthly_df[col].ffill().bfill().fillna(0)

        # Prepare for Prophet
        prophet_df = monthly_df.rename(columns={
            "date": "ds",
            "monthly_expense": "y"
        })
        
        # Add index regressor (sequential month number)
        prophet_df['index'] = range(1, len(prophet_df) + 1)

        # Handle single month of data with simple forecast
        if len(prophet_df) < 2:
            print(f"⚠️ Only {len(prophet_df)} month(s) of data. Using simple average-based forecast.")
            
            # Get the single month's data
            monthly_avg = prophet_df['y'].iloc[0]
            last_date = prophet_df['ds'].max()
            
            # Convert to Timestamp if needed
            if not isinstance(last_date, pd.Timestamp):
                last_date = pd.to_datetime(last_date)
            
            # Generate future dates
            from pandas import DateOffset
            next_month_start = last_date.replace(day=1) + DateOffset(months=1)
            months_to_forecast = max(1, int(days / 30))
            
            future_dates = pd.date_range(
                start=next_month_start,
                periods=months_to_forecast,
                freq='ME'
            )
            
            # Simple forecast: use the single month's average for all future months
            forecast_results = []
            for date_val in future_dates:
                forecast_results.append({
                    "date": date_val.strftime("%Y-%m"),
                    "forecasted_amount": round(float(monthly_avg), 2),
                    "lower_bound": round(float(monthly_avg * 0.5), 2),  # 50% lower
                    "upper_bound": round(float(monthly_avg * 1.5), 2),  # 50% higher
                })
            
            return {
                "status": "success",
                "forecast_days": days,
                "forecast_months": months_to_forecast,
                "forecast": forecast_results,
                "summary": {
                    "total_predicted": round(float(monthly_avg * months_to_forecast), 2),
                    "average_monthly": round(float(monthly_avg), 2),
                    "min_monthly": round(float(monthly_avg), 2),
                    "max_monthly": round(float(monthly_avg), 2),
                    "historical_average": round(float(monthly_avg), 2),
                    "historical_max": round(float(monthly_avg), 2),
                    "historical_min": round(float(monthly_avg), 2),
                    "average_previous_monthly": round(float(monthly_avg), 2),
                    "note": "Forecast based on single month of data. Add more months for better predictions."
                }
            }

        # Convert days to months
        months_to_forecast = max(1, int(days / 30))
        
        # Get the last date from user's data (not from model's training data)
        last_user_date = prophet_df['ds'].max()
        print(f"📅 Last user data date: {last_user_date.strftime('%Y-%m-%d')}")
        
        # Create future dataframe starting from the month AFTER the user's last data
        # This ensures we forecast from the user's current data, not the model's old training data
        from pandas import DateOffset
        
        # Convert to Timestamp if needed
        if not isinstance(last_user_date, pd.Timestamp):
            last_user_date = pd.to_datetime(last_user_date)
        
        # Get the next month end date (ME = Month End frequency)
        # Start from first day of next month, then use ME to get month end
        next_month_start = last_user_date.replace(day=1) + DateOffset(months=1)
        
        # Generate future dates (month end dates) starting from next month
        future_dates = pd.date_range(
            start=next_month_start,
            periods=months_to_forecast,
            freq='ME'  # Month End - automatically gets last day of each month
        )
        
        # Create future dataframe with just dates
        future = pd.DataFrame({'ds': future_dates})
        
        print(f"📅 Forecasting from {future_dates[0].strftime('%Y-%m-%d')} for {months_to_forecast} months")
        print(f"   Future dates: {future_dates[0].strftime('%Y-%m')} to {future_dates[-1].strftime('%Y-%m')}")
        
        # Get regressors the model expects
        model_regressors = []
        if hasattr(model, 'extra_regressors') and model.extra_regressors:
            model_regressors = list(model.extra_regressors.keys())
        elif hasattr(model, 'regressors') and model.regressors:
            model_regressors = list(model.regressors)
        elif metadata and 'regressors' in metadata:
            model_regressors = metadata['regressors']
        
        # Add regressors for training period (following Example 4 logic)
        num_months = len(prophet_df)
        
        # For small datasets (< 24 months), the pre-trained model may still expect regressors
        # but we need to be very careful about how we populate them
        if model_regressors:
            print(f"📊 Model expects {len(model_regressors)} regressors for dataset with {num_months} months")
            
            # Ensure all required regressors exist in prophet_df
            for regressor in model_regressors:
                if regressor not in prophet_df.columns:
                    # Add missing regressor with default value
                    if regressor == 'index':
                        prophet_df[regressor] = range(1, len(prophet_df) + 1)
                    else:
                        prophet_df[regressor] = 0
            
            # Merge historical regressors for training period
            regressor_cols = [r for r in model_regressors if r in prophet_df.columns]
            if regressor_cols:
                future = future.merge(prophet_df[['ds'] + regressor_cols], on='ds', how='left')
            
            # Ensure all regressors are in future dataframe
            for regressor in model_regressors:
                if regressor not in future.columns:
                    future[regressor] = 0
            
            # For future periods, calculate regressors from historical patterns (Example 4 approach)
            last_date = prophet_df['ds'].max()
            future_period_mask = future['ds'] > last_date
            
            if future_period_mask.any():
                print(f"   Calculating regressors for {future_period_mask.sum()} future periods...")
                
                # Get last known values from training data (like Example 4)
                last_values = {}
                for regressor in model_regressors:
                    if regressor in prophet_df.columns:
                        last_values[regressor] = prophet_df[regressor].iloc[-1]
                    else:
                        last_values[regressor] = 0
                
                # Calculate each regressor for future periods (matching Example 4 logic)
                for idx in future[future_period_mask].index:
                    date_val = future.loc[idx, 'ds']
                    
                    for regressor in model_regressors:
                        # Index: sequential month number (continue from last)
                        if regressor == 'index':
                            last_index = last_values.get('index', len(prophet_df))
                            last_year = last_values.get('year', prophet_df.iloc[-1]['year'])
                            last_month = last_values.get('month', prophet_df.iloc[-1]['month'])
                            # Calculate months ahead
                            months_ahead = (date_val.year - last_year) * 12 + (date_val.month - last_month)
                            future.loc[idx, regressor] = last_index + months_ahead
                        # Temporal features: calculate from date
                        elif regressor == 'month':
                            future.loc[idx, regressor] = date_val.month
                        elif regressor == 'quarter':
                            future.loc[idx, regressor] = date_val.quarter
                        elif regressor == 'year':
                            future.loc[idx, regressor] = date_val.year
                        elif regressor == 'is_month_end':
                            future.loc[idx, regressor] = 1 if date_val.day >= 28 else 0
                        elif regressor == 'month_start_dow':
                            future.loc[idx, regressor] = date_val.dayofweek
                        elif regressor == 'is_holiday_season':
                            future.loc[idx, regressor] = 1 if date_val.month in [11, 12] else 0
                        elif regressor == 'is_year_end':
                            future.loc[idx, regressor] = 1 if date_val.month == 12 else 0
                        elif regressor == 'is_quarter_end':
                            future.loc[idx, regressor] = 1 if date_val.month in [3, 6, 9, 12] else 0
                        # Moving averages: use last calculated value (stabilizes)
                        elif 'ma_' in regressor or '_ma' in regressor:
                            future.loc[idx, regressor] = last_values.get(regressor, 0)
                        # Growth rates: use last known growth (assume continuation)
                        elif 'growth' in regressor or 'mom_' in regressor:
                            future.loc[idx, regressor] = last_values.get(regressor, 0)
                        # Volatility: use last known volatility
                        elif 'volatility' in regressor:
                            future.loc[idx, regressor] = last_values.get(regressor, 0)
                        # Ratios: use last known ratio
                        elif 'ratio' in regressor:
                            val = last_values.get(regressor, 0.5)
                            future.loc[idx, regressor] = val if not pd.isna(val) else 0.5
                        # Other features: use last known value
                        else:
                            val = last_values.get(regressor, 0)
                            future.loc[idx, regressor] = val if not pd.isna(val) else 0
                
                print(f"   ✓ Calculated all {len(model_regressors)} regressors for future periods")
            
            # CRITICAL: FINAL SAFETY CHECK (matching Example 4)
            print(f"\n   🔍 FINAL SAFETY CHECK before prediction:")
            print(f"      Model expects {len(model_regressors)} regressors")
            
            # Ensure ALL required regressors are present and non-NaN
            missing_count = 0
            nan_count_total = 0
            for regressor in model_regressors:
                if regressor not in future.columns:
                    missing_count += 1
                    # Use last known value from training data if available
                    if regressor in prophet_df.columns:
                        fill_val = prophet_df[regressor].iloc[-1]
                        if pd.isna(fill_val):
                            fill_val = 0.5 if 'ratio' in regressor else 0
                    else:
                        fill_val = 0.5 if 'ratio' in regressor else 0
                    future[regressor] = fill_val
                elif future[regressor].isna().any():
                    nan_count = future[regressor].isna().sum()
                    nan_count_total += nan_count
                    # Fill with last known value or default
                    if regressor in prophet_df.columns:
                        fill_val = prophet_df[regressor].iloc[-1]
                        if pd.isna(fill_val):
                            fill_val = 0.5 if 'ratio' in regressor else 0
                    else:
                        fill_val = 0.5 if 'ratio' in regressor else 0
                    future[regressor] = future[regressor].fillna(fill_val)
            
            if missing_count > 0:
                print(f"      ⚠ Added {missing_count} missing regressors with calculated values")
            if nan_count_total > 0:
                print(f"      ⚠ Filled {nan_count_total} NaN values with calculated values")
            
            print(f"      ✅ Safety check complete. All {len(model_regressors)} regressors present.")
        
        # Make prediction
        forecast = model.predict(future)

        # Get only the forecasted period
        forecast_period = forecast.tail(months_to_forecast)

        # Get historical statistics for validation
        historical_avg = prophet_df['y'].mean()
        historical_std = prophet_df['y'].std()
        historical_max = prophet_df['y'].max()
        historical_min = prophet_df['y'].min()
        historical_median = prophet_df['y'].median()
        
        # For small datasets, use MUCH more conservative capping
        num_months = len(prophet_df)
        recent_avg = prophet_df['y'].tail(min(3, len(prophet_df))).mean()  # Last 3 months or all
        
        # Calculate trend for small datasets
        use_trend_based = False
        trend = 0
        if num_months >= 3:
            recent_values = prophet_df['y'].tail(3).values
            trend = (recent_values[-1] - recent_values[0]) / 2  # Average monthly change
            
        if num_months < 6:
            # For very small datasets (3-5 months), use trend-based prediction instead of raw model
            use_trend_based = True
            max_multiplier = 1.2  # Only 20% above max
            min_multiplier = 0.8  # Only 20% below min
        elif num_months < 12:
            # Very conservative for small datasets
            max_multiplier = 1.3  # Only 30% increase
            min_multiplier = 0.6  # Allow 40% decrease
        elif num_months < 24:
            # Conservative for medium datasets
            max_multiplier = 2.0  # Allow 2x increase
            min_multiplier = 0.3  # Allow 70% decrease
        else:
            # Normal for large datasets
            max_multiplier = 3.0  # Allow 3x increase
            min_multiplier = 0.2  # Allow 80% decrease
        
        max_allowed = max(historical_max * max_multiplier, recent_avg * max_multiplier)
        min_allowed = min(historical_min * min_multiplier, recent_avg * min_multiplier)
        
        print(f"📊 Historical: avg=${historical_avg:,.2f}, max=${historical_max:,.2f}, min=${historical_min:,.2f}")
        print(f"   Recent avg (last 3): ${recent_avg:,.2f}, trend: ${trend:,.2f}/month")
        print(f"   Dataset: {num_months} months - Using {'trend-based' if use_trend_based else 'model'} prediction")
        print(f"   Capping: max=${max_allowed:,.2f}, min=${min_allowed:,.2f}")
        
        # Format response with validation
        forecast_results = []
        for i, (_, row) in enumerate(forecast_period.iterrows()):
            # Get raw predicted value
            raw_predicted = float(row['yhat'])
            raw_lower = float(row['yhat_lower'])
            raw_upper = float(row['yhat_upper'])
            
            # For very small datasets, use trend-based prediction
            if use_trend_based:
                # Project forward based on recent trend
                months_ahead = i + 1
                predicted = recent_avg + (trend * months_ahead)
                print(f"   Month {i+1}: Trend-based: ${predicted:,.2f} (model said: ${raw_predicted:,.2f})")
            else:
                predicted = raw_predicted
                
                # If negative, use recent average
                if predicted < 0:
                    print(f"   Month {i+1}: Negative! Using recent avg.")
                    predicted = recent_avg
                
                # Cap extreme outliers
                if predicted > max_allowed:
                    print(f"   Month {i+1}: Too high (${predicted:,.2f})! Capping to ${max_allowed:,.2f}")
                    predicted = max_allowed
                elif predicted < min_allowed:
                    print(f"   Month {i+1}: Too low (${predicted:,.2f})! Setting to ${min_allowed:,.2f}")
                    predicted = min_allowed
                
                # If still way off from recent trend, use trend-based instead
                if num_months >= 3 and abs(predicted - recent_avg) > recent_avg * 1.5:
                    predicted = recent_avg + trend
                    print(f"   Month {i+1}: Too far from trend! Using trend-based: ${predicted:,.2f}")
            
            # Final validation: ensure within bounds
            predicted = max(min_allowed, min(max_allowed, predicted))
            
            # Validate bounds
            lower = max(0, raw_lower) if raw_lower >= 0 else historical_avg * 0.5
            upper = min(raw_upper, historical_max * 3) if raw_upper < historical_max * 3 else historical_max * 3
            
            # Ensure bounds make sense relative to prediction
            if lower > predicted:
                lower = predicted * 0.5
            if upper < predicted:
                upper = predicted * 1.5
            
            # Format date as YYYY-MM for frontend compatibility
            # Frontend formatMonthLabel expects "YYYY-MM" format and appends '-01'
            date_val = row['ds']
            if pd.isna(date_val):
                # Skip if date is NaN (shouldn't happen, but safety check)
                continue
            
            # Convert to datetime and format as YYYY-MM (month format, not full date)
            if isinstance(date_val, pd.Timestamp):
                date_formatted = date_val.strftime("%Y-%m")
            elif hasattr(date_val, 'strftime'):
                date_formatted = date_val.strftime("%Y-%m")
            else:
                # Convert to datetime first
                date_formatted = pd.to_datetime(date_val).strftime("%Y-%m")
            
            forecast_results.append({
                "date": date_formatted,
                "forecasted_amount": round(predicted, 2),
                "lower_bound": round(lower, 2),
                "upper_bound": round(upper, 2)
            })

        # Calculate summary with validated values
        predicted_values = [r['forecasted_amount'] for r in forecast_results]
        summary = {
            "total_predicted": round(sum(predicted_values), 2),
            "average_monthly": round(sum(predicted_values) / len(predicted_values), 2),
            "min_monthly": round(min(predicted_values), 2),
            "max_monthly": round(max(predicted_values), 2),
            "historical_average": round(historical_avg, 2),
            "historical_max": round(historical_max, 2),
            "historical_min": round(historical_min, 2),
            "average_previous_monthly": round(historical_avg, 2)
        }

        return {
            "status": "success",
            "forecast_days": days,
            "forecast_months": months_to_forecast,
            "forecast": forecast_results,
            "summary": summary
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Forecast error: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error during forecasting: {str(e)}")
