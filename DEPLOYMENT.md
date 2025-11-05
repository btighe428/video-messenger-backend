# Deploying Video Messenger with Backend

Your Magic Mirror app is now split into:
- **Frontend**: Static files on Netlify (already deployed)
- **Backend**: Node.js server for video chat (needs to be deployed)

## Deploy Backend to Render (Free)

### 1. Create a Render account
- Go to https://render.com
- Sign up with GitHub (easiest)

### 2. Create a new Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository OR manually deploy
3. Configure the service:
   - **Name**: `video-messenger-backend` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave blank
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### 3. Add Environment Variables
In Render, go to **Environment** and add:
```
CLIENT_URL=https://bright-hummingbird-dfbf58.netlify.app
```

### 4. Deploy
Click **"Create Web Service"** - Render will build and deploy your backend!

### 5. Get Your Backend URL
After deployment completes, Render gives you a URL like:
```
https://video-messenger-backend-xyz.onrender.com
```

### 6. Update Frontend Configuration
Edit `/public/js/connection.js` line 4:
```javascript
const BACKEND_URL = window.location.hostname.includes('localhost')
    ? 'http://localhost:3000'
    : 'https://video-messenger-backend-xyz.onrender.com'; // Your Render URL
```

### 7. Redeploy Frontend to Netlify
Push the changes to GitHub and Netlify will auto-deploy, OR:
- Drag & drop the `public` folder to Netlify dashboard

## Testing Video Chat
1. Open your Netlify site
2. Click the "Join Video Chat" button
3. Enter password: `Yahoo`
4. Open another browser/tab with the same URL
5. Join with the same password - you should see each other!

## Troubleshooting

### Backend won't connect
- Check Render logs for errors
- Verify the Backend URL in connection.js matches your Render URL
- Make sure CLIENT_URL in Render env variables matches your Netlify URL

### Video doesn't show
- Allow camera permissions in browser
- Check browser console for errors
- Try refreshing the page

### Free tier limitations
- Render free tier sleeps after 15 min of inactivity
- First connection may take 30-60 seconds to wake up
- Consider upgrading if you need always-on service

## Alternative: Deploy Backend to Railway
If you prefer Railway over Render:
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Add environment variable: `CLIENT_URL`
4. Same steps as Render, but Railway stays awake longer on free tier
