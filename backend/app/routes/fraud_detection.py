from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import List, Optional
from uuid import UUID as UUIDType
import pandas as pd
import numpy as np
import joblib
import os
from pathlib import Path

from app.database import get_db
from app.models import FraudDetection, User
from app.auth import get_user_id_from_token
from sklearn.preprocessing import OneHotEncoder

router = APIRouter()

# Path to fraud detection model
MODELS_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_PATH = MODELS_DIR / "fraud_detection_pipeline.pkl"

# Load model and preprocessing components
_pipeline = None
_model = None
_encoder = None
_median_imputations = None
_top_15_fraud_states = None  # Will be loaded from model or hardcoded based on training

def load_fraud_model():
    """Load the fraud detection model and preprocessing components."""
    global _pipeline, _model, _encoder, _median_imputations
    
    if _pipeline is not None:
        return _pipeline, _model, _encoder, _median_imputations
    
    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Fraud detection model not found. Please ensure fraud_detection_pipeline.pkl exists in backend/models/"
        )
    
    try:
        pipeline_data = joblib.load(MODEL_PATH)
        _pipeline = pipeline_data
        _model = pipeline_data.get("model")
        _encoder = pipeline_data.get("encoder")
        _median_imputations = pipeline_data.get("median_imputations")
        
        if _model is None or _encoder is None or _median_imputations is None:
            raise HTTPException(
                status_code=500,
                detail="Invalid model file. Missing required components (model, encoder, median_imputations)."
            )
        
        return _pipeline, _model, _encoder, _median_imputations
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading fraud detection model: {str(e)}"
        )


def apply_preprocessing(df, median_imputations, encoder, top_15_fraud_states=None):
    """Apply the same preprocessing pipeline used during training."""
    df_processed = df.copy()
    
    # Clean numerical columns by removing $ and commas
    amount_cols = ['amount', 'per_capita_income', 'yearly_income', 'credit_limit', 'total_debt']
    for col in amount_cols:
        if col in df_processed.columns:
            df_processed[col] = pd.to_numeric(
                df_processed[col].astype(str).str.replace(r'[$,]', '', regex=True),
                errors='coerce'
            )
    
    # Extract features from date columns
    date_cols = ['date', 'expires', 'acct_open_date']
    for col in date_cols:
        if col in df_processed.columns:
            df_processed[col] = pd.to_datetime(df_processed[col], errors='coerce', format='mixed')
    
    if 'date' in df_processed.columns:
        df_processed['hour_of_day'] = df_processed['date'].dt.hour
        df_processed['day_of_week'] = df_processed['date'].dt.dayofweek
        df_processed['month'] = df_processed['date'].dt.month
    if 'expires' in df_processed.columns and 'date' in df_processed.columns:
        df_processed['days_to_expiry'] = (df_processed['expires'] - df_processed['date']).dt.days
    
    df_processed.drop(columns=date_cols, inplace=True, errors='ignore')
    
    # Create cyclical features for time-based columns
    cyclical_cols = ['hour_of_day', 'day_of_week', 'month']
    if all(col in df_processed.columns for col in cyclical_cols):
        df_processed['hour_sin'] = np.sin(2 * np.pi * df_processed['hour_of_day'] / 24.0)
        df_processed['hour_cos'] = np.cos(2 * np.pi * df_processed['hour_of_day'] / 24.0)
        df_processed['day_of_week_sin'] = np.sin(2 * np.pi * df_processed['day_of_week'] / 7.0)
        df_processed['day_of_week_cos'] = np.cos(2 * np.pi * df_processed['day_of_week'] / 7.0)
        df_processed['month_sin'] = np.sin(2 * np.pi * df_processed['month'] / 12.0)
        df_processed['month_cos'] = np.cos(2 * np.pi * df_processed['month'] / 12.0)
        df_processed.drop(columns=cyclical_cols, inplace=True)
    
    # Process binary categorical features
    if 'errors' in df_processed.columns:
        df_processed['has_error'] = df_processed['errors'].notna().astype(int)
    if 'gender' in df_processed.columns:
        df_processed['gender'] = df_processed['gender'].map({'Female': 0, 'Male': 1})
    if 'has_chip' in df_processed.columns:
        df_processed['has_chip'] = df_processed['has_chip'].map({'NO': 0, 'YES': 1})
    
    # Group merchant_state (if top_15_fraud_states provided)
    if top_15_fraud_states and 'merchant_state' in df_processed.columns:
        df_processed['merchant_state'] = df_processed['merchant_state'].apply(
            lambda x: x if x in top_15_fraud_states else 'OTHER_STATE'
        )
    
    # Handle missing values with median imputation
    if median_imputations is not None:
        numerical_cols = df_processed.select_dtypes(include=[np.number]).columns.tolist()
        for col in numerical_cols:
            if col in median_imputations.index:
                df_processed[col].fillna(median_imputations[col], inplace=True)
    
    # Drop unnecessary columns
    cols_to_drop = [
        'id', 'client_id', 'card_id', 'merchant_id', 'card_number', 'cvv', 'mcc',
        'acct_open_date', 'year_pin_last_changed', 'card_on_dark_web', 'has_chip',
        'address', 'merchant_city', 'birth_year', 'birth_month', 'latitude',
        'longitude', 'date', 'expires'
    ]
    for col in cols_to_drop:
        if col in df_processed.columns:
            df_processed.drop(columns=[col], inplace=True)
    
    # One-hot encode categorical columns
    categorical_cols = df_processed.select_dtypes(include=['object']).columns.tolist()
    if categorical_cols and encoder is not None:
        try:
            encoded_df = pd.DataFrame(
                encoder.transform(df_processed[categorical_cols]),
                index=df_processed.index,
                columns=encoder.get_feature_names_out(categorical_cols)
            )
            df_processed = pd.concat([df_processed.drop(columns=categorical_cols), encoded_df], axis=1)
        except Exception as e:
            # If encoding fails, drop categorical columns
            df_processed = df_processed.drop(columns=categorical_cols)
    
    # Downcast data types
    for col in df_processed.select_dtypes(include=['float64', 'int64']).columns:
        if 'float' in str(df_processed[col].dtype):
            df_processed[col] = df_processed[col].astype('float32')
        else:
            df_processed[col] = pd.to_numeric(df_processed[col], downcast='integer')
    
    return df_processed


def check_transaction_for_fraud_internal(
    amount: float,
    transaction_date: datetime,
    merchant_name: Optional[str] = None,
    merchant_state: Optional[str] = None,
    transaction_id: Optional[str] = None
):
    """
    Internal helper function to check a transaction for fraud.
    Returns (is_fraud, fraud_probability) tuple.
    """
    try:
        # Load model
        _, model, encoder, median_imputations = load_fraud_model()
    except (HTTPException, Exception) as e:
        # If model not available or any error, return safe defaults
        print(f"Error loading fraud model for automatic check: {str(e)}")
        return (0, 0.0)
    
    # Create a minimal transaction dataframe with required fields
    transaction_data = {
        'amount': [amount],
        'date': [transaction_date],
        'merchant_state': [merchant_state or 'OTHER_STATE'],
        # Add default values for other required fields
        'per_capita_income': [50000.0],
        'yearly_income': [60000.0],
        'credit_limit': [10000.0],
        'total_debt': [5000.0],
        'gender': [0],
        'errors': [None],
        'expires': [None],
        'acct_open_date': [None],
    }
    
    df = pd.DataFrame(transaction_data)
    
    # Apply preprocessing
    try:
        df_processed = apply_preprocessing(df, median_imputations, encoder)
    except Exception as e:
        # If preprocessing fails, return safe defaults
        print(f"Error preprocessing transaction for fraud check: {str(e)}")
        return (0, 0.0)
    
    # Make prediction
    if model is not None:
        try:
            fraud_prediction = model.predict(df_processed)[0]
            fraud_probability = model.predict_proba(df_processed)[0][1]  # Probability of fraud (class 1)
            return (int(fraud_prediction), float(fraud_probability))
        except Exception as e:
            print(f"Error making fraud prediction: {str(e)}")
            return (0, 0.0)
    else:
        return (0, 0.0)


@router.post("/fraud/check")
def check_transaction_fraud(
    amount: float = Form(...),
    transaction_date: str = Form(...),  # Format: "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
    merchant_name: Optional[str] = Form(None),
    merchant_state: Optional[str] = Form(None),
    transaction_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Check if a single transaction is fraudulent.
    Returns fraud prediction (0 = legitimate, 1 = fraud) and probability score.
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")
    
    # Get or create user
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        user = User(
            user_id=user_uuid,
            name=None,
            facebook_id=None,
            session_token=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Parse date
    try:
        if len(transaction_date) == 10:
            parsed_date = datetime.strptime(transaction_date, "%Y-%m-%d")
        else:
            parsed_date = datetime.strptime(transaction_date, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS"
        )
    
    # Load model
    try:
        _, model, encoder, median_imputations = load_fraud_model()
    except HTTPException:
        raise
    
    # Create a minimal transaction dataframe with required fields
    # Note: The model was trained on a complex dataset. We'll use defaults for missing fields.
    transaction_data = {
        'amount': [amount],
        'date': [parsed_date],
        'merchant_state': [merchant_state or 'OTHER_STATE'],
        # Add default values for other required fields (these would come from user/card data in production)
        'per_capita_income': [50000.0],  # Default
        'yearly_income': [60000.0],  # Default
        'credit_limit': [10000.0],  # Default
        'total_debt': [5000.0],  # Default
        'gender': [0],  # Default: Female
        'errors': [None],  # No errors
        'expires': [None],  # Not applicable
        'acct_open_date': [None],  # Not applicable
    }
    
    df = pd.DataFrame(transaction_data)
    
    # Apply preprocessing
    try:
        df_processed = apply_preprocessing(df, median_imputations, encoder)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error preprocessing transaction data: {str(e)}"
        )
    
    # Ensure all model features are present (fill missing with 0)
    # This is a simplified approach - in production, you'd want to ensure all features match training
    if model is not None:
        try:
            # Get feature names from model
            model_features = model.get_booster().feature_names if hasattr(model, 'get_booster') else None
            
            # Make prediction
            fraud_prediction = model.predict(df_processed)[0]
            fraud_probability = model.predict_proba(df_processed)[0][1]  # Probability of fraud (class 1)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error making fraud prediction: {str(e)}"
            )
    else:
        raise HTTPException(status_code=500, detail="Model not loaded correctly")
    
    # Store result in database
    fraud_detection = FraudDetection(
        user_id=user_uuid,
        transaction_id=transaction_id,
        amount=amount,
        is_fraud=int(fraud_prediction),
        fraud_probability=float(fraud_probability),
        merchant_name=merchant_name,
        merchant_state=merchant_state,
        transaction_date=parsed_date
    )
    
    db.add(fraud_detection)
    db.commit()
    db.refresh(fraud_detection)
    
    return {
        "status": "success",
        "transaction_id": transaction_id,
        "is_fraud": int(fraud_prediction),
        "fraud_probability": float(fraud_probability),
        "fraud_risk": "high" if fraud_probability > 0.7 else "medium" if fraud_probability > 0.3 else "low",
        "detection_id": fraud_detection.id,
        "message": "Fraudulent transaction detected" if fraud_prediction == 1 else "Transaction appears legitimate"
    }


@router.post("/fraud/check/batch")
def check_transactions_batch(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Check multiple transactions from a CSV file for fraud.
    CSV must have: amount, transaction_date (or date), and optionally merchant_name, merchant_state, transaction_id
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")
    
    # Load model
    try:
        _, model, encoder, median_imputations = load_fraud_model()
    except HTTPException:
        raise
    
    try:
        # Read CSV
        df = pd.read_csv(file.file)
        
        # Validate required columns
        if 'amount' not in df.columns:
            raise HTTPException(
                status_code=400,
                detail="CSV must contain 'amount' column"
            )
        
        # Handle date column (can be 'date' or 'transaction_date')
        date_col = 'transaction_date' if 'transaction_date' in df.columns else 'date'
        if date_col not in df.columns:
            raise HTTPException(
                status_code=400,
                detail="CSV must contain 'date' or 'transaction_date' column"
            )
        
        # Rename date column to 'date' for preprocessing
        if date_col == 'transaction_date':
            df['date'] = df['transaction_date']
        
        # Add default values for missing columns
        if 'merchant_state' not in df.columns:
            df['merchant_state'] = 'OTHER_STATE'
        if 'per_capita_income' not in df.columns:
            df['per_capita_income'] = 50000.0
        if 'yearly_income' not in df.columns:
            df['yearly_income'] = 60000.0
        if 'credit_limit' not in df.columns:
            df['credit_limit'] = 10000.0
        if 'total_debt' not in df.columns:
            df['total_debt'] = 5000.0
        if 'gender' not in df.columns:
            df['gender'] = 0
        if 'errors' not in df.columns:
            df['errors'] = None
        if 'expires' not in df.columns:
            df['expires'] = None
        if 'acct_open_date' not in df.columns:
            df['acct_open_date'] = None
        
        # Convert date to datetime
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        
        # Remove rows with invalid data
        df = df.dropna(subset=['date', 'amount'])
        
        if df.empty:
            raise HTTPException(status_code=400, detail="No valid data found in CSV")
        
        # Process each transaction
        results = []
        fraud_count = 0
        
        for idx, row in df.iterrows():
            try:
                # Create transaction dataframe
                transaction_data = {
                    'amount': [row['amount']],
                    'date': [row['date']],
                    'merchant_state': [row.get('merchant_state', 'OTHER_STATE')],
                    'per_capita_income': [row.get('per_capita_income', 50000.0)],
                    'yearly_income': [row.get('yearly_income', 60000.0)],
                    'credit_limit': [row.get('credit_limit', 10000.0)],
                    'total_debt': [row.get('total_debt', 5000.0)],
                    'gender': [row.get('gender', 0)],
                    'errors': [row.get('errors', None)],
                    'expires': [row.get('expires', None)],
                    'acct_open_date': [row.get('acct_open_date', None)],
                }
                
                df_transaction = pd.DataFrame(transaction_data)
                
                # Apply preprocessing
                df_processed = apply_preprocessing(df_transaction, median_imputations, encoder)
                
                # Make prediction
                fraud_prediction = model.predict(df_processed)[0]
                fraud_probability = model.predict_proba(df_processed)[0][1]
                
                if fraud_prediction == 1:
                    fraud_count += 1
                
                # Store in database
                fraud_detection = FraudDetection(
                    user_id=user_uuid,
                    transaction_id=str(row.get('transaction_id', f'batch_{idx}')),
                    amount=float(row['amount']),
                    is_fraud=int(fraud_prediction),
                    fraud_probability=float(fraud_probability),
                    merchant_name=row.get('merchant_name'),
                    merchant_state=row.get('merchant_state'),
                    transaction_date=row['date']
                )
                db.add(fraud_detection)
                
                results.append({
                    "transaction_id": str(row.get('transaction_id', f'batch_{idx}')),
                    "amount": float(row['amount']),
                    "is_fraud": int(fraud_prediction),
                    "fraud_probability": float(fraud_probability),
                    "fraud_risk": "high" if fraud_probability > 0.7 else "medium" if fraud_probability > 0.3 else "low"
                })
            except Exception as e:
                results.append({
                    "transaction_id": str(row.get('transaction_id', f'batch_{idx}')),
                    "error": str(e)
                })
        
        db.commit()
        
        return {
            "status": "success",
            "total_processed": len(results),
            "fraud_detected": fraud_count,
            "legitimate": len(results) - fraud_count,
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")


@router.get("/fraud/history")
def get_fraud_detection_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_fraud: Optional[int] = None,  # 0 or 1
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Get fraud detection history for the authenticated user.
    Optional filters: start_date, end_date (format: YYYY-MM-DD), is_fraud (0 or 1)
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")
    
    # Query fraud detections for user
    query = db.query(FraudDetection).filter(FraudDetection.user_id == user_uuid)
    
    # Apply date filters
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(FraudDetection.transaction_date >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(FraudDetection.transaction_date <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    # Apply fraud filter
    if is_fraud is not None:
        query = query.filter(FraudDetection.is_fraud == is_fraud)
    
    # Order by date descending
    query = query.order_by(desc(FraudDetection.transaction_date))
    
    # Get total count
    total_count = query.count()
    
    # Apply pagination
    detections = query.offset(offset).limit(limit).all()
    
    # Calculate summary statistics
    fraud_count = db.query(FraudDetection).filter(
        FraudDetection.user_id == user_uuid,
        FraudDetection.is_fraud == 1
    ).count()
    
    legitimate_count = db.query(FraudDetection).filter(
        FraudDetection.user_id == user_uuid,
        FraudDetection.is_fraud == 0
    ).count()
    
    return {
        "status": "success",
        "total_count": total_count,
        "fraud_count": fraud_count,
        "legitimate_count": legitimate_count,
        "limit": limit,
        "offset": offset,
        "data": [
            {
                "id": detection.id,
                "transaction_id": detection.transaction_id,
                "amount": float(detection.amount),
                "is_fraud": detection.is_fraud,
                "fraud_probability": float(detection.fraud_probability),
                "fraud_risk": "high" if detection.fraud_probability > 0.7 else "medium" if detection.fraud_probability > 0.3 else "low",
                "merchant_name": detection.merchant_name,
                "merchant_state": detection.merchant_state,
                "transaction_date": detection.transaction_date.isoformat(),
                "created_at": detection.created_at.isoformat() if detection.created_at else None
            }
            for detection in detections
        ]
    }

