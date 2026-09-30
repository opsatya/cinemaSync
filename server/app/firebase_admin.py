import firebase_admin
from firebase_admin import credentials, auth
import os

def init_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        # Use a dedicated service account for Firebase if available.
        # This avoids conflicts if Google Drive uses a different project.
        cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')

        # Fallback to the general Google service account if the dedicated one is not set.
        if not cred_path:
            cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if cred_path:
                print("⚠️  Using GOOGLE_APPLICATION_CREDENTIALS for Firebase. It's recommended to set a dedicated FIREBASE_SERVICE_ACCOUNT_KEY to avoid project conflicts.")

        if cred_path and not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin SDK initialized successfully.")
        else:
            print("🔥 Firebase Admin SDK not initialized. Missing FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.")
    except Exception as e:
        print(f"🔥 Failed to initialize Firebase Admin SDK: {e}")

def verify_firebase_token(id_token):
    """Verify Firebase ID token and return user data"""
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        print(f"Error verifying Firebase token: {e}")
        return None