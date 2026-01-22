// SFU Connection Manager using LiveKit
// Manages multi-party video with circular honeycomb layout (Apple Watch style)

const SFU_ENABLED = true; // Feature flag

class SFUConnectionManager {
    constructor() {
        this.socket = null;
        this.room = null;
        this.localParticipant = null;
        this.remoteParticipants = new Map(); // participantId -> RemoteParticipant
        this.remoteStreams = new Map();      // participantId -> MediaStream
        this.peerNames = new Map();          // participantId -> username
        this.localStream = null;
        this.localVideoTrack = null;
        this.localAudioTrack = null;

        this.isConnected = false;
        this.mySocketId = null;
        this.livekitUrl = null;
        this.livekitToken = null;

        // DOM references
        this.honeycombContainer = null;

        // Circular layout settings
        this.circleSize = 160;  // Base size for video circles
        this.centerX = 0;
        this.centerY = 0;

        // Drag state
        this.draggedElement = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;

        // Emoji tags - participantId -> { emoji, fromUser }
        this.emojiTags = new Map();

        // Available tag emojis
        this.tagEmojis = ['👋', '❤️', '😂', '🔥', '👏', '🎉', '😍', '🤔', '👀', '💯', '🙌', '✨'];

        // ==================== SHARED REALITY STATE ====================
        // Position sync: All users see same circle positions
        this.circlePositions = new Map();      // participantId -> { x, y, scale }
        this.lastActivityTime = new Map();     // participantId -> timestamp (for gravity)

        // Formation state
        this.currentFormation = 'cluster';     // 'cluster' | 'audience' | 'stack' | 'scatter'
        this.formationPresenterId = null;      // For audience mode

        // Gravity/clustering settings
        this.gravityEnabled = false;  // DISABLED - was causing page crashes
        this.gravityLoopActive = false;
        this.inactivityThreshold = 10000;      // 10 seconds before gravity kicks in
        this.gravityStrength = 0.01;           // Weak spring constant
        this.maxGravityForce = 0.5;            // Max px per frame
        this.clusterRadius = 200;              // Target cluster size

        // Bind methods
        this.onTrackSubscribed = this.onTrackSubscribed.bind(this);
        this.onTrackUnsubscribed = this.onTrackUnsubscribed.bind(this);
        this.onParticipantConnected = this.onParticipantConnected.bind(this);
        this.onParticipantDisconnected = this.onParticipantDisconnected.bind(this);
        this.onDisconnected = this.onDisconnected.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }

    async init() {
        // Wait for DOM and socket
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.honeycombContainer = document.getElementById('videoHoneycomb');

        // Setup global drag handlers
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('touchmove', this.onMouseMove, { passive: false });
        document.addEventListener('touchend', this.onMouseUp);

        // Setup canvas transform listener (for Studio mode canvas pinning)
        this.setupCanvasTransformListener();

        // Wait for the main connection manager to establish socket
        this.waitForSocket();
    }

    // ==================== CANVAS TRANSFORM SYNC (Studio Mode) ====================
    // Video circles transform with Fabric.js canvas when in Studio mode

    setupCanvasTransformListener() {
        // Listen for canvas viewport changes from studio-fabric.js
        window.addEventListener('canvas-viewport-change', (e) => {
            // Only apply transform when in Studio mode
            if (!document.body.classList.contains('studio-active')) {
                this.resetHoneycombToViewport();
                return;
            }

            const { transform, zoom } = e.detail;

            // Get canvas container position to align honeycomb with canvas
            const canvasContainer = document.getElementById('studioCanvasContainer');
            if (!canvasContainer || !this.honeycombContainer) return;

            const canvasRect = canvasContainer.getBoundingClientRect();

            // Position honeycomb to match canvas container exactly
            this.honeycombContainer.style.position = 'fixed';
            this.honeycombContainer.style.top = `${canvasRect.top}px`;
            this.honeycombContainer.style.left = `${canvasRect.left}px`;
            this.honeycombContainer.style.right = 'auto';
            this.honeycombContainer.style.bottom = 'auto';
            this.honeycombContainer.style.width = `${canvasRect.width}px`;
            this.honeycombContainer.style.height = `${canvasRect.height}px`;

            // Apply Fabric.js viewport transform as CSS matrix
            // viewportTransform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
            const cssMatrix = `matrix(${transform.join(',')})`;
            this.honeycombContainer.style.transform = cssMatrix;
            this.honeycombContainer.style.transformOrigin = '0 0';
            this.honeycombContainer.classList.add('canvas-pinned');

            console.log(`[SharedReality] Canvas transform applied: zoom=${zoom.toFixed(2)}, pos=(${Math.round(canvasRect.left)}, ${Math.round(canvasRect.top)})`);
        });

        // Listen for mode changes to reset honeycomb position
        window.addEventListener('mode-changed', (e) => {
            if (e.detail?.mode !== 'studio') {
                this.resetHoneycombToViewport();
            }
        });

        // Also reset when switching modes via body class observation
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isStudio = document.body.classList.contains('studio-active');
                    if (!isStudio) {
                        this.resetHoneycombToViewport();
                        this.removeTestCircle();
                    } else {
                        // In Studio mode, show test circle if no remote participants
                        this.addTestCircleIfNeeded();
                    }
                }
            });
        });
        observer.observe(document.body, { attributes: true });
    }

    // Add a test circle for debugging canvas pinning when no remote participants
    addTestCircleIfNeeded() {
        if (!this.honeycombContainer) return;
        if (this.remoteStreams.size > 0) return; // Real participants exist

        // Check if test circle already exists
        if (this.honeycombContainer.querySelector('.test-circle')) return;

        // Show honeycomb
        this.honeycombContainer.classList.remove('hidden');

        // Create test circle
        const testCircle = document.createElement('div');
        testCircle.className = 'honeycomb-video test-circle';
        testCircle.dataset.peerId = 'test-circle';
        testCircle.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                font-size: 14px;
                text-align: center;
                padding: 10px;
            ">
                Canvas<br>Pin Test
            </div>
        `;
        testCircle.style.cssText = `
            position: absolute;
            left: 200px;
            top: 200px;
            width: ${this.circleSize}px;
            height: ${this.circleSize}px;
            cursor: grab;
        `;

        // Add drag handlers
        this.setupDragHandlers(testCircle);

        this.honeycombContainer.appendChild(testCircle);
        console.log('[SharedReality] Test circle added for canvas pinning debug');
    }

    removeTestCircle() {
        const testCircle = this.honeycombContainer?.querySelector('.test-circle');
        if (testCircle) {
            testCircle.remove();
            console.log('[SharedReality] Test circle removed');
        }
    }

    // Reset honeycomb to full viewport positioning (Video mode)
    resetHoneycombToViewport() {
        if (!this.honeycombContainer) return;

        this.honeycombContainer.style.transform = '';
        this.honeycombContainer.style.top = '';
        this.honeycombContainer.style.left = '';
        this.honeycombContainer.style.right = '';
        this.honeycombContainer.style.bottom = '';
        this.honeycombContainer.style.width = '';
        this.honeycombContainer.style.height = '';
        this.honeycombContainer.classList.remove('canvas-pinned');
    }

    waitForSocket() {
        // Check if connectionManager exists and has a socket
        const checkSocket = () => {
            if (window.connectionManager && window.connectionManager.socket) {
                this.socket = window.connectionManager.socket;
                this.mySocketId = window.connectionManager.mySocketId;
                this.setupSocketHandlers();
                console.log('[LiveKit] Socket connected, ready for token request');
            } else {
                setTimeout(checkSocket, 500);
            }
        };
        checkSocket();
    }

    setupSocketHandlers() {
        if (!this.socket) return;

        // Listen for user events to track names
        this.socket.on('user-joined', (data) => {
            this.peerNames.set(data.socketId, data.username);
        });

        this.socket.on('user-left', (data) => {
            this.handlePeerLeft(data.socketId);
        });

        // Listen for emoji tags from other users
        this.socket.on('emoji-tag', (data) => {
            console.log('[LiveKit] Received emoji tag:', data);
            this.emojiTags.set(data.targetId, {
                emoji: data.emoji,
                fromUser: data.fromUser,
                timestamp: Date.now()
            });
            this.updateVideoHoneycomb();

            // Auto-clear tag after 10 seconds
            setTimeout(() => {
                const tag = this.emojiTags.get(data.targetId);
                if (tag && tag.timestamp === Date.now()) {
                    this.emojiTags.delete(data.targetId);
                    this.updateVideoHoneycomb();
                }
            }, 10000);
        });

        // Listen for tag cleared
        this.socket.on('emoji-tag-cleared', (data) => {
            this.emojiTags.delete(data.targetId);
            this.updateVideoHoneycomb();
        });

        // Listen for smile status from other users
        this.socket.on('smile-status', (data) => {
            console.log('[LiveKit] Received smile status:', data);
            if (data.participantId && data.participantId !== this.localParticipant?.identity) {
                // Visual feedback on remote video circle
                const remoteCircle = this.honeycombContainer?.querySelector(
                    `[data-peer-id="${data.participantId}"]`
                );
                if (remoteCircle) {
                    if (data.isSmiling) {
                        remoteCircle.classList.add('smiling');
                    } else {
                        remoteCircle.classList.remove('smiling');
                    }
                }
            }
        });

        // ==================== SHARED REALITY: Position Sync ====================

        // Receive position updates from other users
        this.socket.on('video-position-update', (data) => {
            // Ignore updates from self
            if (data.movedBy === this.mySocketId) return;

            console.log(`[SharedReality] Position update: ${data.participantId} -> (${Math.round(data.x)}, ${Math.round(data.y)})`);

            // Update local state
            this.circlePositions.set(data.participantId, {
                x: data.x,
                y: data.y,
                scale: data.scale || 1
            });
            this.lastActivityTime.set(data.participantId, Date.now());

            // Apply position to circle with animation
            this.applyPositionWithAnimation(data.participantId, data.x, data.y, data.scale);
        });

        // Receive full position sync (on join)
        this.socket.on('video-position-sync', (data) => {
            console.log(`[SharedReality] Full sync received: ${Object.keys(data.positions).length} positions`);

            // Apply all positions
            Object.entries(data.positions).forEach(([participantId, pos]) => {
                this.circlePositions.set(participantId, {
                    x: pos.x,
                    y: pos.y,
                    scale: pos.scale || 1
                });
                this.lastActivityTime.set(participantId, pos.timestamp || Date.now());
                this.applyPositionWithAnimation(participantId, pos.x, pos.y, pos.scale);
            });

            // Update formation state
            this.currentFormation = data.formation || 'cluster';
            this.formationPresenterId = data.presenterId || null;

            // Update formation UI if visible
            this.updateFormationUI();
        });

        // Receive formation change from other users
        this.socket.on('video-formation-change', (data) => {
            console.log(`[SharedReality] Formation changed to '${data.formation}' by ${data.changedBy}`);

            this.currentFormation = data.formation;
            this.formationPresenterId = data.presenterId || null;

            // Apply target positions if provided
            if (data.targetPositions) {
                Object.entries(data.targetPositions).forEach(([participantId, pos]) => {
                    this.circlePositions.set(participantId, {
                        x: pos.x,
                        y: pos.y,
                        scale: pos.scale || 1
                    });
                    this.applyPositionWithAnimation(participantId, pos.x, pos.y, pos.scale);
                });
            }

            // Update formation UI
            this.updateFormationUI();
        });

        // Request position sync on connection (with delay to allow circles to be created)
        setTimeout(() => {
            this.socket.emit('video-position-sync-request');
            console.log('[SharedReality] Requested position sync from server');
        }, 1500);
    }

    // Apply position to a circle with smooth animation
    applyPositionWithAnimation(participantId, x, y, scale = 1) {
        const circle = this.honeycombContainer?.querySelector(
            `[data-peer-id="${participantId}"]`
        );
        if (!circle) return;

        // Add transition for smooth animation
        circle.style.transition = 'left 0.3s ease-out, top 0.3s ease-out, transform 0.3s ease-out';
        circle.style.left = `${x}px`;
        circle.style.top = `${y}px`;

        if (scale !== 1) {
            circle.style.transform = `scale(${scale})`;
        }

        // Remove transition after animation
        setTimeout(() => {
            circle.style.transition = 'none';
        }, 300);
    }

    // Update formation UI buttons
    updateFormationUI() {
        const controls = document.getElementById('formationControls');
        if (!controls) return;

        controls.querySelectorAll('button').forEach(btn => {
            const formation = btn.dataset.formation;
            btn.classList.toggle('active', formation === this.currentFormation);
        });
    }

    // Request LiveKit token from server
    async requestToken(roomName = 'video-messenger-room') {
        return new Promise((resolve, reject) => {
            this.socket.emit('getLiveKitToken', { roomName }, (response) => {
                if (response && response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Wait for LiveKit client to load
    async waitForLiveKitClient(maxAttempts = 20) {
        for (let i = 0; i < maxAttempts; i++) {
            if (window.LivekitClient) {
                return true;
            }
            console.log(`[LiveKit] Waiting for client library... (${i + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        return false;
    }

    // Connect to LiveKit room
    async connectToRoom(token, url) {
        const clientLoaded = await this.waitForLiveKitClient();
        if (!clientLoaded) {
            console.error('[LiveKit] Client library failed to load');
            return false;
        }

        try {
            const { Room, RoomEvent, Track, VideoPresets } = window.LivekitClient;

            // Create room instance
            this.room = new Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: VideoPresets.h720.resolution,
                },
            });

            // Set up event handlers
            this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed);
            this.room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed);
            this.room.on(RoomEvent.ParticipantConnected, this.onParticipantConnected);
            this.room.on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected);
            this.room.on(RoomEvent.Disconnected, this.onDisconnected);

            // Connect to the room
            await this.room.connect(url, token);

            this.localParticipant = this.room.localParticipant;
            this.isConnected = true;

            console.log(`[LiveKit] Connected to room: ${this.room.name}`);
            console.log(`[LiveKit] Local participant: ${this.localParticipant.identity}`);

            // Subscribe to existing participants' tracks
            this.room.remoteParticipants.forEach((participant) => {
                this.onParticipantConnected(participant);
                participant.trackPublications.forEach((publication) => {
                    if (publication.track) {
                        this.onTrackSubscribed(publication.track, publication, participant);
                    }
                });
            });

            return true;
        } catch (error) {
            console.error('[LiveKit] Failed to connect to room:', error);
            return false;
        }
    }

    // Publish local tracks
    async publishTracks() {
        if (!this.room || !this.localStream) {
            console.error('[LiveKit] Room or local stream not ready');
            return false;
        }

        try {
            const { Track } = window.LivekitClient;

            // Get tracks from local stream
            const videoTracks = this.localStream.getVideoTracks();
            const audioTracks = this.localStream.getAudioTracks();

            // Publish video track
            if (videoTracks.length > 0) {
                this.localVideoTrack = await this.localParticipant.publishTrack(videoTracks[0], {
                    name: 'camera',
                    source: Track.Source.Camera,
                });
                console.log('[LiveKit] Published video track');
            }

            // Publish audio track
            if (audioTracks.length > 0) {
                this.localAudioTrack = await this.localParticipant.publishTrack(audioTracks[0], {
                    name: 'microphone',
                    source: Track.Source.Microphone,
                });
                console.log('[LiveKit] Published audio track');
            }

            return true;
        } catch (error) {
            console.error('[LiveKit] Failed to publish tracks:', error);
            return false;
        }
    }

    // Handle track subscribed (remote track received)
    onTrackSubscribed(track, publication, participant) {
        console.log(`[LiveKit] Track subscribed: ${track.kind} from ${participant.identity}`);

        const participantId = participant.identity;

        // Create or get stream for this participant
        if (!this.remoteStreams.has(participantId)) {
            this.remoteStreams.set(participantId, new MediaStream());
        }

        const stream = this.remoteStreams.get(participantId);

        // Add track to stream
        if (track.kind === 'video' || track.kind === 'audio') {
            const mediaTrack = track.mediaStreamTrack;
            if (mediaTrack) {
                stream.addTrack(mediaTrack);
            }
        }

        // Store participant name
        this.peerNames.set(participantId, participant.name || participant.identity);
        this.remoteParticipants.set(participantId, participant);

        // Update UI
        this.updateVideoHoneycomb();
    }

    // Handle track unsubscribed
    onTrackUnsubscribed(track, publication, participant) {
        console.log(`[LiveKit] Track unsubscribed: ${track.kind} from ${participant.identity}`);

        const participantId = participant.identity;
        const stream = this.remoteStreams.get(participantId);

        if (stream && track.mediaStreamTrack) {
            stream.removeTrack(track.mediaStreamTrack);
        }

        // Update UI
        this.updateVideoHoneycomb();
    }

    // Handle participant connected
    onParticipantConnected(participant) {
        console.log(`[LiveKit] Participant connected: ${participant.identity}`);
        this.peerNames.set(participant.identity, participant.name || participant.identity);
        this.remoteParticipants.set(participant.identity, participant);
    }

    // Handle participant disconnected
    onParticipantDisconnected(participant) {
        console.log(`[LiveKit] Participant disconnected: ${participant.identity}`);
        this.handlePeerLeft(participant.identity);
    }

    // Handle room disconnection
    onDisconnected(reason) {
        console.log(`[LiveKit] Disconnected from room: ${reason}`);
        this.isConnected = false;
        this.hideHoneycomb();
    }

    // Handle peer left
    handlePeerLeft(participantId) {
        console.log(`[LiveKit] Peer left: ${participantId}`);

        // Remove stream
        this.remoteStreams.delete(participantId);
        this.peerNames.delete(participantId);
        this.remoteParticipants.delete(participantId);

        // Update UI
        this.updateVideoHoneycomb();
    }

    // Start the LiveKit connection
    async start(localStream) {
        // Ensure socket is set from connectionManager
        if (!this.socket && window.connectionManager?.socket) {
            this.socket = window.connectionManager.socket;
            this.mySocketId = window.connectionManager.mySocketId;
        }

        console.log('[LiveKit] Starting...', { enabled: SFU_ENABLED, hasSocket: !!this.socket, hasStream: !!localStream });

        if (!SFU_ENABLED) {
            console.log('[LiveKit] SFU disabled, using P2P');
            return false;
        }

        if (!this.socket) {
            console.error('[LiveKit] Socket not connected');
            return false;
        }

        if (!localStream) {
            console.error('[LiveKit] No local stream provided');
            return false;
        }

        this.localStream = localStream;

        try {
            // Request token from server
            console.log('[LiveKit] Requesting token...');
            const { token, url, roomName } = await this.requestToken();

            if (!token || !url) {
                console.error('[LiveKit] Server did not return token or URL. LiveKit may not be configured.');
                return false;
            }

            console.log(`[LiveKit] Got token for room: ${roomName}`);
            this.livekitUrl = url;
            this.livekitToken = token;

            // Connect to room
            const connected = await this.connectToRoom(token, url);
            if (!connected) return false;

            // Publish local tracks
            await this.publishTracks();

            // Hide legacy P2P remote video frame (we use honeycomb for remotes now)
            const legacyRemoteFrame = document.getElementById('remoteVideoFrame');
            if (legacyRemoteFrame) {
                legacyRemoteFrame.classList.add('hidden');
                legacyRemoteFrame.style.display = 'none';
            }

            // Show honeycomb
            this.showHoneycomb();
            this.updateVideoHoneycomb();

            console.log('[LiveKit] Started successfully');
            return true;
        } catch (error) {
            console.error('[LiveKit] Failed to start:', error);
            return false;
        }
    }

    // Show the honeycomb container
    showHoneycomb() {
        if (this.honeycombContainer) {
            this.honeycombContainer.classList.remove('hidden');
        }
    }

    // Hide the honeycomb container
    hideHoneycomb() {
        if (this.honeycombContainer) {
            this.honeycombContainer.classList.add('hidden');
        }
    }

    // Calculate honeycomb positions (Apple Watch style circular arrangement)
    calculateHoneycombPositions(count) {
        const positions = [];
        const containerWidth = this.honeycombContainer?.offsetWidth || window.innerWidth;
        const containerHeight = this.honeycombContainer?.offsetHeight || window.innerHeight;

        this.centerX = containerWidth / 2;
        this.centerY = containerHeight / 2;

        // Keep circles large - minimum 150px, scale gently with count
        // Use logarithmic scaling to prevent drastic size reduction
        const baseSize = Math.min(containerWidth, containerHeight) * 0.3;
        this.circleSize = Math.max(150, Math.min(200, baseSize / (1 + Math.log2(count) * 0.3)));

        if (count === 1) {
            // Single user: center
            positions.push({ x: this.centerX, y: this.centerY, scale: 1.2 });
        } else if (count === 2) {
            // Two users: side by side
            const offset = this.circleSize * 0.8;
            positions.push({ x: this.centerX - offset, y: this.centerY, scale: 1 });
            positions.push({ x: this.centerX + offset, y: this.centerY, scale: 1 });
        } else if (count === 3) {
            // Three users: triangle
            const radius = this.circleSize * 1.0;
            for (let i = 0; i < 3; i++) {
                const angle = (i * 2 * Math.PI / 3) - Math.PI / 2; // Start from top
                positions.push({
                    x: this.centerX + radius * Math.cos(angle),
                    y: this.centerY + radius * Math.sin(angle),
                    scale: 1
                });
            }
        } else if (count === 4) {
            // Four users: 2x2 grid
            const radius = this.circleSize * 1.0;
            for (let i = 0; i < 4; i++) {
                const angle = (i * 2 * Math.PI / 4) - Math.PI / 4; // Start from top-right
                positions.push({
                    x: this.centerX + radius * Math.cos(angle),
                    y: this.centerY + radius * Math.sin(angle),
                    scale: 1
                });
            }
        } else {
            // 5+ users: spread out in rows, no center positioning
            const cols = Math.ceil(Math.sqrt(count));
            const rows = Math.ceil(count / cols);
            const spacingX = this.circleSize * 1.1;
            const spacingY = this.circleSize * 1.1;
            const startX = this.centerX - (cols - 1) * spacingX / 2;
            const startY = this.centerY - (rows - 1) * spacingY / 2;

            for (let i = 0; i < count; i++) {
                const row = Math.floor(i / cols);
                const col = i % cols;
                // Center the last row if it's not full
                const itemsInRow = row === rows - 1 ? count - row * cols : cols;
                const rowOffset = (cols - itemsInRow) * spacingX / 2;

                positions.push({
                    x: startX + col * spacingX + rowOffset,
                    y: startY + row * spacingY,
                    scale: 1
                });
            }
        }

        return positions;
    }

    // Update the video honeycomb layout
    updateVideoHoneycomb() {
        if (!this.honeycombContainer) return;

        // Clear existing elements
        this.honeycombContainer.innerHTML = '';

        // Collect remote participants only (local video uses the preview dock)
        const participants = [];

        for (const [participantId, stream] of this.remoteStreams) {
            // Skip if this is somehow our own stream
            if (this.localParticipant && participantId === this.localParticipant.identity) {
                continue;
            }

            if (stream.getTracks().length > 0) {
                participants.push({
                    id: participantId,
                    name: this.peerNames.get(participantId) || 'Guest',
                    stream: stream,
                    isLocal: false
                });
            }
        }

        // If no remote participants, hide honeycomb
        if (participants.length === 0) {
            this.hideHoneycomb();
            return;
        }

        // Calculate positions
        const positions = this.calculateHoneycombPositions(participants.length);

        // Create video elements
        participants.forEach((participant, index) => {
            const pos = positions[index];
            const element = this.createVideoCircle(participant, pos);
            this.honeycombContainer.appendChild(element);
        });
    }

    // Create a circular video element for remote participants
    createVideoCircle(participant, position) {
        const container = document.createElement('div');
        container.className = 'honeycomb-video remote';
        container.dataset.peerId = participant.id;

        // Position and size
        const size = this.circleSize * position.scale;
        container.style.cssText = `
            position: absolute;
            left: ${position.x - size / 2}px;
            top: ${position.y - size / 2}px;
            width: ${size}px;
            height: ${size}px;
            transition: none;
            cursor: grab;
        `;

        // Video element
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true; // ALL videos muted by default
        video.srcObject = participant.stream;

        // Label with participant name
        const label = document.createElement('div');
        label.className = 'honeycomb-label';
        label.textContent = participant.name;

        // Emoji tag display (if tagged)
        const tag = this.emojiTags.get(participant.id);
        if (tag) {
            const tagElement = document.createElement('div');
            tagElement.className = 'emoji-tag';
            tagElement.textContent = tag.emoji;
            tagElement.style.cssText = `
                position: absolute;
                top: -10px;
                right: -10px;
                font-size: 32px;
                z-index: 100;
                animation: emoji-bounce 0.5s ease-out;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            `;
            container.appendChild(tagElement);
        }

        container.appendChild(video);
        container.appendChild(label);

        // Add drag handlers
        this.setupDragHandlers(container);

        // Add click handler for emoji tagging (on click, not drag)
        this.setupTagHandler(container, participant.id, participant.name);

        return container;
    }

    // Setup click handler for emoji tagging
    setupTagHandler(element, participantId, participantName) {
        let clickStartTime = 0;
        let clickStartPos = { x: 0, y: 0 };

        element.addEventListener('mousedown', (e) => {
            clickStartTime = Date.now();
            clickStartPos = { x: e.clientX, y: e.clientY };
        });

        element.addEventListener('mouseup', (e) => {
            const clickDuration = Date.now() - clickStartTime;
            const moveDistance = Math.sqrt(
                Math.pow(e.clientX - clickStartPos.x, 2) +
                Math.pow(e.clientY - clickStartPos.y, 2)
            );

            // Only show picker if it was a quick click (not drag)
            if (clickDuration < 300 && moveDistance < 10) {
                this.showEmojiPicker(e.clientX, e.clientY, participantId, participantName);
            }
        });

        // Touch support
        element.addEventListener('touchstart', (e) => {
            clickStartTime = Date.now();
            clickStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        });

        element.addEventListener('touchend', (e) => {
            const clickDuration = Date.now() - clickStartTime;
            const touch = e.changedTouches[0];
            const moveDistance = Math.sqrt(
                Math.pow(touch.clientX - clickStartPos.x, 2) +
                Math.pow(touch.clientY - clickStartPos.y, 2)
            );

            if (clickDuration < 300 && moveDistance < 10) {
                this.showEmojiPicker(touch.clientX, touch.clientY, participantId, participantName);
            }
        });
    }

    // Show emoji picker popup
    showEmojiPicker(x, y, targetId, targetName) {
        // Remove existing picker
        const existingPicker = document.getElementById('emoji-tag-picker');
        if (existingPicker) existingPicker.remove();

        const picker = document.createElement('div');
        picker.id = 'emoji-tag-picker';
        picker.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -100%) translateY(-10px);
            background: white;
            border-radius: 16px;
            padding: 8px;
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 4px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: picker-appear 0.2s ease-out;
        `;

        // Add picker animation style
        if (!document.getElementById('emoji-tag-styles')) {
            const style = document.createElement('style');
            style.id = 'emoji-tag-styles';
            style.textContent = `
                @keyframes picker-appear {
                    from { opacity: 0; transform: translate(-50%, -100%) translateY(0) scale(0.8); }
                    to { opacity: 1; transform: translate(-50%, -100%) translateY(-10px) scale(1); }
                }
                @keyframes emoji-bounce {
                    0% { transform: scale(0); }
                    50% { transform: scale(1.3); }
                    100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            grid-column: 1 / -1;
            font-size: 12px;
            color: #666;
            text-align: center;
            padding-bottom: 4px;
            border-bottom: 1px solid #eee;
            margin-bottom: 4px;
        `;
        header.textContent = `Tag ${targetName}`;
        picker.appendChild(header);

        // Emoji buttons
        this.tagEmojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.textContent = emoji;
            btn.style.cssText = `
                font-size: 24px;
                width: 40px;
                height: 40px;
                border: none;
                background: transparent;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.15s;
            `;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#f0f0f0';
                btn.style.transform = 'scale(1.2)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'transparent';
                btn.style.transform = 'scale(1)';
            });
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[LiveKit] Emoji button clicked:', emoji);
                this.sendEmojiTag(targetId, emoji);
                picker.remove();
                document.removeEventListener('click', closeHandler);
            });
            // Also handle touch
            btn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[LiveKit] Emoji button touched:', emoji);
                this.sendEmojiTag(targetId, emoji);
                picker.remove();
                document.removeEventListener('click', closeHandler);
            });
            picker.appendChild(btn);
        });

        document.body.appendChild(picker);

        // Close picker when clicking outside (use click, not mousedown)
        const closeHandler = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        // Delay adding the close handler to prevent immediate closure
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 200);
    }

    // Send emoji tag to server
    sendEmojiTag(targetId, emoji) {
        // Try to get socket from connectionManager if not set
        if (!this.socket && window.connectionManager?.socket) {
            this.socket = window.connectionManager.socket;
        }

        if (!this.socket) {
            console.error('[LiveKit] Cannot send emoji tag - no socket connection');
            return;
        }

        const myName = window.connectionManager?.username || 'Someone';

        console.log('[LiveKit] Sending emoji tag:', { targetId, emoji, fromUser: myName });

        this.socket.emit('emoji-tag', {
            targetId: targetId,
            emoji: emoji,
            fromUser: myName
        });

        // Also update locally immediately
        this.emojiTags.set(targetId, {
            emoji: emoji,
            fromUser: myName,
            timestamp: Date.now()
        });
        this.updateVideoHoneycomb();

        // Auto-clear after 10 seconds
        const tagTime = Date.now();
        setTimeout(() => {
            const tag = this.emojiTags.get(targetId);
            if (tag && tag.timestamp === tagTime) {
                this.emojiTags.delete(targetId);
                this.updateVideoHoneycomb();
            }
        }, 10000);
    }

    // Setup drag handlers for a video circle (simple drag, no physics)
    setupDragHandlers(element) {
        const onStart = (e) => {
            e.preventDefault();
            this.draggedElement = element;
            this.isDragging = true;
            element.style.cursor = 'grabbing';
            element.style.zIndex = '1000';
            element.style.transition = 'none';

            const rect = element.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            this.dragOffset = {
                x: clientX - rect.left - rect.width / 2,
                y: clientY - rect.top - rect.height / 2
            };
        };

        element.addEventListener('mousedown', onStart);
        element.addEventListener('touchstart', onStart, { passive: false });
    }

    // Handle mouse/touch move for dragging (simple position update)
    onMouseMove(e) {
        if (!this.draggedElement) return;

        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const containerRect = this.honeycombContainer.getBoundingClientRect();
        const size = this.draggedElement.offsetWidth;

        const newX = clientX - containerRect.left - this.dragOffset.x - size / 2;
        const newY = clientY - containerRect.top - this.dragOffset.y - size / 2;

        // Clamp to container bounds
        const maxX = containerRect.width - size;
        const maxY = containerRect.height - size;
        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));

        this.draggedElement.style.left = `${clampedX}px`;
        this.draggedElement.style.top = `${clampedY}px`;
    }

    // Handle mouse/touch up to end dragging (simple reset + broadcast)
    onMouseUp() {
        if (this.draggedElement) {
            const peerId = this.draggedElement.dataset.peerId;
            const x = parseFloat(this.draggedElement.style.left) || 0;
            const y = parseFloat(this.draggedElement.style.top) || 0;

            // Update local position state
            this.circlePositions.set(peerId, { x, y, scale: 1 });
            this.lastActivityTime.set(peerId, Date.now());

            // Broadcast position to all other users (Shared Reality)
            if (this.socket) {
                this.socket.emit('video-position-update', {
                    participantId: peerId,
                    x: x,
                    y: y,
                    timestamp: Date.now(),
                    movedBy: this.mySocketId
                });
                console.log(`[SharedReality] Position broadcast: ${peerId} -> (${Math.round(x)}, ${Math.round(y)})`);
            }

            // Reset drag state
            this.draggedElement.style.cursor = 'grab';
            this.draggedElement.style.zIndex = '';
            this.draggedElement = null;
            this.isDragging = false;

            // Restart gravity loop if not running
            this.startGravityLoop();
        }
    }

    // ==================== GRAVITY/CLUSTERING SYSTEM ====================
    // Circles drift back to cluster after 10s of inactivity

    startGravityLoop() {
        if (this.gravityLoopActive || !this.gravityEnabled) return;
        this.gravityLoopActive = true;

        const loop = () => {
            if (!this.gravityLoopActive || !this.gravityEnabled) return;

            const now = Date.now();
            const clusterCenter = this.calculateClusterCenter();
            let anyMoved = false;

            this.circlePositions.forEach((pos, participantId) => {
                const lastActivity = this.lastActivityTime.get(participantId) || 0;

                // Only apply gravity after inactivity threshold
                if (now - lastActivity < this.inactivityThreshold) return;

                const force = this.calculateGravityForce(pos, clusterCenter);
                if (Math.abs(force.x) > 0.1 || Math.abs(force.y) > 0.1) {
                    pos.x += force.x;
                    pos.y += force.y;
                    anyMoved = true;

                    // Apply position without animation (smooth drift)
                    const circle = this.honeycombContainer?.querySelector(
                        `[data-peer-id="${participantId}"]`
                    );
                    if (circle) {
                        circle.style.left = `${pos.x}px`;
                        circle.style.top = `${pos.y}px`;
                    }

                    // Broadcast if moved significantly (throttled)
                    if (Math.abs(force.x) > 2 || Math.abs(force.y) > 2) {
                        this.broadcastPosition(participantId, pos.x, pos.y);
                    }
                }
            });

            // Continue loop only if there's movement potential
            if (this.circlePositions.size > 0) {
                requestAnimationFrame(loop);
            } else {
                this.gravityLoopActive = false;
            }
        };

        requestAnimationFrame(loop);
    }

    calculateGravityForce(pos, center) {
        const dx = center.x - pos.x;
        const dy = center.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Don't apply gravity if already within cluster radius
        if (distance < this.clusterRadius) return { x: 0, y: 0 };

        const forceX = dx * this.gravityStrength;
        const forceY = dy * this.gravityStrength;

        return {
            x: Math.max(-this.maxGravityForce, Math.min(this.maxGravityForce, forceX)),
            y: Math.max(-this.maxGravityForce, Math.min(this.maxGravityForce, forceY))
        };
    }

    calculateClusterCenter() {
        let sumX = 0, sumY = 0, count = 0;
        this.circlePositions.forEach(pos => {
            sumX += pos.x;
            sumY += pos.y;
            count++;
        });

        if (count > 0) {
            return { x: sumX / count, y: sumY / count };
        }

        // Default to container center
        const containerRect = this.honeycombContainer?.getBoundingClientRect();
        return {
            x: (containerRect?.width || 800) / 2 - this.circleSize / 2,
            y: (containerRect?.height || 600) / 2 - this.circleSize / 2
        };
    }

    broadcastPosition(participantId, x, y, scale = 1) {
        if (!this.socket) return;

        this.socket.emit('video-position-update', {
            participantId: participantId,
            x: x,
            y: y,
            scale: scale,
            timestamp: Date.now(),
            movedBy: this.mySocketId
        });
    }

    // ==================== FORMATION MODES ====================

    setFormation(mode, options = {}) {
        this.currentFormation = mode;
        this.formationPresenterId = options.presenterId || null;

        const participants = Array.from(this.circlePositions.keys());
        if (participants.length === 0) {
            // Use remote participants if no positions yet
            participants.push(...Array.from(this.remoteParticipants.keys()));
        }

        let targetPositions;
        switch (mode) {
            case 'cluster':
                targetPositions = this.calculateClusterFormation(participants);
                break;
            case 'audience':
                targetPositions = this.calculateAudienceFormation(participants, options.presenterId);
                break;
            case 'stack':
                targetPositions = this.calculateStackFormation(participants);
                break;
            case 'scatter':
                targetPositions = this.calculateScatterFormation(participants);
                break;
            default:
                targetPositions = this.calculateClusterFormation(participants);
        }

        // Apply positions locally with animation
        Object.entries(targetPositions).forEach(([participantId, pos]) => {
            this.circlePositions.set(participantId, { x: pos.x, y: pos.y, scale: pos.scale || 1 });
            this.lastActivityTime.set(participantId, Date.now());
            this.applyPositionWithAnimation(participantId, pos.x, pos.y, pos.scale);
        });

        // Broadcast formation change to all users
        if (this.socket) {
            this.socket.emit('video-formation-change', {
                formation: mode,
                presenterId: options.presenterId,
                targetPositions: targetPositions
            });
        }

        this.updateFormationUI();
        console.log(`[SharedReality] Formation set to '${mode}'`);
    }

    calculateClusterFormation(participants) {
        const positions = {};
        const count = participants.length;
        if (count === 0) return positions;

        const containerRect = this.honeycombContainer?.getBoundingClientRect();
        const centerX = (containerRect?.width || 800) / 2 - this.circleSize / 2;
        const centerY = (containerRect?.height || 600) / 2 - this.circleSize / 2;

        // Use existing calculateHoneycombPositions logic for cluster
        const basePositions = this.calculateHoneycombPositions(count);
        participants.forEach((p, i) => {
            if (basePositions[i]) {
                positions[p] = {
                    x: basePositions[i].x - this.circleSize / 2,
                    y: basePositions[i].y - this.circleSize / 2,
                    scale: basePositions[i].scale
                };
            }
        });

        return positions;
    }

    calculateAudienceFormation(participants, presenterId) {
        const positions = {};
        const count = participants.length;
        if (count === 0) return positions;

        const containerRect = this.honeycombContainer?.getBoundingClientRect();
        const centerX = (containerRect?.width || 800) / 2 - this.circleSize / 2;
        const centerY = (containerRect?.height || 600) / 2 - this.circleSize / 2;

        const presenter = presenterId || participants[0];
        const audience = participants.filter(p => p !== presenter);

        // Presenter: center, larger
        positions[presenter] = {
            x: centerX,
            y: centerY - 50,
            scale: 1.5
        };

        // Audience: row at bottom, smaller
        audience.forEach((p, i) => {
            const offsetX = (i - (audience.length - 1) / 2) * 120;
            positions[p] = {
                x: centerX + offsetX,
                y: centerY + 180,
                scale: 0.6
            };
        });

        return positions;
    }

    calculateStackFormation(participants) {
        const positions = {};
        const count = participants.length;
        if (count === 0) return positions;

        const containerRect = this.honeycombContainer?.getBoundingClientRect();
        const centerX = (containerRect?.width || 800) / 2 - this.circleSize / 2;
        const centerY = (containerRect?.height || 600) / 2 - this.circleSize / 2;

        const stackOffset = 25;
        participants.forEach((p, i) => {
            positions[p] = {
                x: centerX + i * stackOffset,
                y: centerY + i * stackOffset,
                scale: 1 - i * 0.05,
                zIndex: participants.length - i
            };
        });

        return positions;
    }

    calculateScatterFormation(participants) {
        const positions = {};
        const count = participants.length;
        if (count === 0) return positions;

        const containerRect = this.honeycombContainer?.getBoundingClientRect();
        const w = (containerRect?.width || 800) - this.circleSize;
        const h = (containerRect?.height || 600) - this.circleSize;
        const padding = this.circleSize / 2;

        participants.forEach(p => {
            positions[p] = {
                x: padding + Math.random() * (w - 2 * padding),
                y: padding + Math.random() * (h - 2 * padding),
                scale: 0.8 + Math.random() * 0.4
            };
        });

        return positions;
    }

    // Stop and cleanup
    stop() {
        // Unpublish tracks
        if (this.localVideoTrack) {
            this.localParticipant?.unpublishTrack(this.localVideoTrack);
            this.localVideoTrack = null;
        }
        if (this.localAudioTrack) {
            this.localParticipant?.unpublishTrack(this.localAudioTrack);
            this.localAudioTrack = null;
        }

        // Disconnect from room
        if (this.room) {
            this.room.disconnect();
            this.room = null;
        }

        // Clear state
        this.remoteStreams.clear();
        this.peerNames.clear();
        this.remoteParticipants.clear();
        this.localParticipant = null;

        this.isConnected = false;
        this.hideHoneycomb();

        console.log('[LiveKit] Stopped');
    }
}

// Global instance
window.sfuConnectionManager = new SFUConnectionManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sfuConnectionManager.init();
    });
} else {
    window.sfuConnectionManager.init();
}

// Auto-start SFU when user joins video chat
document.addEventListener('DOMContentLoaded', () => {
    // Listen for login success to auto-start SFU
    const checkAndPatch = () => {
        if (window.connectionManager) {
            if (window.connectionManager.socket) {
                window.connectionManager.socket.on('login-success', async (data) => {
                    console.log('[LiveKit] Login success detected, initializing SFU...');

                    // Wait for local stream
                    setTimeout(async () => {
                        const localStream = window.videoRecorder?.stream;
                        if (localStream && SFU_ENABLED) {
                            await window.sfuConnectionManager.start(localStream);
                        }
                    }, 1000);
                });
            }
        } else {
            setTimeout(checkAndPatch, 500);
        }
    };
    checkAndPatch();
});
