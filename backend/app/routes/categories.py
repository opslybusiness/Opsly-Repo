from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Category

router = APIRouter()


@router.get("/categories")
def get_categories(
    db: Session = Depends(get_db)
):
    """
    Get all available expense categories.
    Returns list of categories with id, name, mcc_code, and description.
    """
    try:
        categories = db.query(Category).order_by(Category.name).all()
        
        return {
            "status": "success",
            "count": len(categories),
            "categories": [
                {
                    "id": cat.id,
                    "name": cat.name,
                    "mcc_code": cat.mcc_code,
                    "description": cat.description
                }
                for cat in categories
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching categories: {str(e)}")

