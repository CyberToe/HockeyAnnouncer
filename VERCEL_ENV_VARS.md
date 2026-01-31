# Vercel Environment Variables

## Required Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

### 1. HA_DATABASE_URL
```
postgresql://neondb_owner:npg_SvDJbfKq36In@ep-falling-mode-ahy9q2ab-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```
**Description:** Neon PostgreSQL database connection string

### 2. HA_JWT_SECRET
```
[Generate a random string - use a password generator or: openssl rand -base64 32]
```
**Description:** Secret key for JWT token signing. Use a strong, random string in production.

### 3. HA_NODE_ENV
```
production
```
**Description:** Node environment. Set to `production` for Vercel deployments.

### 4. HA_ELEVENLABS_API_KEY
```
sk_11b0f83e527f39ff6a23020ae9b9246fee3dce41003c7140
```
**Description:** Your ElevenLabs API key for text-to-speech functionality.

## How to Set in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Key:** `HA_DATABASE_URL`
   - **Value:** `postgresql://neondb_owner:npg_SvDJbfKq36In@ep-falling-mode-ahy9q2ab-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - **Environment:** Production, Preview, Development (select all)

4. Repeat for:
   - `HA_JWT_SECRET` (generate a new random string)
   - `HA_NODE_ENV` = `production`
   - `HA_ELEVENLABS_API_KEY` = your API key

5. **Important:** After adding variables, redeploy your application for changes to take effect.

## Security Notes

- Never commit these values to git
- The `HA_JWT_SECRET` should be unique and kept secret
- Rotate secrets periodically for security
- Use different secrets for production vs development if needed



