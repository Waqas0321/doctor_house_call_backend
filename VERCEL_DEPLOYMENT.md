# Vercel Deployment Guide

## Setup Complete

The project is configured for Vercel serverless deployment:
- `api/index.js` - Serverless entry point
- `vercel.json` - Vercel configuration

## Required Environment Variables

Add these in **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| MONGODB_URI | MongoDB Atlas connection string | mongodb+srv://user:pass@cluster.mongodb.net/dbname |
| JWT_SECRET | Secret for JWT tokens | your-secure-random-string |

## Deploy

1. Push to GitHub and connect the repo to Vercel, or use Vercel CLI:
   ```bash
   npm i -g vercel
   vercel
   ```

2. Set environment variables in Vercel Dashboard before deploying

3. **MongoDB Atlas**: Whitelist Vercel's IPs OR use "Allow access from anywhere" (0.0.0.0/0) in Network Access

## Update Your App

After deployment, use your Vercel URL as the API base:
```
https://your-project.vercel.app
```

Examples:
- Health: `https://your-project.vercel.app/health`
- Google Auth: `https://your-project.vercel.app/api/auth/google`
