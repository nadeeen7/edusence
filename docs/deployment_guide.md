# LearnLens Deployment Guide

This guide provides step-by-step instructions for deploying the LearnLens AI Classroom project to production environments.

## 🚀 Deployment Strategy Overview

- **Backend**: Python/Flask on **Render** (or Railway).
- **Frontend**: React/Vite on **Vercel** (or Netlify).
- **Database**: **Render PostgreSQL** (or external PostgreSQL provider).
- **Communication**: WebSockets via `Flask-SocketIO` with `eventlet`/`gunicorn`.

---

## 🛠️ Phase 1: Backend Deployment (Render)

### 1. Create a PostgreSQL Database
- Go to [Dashboard](https://dashboard.render.com/) > **New** > **PostgreSQL**.
- Copy the **Internal Database URL** for later.

### 2. Create a Web Service
- **New** > **Web Service**.
- Connect your GitHub repository.
- **Root Directory**: `server` (or keep as root and adjust build command).
- **Runtime**: `Python`.
- **Build Command**: `pip install -r ../requirements.txt`
- **Start Command**: `gunicorn -k eventlet -w 1 app:app --bind 0.0.0.0:$PORT`

### 3. Environment Variables
Add these in the Render dashboard:
| Variable | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL URL |
| `SECRET_KEY` | A long random string |
| `JWT_SECRET_KEY` | A long random string |
| `FRONTEND_URL` | Your Vercel URL (e.g., `https://learnlens.vercel.app`) |
| `PYTHON_VERSION` | `3.9` or higher |

---

## 💻 Phase 2: Frontend Deployment (Vercel)

### 1. Create a Project
- Go to [Vercel](https://vercel.com/) > **Add New** > **Project**.
- Connect the same repository.
- **Framework Preset**: `Vite`.
- **Root Directory**: `client`.

### 2. Environment Variables
Add these in the Vercel dashboard:
| Variable | Value |
|---|---|
| `VITE_API_URL` | Your Render Web Service URL (e.g., `https://learnlens-backend.onrender.com`) |

### 3. Deploy
- Click **Deploy**.

---

## 🔐 Phase 3: WebRTC & HTTPS

> [!IMPORTANT]
> WebRTC (camera/mic access) **requires** HTTPS in production.
> Both Render and Vercel provide SSL (HTTPS) automatically. Ensure your `FRONTEND_URL` and `VITE_API_URL` both start with `https://`.

---

## 📊 Phase 4: Database Migration (SQLite to PostgreSQL)

If you have local data in `classroom.db` that you want to move:
1. Dump your SQLite data to SQL.
2. Use a tool like `pgloader` or manually run the SQL on your PostgreSQL instance.
3. If starting fresh, the backend will automatically create tables on first run via `db.create_all()`.

---

## 🔍 Troubleshooting

- **WebSocket Connection Failure**: Ensure the backend `gunicorn` command uses the `eventlet` worker class.
- **CORS Errors**: Double-check that `FRONTEND_URL` in the backend matches your Vercel URL exactly.
- **Camera Not Loading**: Check the browser console; it's likely a missing HTTPS certificate or incorrect `VITE_API_URL`.
