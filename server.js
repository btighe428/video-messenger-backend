const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const io = new Server(server, {
    cors: {
        origin: [CLIENT_URL, 'http://localhost:3000', 'https://bright-hummingbird-dfbf58.netlify.app'],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Enable CORS for frontend domain
app.use(cors({
    origin: [CLIENT_URL, 'http://localhost:3000', 'https://bright-hummingbird-dfbf58.netlify.app'],
    credentials: true
}));

// Serve static files from the public directory
app.use(express.static('public'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'video-' + uniqueSuffix + ext);
    }
});

// File filter to accept only video files
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['video/webm', 'video/mp4', 'video/x-matroska'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Routes

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload endpoint
app.post('/upload', upload.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No video file uploaded'
            });
        }

        // Generate URL for the uploaded file
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        res.json({
            success: true,
            message: 'Video uploaded successfully',
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading video',
            error: error.message
        });
    }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// List all uploaded videos (optional - for viewing all videos)
app.get('/api/videos', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error reading uploads directory',
                error: err.message
            });
        }

        const videos = files
            .filter(file => file.startsWith('video-'))
            .map(file => {
                const filePath = path.join(uploadsDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    url: `/uploads/${file}`,
                    size: stats.size,
                    created: stats.birthtime
                };
            })
            .sort((a, b) => b.created - a.created);

        res.json({
            success: true,
            count: videos.length,
            videos: videos
        });
    });
});

// Delete a video (optional)
app.delete('/api/videos/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    // Security check - ensure filename doesn't contain path traversal
    if (filename.includes('..') || !filename.startsWith('video-')) {
        return res.status(400).json({
            success: false,
            message: 'Invalid filename'
        });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error deleting video',
                error: err.message
            });
        }

        res.json({
            success: true,
            message: 'Video deleted successfully'
        });
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File is too large. Maximum size is 100MB.'
            });
        }
    }

    res.status(500).json({
        success: false,
        message: error.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Socket.io for WebRTC signaling
const PASSWORD = 'Yahoo';
let connectedUsers = new Map(); // socketId -> userInfo

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle login
    socket.on('login', (data) => {
        const { password, username } = data;

        if (password !== PASSWORD) {
            socket.emit('login-failed', { message: 'Incorrect password' });
            return;
        }

        // Store user info
        connectedUsers.set(socket.id, {
            username: username || `User${socket.id.substring(0, 4)}`,
            socketId: socket.id
        });

        socket.emit('login-success', { socketId: socket.id });

        // Notify all users of new connection
        const usersList = Array.from(connectedUsers.values())
            .filter(user => user.socketId !== socket.id);

        socket.emit('users-list', usersList);
        socket.broadcast.emit('user-joined', connectedUsers.get(socket.id));

        console.log(`User logged in: ${connectedUsers.get(socket.id).username} (${socket.id})`);
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
        const { offer, to } = data;
        io.to(to).emit('offer', {
            offer,
            from: socket.id
        });
        console.log(`Offer sent from ${socket.id} to ${to}`);
    });

    socket.on('answer', (data) => {
        const { answer, to } = data;
        io.to(to).emit('answer', {
            answer,
            from: socket.id
        });
        console.log(`Answer sent from ${socket.id} to ${to}`);
    });

    socket.on('ice-candidate', (data) => {
        const { candidate, to } = data;
        io.to(to).emit('ice-candidate', {
            candidate,
            from: socket.id
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            console.log(`User disconnected: ${user.username} (${socket.id})`);
            connectedUsers.delete(socket.id);
            socket.broadcast.emit('user-left', { socketId: socket.id });
        }
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`\n🎥 Video Messenger Server`);
    console.log(`================================`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Upload endpoint: http://localhost:${PORT}/upload`);
    console.log(`Uploads folder: ${uploadsDir}`);
    console.log(`WebSocket: Enabled`);
    console.log(`================================\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    process.exit(0);
});
