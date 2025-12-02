# Supabase Authentication Setup Guide

This guide will help you set up Supabase email/password authentication for your application.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Fill in your project details:
   - **Name**: Choose a name for your project (e.g., "marketing-minds")
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the region closest to your users
5. Click "Create new project" and wait for it to be set up (this takes a few minutes)

## Step 2: Get Your API Keys

1. Once your project is ready, go to **Project Settings** (gear icon in the sidebar)
2. Click on **API** in the settings menu
3. You'll find two important values:
   - **Project URL** (looks like: `https://oewacnimzsuuhhobjiaj.supabase.co`)
   - **anon/public key** (a long string starting with `eyJ...`)

## Step 3: Configure Email Authentication

1. In your Supabase dashboard, go to **Authentication** > **Providers**
2. Find **Email** in the list and make sure it's enabled
3. (Optional) Configure email templates under **Authentication** > **Email Templates**
4. (Optional) Set up SMTP settings if you want to use a custom email service

## Step 4: Set Up Environment Variables

1. In your `Opsly` folder, create a `.env` file (copy from `.env.example` if it exists)
2. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Example:**
```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 5: Configure Site URL (Important!)

1. In Supabase dashboard, go to **Authentication** > **URL Configuration**
2. Set **Site URL** to your application URL:
   - For development: `http://localhost:5173`
   - For production: Your production domain (e.g., `https://yourdomain.com`)
3. Add **Redirect URLs**:
   - `http://localhost:5173/**` (for development)
   - Your production URL with `/**` (e.g., `https://yourdomain.com/**`)

## Step 6: Test Your Setup

1. Make sure your `.env` file is in the `Opsly` folder
2. Restart your development server:
   ```bash
   npm run dev
   ```
3. Try signing up with a new email address
4. Check your email for the verification link (check spam if you don't see it)
5. Verify your email and then try logging in

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure your `.env` file is in the `Opsly` folder (not the root)
- Restart your dev server after creating/updating `.env`
- Check that the variable names start with `VITE_`

### "Invalid API key" error
- Double-check that you copied the full anon key
- Make sure there are no extra spaces or quotes in your `.env` file

### Email not sending
- Check your Supabase project logs under **Logs** > **Postgres Logs**
- Verify email is enabled in **Authentication** > **Providers**
- Check spam folder
- For production, consider setting up custom SMTP

### Redirect errors after signup/login
- Verify your Site URL and Redirect URLs in **Authentication** > **URL Configuration**
- Make sure they match exactly (including `http://` vs `https://`)

## Additional Features

### Password Reset
Password reset functionality is included. Users can click "Forgot Password?" on the login page.

### User Metadata
When users sign up, their full name is stored in user metadata and can be accessed via:
```javascript
user?.user_metadata?.full_name
```

## Next Steps

- Set up Row Level Security (RLS) policies in Supabase if you need database access
- Customize email templates in Supabase dashboard
- Add social authentication (Google, GitHub, etc.) if needed

