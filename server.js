const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ==================== LIVEKIT CONFIGURATION ====================
// LiveKit Cloud credentials - set these environment variables:
// LIVEKIT_API_KEY - Your LiveKit API key
// LIVEKIT_API_SECRET - Your LiveKit API secret
// LIVEKIT_URL - Your LiveKit WebSocket URL (e.g., wss://your-app.livekit.cloud)

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// Generate LiveKit access token for a participant
async function generateLiveKitToken(roomName, participantName, participantId) {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        console.error('[LiveKit] API credentials not configured');
        return null;
    }

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: participantId,
        name: participantName,
    });

    // Grant permissions for the room
    token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
    });

    return await token.toJwt();
}

const io = new Server(server, {
    cors: {
        origin: [CLIENT_URL, 'http://localhost:3000', 'https://video-messaging-v4.vercel.app', 'https://bright-hummingbird-dfbf58.netlify.app', 'https://video-messaging-v4-adwalnctx-brians-projects-61d69cd7.vercel.app'],
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
    origin: [CLIENT_URL, 'http://localhost:3000', 'https://video-messaging-v4.vercel.app', 'https://bright-hummingbird-dfbf58.netlify.app', 'https://video-messaging-v4-adwalnctx-brians-projects-61d69cd7.vercel.app'],
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

// Serve static files from the public directory (use absolute path for Vercel)
app.use(express.static(path.join(__dirname, 'public'), {
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

// Health check endpoint (shows LiveKit status)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        node: process.version,
        livekit: {
            configured: !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL),
            url: LIVEKIT_URL || 'NOT SET',
            apiKeySet: !!LIVEKIT_API_KEY,
            apiSecretSet: !!LIVEKIT_API_SECRET,
        },
        connectedUsers: connectedUsers.size,
    });
});

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// LiveKit token endpoint (REST API alternative to socket)
app.get('/api/livekit-token', async (req, res) => {
    const { room, username, identity } = req.query;

    if (!room || !username || !identity) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameters: room, username, identity'
        });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        return res.status(503).json({
            success: false,
            message: 'LiveKit not configured on server'
        });
    }

    try {
        const token = await generateLiveKitToken(room, username, identity);
        res.json({
            success: true,
            token,
            url: LIVEKIT_URL,
        });
    } catch (error) {
        console.error('[LiveKit] Token generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate token',
            error: error.message
        });
    }
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

// Serve uploaded files (use absolute path for Vercel)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// ==================== VIDEO CIRCLE POSITION STATE ====================
// Shared Reality: All users see same circle positions
const videoPositions = new Map(); // participantId -> { x, y, timestamp, movedBy }
let currentFormation = 'cluster'; // 'cluster' | 'audience' | 'stack' | 'scatter'
let formationPresenterId = null;  // For audience mode

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
        // Username is ALWAYS provided by client (Color-Animal format)
        // Never fall back to generic User-XXX format
        connectedUsers.set(socket.id, {
            username: username,
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

    // WebRTC signaling (P2P fallback)
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

    // ==================== LIVEKIT TOKEN REQUEST ====================

    // Client requests LiveKit token to join a room
    socket.on('getLiveKitToken', async (data, callback) => {
        const { roomName } = data;
        const user = connectedUsers.get(socket.id);

        if (!user) {
            callback({ error: 'Not logged in' });
            return;
        }

        if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
            callback({ error: 'LiveKit not configured' });
            return;
        }

        try {
            const token = await generateLiveKitToken(
                roomName || 'video-messenger-room',
                user.username,
                socket.id
            );

            callback({
                token,
                url: LIVEKIT_URL,
                roomName: roomName || 'video-messenger-room',
            });

            console.log(`[LiveKit] Token generated for ${user.username} (${socket.id})`);
        } catch (error) {
            console.error('[LiveKit] Token generation error:', error);
            callback({ error: error.message });
        }
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

    // Handle emoji tags on video circles
    socket.on('emoji-tag', (data) => {
        const { targetId, emoji, fromUser } = data;

        // Broadcast to ALL users (including sender for consistency)
        io.emit('emoji-tag', {
            targetId: targetId,
            emoji: emoji,
            fromUser: fromUser,
            fromSocketId: socket.id
        });

        console.log(`Emoji tag from ${fromUser}: ${emoji} on ${targetId}`);
    });

    // Handle smile status for physics attraction
    socket.on('smile-status', (data) => {
        const { isSmiling, participantId } = data;

        // Broadcast smile status to all OTHER users
        socket.broadcast.emit('smile-status', {
            participantId: participantId,
            isSmiling: isSmiling
        });

        console.log(`Smile status: ${participantId} is ${isSmiling ? 'smiling 😊' : 'not smiling'}`);
    });

    // ==================== VIDEO CIRCLE POSITION SYNC ====================
    // Shared Reality: When User A moves a circle, all users see it move

    // Handle position update from a user
    socket.on('video-position-update', (data) => {
        const { participantId, x, y, timestamp, movedBy } = data;

        // Store position in server state
        videoPositions.set(participantId, {
            x: x,
            y: y,
            timestamp: timestamp || Date.now(),
            movedBy: movedBy || socket.id
        });

        // Broadcast to all OTHER users
        socket.broadcast.emit('video-position-update', {
            participantId: participantId,
            x: x,
            y: y,
            timestamp: timestamp,
            movedBy: movedBy || socket.id
        });

        console.log(`Video position: ${participantId} moved to (${Math.round(x)}, ${Math.round(y)}) by ${movedBy}`);
    });

    // Handle request for full position sync (new user joining)
    socket.on('video-position-sync-request', () => {
        // Convert Map to plain object for transmission
        const positionsObj = {};
        videoPositions.forEach((pos, id) => {
            positionsObj[id] = pos;
        });

        // Send current state to requesting user (use socket.id directly for reliability)
        socket.emit('video-position-sync', {
            positions: positionsObj,
            formation: currentFormation,
            presenterId: formationPresenterId
        });

        console.log(`Position sync sent to ${socket.id}: ${videoPositions.size} positions`);
    });

    // Handle formation mode change
    socket.on('video-formation-change', (data) => {
        const { formation, presenterId, targetPositions } = data;
        const user = connectedUsers.get(socket.id);

        // Update server state
        currentFormation = formation;
        formationPresenterId = presenterId || null;

        // If target positions provided, update all positions
        if (targetPositions) {
            Object.entries(targetPositions).forEach(([participantId, pos]) => {
                videoPositions.set(participantId, {
                    x: pos.x,
                    y: pos.y,
                    scale: pos.scale,
                    timestamp: Date.now(),
                    movedBy: socket.id
                });
            });
        }

        // Broadcast to ALL users (including sender for consistency)
        io.emit('video-formation-change', {
            formation: formation,
            presenterId: presenterId,
            targetPositions: targetPositions,
            changedBy: user?.username || socket.id
        });

        console.log(`Formation changed to '${formation}' by ${user?.username || socket.id}`);
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

    // ==================== Fabric.js Studio Events ====================

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
        console.log(`[SYNC] Canvas sync request from ${socket.id}, inStudio: ${socket.inStudio}`);
        if (!socket.inStudio) {
            console.log(`[SYNC] Rejected - user not in studio`);
            return;
        }

        // Broadcast to all other users that someone needs the canvas state
        console.log(`[SYNC] Broadcasting sync request to other studio users`);
        socket.broadcast.emit('studio-canvas-sync-request', {
            requesterId: data.requesterId
        });
    });

    // Canvas sync response (sending full canvas state)
    socket.on('studio-canvas-sync', (data) => {
        console.log(`[SYNC] Canvas sync response from ${socket.id}, target: ${data.targetId}, objects: ${data.objects?.length || 0}`);
        if (!socket.inStudio) {
            console.log(`[SYNC] Rejected - user not in studio`);
            return;
        }

        // Send to specific target or broadcast
        if (data.targetId) {
            console.log(`[SYNC] Sending sync to specific target: ${data.targetId}`);
            io.to(data.targetId).emit('studio-canvas-sync', {
                socketId: socket.id,
                targetId: data.targetId,
                objects: data.objects,
                nextObjectId: data.nextObjectId
            });
        } else {
            console.log(`[SYNC] Broadcasting sync to all studio users`);
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

            // Clean up video position for this user
            videoPositions.delete(socket.id);

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
    console.log(`LiveKit: ${LIVEKIT_API_KEY ? 'Configured' : 'Not configured (set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL)'}`);
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

// Export for Vercel
module.exports = app;
