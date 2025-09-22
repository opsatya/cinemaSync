# Google Drive Integration Debug Guide

## Issue: "No videos found in Drive" when trying to select videos

### Quick Diagnosis Steps

1. **Check if user is authenticated**:
   - Open browser dev tools → Network tab
   - Try to "Select Video from Drive" 
   - Look for the API call to `/api/rooms/videos/drive`
   - Check the response

2. **Check Google OAuth connection status**:
   ```bash
   # Test the tokens status endpoint
   curl -H "Authorization: Bearer YOUR_BACKEND_JWT" \
        http://localhost:5000/api/google/tokens/status
   ```

3. **Check backend logs**:
   - Look for `🎬 GET USER DRIVE VIDEOS` logs
   - Look for `🔍 TOKENS STATUS` logs
   - Check for any error messages

### Common Issues & Solutions

#### Issue 1: "Google Drive not connected"
**Symptoms**: API returns 401 with message about connecting Google Drive

**Solution**:
1. Click "Connect Google Drive" button in CreateRoom
2. Complete the OAuth flow in the popup window
3. Check that the popup closes and you're redirected back
4. Try "Select Video from Drive" again

**Debug**:
```bash
# Check if tokens were saved
curl -H "Authorization: Bearer YOUR_JWT" \
     http://localhost:5000/api/google/tokens/status
```

#### Issue 2: OAuth callback fails
**Symptoms**: OAuth popup shows error or doesn't close properly

**Possible causes**:
- Missing environment variables
- Incorrect redirect URI configuration
- User ID not passed correctly in state

**Debug**:
1. Check backend logs for `🔐 OAUTH CALLBACK` messages
2. Verify environment variables in `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_PROJECT_ID=your-project-id
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/auth/callback
   ```
3. Check Google Cloud Console OAuth client configuration

#### Issue 3: "No videos found" but Drive has videos
**Symptoms**: OAuth works, tokens saved, but no videos returned

**Possible causes**:
- User has no video files in their Drive
- OAuth scope doesn't include Drive access
- Token expired and refresh failed

**Debug**:
1. Check backend logs for video count: `Found X videos`
2. Verify OAuth scopes include `https://www.googleapis.com/auth/drive.file`
3. Test with a simple video file in Drive root

### Manual Testing Steps

1. **Test OAuth flow**:
   ```bash
   # Get auth URL
   curl -H "Authorization: Bearer YOUR_JWT" \
        http://localhost:5000/api/google/auth/url
   
   # Visit the returned URL in browser
   # Complete OAuth flow
   # Check callback logs
   ```

2. **Test token status**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT" \
        http://localhost:5000/api/google/tokens/status
   ```

3. **Test video listing**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT" \
        http://localhost:5000/api/rooms/videos/drive
   ```

### Environment Setup Checklist

#### Google Cloud Console
- [ ] OAuth 2.0 Client ID created
- [ ] Authorized JavaScript origins: `http://localhost:5173`
- [ ] Authorized redirect URIs: `http://localhost:5000/api/google/auth/callback`
- [ ] Drive API enabled for the project

#### Backend Environment
- [ ] `GOOGLE_CLIENT_ID` set
- [ ] `GOOGLE_CLIENT_SECRET` set  
- [ ] `GOOGLE_PROJECT_ID` set
- [ ] `GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/auth/callback`
- [ ] `OAUTH_SUCCESS_REDIRECT=http://localhost:5173/profile` (optional)

#### Client Environment
- [ ] User logged in with valid backend JWT
- [ ] Network requests not blocked by CORS
- [ ] Popup blocker disabled for localhost

### Expected Flow

1. User clicks "Connect Google Drive"
2. Frontend calls `/api/google/auth/url` with JWT
3. Backend returns Google OAuth URL with user ID in state
4. User completes OAuth in popup
5. Google redirects to `/api/google/auth/callback`
6. Backend extracts user ID from state and saves tokens
7. User clicks "Select Video from Drive"
8. Frontend calls `/api/rooms/videos/drive` with JWT
9. Backend uses saved tokens to fetch user's Drive videos
10. Videos displayed in selection dialog

### Troubleshooting Commands

```bash
# Check if backend is running
curl http://localhost:5000/health

# Check Google OAuth health
curl http://localhost:5000/api/google/health

# Test with debug info
curl -v -H "Authorization: Bearer YOUR_JWT" \
     http://localhost:5000/api/google/tokens/status

# Check MongoDB for saved tokens
# (if you have MongoDB CLI access)
db.user_tokens.find({"user_id": "YOUR_USER_ID", "provider": "google"})
```

### Success Indicators

- ✅ OAuth popup opens and closes cleanly
- ✅ `/api/google/tokens/status` returns `"connected": true`
- ✅ `/api/rooms/videos/drive` returns list of videos
- ✅ Backend logs show "Found X videos" message
- ✅ Video selection dialog shows actual video files

### Still Having Issues?

1. Check browser console for JavaScript errors
2. Check backend logs for detailed error messages
3. Verify Google Cloud Console configuration
4. Test with a fresh OAuth connection (revoke and reconnect)
5. Ensure test video files exist in Google Drive root folder