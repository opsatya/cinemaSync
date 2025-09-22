#!/usr/bin/env python3
"""
Test script for Google Drive integration
"""
import requests
import json
import sys
import os

# Test configuration
BACKEND_URL = "http://localhost:5000"
API_URL = f"{BACKEND_URL}/api"

def test_google_health():
    """Test Google OAuth configuration"""
    try:
        response = requests.get(f"{API_URL}/google/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('env_ok'):
                print("✅ Google OAuth environment configured")
                return True
            else:
                print(f"❌ Google OAuth environment issues: {data.get('missing', [])}")
                return False
        else:
            print(f"❌ Google health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Google health check failed: {e}")
        return False

def test_auth_url():
    """Test getting Google auth URL"""
    try:
        response = requests.get(f"{API_URL}/google/auth/url", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('auth_url'):
                print("✅ Google auth URL generation works")
                print(f"   Auth URL: {data['auth_url'][:50]}...")
                return True
            else:
                print(f"❌ Auth URL generation failed: {data.get('message')}")
                return False
        else:
            print(f"❌ Auth URL request failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Auth URL test failed: {e}")
        return False

def test_with_jwt(jwt_token):
    """Test Google Drive endpoints with JWT token"""
    headers = {'Authorization': f'Bearer {jwt_token}'}
    
    print(f"\n🔑 Testing with JWT token (length: {len(jwt_token)})")
    
    # Test tokens status
    try:
        response = requests.get(f"{API_URL}/google/tokens/status", headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                connected = data.get('connected', False)
                print(f"✅ Token status check: connected={connected}")
                if data.get('debug'):
                    debug = data['debug']
                    print(f"   User ID: {debug.get('user_id')}")
                    print(f"   Tokens found: {debug.get('tokens_found')}")
                    print(f"   Has access token: {debug.get('has_access_token')}")
                return connected
            else:
                print(f"❌ Token status failed: {data.get('message')}")
                return False
        else:
            print(f"❌ Token status request failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Token status test failed: {e}")
        return False

def test_drive_videos(jwt_token):
    """Test fetching Drive videos"""
    headers = {'Authorization': f'Bearer {jwt_token}'}
    
    try:
        response = requests.get(f"{API_URL}/rooms/videos/drive", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                videos = data.get('videos', [])
                print(f"✅ Drive videos fetch successful: {len(videos)} videos found")
                for i, video in enumerate(videos[:3]):  # Show first 3
                    print(f"   Video {i+1}: {video.get('name', 'Unknown')} ({video.get('mimeType', 'Unknown type')})")
                return True
            else:
                print(f"❌ Drive videos fetch failed: {data.get('message')}")
                if data.get('debug'):
                    print(f"   Debug: {data['debug']}")
                return False
        elif response.status_code == 401:
            data = response.json()
            print(f"❌ Drive videos unauthorized: {data.get('message')}")
            return False
        else:
            print(f"❌ Drive videos request failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Drive videos test failed: {e}")
        return False

def main():
    """Run all Google Drive tests"""
    print("🔍 Testing Google Drive integration...")
    print("=" * 50)
    
    # Basic tests (no auth required)
    basic_tests = [
        ("Google OAuth Health", test_google_health),
        ("Auth URL Generation", test_auth_url),
    ]
    
    passed = 0
    total = len(basic_tests)
    
    for test_name, test_func in basic_tests:
        print(f"\n🧪 Testing {test_name}...")
        if test_func():
            passed += 1
    
    print(f"\n📊 Basic Tests: {passed}/{total} passed")
    
    # JWT-based tests
    jwt_token = input("\n🔑 Enter your backend JWT token (or press Enter to skip): ").strip()
    
    if jwt_token:
        jwt_tests = [
            ("Token Status", lambda: test_with_jwt(jwt_token)),
            ("Drive Videos", lambda: test_drive_videos(jwt_token)),
        ]
        
        jwt_passed = 0
        jwt_total = len(jwt_tests)
        
        for test_name, test_func in jwt_tests:
            print(f"\n🧪 Testing {test_name}...")
            if test_func():
                jwt_passed += 1
        
        print(f"\n📊 JWT Tests: {jwt_passed}/{jwt_total} passed")
        total_passed = passed + jwt_passed
        total_tests = total + jwt_total
    else:
        print("\n⏭️  Skipping JWT-based tests")
        total_passed = passed
        total_tests = total
    
    print("\n" + "=" * 50)
    print(f"📊 Overall Results: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the Google Drive debug guide.")
        return 1

if __name__ == "__main__":
    sys.exit(main())