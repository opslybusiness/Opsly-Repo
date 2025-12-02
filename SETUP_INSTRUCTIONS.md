# Setup Instructions for User ID Authentication

## Backend Setup

### 1. Install New Dependencies

Run this in your backend directory:

```bash
pip install python-jose[cryptography]==3.3.0
```

Or if using requirements.txt:

```bash
pip install -r requirements.txt
```

### 2. Environment Variables

Add to your backend `.env` file:

```env
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

**How to get your JWT Secret:**
1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** > **API**
3. Find **JWT Secret** (not the anon key or service role key)
4. Copy it and add to your `.env` file

**Important**: The JWT Secret is different from:
- Anon/Public Key (starts with `eyJ...`)
- Service Role Key (starts with `eyJ...`)
- JWT Secret is a long string used to verify tokens

### 3. How It Works

The backend now:
- ✅ Extracts `user_id` from the JWT token in the `Authorization: Bearer <token>` header
- ✅ Automatically verifies the token is valid
- ✅ No need to pass `user_id` as a parameter anymore
- ✅ All routes are now protected and require authentication

### 4. API Changes

**Before:**
```javascript
// Had to pass user_id as parameter
apiClient('/facebook/page-analytics?user_id=3')
formData.append('user_id', '3')
```

**After:**
```javascript
// user_id is automatically extracted from JWT token
apiClient('/facebook/page-analytics')  // No user_id needed!
// formData doesn't need user_id either
```

## Frontend Setup

### 1. Using userId in Components

The `useAuth()` hook now provides `userId`:

```javascript
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { userId, isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    return <div>Please log in</div>
  }
  
  // userId is the UUID from auth.users table
  console.log('User ID:', userId)
}
```

### 2. API Calls

All API calls automatically include the JWT token in the `Authorization` header (already set up in `apiClient`). The backend extracts `user_id` from this token.

## Testing

1. **Make sure user is logged in** - The frontend should have a valid Supabase session
2. **Check token is being sent** - Open browser DevTools > Network tab, check that `Authorization: Bearer <token>` header is present
3. **Test an API endpoint** - Try calling `/facebook/page-analytics` - it should work without passing `user_id`

## Troubleshooting

### Error: "JWT secret not configured"
- Make sure `SUPABASE_JWT_SECRET` is set in your backend `.env` file
- Restart your backend server after adding the env variable

### Error: "Invalid token"
- Make sure the user is logged in on the frontend
- Check that the token is being sent in the `Authorization` header
- Verify the JWT Secret matches your Supabase project

### Error: "User not found"
- The `user_id` from the token doesn't exist in your `users` table
- Make sure you've linked the `users.user_id` column to `auth.users.id` (see migration guide)

### Error: "User ID not found in token"
- The JWT token structure might be different
- Check the token payload - it should have a `sub` field with the user UUID

## Security Notes

- ✅ All endpoints now require authentication
- ✅ `user_id` cannot be spoofed - it comes from verified JWT token
- ✅ Users can only access their own data
- ✅ No need to trust client-provided `user_id` values

