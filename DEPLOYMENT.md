# Deployment Guide

## Vercel Deployment

### Environment Variables
Make sure to set the following environment variable in your Vercel project settings:

```
MONGODB_URI=your_mongodb_connection_string
```

For example:
- MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/swagger-scanner`
- Local MongoDB: `mongodb://127.0.0.1:27017/swagger-scanner`

### CORS Configuration
The app includes proper CORS configuration for cross-origin requests. The `/api/execute` endpoint acts as a proxy to avoid CORS issues when making requests to external APIs.

### Testing CORS
You can test CORS functionality by visiting:
- `https://your-app.vercel.app/api/test-cors` - Should return a JSON response
- Use browser dev tools to check for CORS errors

### Troubleshooting CORS Issues

1. **Check browser console** for CORS error messages
2. **Verify API endpoints** are responding with proper CORS headers
3. **Test the proxy endpoint** `/api/execute` directly
4. **Check Vercel function logs** for any server-side errors

### API Proxy Usage
Instead of making direct requests to external APIs from the frontend, use the proxy:

```javascript
// Instead of this (causes CORS):
fetch('https://external-api.com/endpoint')

// Use this (via proxy):
fetch('/api/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://external-api.com/endpoint',
    method: 'GET',
    headers: {},
    body: null
  })
})
```