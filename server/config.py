import os
from datetime import timedelta
from dotenv import load_dotenv

# Robust .env loading - only load if not in production environment
if not os.getenv("DATABASE_URL"):
    basedir = os.path.abspath(os.path.dirname(__file__))
    load_dotenv(os.path.join(basedir, '.env'))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "classroom_live_stable_secret_key_for_persistence")
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "edusense_jwt_secure_secret_7788")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    CORS_ORIGINS = [FRONTEND_URL, "http://localhost:3000"]
