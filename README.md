# Video Messenger

A simple, modern web application for recording and sharing short video messages.

## Features

- **Browser-based Recording**: Record video messages directly from your browser using WebRTC
- **Quality Settings**: Choose from multiple video quality options (720p, 480p, 360p)
- **Real-time Preview**: See yourself while recording with live camera preview
- **Recording Timer**: Track recording duration in real-time
- **Playback Review**: Review your recording before uploading or sharing
- **Easy Sharing**: Upload videos and get shareable links
- **Download Option**: Download recordings to your device
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with smooth animations

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A modern web browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- Camera and microphone permissions

## Installation

1. **Navigate to the project directory:**
   ```bash
   cd /Users/btighe/Documents/Sandbox/Video-messaging
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Usage

1. **Start the server:**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   Navigate to `http://localhost:3000`

3. **Grant permissions:**
   Allow camera and microphone access when prompted

4. **Record your video:**
   - Click "Start Recording" to begin
   - Record your message (timer will show duration)
   - Click "Stop Recording" when done

5. **Review and share:**
   - Watch your recording in the playback section
   - Click "Upload & Share" to upload and get a shareable link
   - Click "Download" to save the video locally
   - Click "Discard" to delete and start over

## API Endpoints

### Upload Video
```
POST /upload
Content-Type: multipart/form-data

Body:
- video: video file (webm, mp4, or mkv)

Response:
{
  "success": true,
  "message": "Video uploaded successfully",
  "url": "http://localhost:3000/uploads/video-1234567890.webm",
  "filename": "video-1234567890.webm",
  "size": 1234567,
  "mimetype": "video/webm"
}
```

### List All Videos
```
GET /api/videos

Response:
{
  "success": true,
  "count": 5,
  "videos": [
    {
      "filename": "video-1234567890.webm",
      "url": "/uploads/video-1234567890.webm",
      "size": 1234567,
      "created": "2024-11-05T12:34:56.789Z"
    }
  ]
}
```

### Delete Video
```
DELETE /api/videos/:filename

Response:
{
  "success": true,
  "message": "Video deleted successfully"
}
```

## Project Structure

```
Video-messaging/
├── public/
│   ├── css/
│   │   └── styles.css          # Application styling
│   ├── js/
│   │   └── recorder.js         # Video recording logic
│   └── index.html              # Main HTML page
├── uploads/                    # Uploaded videos (created automatically)
├── server.js                   # Express server
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## Configuration

### Video Quality Settings

Adjust video quality in the UI or modify constraints in `recorder.js`:

```javascript
getVideoConstraints(quality) {
    const constraints = {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
        }
    };
    // ...
}
```

### Upload Limits

Modify in `server.js`:

```javascript
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});
```

### Server Port

Change the port by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Browser Compatibility

- Chrome/Edge 60+
- Firefox 55+
- Safari 14.1+
- Opera 47+

**Note**: Safari and iOS Safari use different video codecs (H.264 instead of VP8/VP9)

## Troubleshooting

### Camera Access Denied
- Check browser permissions for camera and microphone
- Ensure you're accessing via HTTPS (required for production)
- Try refreshing the page and granting permissions again

### Recording Not Starting
- Verify MediaRecorder API support: `MediaRecorder.isTypeSupported('video/webm')`
- Check browser console for errors
- Ensure no other application is using the camera

### Upload Failing
- Check server is running on port 3000
- Verify `uploads` directory exists and has write permissions
- Check file size is under 100MB
- Review server logs for errors

### Video Won't Play
- Some browsers may not support WebM playback
- Try downloading and playing in VLC or another media player
- Server may need to set proper MIME types

## Security Considerations

- Videos are stored locally in the `uploads` directory
- No authentication is implemented (add for production use)
- Consider implementing:
  - User authentication
  - File encryption
  - Access control lists
  - Rate limiting
  - HTTPS in production

## Future Enhancements

- User authentication and profiles
- Video thumbnails
- Transcription and captions
- Video trimming/editing
- Social sharing integrations
- Email notifications
- Cloud storage integration (AWS S3, Firebase Storage)
- End-to-end encryption
- Video compression
- Commenting and reactions

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express
- **APIs**: WebRTC, MediaRecorder API
- **File Upload**: Multer
- **Video Format**: WebM (VP8/VP9 + Opus)

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!

## Support

For questions or issues, please check:
1. Browser console for errors
2. Server logs for upload issues
3. Camera/microphone permissions
4. Network connectivity

---

Made with video recording capabilities using modern web technologies.
