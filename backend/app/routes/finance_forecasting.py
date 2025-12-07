from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID as UUIDType
import pandas as pd
import pickle
import os
from pathlib import Path

from app.database import get_db
from app.models import FinancialData, User
from app.auth import get_user_id_from_token

router = APIRouter()

# Path to store models
MODELS_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_PATH = MODELS_DIR / "prophet_model.pkl"


@router.post("/finance/data")
def add_financial_data(
    date: str,  # Format: "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
    amount: float,
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
    
    # Verify user exists
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

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
        amount=amount
    )

    db.add(financial_entry)
    db.commit()
    db.refresh(financial_entry)

    return {
        "status": "success",
        "message": "Financial data added successfully",
        "data": {
            "id": financial_entry.id,
            "date": financial_entry.date.isoformat(),
            "amount": float(financial_entry.amount)
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
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")
    
    # Verify user exists
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    try:
        # Read CSV
        df = pd.read_csv(file.file)
        
        # Validate required columns
        if 'date' not in df.columns or 'amount' not in df.columns:
            raise HTTPException(
                status_code=400, 
                detail="CSV must contain 'date' and 'amount' columns"
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

        # Insert data into database
        added_count = 0
        errors = []

        for _, row in df.iterrows():
            try:
                financial_entry = FinancialData(
                    user_id=user_uuid,
                    date=row['date'].to_pydatetime(),
                    amount=float(row['amount'])
                )
                db.add(financial_entry)
                added_count += 1
            except Exception as e:
                errors.append(f"Row {_ + 1}: {str(e)}")

        db.commit()

        return {
            "status": "success",
            "message": f"Successfully added {added_count} financial data entries",
            "added_count": added_count,
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
                "created_at": entry.created_at.isoformat() if entry.created_at else None
            }
            for entry in financial_data
        ]
    }


@router.post("/finance/forecast")
def forecast_financial_data(
    days: int,
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
                "amount": float(entry.amount)
            }
            for entry in financial_data
        ])

        # Sort by date
        df = df.sort_values('date')

        # Group by month and sum (matching the training script logic)
        df['date'] = pd.to_datetime(df['date'])
        monthly_df = df.groupby(pd.Grouper(key='date', freq='M'))['amount'].sum()
        monthly_df = monthly_df.to_frame(name='monthly_expense')

        # Prepare data for Prophet (needs 'ds' and 'y' columns)
        prophet_df = monthly_df.reset_index()
        prophet_df = prophet_df.rename(columns={
            "date": "ds",
            "monthly_expense": "y"
        })

        if len(prophet_df) < 2:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for forecasting. Need at least 2 months of data."
            )

        # Load the Prophet model
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)

        # Retrain model with current data (optional - you might want to just use the pre-trained model)
        # For now, we'll retrain to incorporate latest data
        model.fit(prophet_df)

        # Create future dates for forecasting
        # Since we're grouping by month, we need to forecast months, not days
        # Convert days to approximate months (assuming ~30 days per month)
        months_to_forecast = max(1, int(days / 30))
        future = model.make_future_dataframe(periods=months_to_forecast, freq="M")
        
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during forecasting: {str(e)}")


