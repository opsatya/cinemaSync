#!/usr/bin/env python3
"""
Test script to verify the debug guide fixes are working
"""
import requests
import json
import sys
import os

# Test configuration
BACKEND_URL = "http://localhost:5000"
API_URL = f"{BACKEND_URL}/api"

def test_backend_health():
    """Test backend health endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend health check passed")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend health check failed: {e}")
        return False

def test_api_health():
    """Test API health endpoint"""
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ API health check passed")
            return True
        else:
            print(f"❌ API health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ API health check failed: {e}")
        return False

def test_rooms_endpoint():
    """Test rooms list endpoint"""
    try:
        response = requests.get(f"{API_URL}/rooms/", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Rooms endpoint working")
                return True
            else:
                print(f"❌ Rooms endpoint returned error: {data.get('message')}")
                return False
        else:
            print(f"❌ Rooms endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Rooms endpoint failed: {e}")
        return False

def test_cors_headers():
    """Test CORS headers are properly set"""
    try:
        response = requests.options(f"{API_URL}/rooms/", 
                                  headers={'Origin': 'http://localhost:5173'}, 
                                  timeout=5)
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
        }
        
        if cors_headers['Access-Control-Allow-Origin'] in ['http://localhost:5173', '*']:
            print("✅ CORS headers properly configured")
            print(f"   Origin: {cors_headers['Access-Control-Allow-Origin']}")
            print(f"   Credentials: {cors_headers['Access-Control-Allow-Credentials']}")
            print(f"   Headers: {cors_headers['Access-Control-Allow-Headers']}")
            return True
        else:
            print(f"❌ CORS headers not properly configured: {cors_headers}")
            return False
    except Exception as e:
        print(f"❌ CORS test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🔍 Testing CinemaSync fixes...")
    print("=" * 50)
    
    tests = [
        ("Backend Health", test_backend_health),
        ("API Health", test_api_health),
        ("Rooms Endpoint", test_rooms_endpoint),
        ("CORS Configuration", test_cors_headers),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🧪 Testing {test_name}...")
        if test_func():
            passed += 1
        
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The fixes are working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the backend is running and configured correctly.")
        return 1

if __name__ == "__main__":
    sys.exit(main())