// Configuration
const BACKEND_URL = window.location.hostname.includes('localhost')
    ? 'http://localhost:3000'
    : 'https://video-messenger-backend.onrender.com'; // Render backend URL

// Random username generator (Color + Animal)
function generateRandomUsername() {
    const colors = [
        'Red', 'Blue', 'Green', 'Pink', 'Purple', 'Orange', 'Yellow', 'Teal',
        'Coral', 'Mint', 'Gold', 'Silver', 'Crimson', 'Azure', 'Violet', 'Jade',
        'Ruby', 'Amber', 'Indigo', 'Cyan', 'Magenta', 'Lime', 'Navy', 'Plum'
    ];
    const animals = [
        'Panda', 'Tiger', 'Eagle', 'Dolphin', 'Fox', 'Wolf', 'Bear', 'Lion',
        'Hawk', 'Owl', 'Falcon', 'Raven', 'Phoenix', 'Dragon', 'Panther', 'Cobra',
        'Jaguar', 'Lynx', 'Otter', 'Badger', 'Moose', 'Bison', 'Rhino', 'Koala'
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    return `${color}-${animal}`;
}

// WebRTC Connection Manager
class ConnectionManager {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isLoggedIn = false;
        this.mySocketId = null;
        this.remoteSocketId = null;
        this.connectedUsers = [];

        // ICE servers configuration (STUN server)
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        // DOM elements
        this.loginModal = null;
        this.remoteVideoFrame = null;
        this.remoteVideo = null;
        this.connectionStatus = null;

        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupUI());
        } else {
            this.setupUI();
        }
    }

    setupUI() {
        // Get DOM elements
        this.loginModal = document.getElementById('loginModal');
        this.remoteVideoFrame = document.getElementById('remoteVideoFrame');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Join Video Chat button - Direct join (no auth)
        const joinVideoBtn = document.getElementById('joinVideoBtn');
        if (joinVideoBtn) {
            joinVideoBtn.addEventListener('click', () => {
                this.login('no-password-required', generateRandomUsername());
            });
        }

        // Connect button in toolbar - Direct join (no auth)
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                if (this.isLoggedIn) {
                    // Already connected - could add disconnect logic here
                    console.log('Already connected');
                } else {
                    this.login('no-password-required', generateRandomUsername());
                }
            });
        }

        // Close incoming message button
        const closeMessageBtn = document.getElementById('closeMessageBtn');
        if (closeMessageBtn) {
            closeMessageBtn.addEventListener('click', () => {
                const modal = document.getElementById('incomingMessageModal');
                const messageVideo = document.getElementById('incomingMessageVideo');
                if (modal) modal.classList.add('hidden');
                if (messageVideo) {
                    messageVideo.pause();
                    messageVideo.src = '';
                }
            });
        }

        /* COMMENTED OUT - Authentication UI handlers
        // Login button
        const loginBtn = document.getElementById('loginBtn');
        const passwordInput = document.getElementById('passwordInput');
        const usernameInput = document.getElementById('usernameInput');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                const password = passwordInput.value;
                const username = usernameInput.value || 'Guest';
                this.login(password, username);
            });

            // Enter key to login
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const password = passwordInput.value;
                    const username = usernameInput.value || 'Guest';
                    this.login(password, username);
                }
            });
        }
        */

        // Reconnect button handler
        const reconnectBtn = document.getElementById('reconnectBtn');
        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', () => {
                this.reconnect();
            });
        }
    }

    reconnect() {
        console.log('🔄 Reconnecting...');
        this.updateConnectionStatus('connecting', 'Reconnecting...');

        // Close existing connection
        this.closeConnection();

        // Find a user to connect to
        if (this.connectedUsers.length > 0) {
            const targetUser = this.connectedUsers[0];
            console.log('Reconnecting to:', targetUser.username);
            this.connectToUser(targetUser.socketId);
        } else {
            // No users available, just update status
            this.updateConnectionStatus('waiting', 'Waiting for others to join');
        }
    }

    login(password, username) {
        /* COMMENTED OUT - Password validation
        if (!password) {
            this.showStatus('Please enter a password', 'error');
            return;
        }
        */

        // Check if Socket.io is loaded
        if (typeof io === 'undefined') {
            console.error('Socket.io client library not loaded');
            this.showStatus('Connection error: Socket.io not loaded. Please refresh the page.', 'error');
            return;
        }

        // Connect to Socket.io server
        console.log('Connecting to backend:', BACKEND_URL);
        this.socket = io(BACKEND_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });

        // Socket event handlers
        this.setupSocketHandlers();

        // Emit login event
        this.socket.emit('login', { password, username });
    }

    setupSocketHandlers() {
        this.socket.on('login-success', (data) => {
            this.isLoggedIn = true;
            this.mySocketId = data.socketId;
            this.loginModal.classList.add('hidden');
            this.showStatus('Connected! Waiting for other users...', 'success');
            console.log('Login successful, socket ID:', this.mySocketId);

            // Update connection status indicator
            this.updateConnectionStatus('waiting', 'Waiting for others to join');

            // Update connect button state
            const connectBtn = document.getElementById('connectBtn');
            if (connectBtn) {
                connectBtn.classList.add('connected');
                const label = connectBtn.querySelector('.btn-label');
                if (label) label.textContent = 'Connected';
            }
        });

        this.socket.on('login-failed', (data) => {
            this.showStatus(data.message, 'error');
            this.updateConnectionStatus('error', data.message);
        });

        this.socket.on('users-list', (users) => {
            console.log('Current users:', users);
            console.log('My socket ID:', this.mySocketId);
            this.connectedUsers = users;
            this.updateUsersList();

            // Update status based on users count
            if (users.length > 0) {
                this.updateConnectionStatus('user-joined', `${users.length} user(s) online`);
            }

            // If there are other users, connect to the first one
            // Only initiate if our socket ID is greater (prevents both users from initiating)
            if (users.length > 0) {
                console.log('Comparing socket IDs:', this.mySocketId, '>', users[0].socketId, '=', this.mySocketId > users[0].socketId);
                if (this.mySocketId > users[0].socketId) {
                    console.log('I will initiate connection');
                    this.updateConnectionStatus('connecting', `Connecting to ${users[0].username}...`);
                    this.connectToUser(users[0].socketId);
                } else {
                    console.log('Waiting for other user to initiate connection');
                    this.updateConnectionStatus('connecting', `${users[0].username} connecting to you...`);
                }
            }
        });

        this.socket.on('user-joined', (user) => {
            console.log('User joined:', user);
            console.log('My socket ID:', this.mySocketId);
            this.connectedUsers.push(user);
            this.updateUsersList();
            this.showStatus(`${user.username} joined!`, 'info');

            // Update status to show user joined
            this.updateConnectionStatus('user-joined', `${user.username} is online`);

            // If we're not connected to anyone, initiate connection
            // Only initiate if our socket ID is greater (prevents both users from initiating)
            const shouldConnect = (!this.peerConnection || this.peerConnection.connectionState === 'closed')
                && this.mySocketId > user.socketId;

            console.log('Peer connection state:', this.peerConnection ? this.peerConnection.connectionState : 'null');
            console.log('Should I initiate?', shouldConnect);

            if (shouldConnect) {
                console.log('I will initiate connection to new user');
                this.updateConnectionStatus('connecting', `Connecting to ${user.username}...`);
                this.connectToUser(user.socketId);
            } else {
                console.log('Waiting for other user to initiate connection');
                this.updateConnectionStatus('connecting', `${user.username} connecting to you...`);
            }
        });

        this.socket.on('user-left', (data) => {
            console.log('User left:', data.socketId);
            this.connectedUsers = this.connectedUsers.filter(u => u.socketId !== data.socketId);
            this.updateUsersList();
            if (this.remoteSocketId === data.socketId) {
                this.showStatus('Remote user disconnected', 'info');
                this.closeConnection();
                // Update status based on remaining users
                if (this.connectedUsers.length > 0) {
                    this.updateConnectionStatus('waiting', `${this.connectedUsers.length} user(s) online`);
                } else {
                    this.updateConnectionStatus('waiting', 'Waiting for others to join');
                }
            }
        });

        // WebRTC signaling handlers
        this.socket.on('offer', async (data) => {
            console.log('Received offer from:', data.from);
            this.remoteSocketId = data.from;
            await this.handleOffer(data.offer, data.from);
        });

        this.socket.on('answer', async (data) => {
            console.log('Received answer from:', data.from);
            await this.handleAnswer(data.answer);
        });

        this.socket.on('ice-candidate', async (data) => {
            console.log('Received ICE candidate from:', data.from);
            await this.handleIceCandidate(data.candidate);
        });

        // Video message handlers
        this.socket.on('video-message-received', (data) => {
            console.log('Received video message from:', data.senderName);
            this.handleVideoMessageReceived(data);
        });

        this.socket.on('video-message-sent', (data) => {
            console.log('Video message sent successfully to:', data.to);
            this.showStatus('Video message sent successfully!', 'success');
        });

        // Sticker synchronization
        this.socket.on('stickers-update', (data) => {
            console.log('📥 Received sticker update from:', data.from, '|', data.stickers.length, 'stickers');
            // Pass to sticker manager to handle remote stickers
            if (window.stickerManager) {
                window.stickerManager.receiveRemoteStickers(data.stickers);
            }
        });
    }

    async connectToUser(remoteSocketId) {
        console.log('Connecting to user:', remoteSocketId);
        this.remoteSocketId = remoteSocketId;

        try {
            // Get local stream from multiple sources
            this.localStream = document.getElementById('preview')?.srcObject
                || window.videoRecorder?.stream
                || null;

            console.log('connectToUser - localStream:', this.localStream ? 'available with ' + this.localStream.getTracks().length + ' tracks' : 'not available');

            // Close any existing peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            this.remoteStream = null;

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.iceServers);
            console.log('Created new peer connection');

            // Add local stream tracks to peer connection (if available)
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                    console.log('Added local track:', track.kind);
                });
            } else {
                console.log('No local stream to add tracks from');
            }

            // Handle incoming remote stream
            this.peerConnection.ontrack = (event) => {
                console.log('🎥 Received remote track:', event.track.kind);
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                    this.remoteVideo.srcObject = this.remoteStream;
                }
                this.remoteStream.addTrack(event.track);
                console.log('Remote stream tracks:', this.remoteStream.getTracks().length);
                this.remoteVideoFrame.classList.remove('hidden');
                // Update remote user label with their username
                const remoteUser = this.connectedUsers.find(u => u.socketId === this.remoteSocketId);
                const remoteLabel = document.getElementById('remoteUserLabel');
                if (remoteLabel && remoteUser) {
                    remoteLabel.textContent = remoteUser.username;
                }
                // Update status to Connected when we receive tracks
                this.updateConnectionStatus('connected', 'Video chat active');
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Sending ICE candidate');
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: this.remoteSocketId
                    });
                }
            };

            // Monitor connection state
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                console.log('🔗 Connection state changed:', state);

                // Only update UI status, don't close connection on temporary states
                if (state === 'connected') {
                    this.updateConnectionStatus('connected', 'Video chat active');
                    this.remoteVideoFrame.classList.remove('hidden');
                } else if (state === 'failed') {
                    this.updateConnectionStatus('failed', 'Connection failed - try again');
                } else if (state === 'closed') {
                    this.updateConnectionStatus('closed', 'Connection ended');
                } else if (state === 'disconnected') {
                    this.updateConnectionStatus('disconnected', 'Trying to reconnect...');
                } else if (state === 'connecting') {
                    this.updateConnectionStatus('connecting', 'Establishing connection...');
                }
            };

            // Monitor ICE connection state
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
            };

            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.socket.emit('offer', {
                offer: offer,
                to: this.remoteSocketId
            });

            console.log('Offer sent');

        } catch (error) {
            console.error('Error connecting to user:', error);
            this.showStatus('Connection error: ' + error.message, 'error');
        }
    }

    async handleOffer(offer, from) {
        try {
            // Store the remote socket ID for ICE candidate exchange
            this.remoteSocketId = from;

            // Get local stream from multiple sources
            this.localStream = document.getElementById('preview')?.srcObject
                || window.videoRecorder?.stream
                || null;

            console.log('handleOffer - localStream:', this.localStream ? 'available with ' + this.localStream.getTracks().length + ' tracks' : 'not available');

            // Close any existing peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            this.remoteStream = null;

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.iceServers);
            console.log('Created new peer connection (handleOffer)');

            // Add local stream tracks (if available)
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                    console.log('Added local track:', track.kind);
                });
            } else {
                console.log('No local stream to add tracks from');
            }

            // Handle incoming remote stream
            this.peerConnection.ontrack = (event) => {
                console.log('🎥 Received remote track (in handleOffer):', event.track.kind);
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                    this.remoteVideo.srcObject = this.remoteStream;
                }
                this.remoteStream.addTrack(event.track);
                console.log('Remote stream tracks:', this.remoteStream.getTracks().length);
                this.remoteVideoFrame.classList.remove('hidden');
                // Update remote user label with their username
                const remoteUser = this.connectedUsers.find(u => u.socketId === this.remoteSocketId);
                const remoteLabel = document.getElementById('remoteUserLabel');
                if (remoteLabel && remoteUser) {
                    remoteLabel.textContent = remoteUser.username;
                }
                // Update status to Connected when we receive tracks
                this.updateConnectionStatus('connected', 'Video chat active');
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Sending ICE candidate (handleOffer)');
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: this.remoteSocketId
                    });
                }
            };

            // Monitor connection state
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                console.log('🔗 Connection state changed (handleOffer):', state);

                // Only update UI status, don't close connection on temporary states
                if (state === 'connected') {
                    this.updateConnectionStatus('connected', 'Video chat active');
                    this.remoteVideoFrame.classList.remove('hidden');
                } else if (state === 'failed') {
                    this.updateConnectionStatus('failed', 'Connection failed - try again');
                } else if (state === 'closed') {
                    this.updateConnectionStatus('closed', 'Connection ended');
                } else if (state === 'disconnected') {
                    this.updateConnectionStatus('disconnected', 'Trying to reconnect...');
                } else if (state === 'connecting') {
                    this.updateConnectionStatus('connecting', 'Establishing connection...');
                }
            };

            // Monitor ICE connection state
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('🧊 ICE connection state (handleOffer):', this.peerConnection.iceConnectionState);
            };

            // Set remote description
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('answer', {
                answer: answer,
                to: from
            });

            console.log('Answer sent');

        } catch (error) {
            console.error('Error handling offer:', error);
            this.showStatus('Connection error: ' + error.message, 'error');
        }
    }

    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Answer processed');
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    // Get the actual connection state based on all factors
    getActualConnectionState() {
        // Priority 1: Check WebRTC peer connection state
        if (this.peerConnection) {
            const peerState = this.peerConnection.connectionState;
            if (peerState === 'connected') {
                return { state: 'connected', detail: 'Video chat active' };
            }
            if (peerState === 'connecting' || peerState === 'new') {
                return { state: 'connecting', detail: 'Establishing peer connection' };
            }
            if (peerState === 'failed') {
                return { state: 'failed', detail: 'Connection failed - try again' };
            }
            if (peerState === 'disconnected') {
                return { state: 'disconnected', detail: 'Peer connection lost' };
            }
            if (peerState === 'closed') {
                return { state: 'closed', detail: 'Connection ended' };
            }
        }

        // Priority 2: Check if we're connected to server and have users
        if (this.isLoggedIn && this.socket) {
            if (this.connectedUsers.length > 0) {
                return { state: 'user-joined', detail: `${this.connectedUsers.length} user(s) online` };
            }
            return { state: 'waiting', detail: 'Waiting for others to join' };
        }

        // Priority 3: Not connected to server
        return { state: 'disconnected', detail: 'Click Connect to start' };
    }

    updateConnectionStatus(state, detail = '') {
        if (!this.connectionStatus) return;

        const statusText = this.connectionStatus.querySelector('.status-text');
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusDetail = this.connectionStatus.querySelector('.status-detail');
        const reconnectBtn = document.getElementById('reconnectBtn');

        if (!statusText || !statusDot || !statusDetail) return;

        // Use provided state or get actual state
        let displayState = state;
        let displayDetail = detail;

        // If no explicit state provided, calculate it
        if (!state) {
            const actual = this.getActualConnectionState();
            displayState = actual.state;
            displayDetail = actual.detail;
        }

        switch (displayState) {
            case 'connected':
                statusText.textContent = 'Connected';
                statusDot.className = 'status-dot connected';
                statusDetail.textContent = displayDetail || 'Video chat active';
                break;
            case 'new':
            case 'connecting':
                statusText.textContent = 'Connecting';
                statusDot.className = 'status-dot connecting';
                statusDetail.textContent = displayDetail || 'Establishing peer connection';
                break;
            case 'waiting':
                statusText.textContent = 'Online';
                statusDot.className = 'status-dot waiting';
                statusDetail.textContent = displayDetail || 'Waiting for others to join';
                break;
            case 'server-connected':
                statusText.textContent = 'Server Connected';
                statusDot.className = 'status-dot waiting';
                statusDetail.textContent = displayDetail || 'Ready to connect';
                break;
            case 'user-joined':
                statusText.textContent = 'User Online';
                statusDot.className = 'status-dot connecting';
                statusDetail.textContent = displayDetail || 'Initiating connection...';
                break;
            case 'error':
                statusText.textContent = 'Error';
                statusDot.className = 'status-dot error';
                statusDetail.textContent = displayDetail || 'Connection failed';
                break;
            case 'disconnected':
                // Don't hide video immediately - disconnected can be temporary
                statusText.textContent = 'Reconnecting';
                statusDot.className = 'status-dot connecting';
                statusDetail.textContent = displayDetail || 'Connection interrupted, trying to reconnect...';
                // Don't hide video - might recover
                break;
            case 'closed':
                statusText.textContent = 'Closed';
                statusDot.className = 'status-dot disconnected';
                statusDetail.textContent = displayDetail || 'Connection ended';
                if (this.remoteVideoFrame) this.remoteVideoFrame.classList.add('hidden');
                break;
            case 'failed':
                statusText.textContent = 'Failed';
                statusDot.className = 'status-dot error';
                statusDetail.textContent = displayDetail || 'Connection failed - try again';
                if (this.remoteVideoFrame) this.remoteVideoFrame.classList.add('hidden');
                if (reconnectBtn) reconnectBtn.classList.remove('hidden');
                break;
            default:
                statusText.textContent = 'Not Connected';
                statusDot.className = 'status-dot disconnected';
                statusDetail.textContent = 'Click Connect to start';
        }

        // Hide reconnect button for non-failed states
        if (displayState !== 'failed' && reconnectBtn) {
            reconnectBtn.classList.add('hidden');
        }
    }

    closeConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        this.remoteVideoFrame.classList.add('hidden');
        this.remoteSocketId = null;
    }

    updateUsersList() {
        const recipientSelect = document.getElementById('recipientSelect');
        if (!recipientSelect) return;

        // Clear existing options
        recipientSelect.innerHTML = '<option value="">Select recipient...</option>';

        // Add connected users
        this.connectedUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.socketId;
            option.textContent = user.username;
            recipientSelect.appendChild(option);
        });

        // Show/hide recipient selector based on user count
        const recipientContainer = document.getElementById('recipientContainer');
        if (recipientContainer) {
            if (this.connectedUsers.length > 0) {
                recipientContainer.classList.remove('hidden');
            } else {
                recipientContainer.classList.add('hidden');
            }
        }
    }

    sendVideoMessage(videoUrl, filename, size, recipientId) {
        if (!this.socket || !this.isLoggedIn) {
            this.showStatus('Please join the chat first', 'error');
            return;
        }

        if (!recipientId) {
            this.showStatus('Please select a recipient', 'error');
            return;
        }

        this.socket.emit('send-video-message', {
            videoUrl,
            filename,
            size,
            to: recipientId
        });

        console.log('Sending video message to:', recipientId);
    }

    handleVideoMessageReceived(data) {
        const { videoUrl, filename, senderName, timestamp } = data;

        this.showStatus(`New video message from ${senderName}!`, 'info');

        // Show notification modal
        const modal = document.getElementById('incomingMessageModal');
        const messageVideo = document.getElementById('incomingMessageVideo');
        const messageSender = document.getElementById('messageSender');

        if (modal && messageVideo && messageSender) {
            messageSender.textContent = senderName;
            messageVideo.src = videoUrl;
            modal.classList.remove('hidden');
        }
    }

    showStatus(message, type) {
        // Use the existing status toast from recorder
        const status = document.getElementById('status');
        if (status) {
            status.textContent = message;
            status.className = `status-toast ${type}`;
            status.classList.remove('hidden');

            setTimeout(() => {
                status.classList.add('hidden');
            }, 3000);
        }
        console.log(`[${type}] ${message}`);
    }
}

// Initialize connection manager when page loads and Socket.io is ready
let retryCount = 0;
const MAX_RETRIES = 10;

function initializeConnectionManager() {
    if (typeof io !== 'undefined') {
        // Check if backend URL is configured
        if (BACKEND_URL === 'YOUR_BACKEND_URL_HERE') {
            console.log('Backend URL not configured - Video chat feature disabled');
            console.log('To enable video chat: Deploy server.js and update BACKEND_URL in connection.js');
            // Hide the join video chat button
            const joinVideoBtn = document.getElementById('joinVideoBtn');
            if (joinVideoBtn) {
                joinVideoBtn.style.display = 'none';
            }
            const connectionStatus = document.getElementById('connectionStatus');
            if (connectionStatus) {
                connectionStatus.style.display = 'none';
            }
            return;
        }

        window.connectionManager = new ConnectionManager();
        console.log('ConnectionManager initialized with backend:', BACKEND_URL);
    } else {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
            // Retry after a short delay if Socket.io isn't loaded yet
            console.warn('Socket.io not loaded yet, retrying...');
            setTimeout(initializeConnectionManager, 100);
        } else {
            console.log('Socket.io not available after max retries - Video chat disabled');
            // Hide the join video chat button
            const joinVideoBtn = document.getElementById('joinVideoBtn');
            if (joinVideoBtn) {
                joinVideoBtn.style.display = 'none';
            }
            const connectionStatus = document.getElementById('connectionStatus');
            if (connectionStatus) {
                connectionStatus.style.display = 'none';
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initializeConnectionManager();
    initializeMuteButton();
});

// Mute/Unmute functionality for remote video
function initializeMuteButton() {
    const muteBtn = document.getElementById('muteBtn');
    const remoteVideo = document.getElementById('remoteVideo');

    if (!muteBtn || !remoteVideo) return;

    muteBtn.addEventListener('click', () => {
        remoteVideo.muted = !remoteVideo.muted;
        muteBtn.classList.toggle('muted', remoteVideo.muted);
        muteBtn.title = remoteVideo.muted ? 'Unmute' : 'Mute';
        console.log('Remote video muted:', remoteVideo.muted);
    });
}
