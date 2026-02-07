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

3. **MongoDB Atlas** (required):
   - Network Access → Add IP Address → **Allow access from anywhere** (0.0.0.0/0)
   - Cluster must be **running** (not paused)

## Update Your App

**Production Base URL:** `https://doctor-house-call-backend.vercel.app`

Examples:
- Health: `https://doctor-house-call-backend.vercel.app/health`
- Google Auth: `https://doctor-house-call-backend.vercel.app/api/auth/google`

## Troubleshooting "buffering timed out"

If you see `users.findOne() buffering timed out`:
1. **MONGODB_URI** – Ensure it's set in Vercel → Settings → Environment Variables
2. **MongoDB Atlas** – Network Access must include 0.0.0.0/0
3. **Cluster** – Must be running (resume if paused)
4. Redeploy after changing env vars
