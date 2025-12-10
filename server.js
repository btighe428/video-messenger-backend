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
    },
    // Increase max payload size to handle large image data URLs (default is 1MB)
    maxHttpBufferSize: 10 * 1024 * 1024, // 10MB
    // Ping settings to keep connection alive
    pingTimeout: 60000,
    pingInterval: 25000
});

// Enable CORS for frontend domain
app.use(cors({
    origin: [CLIENT_URL, 'http://localhost:3000', 'https://bright-hummingbird-dfbf58.netlify.app'],
    credentials: true
}));

// Disable caching for all static files during development
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// Serve static files from the public directory
app.use(express.static('public', {
    etag: false,
    lastModified: false
}));

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

    // Handle login - No authentication required
    socket.on('login', (data) => {
        const { password, username } = data;

        /* COMMENTED OUT - Password authentication
        if (password !== PASSWORD) {
            socket.emit('login-failed', { message: 'Incorrect password' });
            return;
        }
        */

        // Store user info (no password check)
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

        console.log(`User joined: ${connectedUsers.get(socket.id).username} (${socket.id})`);
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

    // Handle video message sending
    socket.on('send-video-message', (data) => {
        const { videoUrl, filename, size, to } = data;
        const sender = connectedUsers.get(socket.id);

        if (!sender) {
            console.log('Sender not found in connected users');
            return;
        }

        io.to(to).emit('video-message-received', {
            videoUrl,
            filename,
            size,
            from: socket.id,
            senderName: sender.username,
            timestamp: Date.now()
        });

        console.log(`Video message sent from ${sender.username} (${socket.id}) to ${to}`);

        // Confirm delivery to sender
        socket.emit('video-message-sent', {
            success: true,
            to: to
        });
    });

    // Handle sticker synchronization
    socket.on('stickers-update', (data) => {
        const { stickers } = data;

        // Broadcast to all OTHER connected users (not back to sender)
        socket.broadcast.emit('stickers-update', {
            stickers: stickers,
            from: socket.id
        });

        console.log(`Stickers updated from ${socket.id}: ${stickers.length} stickers`);
    });

    // ==================== STUDIO MODE EVENTS ====================

    // Track users in studio mode
    if (!socket.inStudio) {
        socket.inStudio = false;
    }

    // User joins studio mode
    socket.on('studio-join', () => {
        // Prevent duplicate join broadcasts
        if (socket.inStudio) {
            console.log(`User ${socket.id} already in Studio, skipping duplicate join`);
            return;
        }

        socket.inStudio = true;
        const user = connectedUsers.get(socket.id);
        console.log(`User ${user?.username || socket.id} joined Studio mode`);

        // Notify other studio users
        socket.broadcast.emit('studio-user-joined', {
            socketId: socket.id,
            username: user?.username || 'Guest'
        });

        // Request current state from other users in studio
        socket.broadcast.emit('studio-state-request', {
            requesterId: socket.id
        });

        // Send list of users currently in studio
        const studioUsers = [];
        connectedUsers.forEach((userData, odIds) => {
            const userSocket = io.sockets.sockets.get(odIds);
            if (userSocket && userSocket.inStudio && odIds !== socket.id) {
                studioUsers.push({
                    socketId: odIds,
                    username: userData.username
                });
            }
        });
        socket.emit('studio-users-list', studioUsers);
    });

    // User leaves studio mode
    socket.on('studio-leave', () => {
        socket.inStudio = false;
        const user = connectedUsers.get(socket.id);
        console.log(`User ${user?.username || socket.id} left Studio mode`);

        // Notify other studio users
        socket.broadcast.emit('studio-user-left', {
            socketId: socket.id
        });
    });

    // Client explicitly requests state from other users
    socket.on('studio-state-request', (data) => {
        if (!socket.inStudio) return;

        console.log(`User ${socket.id} requesting state from other users`);
        // Broadcast to all other users in studio
        socket.broadcast.emit('studio-state-request', {
            requesterId: data.requesterId || socket.id
        });
    });

    // Real-time cursor position updates
    socket.on('studio-cursor-update', (data) => {
        if (!socket.inStudio) return;

        const user = connectedUsers.get(socket.id);

        // Broadcast cursor position to all OTHER users in studio
        socket.broadcast.emit('studio-cursor-update', {
            socketId: socket.id,
            x: data.x,
            y: data.y,
            color: data.color,
            name: user?.username || data.name || 'Guest'
        });
    });

    // Canvas state synchronization
    socket.on('studio-canvas-update', (data) => {
        if (!socket.inStudio) return;

        // If target is specified, send only to that user (for initial sync)
        if (data.to) {
            io.to(data.to).emit('studio-canvas-update', {
                socketId: socket.id,
                objects: data.objects
            });
            console.log(`Canvas state sent from ${socket.id} to ${data.to}: ${data.objects?.length || 0} objects`);
        } else {
            // Broadcast canvas state to all OTHER users in studio
            socket.broadcast.emit('studio-canvas-update', {
                socketId: socket.id,
                objects: data.objects
            });
            console.log(`Canvas updated from ${socket.id}: ${data.objects?.length || 0} objects`);
        }
    });

    // ==================== NEW: Fabric.js Studio Events ====================

    // Real-time emoji reactions
    socket.on('studio-reaction', (data) => {
        if (!socket.inStudio) return;

        socket.broadcast.emit('studio-reaction', {
            socketId: socket.id,
            emoji: data.emoji,
            color: data.color
        });
    });

    // Fabric object added
    socket.on('studio-object-added', (data) => {
        if (!socket.inStudio) return;

        socket.broadcast.emit('studio-object-added', {
            socketId: socket.id,
            objectId: data.objectId,
            json: data.json
        });
    });

    // Fabric object modified
    socket.on('studio-object-modified', (data) => {
        if (!socket.inStudio) return;

        socket.broadcast.emit('studio-object-modified', {
            socketId: socket.id,
            objectId: data.objectId,
            json: data.json
        });
    });

    // Fabric object removed
    socket.on('studio-object-removed', (data) => {
        if (!socket.inStudio) return;

        socket.broadcast.emit('studio-object-removed', {
            socketId: socket.id,
            objectId: data.objectId
        });
    });

    // Canvas sync request (new user asking for current state)
    socket.on('studio-canvas-sync-request', (data) => {
        if (!socket.inStudio) return;

        // Broadcast to all other users that someone needs the canvas state
        socket.broadcast.emit('studio-canvas-sync-request', {
            requesterId: data.requesterId
        });
    });

    // Canvas sync response (sending full canvas state)
    socket.on('studio-canvas-sync', (data) => {
        if (!socket.inStudio) return;

        // Send to specific target or broadcast
        if (data.targetId) {
            io.to(data.targetId).emit('studio-canvas-sync', {
                socketId: socket.id,
                targetId: data.targetId,
                objects: data.objects,
                nextObjectId: data.nextObjectId
            });
        } else {
            socket.broadcast.emit('studio-canvas-sync', {
                socketId: socket.id,
                objects: data.objects,
                nextObjectId: data.nextObjectId
            });
        }
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
