import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration class"""
    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-for-development-only')
    DEBUG = False
    TESTING = False
    
    # Google Drive settings
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    GOOGLE_DRIVE_FOLDER_ID = os.getenv('GOOGLE_DRIVE_FOLDER_ID')
    
    # API settings
    API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:5000/api')
    
    # Cache settings
    CACHE_DURATION = int(os.getenv('CACHE_DURATION', 300))  # 5 minutes by default

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    # In production, ensure you set a proper SECRET_KEY in environment variables

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True

# Configuration dictionary
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig
}

# Get configuration based on environment
def get_config():
    env = os.getenv('FLASK_ENV', 'development')
    return config_by_name[env]
