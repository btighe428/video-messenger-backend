// SFU Connection Manager using mediasoup-client
// Manages multi-party video with circular honeycomb layout (Apple Watch style)

const SFU_ENABLED = true; // Feature flag

class SFUConnectionManager {
    constructor() {
        this.socket = null;
        this.device = null;
        this.sendTransport = null;
        this.recvTransport = null;
        this.producers = new Map();     // kind -> Producer
        this.consumers = new Map();     // peerId -> Map<kind, Consumer>
        this.remoteStreams = new Map(); // peerId -> MediaStream
        this.peerNames = new Map();     // peerId -> username
        this.localStream = null;

        this.isConnected = false;
        this.mySocketId = null;

        // DOM references
        this.honeycombContainer = null;
        this.localVideoElement = null;

        // Circular layout settings
        this.circleSize = 160;  // Base size for video circles
        this.centerX = 0;
        this.centerY = 0;

        // Bind methods
        this.onNewProducer = this.onNewProducer.bind(this);
        this.onProducerClosed = this.onProducerClosed.bind(this);
        this.onConsumerClosed = this.onConsumerClosed.bind(this);
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

        // Wait for the main connection manager to establish socket
        this.waitForSocket();
    }

    waitForSocket() {
        // Check if connectionManager exists and has a socket
        const checkSocket = () => {
            if (window.connectionManager && window.connectionManager.socket) {
                this.socket = window.connectionManager.socket;
                this.mySocketId = window.connectionManager.mySocketId;
                this.setupMediasoupHandlers();
                console.log('[SFU] Socket connected, setting up mediasoup handlers');
            } else {
                setTimeout(checkSocket, 500);
            }
        };
        checkSocket();
    }

    setupMediasoupHandlers() {
        if (!this.socket) return;

        // Listen for new producers from other peers
        this.socket.on('newProducer', this.onNewProducer);
        this.socket.on('producerClosed', this.onProducerClosed);
        this.socket.on('consumerClosed', this.onConsumerClosed);

        // Listen for user events to track names
        this.socket.on('user-joined', (data) => {
            this.peerNames.set(data.socketId, data.username);
        });

        this.socket.on('user-left', (data) => {
            this.handlePeerLeft(data.socketId);
        });
    }

    // Request and callback helper
    request(event, data = {}) {
        return new Promise((resolve, reject) => {
            this.socket.emit(event, data, (response) => {
                if (response && response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Initialize mediasoup device with router capabilities
    async loadDevice() {
        if (!window.mediasoupClient) {
            console.warn('[SFU] mediasoup-client not loaded');
            return false;
        }

        try {
            const { rtpCapabilities } = await this.request('getRouterRtpCapabilities');

            this.device = new mediasoupClient.Device();
            await this.device.load({ routerRtpCapabilities: rtpCapabilities });

            console.log('[SFU] Device loaded successfully');
            return true;
        } catch (error) {
            console.error('[SFU] Failed to load device:', error);
            return false;
        }
    }

    // Create send transport for producing media
    async createSendTransport() {
        try {
            const transportInfo = await this.request('createWebRtcTransport', {
                direction: 'send'
            });

            this.sendTransport = this.device.createSendTransport({
                id: transportInfo.id,
                iceParameters: transportInfo.iceParameters,
                iceCandidates: transportInfo.iceCandidates,
                dtlsParameters: transportInfo.dtlsParameters,
            });

            this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await this.request('connectWebRtcTransport', {
                        transportId: this.sendTransport.id,
                        dtlsParameters,
                    });
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                try {
                    const { producerId } = await this.request('produce', {
                        transportId: this.sendTransport.id,
                        kind,
                        rtpParameters,
                    });
                    callback({ id: producerId });
                } catch (error) {
                    errback(error);
                }
            });

            console.log('[SFU] Send transport created');
            return true;
        } catch (error) {
            console.error('[SFU] Failed to create send transport:', error);
            return false;
        }
    }

    // Create receive transport for consuming media
    async createRecvTransport() {
        try {
            const transportInfo = await this.request('createWebRtcTransport', {
                direction: 'recv'
            });

            this.recvTransport = this.device.createRecvTransport({
                id: transportInfo.id,
                iceParameters: transportInfo.iceParameters,
                iceCandidates: transportInfo.iceCandidates,
                dtlsParameters: transportInfo.dtlsParameters,
            });

            this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await this.request('connectWebRtcTransport', {
                        transportId: this.recvTransport.id,
                        dtlsParameters,
                    });
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            console.log('[SFU] Receive transport created');
            return true;
        } catch (error) {
            console.error('[SFU] Failed to create receive transport:', error);
            return false;
        }
    }

    // Produce local media (send to SFU)
    async produce(track) {
        if (!this.sendTransport) {
            console.error('[SFU] Send transport not created');
            return null;
        }

        try {
            const producer = await this.sendTransport.produce({
                track,
                encodings: track.kind === 'video' ? [
                    { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
                    { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
                    { rid: 'r2', maxBitrate: 900000, scalabilityMode: 'S1T3' },
                ] : undefined,
                codecOptions: {
                    videoGoogleStartBitrate: 1000,
                },
            });

            this.producers.set(track.kind, producer);

            producer.on('trackended', () => {
                this.closeProducer(track.kind);
            });

            console.log(`[SFU] Producing ${track.kind}`);
            return producer;
        } catch (error) {
            console.error(`[SFU] Failed to produce ${track.kind}:`, error);
            return null;
        }
    }

    // Close a producer
    async closeProducer(kind) {
        const producer = this.producers.get(kind);
        if (producer) {
            producer.close();
            this.producers.delete(kind);
            console.log(`[SFU] Producer closed: ${kind}`);
        }
    }

    // Consume media from a remote producer
    async consume(producerId, peerId, kind) {
        if (!this.recvTransport || !this.device) {
            console.error('[SFU] Receive transport or device not ready');
            return null;
        }

        try {
            const { consumerId, rtpParameters } = await this.request('consume', {
                producerId,
                rtpCapabilities: this.device.rtpCapabilities,
            });

            const consumer = await this.recvTransport.consume({
                id: consumerId,
                producerId,
                kind,
                rtpParameters,
            });

            // Store consumer
            if (!this.consumers.has(peerId)) {
                this.consumers.set(peerId, new Map());
            }
            this.consumers.get(peerId).set(kind, consumer);

            // Add track to peer's MediaStream
            if (!this.remoteStreams.has(peerId)) {
                this.remoteStreams.set(peerId, new MediaStream());
            }
            this.remoteStreams.get(peerId).addTrack(consumer.track);

            // Update UI
            this.updateVideoHoneycomb();

            console.log(`[SFU] Consuming ${kind} from ${peerId}`);
            return consumer;
        } catch (error) {
            console.error(`[SFU] Failed to consume:`, error);
            return null;
        }
    }

    // Handle new producer notification
    async onNewProducer(data) {
        const { producerId, peerId, peerName, kind } = data;

        console.log(`[SFU] New producer: ${kind} from ${peerName} (${peerId})`);

        // Store peer name
        this.peerNames.set(peerId, peerName);

        // Consume this producer
        await this.consume(producerId, peerId, kind);
    }

    // Handle producer closed notification
    onProducerClosed(data) {
        const { producerId } = data;
        console.log(`[SFU] Producer closed: ${producerId}`);

        // Find and close the corresponding consumer
        for (const [peerId, consumers] of this.consumers) {
            for (const [kind, consumer] of consumers) {
                if (consumer.producerId === producerId) {
                    consumer.close();
                    consumers.delete(kind);

                    // Remove track from stream
                    const stream = this.remoteStreams.get(peerId);
                    if (stream) {
                        const track = consumer.track;
                        stream.removeTrack(track);
                    }

                    this.updateVideoHoneycomb();
                    return;
                }
            }
        }
    }

    // Handle consumer closed notification
    onConsumerClosed(data) {
        const { consumerId } = data;
        console.log(`[SFU] Consumer closed: ${consumerId}`);

        for (const [peerId, consumers] of this.consumers) {
            for (const [kind, consumer] of consumers) {
                if (consumer.id === consumerId) {
                    consumer.close();
                    consumers.delete(kind);
                    this.updateVideoHoneycomb();
                    return;
                }
            }
        }
    }

    // Handle peer left
    handlePeerLeft(peerId) {
        console.log(`[SFU] Peer left: ${peerId}`);

        // Close all consumers for this peer
        const consumers = this.consumers.get(peerId);
        if (consumers) {
            for (const consumer of consumers.values()) {
                consumer.close();
            }
            this.consumers.delete(peerId);
        }

        // Remove stream
        this.remoteStreams.delete(peerId);
        this.peerNames.delete(peerId);

        // Update UI
        this.updateVideoHoneycomb();
    }

    // Start the SFU connection
    async start(localStream) {
        if (!SFU_ENABLED) {
            console.log('[SFU] SFU disabled, using P2P');
            return false;
        }

        if (!this.socket) {
            console.error('[SFU] Socket not connected');
            return false;
        }

        this.localStream = localStream;

        // Initialize device
        const deviceLoaded = await this.loadDevice();
        if (!deviceLoaded) return false;

        // Create transports
        const sendOk = await this.createSendTransport();
        const recvOk = await this.createRecvTransport();

        if (!sendOk || !recvOk) return false;

        // Produce local tracks
        for (const track of localStream.getTracks()) {
            await this.produce(track);
        }

        // Get existing producers
        const { producers } = await this.request('getProducers');
        for (const producer of producers) {
            this.peerNames.set(producer.peerId, producer.peerName);
            await this.consume(producer.producerId, producer.peerId, producer.kind);
        }

        this.isConnected = true;
        this.showHoneycomb();
        this.updateVideoHoneycomb();

        console.log('[SFU] Started successfully');
        return true;
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

        // Adjust circle size based on participant count
        const baseSize = Math.min(containerWidth, containerHeight) * 0.25;
        this.circleSize = Math.max(100, Math.min(200, baseSize / Math.sqrt(count)));

        if (count === 1) {
            // Single user: center
            positions.push({ x: this.centerX, y: this.centerY, scale: 1.2 });
        } else if (count === 2) {
            // Two users: side by side
            const offset = this.circleSize * 0.7;
            positions.push({ x: this.centerX - offset, y: this.centerY, scale: 1 });
            positions.push({ x: this.centerX + offset, y: this.centerY, scale: 1 });
        } else if (count === 3) {
            // Three users: triangle
            const radius = this.circleSize * 0.8;
            for (let i = 0; i < 3; i++) {
                const angle = (i * 2 * Math.PI / 3) - Math.PI / 2; // Start from top
                positions.push({
                    x: this.centerX + radius * Math.cos(angle),
                    y: this.centerY + radius * Math.sin(angle),
                    scale: 1
                });
            }
        } else if (count === 4) {
            // Four users: diamond/square
            const radius = this.circleSize * 0.8;
            for (let i = 0; i < 4; i++) {
                const angle = (i * 2 * Math.PI / 4) - Math.PI / 2; // Start from top
                positions.push({
                    x: this.centerX + radius * Math.cos(angle),
                    y: this.centerY + radius * Math.sin(angle),
                    scale: 1
                });
            }
        } else {
            // 5+ users: circular arrangement with possible center
            const useCenter = count <= 7;
            const outerCount = useCenter ? count - 1 : count;
            const radius = this.circleSize * (useCenter ? 1 : 1.2);

            if (useCenter) {
                positions.push({ x: this.centerX, y: this.centerY, scale: 1.1 });
            }

            for (let i = 0; i < outerCount; i++) {
                const angle = (i * 2 * Math.PI / outerCount) - Math.PI / 2;
                positions.push({
                    x: this.centerX + radius * Math.cos(angle),
                    y: this.centerY + radius * Math.sin(angle),
                    scale: 0.9
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

        // Collect all participants (local + remote)
        const participants = [];

        // Add local user first
        if (this.localStream) {
            participants.push({
                id: 'local',
                name: 'You',
                stream: this.localStream,
                isLocal: true
            });
        }

        // Add remote users
        for (const [peerId, stream] of this.remoteStreams) {
            if (stream.getTracks().length > 0) {
                participants.push({
                    id: peerId,
                    name: this.peerNames.get(peerId) || 'Guest',
                    stream: stream,
                    isLocal: false
                });
            }
        }

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

    // Create a circular video element
    createVideoCircle(participant, position) {
        const container = document.createElement('div');
        container.className = `honeycomb-video ${participant.isLocal ? 'local' : 'remote'}`;
        container.dataset.peerId = participant.id;

        // Position and size
        const size = this.circleSize * position.scale;
        container.style.cssText = `
            position: absolute;
            left: ${position.x - size / 2}px;
            top: ${position.y - size / 2}px;
            width: ${size}px;
            height: ${size}px;
            transition: all 0.3s ease-out;
        `;

        // Video element
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = participant.isLocal;
        video.srcObject = participant.stream;

        // Label
        const label = document.createElement('div');
        label.className = 'honeycomb-label';
        label.textContent = participant.name;

        // Glow ring for local
        if (participant.isLocal) {
            container.classList.add('glow');
        }

        container.appendChild(video);
        container.appendChild(label);

        return container;
    }

    // Stop and cleanup
    stop() {
        // Close all producers
        for (const producer of this.producers.values()) {
            producer.close();
        }
        this.producers.clear();

        // Close all consumers
        for (const consumers of this.consumers.values()) {
            for (const consumer of consumers.values()) {
                consumer.close();
            }
        }
        this.consumers.clear();

        // Close transports
        if (this.sendTransport) {
            this.sendTransport.close();
            this.sendTransport = null;
        }
        if (this.recvTransport) {
            this.recvTransport.close();
            this.recvTransport = null;
        }

        // Clear streams
        this.remoteStreams.clear();
        this.peerNames.clear();

        this.isConnected = false;
        this.hideHoneycomb();

        console.log('[SFU] Stopped');
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
    const originalLoginSuccess = window.connectionManager?.handleLoginSuccess;

    // Patch the connection manager to auto-start SFU
    const checkAndPatch = () => {
        if (window.connectionManager) {
            const originalEmit = window.connectionManager.socket?.on;
            if (window.connectionManager.socket) {
                window.connectionManager.socket.on('login-success', async (data) => {
                    console.log('[SFU] Login success detected, initializing SFU...');

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
