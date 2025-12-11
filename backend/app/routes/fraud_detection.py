from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime
from typing import Optional
from uuid import UUID as UUIDType
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb
from pathlib import Path

from app.database import get_db
from app.models import FinancialData, User, Category
from app.auth import get_user_id_from_token

router = APIRouter()

# Path to fraud detection model
MODELS_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_PATH = MODELS_DIR / "fraud_detection_pipeline.pkl"

# Global model cache
_model = None

# Fraud detection threshold (from model training)
FRAUD_THRESHOLD = 0.72

# Payment code mapping: use_chip -> payment_code
PAYMENT_CODE_MAP = {
    'Swipe Transaction': 1,
    'Chip Transaction': 2,
    'Online Transaction': 3
}
DEFAULT_PAYMENT_CODE = 1  # Default to Swipe if not specified


def load_fraud_model():
    """Load the XGBoost fraud detection model."""
    global _model
    
    if _model is not None:
        return _model
    
    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Fraud detection model not found. Please ensure fraud_detection_pipeline.pkl exists in backend/models/"
        )
    
    try:
        _model = joblib.load(MODEL_PATH)
        print(f"✅ Fraud model loaded: {type(_model)}")
        return _model
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading fraud detection model: {str(e)}"
        )


def get_mcc_simple_from_category(category_name: str, db: Session) -> int:
    """
    Get mcc_simple (MCC code % 100) from category name.
    Returns 0 if category not found or MCC code is not set.
    """
    if not category_name:
        return 0
    
    category = db.query(Category).filter(Category.name == category_name).first()
    if category and category.mcc_code:
        try:
            mcc_code = int(category.mcc_code)
            # Use modulo 100 to get simplified MCC code
            return mcc_code % 100
        except (ValueError, TypeError):
            return 0
    return 0


def get_payment_code_from_use_chip(use_chip: str) -> int:
    """
    Convert use_chip string to payment_code integer.
    'Swipe Transaction': 1
    'Chip Transaction': 2
    'Online Transaction': 3
    """
    if not use_chip:
        return DEFAULT_PAYMENT_CODE
    return PAYMENT_CODE_MAP.get(use_chip, DEFAULT_PAYMENT_CODE)


def calculate_engineered_features(
    user_uuid: UUIDType,
    amount_log: float,
    hour: int,
    mcc_simple: int,
    transaction_date: datetime,
    db: Session
) -> dict:
    """
    Calculate engineered features for fraud detection using FinancialData table.
    
    Engineered inputs:
    - hours_since_last_tx (float64): Hours since user's last transaction
    - client_total_tx (int64): Total number of transactions by user
    - amount_zscore (float64): Z-score of amount relative to user's history
    - mcc_rarity (float64): Rarity score of MCC code (0-1)
    - is_unusual_hour (int64): 1 if hour is unusual (22-5), 0 otherwise
    """
    # Get user's transaction history from finance_data table
    user_history = db.query(FinancialData).filter(
        FinancialData.user_id == user_uuid,
        FinancialData.date < transaction_date
    ).order_by(desc(FinancialData.date)).all()
    
    # 1. hours_since_last_tx
    if user_history:
        last_tx = user_history[0]
        time_diff = transaction_date - last_tx.date
        hours_since_last_tx = time_diff.total_seconds() / 3600.0
    else:
        # Default for first transaction (24 hours as a reasonable default)
        hours_since_last_tx = 24.0
    
    # 2. client_total_tx
    client_total_tx = len(user_history)
    
    # 3. amount_zscore (use abs() to match training)
    if user_history and len(user_history) >= 2:
        amounts = [float(tx.amount) for tx in user_history]
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        if std_amount > 0:
            # Convert from log back to amount for comparison (using expm1 for log1p inverse)
            current_amount = np.expm1(amount_log)
            amount_zscore = abs((current_amount - mean_amount) / std_amount)
        else:
            amount_zscore = 0.0
    else:
        # Default for new users or insufficient history
        amount_zscore = 0.0
    
    # 4. mcc_rarity - Calculate based on frequency in all transactions
    # Get all categories and their counts
    total_tx_count = db.query(func.count(FinancialData.id)).scalar() or 1
    
    # Count transactions with same MCC code (by looking up category)
    # For simplicity, we'll use the mcc_simple directly
    if mcc_simple > 0:
        # Find categories with this MCC code
        categories_with_mcc = db.query(Category.name).filter(Category.mcc_code == str(mcc_simple)).all()
        category_names = [c[0] for c in categories_with_mcc]
        
        if category_names:
            mcc_count = db.query(func.count(FinancialData.id)).filter(
                FinancialData.category.in_(category_names)
            ).scalar() or 0
        else:
            mcc_count = 0
    else:
        mcc_count = db.query(func.count(FinancialData.id)).filter(
            FinancialData.category.is_(None)
        ).scalar() or 0
    
    # mcc_rarity = frequency (how common this merchant type is, matching training)
    mcc_frequency = mcc_count / total_tx_count
    mcc_rarity = mcc_frequency
    
    # 5. is_unusual_hour (early morning: 00:00 - 05:00, matching training)
    is_unusual_hour = 1 if (hour >= 0 and hour <= 5) else 0
    
    return {
        'hours_since_last_tx': float(hours_since_last_tx),
        'client_total_tx': int(client_total_tx),
        'amount_zscore': float(amount_zscore),
        'mcc_rarity': float(mcc_rarity),
        'is_unusual_hour': int(is_unusual_hour)
    }


def prepare_features_for_prediction(
    amount_log: float,
    hour: int,
    is_weekend: int,
    payment_code: int,
    mcc_simple: int,
    engineered_features: dict
) -> pd.DataFrame:
    """
    Prepare all 10 features in the correct order for model prediction.
    
    Feature order:
    1. amount_log (float64)
    2. hour (int32)
    3. is_weekend (int64)
    4. payment_code (int64)
    5. mcc_simple (int64)
    6. hours_since_last_tx (float64)
    7. client_total_tx (int64)
    8. amount_zscore (float64)
    9. mcc_rarity (float64)
    10. is_unusual_hour (int64)
    """
    feature_data = {
        'amount_log': [np.float64(amount_log)],
        'hour': [np.int32(hour)],
        'is_weekend': [np.int64(is_weekend)],
        'payment_code': [np.int64(payment_code)],
        'mcc_simple': [np.int64(mcc_simple)],
        'hours_since_last_tx': [np.float64(engineered_features['hours_since_last_tx'])],
        'client_total_tx': [np.int64(engineered_features['client_total_tx'])],
        'amount_zscore': [np.float64(engineered_features['amount_zscore'])],
        'mcc_rarity': [np.float64(engineered_features['mcc_rarity'])],
        'is_unusual_hour': [np.int64(engineered_features['is_unusual_hour'])]
    }
    
    return pd.DataFrame(feature_data)


def check_transaction_for_fraud_internal(
    amount: float,
    transaction_date: datetime,
    use_chip: Optional[str],
    category: Optional[str],
    user_uuid: UUIDType,
    db: Session
) -> tuple:
    """
    Internal helper function to check a transaction for fraud using XGBoost model.
    Derives payment_code from use_chip and mcc_simple from category.
    Returns (is_fraud, fraud_probability) tuple.
    """
    try:
        model = load_fraud_model()
    except (HTTPException, Exception) as e:
        print(f"❌ Error loading fraud model: {str(e)}")
        return (0, 0.0)
    
    try:
        # Calculate derived values using np.log1p for consistency with training
        amount_log = np.log1p(abs(amount))
        hour = transaction_date.hour
        day_of_week = transaction_date.weekday()
        is_weekend = 1 if day_of_week >= 5 else 0  # Saturday=5, Sunday=6
        
        # Get payment_code from use_chip
        payment_code = get_payment_code_from_use_chip(use_chip)
        
        # Get mcc_simple from category (uses % 100)
        mcc_simple = get_mcc_simple_from_category(category, db)
        
        # Calculate engineered features
        engineered_features = calculate_engineered_features(
            user_uuid=user_uuid,
            amount_log=amount_log,
            hour=hour,
            mcc_simple=mcc_simple,
            transaction_date=transaction_date,
            db=db
        )
        
        # Prepare features DataFrame with correct column order
        features = pd.DataFrame([[
            amount_log,
            hour,
            is_weekend,
            payment_code,
            mcc_simple,
            engineered_features['hours_since_last_tx'],
            engineered_features['client_total_tx'],
            engineered_features['amount_zscore'],
            engineered_features['mcc_rarity'],
            engineered_features['is_unusual_hour']
        ]], columns=[
            'amount_log', 'hour', 'is_weekend', 'payment_code', 'mcc_simple',
            'hours_since_last_tx', 'client_total_tx', 'amount_zscore',
            'mcc_rarity', 'is_unusual_hour'
        ])
        
        # Convert to XGBoost DMatrix for prediction
        dmatrix = xgb.DMatrix(features)
        
        # Get fraud probability from XGBoost model
        fraud_probability = float(model.predict(dmatrix)[0])
        
        # Apply threshold (0.72 from training)
        is_fraud = 1 if fraud_probability > FRAUD_THRESHOLD else 0
        
        print(f"✅ Fraud check: prob={fraud_probability:.4f}, threshold={FRAUD_THRESHOLD}, is_fraud={is_fraud}")
        
        return (is_fraud, fraud_probability)
    except Exception as e:
        import traceback
        print(f"❌ Error in fraud detection: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        return (0, 0.0)


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
    Get fraud detection history for the authenticated user from FinancialData table.
    Optional filters: start_date, end_date (format: YYYY-MM-DD), is_fraud (0 or 1)
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")
    
    # Query financial data with fraud detection results
    query = db.query(FinancialData).filter(
        FinancialData.user_id == user_uuid,
        FinancialData.is_fraud.isnot(None)  # Only include transactions that have been checked
    )
    
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
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(FinancialData.date <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    # Apply fraud filter
    if is_fraud is not None:
        query = query.filter(FinancialData.is_fraud == is_fraud)
    
    # Order by date descending
    query = query.order_by(desc(FinancialData.date))
    
    # Get total count
    total_count = query.count()
    
    # Apply pagination
    transactions = query.offset(offset).limit(limit).all()
    
    # Calculate summary statistics
    fraud_count = db.query(FinancialData).filter(
        FinancialData.user_id == user_uuid,
        FinancialData.is_fraud == 1
    ).count()
    
    legitimate_count = db.query(FinancialData).filter(
        FinancialData.user_id == user_uuid,
        FinancialData.is_fraud == 0
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
                "id": tx.id,
                "transaction_id": str(tx.id),
                "amount": float(tx.amount),
                "is_fraud": tx.is_fraud,
                "fraud_probability": float(tx.fraud_probability) if tx.fraud_probability else 0.0,
                "fraud_risk": "high" if tx.fraud_probability and float(tx.fraud_probability) > 0.7 else "medium" if tx.fraud_probability and float(tx.fraud_probability) > 0.3 else "low",
                "category": tx.category,
                "use_chip": tx.use_chip,
                "payment_code": get_payment_code_from_use_chip(tx.use_chip),
                "mcc_simple": get_mcc_simple_from_category(tx.category, db),
                "transaction_date": tx.date.isoformat(),
                "created_at": tx.created_at.isoformat() if tx.created_at else None
            }
            for tx in transactions
        ]
    }
