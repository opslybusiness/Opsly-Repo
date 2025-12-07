from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID as UUIDType
import pandas as pd
import pickle
import os
from pathlib import Path
from prophet import Prophet

from app.database import get_db
from app.models import FinancialData, User, FraudDetection
from app.auth import get_user_id_from_token
from app.routes.fraud_detection import check_transaction_for_fraud_internal

router = APIRouter()

# Path to store models
MODELS_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_PATH = MODELS_DIR / "prophet_model.pkl"


@router.post("/finance/data")
def add_financial_data(
    date: str = Form(...),  # Format: "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
    amount: float = Form(...),
    transaction_type: str = Form('expense'),  # 'income' or 'expense', default to 'expense'
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Manually add a single financial data entry.
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

    # Validate transaction_type
    if transaction_type not in ['income', 'expense']:
        raise HTTPException(status_code=400, detail="transaction_type must be 'income' or 'expense'")

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

    # Parse date
    try:
        if len(date) == 10:  # YYYY-MM-DD
            parsed_date = datetime.strptime(date, "%Y-%m-%d")
        else:
            parsed_date = datetime.strptime(date, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS")

    # Create financial data entry
    financial_entry = FinancialData(
        user_id=user_uuid,
        date=parsed_date,
        amount=abs(amount),  # Store as positive, type indicates direction
        transaction_type=transaction_type
    )

    db.add(financial_entry)
    db.commit()
    db.refresh(financial_entry)

    # Automatically check for fraud
    try:
        is_fraud, fraud_probability = check_transaction_for_fraud_internal(
            amount=abs(amount),
            transaction_date=parsed_date,
            merchant_name=None,
            merchant_state=None,
            transaction_id=str(financial_entry.id)
        )
        
        # Store fraud detection result
        fraud_detection = FraudDetection(
            user_id=user_uuid,
            transaction_id=str(financial_entry.id),
            amount=abs(amount),
            is_fraud=is_fraud,
            fraud_probability=fraud_probability,
            merchant_name=None,
            merchant_state=None,
            transaction_date=parsed_date
        )
        db.add(fraud_detection)
        db.commit()
    except Exception as e:
        # If fraud check fails, continue anyway (don't fail the transaction)
        print(f"Error checking transaction for fraud: {str(e)}")

    return {
        "status": "success",
        "message": "Financial data added successfully",
        "data": {
            "id": financial_entry.id,
            "date": financial_entry.date.isoformat(),
            "amount": float(financial_entry.amount),
            "transaction_type": financial_entry.transaction_type
        }
    }


@router.post("/finance/data/upload")
def upload_financial_data_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Upload financial data from a CSV file.
    CSV should have columns: date, amount
    Optional column: transaction_type (income/expense, defaults to 'expense' if not provided)
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
        # Read CSV
        df = pd.read_csv(file.file)
        
        # Validate required columns
        if 'date' not in df.columns or 'amount' not in df.columns:
            raise HTTPException(
                status_code=400, 
                detail="CSV must contain 'date' and 'amount' columns. Optional: 'transaction_type' column (income/expense)"
            )
        
        # Handle transaction_type column (optional, defaults to 'expense')
        if 'transaction_type' not in df.columns:
            df['transaction_type'] = 'expense'  # Default to expense if not provided
        else:
            # Validate transaction_type values
            df['transaction_type'] = df['transaction_type'].str.lower().str.strip()
            invalid_types = df[~df['transaction_type'].isin(['income', 'expense'])]
            if not invalid_types.empty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid transaction_type values found. Must be 'income' or 'expense'. Found: {invalid_types['transaction_type'].unique().tolist()}"
                )

        # Clean and process data
        # Clean amount (remove $ signs, convert to numeric)
        df['amount'] = df['amount'].astype(str).str.replace('$', '', regex=False)
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
        
        # Convert date to datetime
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        
        # Remove rows with invalid data
        df = df.dropna(subset=['date', 'amount'])
        
        if df.empty:
            raise HTTPException(status_code=400, detail="No valid data found in CSV")
        
        # Validate amounts (NUMERIC(15, 2) can store up to 999,999,999,999,999.99)
        max_amount = 999999999999999.99
        invalid_amounts = df[df['amount'].abs() > max_amount]
        if not invalid_amounts.empty:
            raise HTTPException(
                status_code=400,
                detail=f"Found {len(invalid_amounts)} rows with amounts exceeding maximum allowed value of {max_amount:,.2f}. Please check your data."
            )
        
        # Remove rows with zero or negative amounts (after abs)
        df = df[df['amount'].abs() > 0]
        
        if df.empty:
            raise HTTPException(status_code=400, detail="No valid data found in CSV after validation")

        # Insert data into database and check for fraud
        added_count = 0
        fraud_detected_count = 0
        errors = []

        for _, row in df.iterrows():
            try:
                transaction_type = row.get('transaction_type', 'expense')
                if pd.isna(transaction_type):
                    transaction_type = 'expense'
                
                transaction_date = row['date'].to_pydatetime()
                transaction_amount = abs(float(row['amount']))
                
                financial_entry = FinancialData(
                    user_id=user_uuid,
                    date=transaction_date,
                    amount=transaction_amount,
                    transaction_type=str(transaction_type).lower()
                )
                db.add(financial_entry)
                db.flush()  # Flush to get the ID
                
                # Automatically check for fraud
                try:
                    merchant_name = row.get('merchant_name') if 'merchant_name' in row else None
                    merchant_state = row.get('merchant_state') if 'merchant_state' in row else None
                    
                    is_fraud, fraud_probability = check_transaction_for_fraud_internal(
                        amount=transaction_amount,
                        transaction_date=transaction_date,
                        merchant_name=merchant_name if not pd.isna(merchant_name) else None,
                        merchant_state=merchant_state if not pd.isna(merchant_state) else None,
                        transaction_id=str(financial_entry.id)
                    )
                    
                    if is_fraud == 1:
                        fraud_detected_count += 1
                    
                    # Store fraud detection result
                    fraud_detection = FraudDetection(
                        user_id=user_uuid,
                        transaction_id=str(financial_entry.id),
                        amount=transaction_amount,
                        is_fraud=is_fraud,
                        fraud_probability=fraud_probability,
                        merchant_name=merchant_name if not pd.isna(merchant_name) else None,
                        merchant_state=merchant_state if not pd.isna(merchant_state) else None,
                        transaction_date=transaction_date
                    )
                    db.add(fraud_detection)
                except Exception as e:
                    # If fraud check fails, continue anyway
                    print(f"Error checking transaction {financial_entry.id} for fraud: {str(e)}")
                
                added_count += 1
            except Exception as e:
                errors.append(f"Row {_ + 1}: {str(e)}")

        db.commit()

        return {
            "status": "success",
            "message": f"Successfully added {added_count} financial data entries",
            "added_count": added_count,
            "fraud_detected": fraud_detected_count,
            "errors": errors if errors else None
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
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Get financial data for the authenticated user.
    Optional filters: start_date, end_date (format: YYYY-MM-DD)
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")

    # Query financial data for user
    query = db.query(FinancialData).filter(FinancialData.user_id == user_uuid)

    # Apply date filters
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(FinancialData.date >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")

    if end_date:
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
                "transaction_type": entry.transaction_type,
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
    Forecast financial data using the Prophet model.
    Uses stored financial data for the authenticated user.
    Returns forecast for the specified number of days.
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")

    if days <= 0:
        raise HTTPException(status_code=400, detail="Days must be a positive integer")

    # Check if model exists
    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=404, 
            detail="Prophet model not found. Please train the model first."
        )

    # Get all financial data for user
    financial_data = db.query(FinancialData).filter(
        FinancialData.user_id == user_uuid
    ).order_by(FinancialData.date).all()

    if not financial_data:
        raise HTTPException(
            status_code=400, 
            detail="No financial data found. Please add financial data first."
        )

    try:
        # Convert to DataFrame
        df = pd.DataFrame([
            {
                "date": entry.date,
                "amount": float(entry.amount),
                "transaction_type": entry.transaction_type
            }
            for entry in financial_data
        ])

        # Sort by date
        df = df.sort_values('date')

        # Calculate net cash flow: income - expense
        # Income is positive, expense is negative
        df['net_amount'] = df.apply(
            lambda row: float(row['amount']) if row['transaction_type'] == 'income' else -float(row['amount']),
            axis=1
        )

        # Group by month and sum net cash flow
        df['date'] = pd.to_datetime(df['date'])
        monthly_df = df.groupby(pd.Grouper(key='date', freq='ME'))['net_amount'].sum()  # 'ME' = Month End
        monthly_df = monthly_df.to_frame(name='monthly_net_cash_flow')

        # Prepare data for Prophet (needs 'ds' and 'y' columns)
        prophet_df = monthly_df.reset_index()
        prophet_df = prophet_df.rename(columns={
            "date": "ds",
            "monthly_net_cash_flow": "y"
        })

        if len(prophet_df) < 2:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for forecasting. Need at least 2 months of data."
            )

        # Create a new Prophet model instance and fit with current data
        # Note: Prophet models can only be fit once, so we create a fresh instance each time
        # This ensures the model incorporates the latest financial data
        model = Prophet()
        model.fit(prophet_df)

        # Create future dates for forecasting
        # Since we're grouping by month, we need to forecast months, not days
        # Convert days to approximate months (assuming ~30 days per month)
        months_to_forecast = max(1, int(days / 30))
        future = model.make_future_dataframe(periods=months_to_forecast, freq="ME")  # 'ME' = Month End
        
        # Make prediction
        forecast = model.predict(future)

        # Get only the forecasted period (last N months)
        forecast_period = forecast.tail(months_to_forecast)

        # Format response
        forecast_results = []
        for _, row in forecast_period.iterrows():
            forecast_results.append({
                "date": row['ds'].strftime("%Y-%m-%d"),
                "forecasted_amount": round(float(row['yhat']), 2),
                "lower_bound": round(float(row['yhat_lower']), 2),
                "upper_bound": round(float(row['yhat_upper']), 2)
            })

        return {
            "status": "success",
            "forecast_days": days,
            "forecast_months": months_to_forecast,
            "forecast": forecast_results
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Forecast error: {error_trace}")  # Log full traceback for debugging
        raise HTTPException(status_code=500, detail=f"Error during forecasting: {str(e)}")


