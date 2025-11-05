// Configuration
const BACKEND_URL = window.location.hostname.includes('localhost')
    ? 'http://localhost:3000'
    : 'YOUR_BACKEND_URL_HERE'; // Replace with your Render backend URL after deployment

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

        // Join Video Chat button
        const joinVideoBtn = document.getElementById('joinVideoBtn');
        if (joinVideoBtn) {
            joinVideoBtn.addEventListener('click', () => {
                this.loginModal.classList.remove('hidden');
            });
        }

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
    }

    login(password, username) {
        if (!password) {
            this.showStatus('Please enter a password', 'error');
            return;
        }

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
        });

        this.socket.on('login-failed', (data) => {
            this.showStatus(data.message, 'error');
        });

        this.socket.on('users-list', (users) => {
            console.log('Current users:', users);
            // If there are other users, connect to the first one
            if (users.length > 0) {
                this.connectToUser(users[0].socketId);
            }
        });

        this.socket.on('user-joined', (user) => {
            console.log('User joined:', user);
            this.showStatus(`${user.username} joined!`, 'info');

            // If we're not connected to anyone, initiate connection
            if (!this.peerConnection || this.peerConnection.connectionState === 'closed') {
                this.connectToUser(user.socketId);
            }
        });

        this.socket.on('user-left', (data) => {
            console.log('User left:', data.socketId);
            if (this.remoteSocketId === data.socketId) {
                this.showStatus('Remote user disconnected', 'info');
                this.closeConnection();
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
    }

    async connectToUser(remoteSocketId) {
        console.log('Connecting to user:', remoteSocketId);
        this.remoteSocketId = remoteSocketId;

        try {
            // Get local stream (from the video preview)
            this.localStream = document.getElementById('preview').srcObject;

            if (!this.localStream) {
                console.error('No local stream available');
                this.showStatus('Camera not initialized', 'error');
                return;
            }

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.iceServers);

            // Add local stream tracks to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle incoming remote stream
            this.peerConnection.ontrack = (event) => {
                console.log('Received remote track');
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                    this.remoteVideo.srcObject = this.remoteStream;
                }
                this.remoteStream.addTrack(event.track);
                this.remoteVideoFrame.classList.remove('hidden');
                this.showStatus('Connected!', 'success');
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: this.remoteSocketId
                    });
                }
            };

            // Monitor connection state
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', this.peerConnection.connectionState);
                this.updateConnectionStatus(this.peerConnection.connectionState);
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
            // Get local stream
            this.localStream = document.getElementById('preview').srcObject;

            if (!this.localStream) {
                console.error('No local stream available');
                return;
            }

            // Create peer connection if it doesn't exist
            if (!this.peerConnection) {
                this.peerConnection = new RTCPeerConnection(this.iceServers);

                // Add local stream tracks
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });

                // Handle incoming remote stream
                this.peerConnection.ontrack = (event) => {
                    console.log('Received remote track');
                    if (!this.remoteStream) {
                        this.remoteStream = new MediaStream();
                        this.remoteVideo.srcObject = this.remoteStream;
                    }
                    this.remoteStream.addTrack(event.track);
                    this.remoteVideoFrame.classList.remove('hidden');
                    this.showStatus('Connected!', 'success');
                };

                // Handle ICE candidates
                this.peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        this.socket.emit('ice-candidate', {
                            candidate: event.candidate,
                            to: this.remoteSocketId
                        });
                    }
                };

                // Monitor connection state
                this.peerConnection.onconnectionstatechange = () => {
                    console.log('Connection state:', this.peerConnection.connectionState);
                    this.updateConnectionStatus(this.peerConnection.connectionState);
                };
            }

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

    updateConnectionStatus(state) {
        const statusText = this.connectionStatus.querySelector('.status-text');
        const statusDot = this.connectionStatus.querySelector('.status-dot');

        switch (state) {
            case 'connected':
                statusText.textContent = 'Connected';
                statusDot.className = 'status-dot connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                statusDot.className = 'status-dot connecting';
                break;
            case 'disconnected':
            case 'closed':
            case 'failed':
                statusText.textContent = 'Disconnected';
                statusDot.className = 'status-dot disconnected';
                this.remoteVideoFrame.classList.add('hidden');
                break;
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
});
