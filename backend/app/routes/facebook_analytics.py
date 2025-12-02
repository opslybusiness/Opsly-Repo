from fastapi import Depends, APIRouter
from sqlalchemy.orm import Session
import requests
from uuid import UUID as UUIDType

from app.database import get_db
from app.models import User
from app.auth import get_user_id_from_token

router = APIRouter()

@router.get("/facebook/page-analytics")
def get_page_post_analytics(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)  # Get from JWT token
):
    # 1. Get user from DB by user_id (UUID from auth.users)
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        return {"error": "Invalid user_id format. Expected UUID."}
    
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        return {"error": "User not found"}

    user_token = user.session_token

    # 2. Get pages managed by user
    pages_resp = requests.get(
        f"https://graph.facebook.com/v24.0/me/accounts",
        params={"access_token": user_token}
    ).json()

    if "data" not in pages_resp or not pages_resp["data"]:
        return {"error": "No managed pages found", "details": pages_resp}

    # For simplicity, pick the first page (or you can filter by name/id)
    page_info = pages_resp["data"][0]
    page_id = page_info["id"]
    page_token = page_info["access_token"]
    #print(page_id,page_token)

    # 3. Get posts from the page
    posts_resp = requests.get(
        f"https://graph.facebook.com/v24.0/{page_id}/posts",
        params={
            "fields": "id,message,created_time,full_picture,permalink_url",
            "access_token": page_token
        }
    ).json()

    if "data" not in posts_resp:
        return {"error": "Failed to fetch posts", "details": posts_resp}

    analytics = []

    for post in posts_resp["data"]:
        post_id = post["id"]

        # Likes
        like_data = requests.get(
            f"https://graph.facebook.com/v24.0/{post_id}/likes",
            params={"summary": "total_count", "access_token": page_token}
        ).json()
    #     like_data = requests.get(
    # f"https://graph.facebook.com/v24.0/{post_id}",
    # params={
    #     "fields": "reactions.summary(total_count)",
    #     "access_token": page_token
    # }
    # ).json()
        #print(like_data)
        #likes_count = like_data.get("reactions", {}).get("summary", {}).get("total_count", 0)


        # Comments
        # comment_data = requests.get(
        #     f"https://graph.facebook.com/v24.0/{post_id}/comments",
        #     params={"summary": "total_count", "access_token": page_token}
        # ).json()
        comments_resp = requests.get(
            f"https://graph.facebook.com/v24.0/{post_id}/comments",
            params={
                "fields": "id,from,message,created_time,like_count",
                "summary": "total_count",
                "access_token": page_token
            }
        ).json()
        print(comments_resp)

        total_comments = comments_resp.get("summary", {}).get("total_count", 0)
        comments_list = comments_resp.get("data", [])

        
        # Shares
        share_data = requests.get(
            f"https://graph.facebook.com/v24.0/{post_id}/sharedposts",
            params={"summary": "total_count", "access_token": page_token}
        ).json()

        analytics.append({
            "post_id": post_id,
            "message": post.get("message"),
            "created_time": post.get("created_time"),
            "likes": like_data.get("summary", {}).get("total_count", 0),
            #"likes": likes_count,
            "comments": total_comments,
            "comments": comments_list,
            "shares": share_data.get("summary", {}).get("total_count", 0),
            "image_url": post.get("full_picture"),
            "post_url": post.get("permalink_url"),

        })

    return {
        "page": {"id": page_id, "name": page_info.get("name")},
        "analytics": analytics
    }
