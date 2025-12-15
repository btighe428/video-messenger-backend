// Video Recorder Application
console.log('🎬 recorder.js loaded');

class VideoRecorder {
    constructor() {
        console.log('🎬 VideoRecorder constructor called');
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.recordingStartTime = null;
        this.timerInterval = null;

        // DOM elements
        this.preview = document.getElementById('preview');
        this.playback = document.getElementById('playback');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.sendEnvelopeBtn = document.getElementById('sendEnvelopeBtn');
        this.playEnvelopeBtn = document.getElementById('playEnvelopeBtn');
        this.discardBtn = document.getElementById('discardBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.videoEnvelope = document.getElementById('videoEnvelope');
        this.envelopeContainer = document.querySelector('.envelope-container');
        this.recordingIndicator = document.getElementById('recording-indicator');
        this.timer = document.getElementById('timer');
        this.status = document.getElementById('status');
        this.qualitySelect = document.getElementById('quality');
        this.videoPreviewDock = document.getElementById('videoPreviewDock');
        this.draggableUI = document.getElementById('draggableUI');
        this.zoomBtn = document.getElementById('zoomBtn');
        this.minimizeBtn = document.getElementById('minimizeBtn');

        this.isMinimized = false;

        // Composite canvas for recording (frames + effects)
        this.recordingCanvas = document.createElement('canvas');
        this.recordingCtx = this.recordingCanvas.getContext('2d');
        this.isRecording = false;

        // Frame system
        this.frameImage = new Image();
        this.frameImage.src = 'css/frame.png';
        this.currentFrame = 'frame.png';  // Default frame

        // Sticker system
        this.stickers = [];  // Array of {img, x, y, scale, rotation}

        // Frame caching for performance
        this.frameCache = document.createElement('canvas');
        this.frameCacheCtx = this.frameCache.getContext('2d');
        this.frameCached = false;

        // Load frame when image loads
        this.frameImage.onload = () => {
            console.log('Frame image loaded successfully');
            this.cacheFrame();
        };

        this.frameImage.onerror = () => {
            console.error('Failed to load frame image');
        };

        // Particle system (will be initialized after DOM loads)
        this.particleSystem = null;

        this.init();
    }

    init() {
        // Check browser support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showStatus('Your browser does not support video recording', 'error');
            return;
        }

        // Set up event listeners
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.sendEnvelopeBtn.addEventListener('click', () => this.sendVideoMessage());
        this.playEnvelopeBtn.addEventListener('click', () => this.playVideo());
        this.discardBtn.addEventListener('click', () => this.discardRecording());
        this.zoomBtn.addEventListener('click', () => this.toggleZoom());
        this.minimizeBtn.addEventListener('click', () => this.toggleMinimize());

        // Set up dragging
        this.setupDragging();
        this.setupRemoteDragging();

        // DON'T initialize camera on page load - wait for Video mode
        // this.initializeCamera();

        // Initialize particle system
        if (window.ParticleSystem) {
            this.particleSystem = new window.ParticleSystem();
            this.particleSystem.start();
            console.log('Particle system initialized');
        }

        // Set up particle toggle button
        const particlesBtn = document.getElementById('particlesBtn');
        if (particlesBtn) {
            particlesBtn.addEventListener('click', () => {
                if (this.particleSystem) {
                    const enabled = this.particleSystem.toggle();
                    particlesBtn.classList.toggle('active', enabled);
                    console.log('Particles:', enabled ? 'enabled' : 'disabled');
                }
            });
        }

        // Set up background toggle button
        const bgToggleBtn = document.getElementById('bgToggleBtn');
        if (bgToggleBtn) {
            // Load saved preference
            const bgHidden = localStorage.getItem('bgHidden') === 'true';
            if (bgHidden) {
                document.body.classList.add('bg-hidden');
            }

            bgToggleBtn.addEventListener('click', () => {
                const isHidden = document.body.classList.toggle('bg-hidden');
                localStorage.setItem('bgHidden', isHidden);
                console.log('Background:', isHidden ? 'hidden' : 'visible');
                this.showStatus(isHidden ? 'Background hidden - Focus on UI' : 'Background visible', 'info');
            });
        }

        // Initialize sticker system - use the same effectsCanvas as glasses/effects
        console.log('Attempting to initialize sticker system...');
        const effectsCanvas = document.getElementById('effectsCanvas');
        console.log('effectsCanvas:', effectsCanvas);
        console.log('window.StickerManager:', window.StickerManager);

        if (effectsCanvas && window.StickerManager) {
            try {
                window.stickerManager = new window.StickerManager(effectsCanvas, this);
                console.log('✓ Sticker system initialized on effectsCanvas');
            } catch (error) {
                console.error('✗ Error initializing sticker system:', error);
            }
        } else {
            console.warn('Cannot initialize stickers:', {
                hasCanvas: !!effectsCanvas,
                hasStickerManager: !!window.StickerManager
            });
        }
    }

    toggleZoom() {
        this.videoPreviewDock.classList.toggle('zoomed');

        // Update canvas size if effects are active
        if (window.faceEffects) {
            setTimeout(() => {
                window.faceEffects.resizeCanvas();
            }, 400); // Wait for transition to complete
        }
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;

        // Toggle UI visibility - hide everything except video preview
        const effectsDock = document.querySelector('.effects-dock');
        const controlsDock = document.querySelector('.controls-dock');
        const bgColorPicker = document.getElementById('bgColorPicker');
        const glassesPicker = document.getElementById('glassesPicker');
        const positionCalibrator = document.getElementById('positionCalibrator');
        const connectionStatus = document.getElementById('connectionStatus');
        const remoteVideoFrame = document.getElementById('remoteVideoFrame');

        if (this.isMinimized) {
            // Hide all controls
            if (effectsDock) effectsDock.classList.add('hidden');
            if (controlsDock) controlsDock.classList.add('hidden');
            if (bgColorPicker) bgColorPicker.classList.add('hidden');
            if (glassesPicker) glassesPicker.classList.add('hidden');
            if (positionCalibrator) positionCalibrator.classList.add('hidden');
            if (connectionStatus) connectionStatus.classList.add('hidden');

            // Change minimize icon to plus
            this.minimizeBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            `;
            this.minimizeBtn.title = 'Show UI';
        } else {
            // Show all controls
            if (effectsDock) effectsDock.classList.remove('hidden');
            if (controlsDock) controlsDock.classList.remove('hidden');
            if (connectionStatus) connectionStatus.classList.remove('hidden');

            // Change plus icon back to minus
            this.minimizeBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            `;
            this.minimizeBtn.title = 'Minimize UI';
        }
    }

    setupDragging() {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        this.draggableUI.addEventListener('mousedown', (e) => {
            // ONLY allow dragging from the drag handle
            if (!e.target.closest('.drag-handle')) {
                return;
            }

            console.log('🎯 Drag handle mousedown');
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            isDragging = true;
            this.draggableUI.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();

                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                this.setTranslate(currentX, currentY);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (isDragging) {
                console.log('🎯 Drag handle mouseup - stopping drag');
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                this.draggableUI.classList.remove('dragging');
            }
        });

        // Touch support
        this.draggableUI.addEventListener('touchstart', (e) => {
            // ONLY allow dragging from the drag handle
            if (!e.target.closest('.drag-handle')) {
                return;
            }

            const touch = e.touches[0];
            initialX = touch.clientX - xOffset;
            initialY = touch.clientY - yOffset;

            isDragging = true;
            this.draggableUI.classList.add('dragging');
        });

        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();

                const touch = e.touches[0];
                currentX = touch.clientX - initialX;
                currentY = touch.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                this.setTranslate(currentX, currentY);
            }
        });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                this.draggableUI.classList.remove('dragging');
            }
        });
    }

    setTranslate(xPos, yPos) {
        this.draggableUI.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    setupRemoteDragging() {
        const remoteVideoFrame = document.getElementById('remoteVideoFrame');
        if (!remoteVideoFrame) return;

        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        remoteVideoFrame.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on video controls
            if (e.target.tagName === 'VIDEO') {
                return;
            }

            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            isDragging = true;
            remoteVideoFrame.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();

                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                this.setRemoteTranslate(currentX, currentY);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                remoteVideoFrame.style.cursor = 'grab';
            }
        });

        // Touch support
        remoteVideoFrame.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            initialX = touch.clientX - xOffset;
            initialY = touch.clientY - yOffset;

            isDragging = true;
        });

        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                const touch = e.touches[0];

                currentX = touch.clientX - initialX;
                currentY = touch.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                this.setRemoteTranslate(currentX, currentY);
            }
        });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            }
        });

        // Set initial cursor
        remoteVideoFrame.style.cursor = 'grab';
    }

    setRemoteTranslate(xPos, yPos) {
        const remoteVideoFrame = document.getElementById('remoteVideoFrame');
        if (remoteVideoFrame) {
            remoteVideoFrame.style.transform = `translate(${xPos}px, ${yPos}px)`;
        }
    }

    async initializeCamera() {
        try {
            console.log('Requesting camera access...');
            const quality = this.qualitySelect ? this.qualitySelect.value : '480';
            const constraints = this.getVideoConstraints(quality);
            console.log('Constraints:', constraints);

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.preview.srcObject = this.stream;
            console.log('Camera initialized successfully');

            this.showStatus('Camera ready! Click record button to begin.', 'info');

            // Auto-hide status after 3 seconds
            setTimeout(() => this.hideStatus(), 3000);
        } catch (error) {
            console.error('Error accessing camera:', error);
            let errorMessage = 'Error accessing camera: ';

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += 'Permission denied. Please allow camera access in your browser settings.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage += 'No camera found. Please connect a camera.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage += 'Camera is already in use by another application.';
            } else {
                errorMessage += error.message;
            }

            this.showStatus(errorMessage, 'error');
        }
    }

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

        switch(quality) {
            case '720':
                constraints.video.width.ideal = 1280;
                constraints.video.height.ideal = 720;
                break;
            case '480':
                constraints.video.width.ideal = 854;
                constraints.video.height.ideal = 480;
                break;
            case '360':
                constraints.video.width.ideal = 640;
                constraints.video.height.ideal = 360;
                break;
        }

        return constraints;
    }

    // Cache frame for performance
    cacheFrame() {
        if (!this.frameImage.complete) return;

        // Set cache canvas size to frame image size
        this.frameCache.width = this.frameImage.width;
        this.frameCache.height = this.frameImage.height;

        // Draw frame to cache
        this.frameCacheCtx.clearRect(0, 0, this.frameCache.width, this.frameCache.height);
        this.frameCacheCtx.drawImage(this.frameImage, 0, 0);

        this.frameCached = true;
        console.log('Frame cached successfully');
    }

    // Composite rendering for recording (video + effects + frame + stickers)
    renderCompositeFrame() {
        if (!this.isRecording) return;

        const ctx = this.recordingCtx;
        const width = this.recordingCanvas.width;
        const height = this.recordingCanvas.height;

        // 1. Clear canvas
        ctx.clearRect(0, 0, width, height);

        // 2. Draw video frame
        if (this.preview && this.preview.videoWidth > 0) {
            ctx.drawImage(this.preview, 0, 0, width, height);
        }

        // 3. Draw effects canvas (MediaPipe glasses, particles, etc.)
        if (window.faceEffects && window.faceEffects.canvas) {
            ctx.drawImage(window.faceEffects.canvas, 0, 0, width, height);
        }

        // 4. Draw frame border - DISABLED (frame removed from recorded video)
        // if (this.frameCached && this.frameCache) {
        //     // Calculate frame positioning to match CSS overlay
        //     // Frame should be 120% of video size, centered
        //     const frameWidth = width * 1.2;
        //     const frameHeight = height * 1.2;
        //     const frameX = -width * 0.1;  // Offset to center
        //     const frameY = -height * 0.1;
        //
        //     ctx.drawImage(this.frameCache, frameX, frameY, frameWidth, frameHeight);
        // }

        // 5. Draw particles (confetti, hearts, stars)
        if (this.particleSystem && this.particleSystem.canvas && this.particleSystem.enabled) {
            ctx.drawImage(this.particleSystem.canvas, 0, 0, width, height);
        }

        // 6. Draw stickers (emoji stickers)
        if (this.stickers && this.stickers.length > 0) {
            this.stickers.forEach(sticker => {
                ctx.save();
                ctx.translate(sticker.x, sticker.y);
                ctx.rotate(sticker.rotation || 0);

                // Draw emoji text
                ctx.font = `${sticker.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(sticker.emoji, 0, 0);

                ctx.restore();
            });
        }

        // Continue rendering loop
        requestAnimationFrame(() => this.renderCompositeFrame());
    }

    async startRecording() {
        try {
            this.recordedChunks = [];

            // Set up recording canvas dimensions to match video
            const videoWidth = this.preview.videoWidth || 1280;
            const videoHeight = this.preview.videoHeight || 720;
            this.recordingCanvas.width = videoWidth;
            this.recordingCanvas.height = videoHeight;

            console.log(`Recording canvas size: ${videoWidth}x${videoHeight}`);

            // Set up particle system canvas size
            if (this.particleSystem) {
                this.particleSystem.setCanvasSize(videoWidth, videoHeight);

                // Trigger confetti explosion!
                this.particleSystem.confettiExplosion();

                // Start auto-floating particles (hearts and stars)
                this.particleSystem.startFloatingParticles();

                console.log('Particle effects triggered!');
            }

            // Check for canvas.captureStream support
            if (!HTMLCanvasElement.prototype.captureStream) {
                console.warn('Canvas captureStream not supported, falling back to direct stream recording');
                // Fallback: record original stream without frames
                this.startDirectRecording();
                return;
            }

            // Start composite rendering loop
            this.isRecording = true;
            this.renderCompositeFrame();

            // Capture canvas stream at 30 FPS
            const compositeStream = this.recordingCanvas.captureStream(30);

            // Add audio track from original camera stream
            const audioTrack = this.stream.getAudioTracks()[0];
            if (audioTrack) {
                compositeStream.addTrack(audioTrack);
                console.log('Audio track added to composite stream');
            } else {
                console.warn('No audio track found in original stream');
            }

            // Create media recorder with composite stream
            const options = {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: 2500000
            };

            // Fallback for Safari/iOS
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/mp4';
                }
            }

            this.mediaRecorder = new MediaRecorder(compositeStream, options);

            // Handle data availability
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                this.handleRecordingStop();
            };

            // Start recording
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.recordingStartTime = Date.now();

            // Update UI
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.recordingIndicator.classList.remove('hidden');
            this.videoEnvelope.classList.add('hidden');
            this.hideStatus();

            // Start timer
            this.startTimer();

            console.log('Recording started with composite canvas stream');

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showStatus('Error starting recording: ' + error.message, 'error');
            this.isRecording = false;
        }
    }

    // Fallback method for browsers without canvas.captureStream
    startDirectRecording() {
        try {
            const options = {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: 2500000
            };

            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/mp4';
                }
            }

            this.mediaRecorder = new MediaRecorder(this.stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingStop();
            };

            this.mediaRecorder.start(100);
            this.recordingStartTime = Date.now();

            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.recordingIndicator.classList.remove('hidden');
            this.videoEnvelope.classList.add('hidden');
            this.hideStatus();

            this.startTimer();

            this.showStatus('Recording without frame overlay (browser limitation)', 'info');
        } catch (error) {
            console.error('Error in fallback recording:', error);
            this.showStatus('Error starting recording: ' + error.message, 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            // Stop rendering loop
            this.isRecording = false;

            // Stop floating particles
            if (this.particleSystem) {
                this.particleSystem.stopFloatingParticles();
            }

            this.mediaRecorder.stop();
            this.stopTimer();

            // Update UI
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.recordingIndicator.classList.add('hidden');

            this.showStatus('Processing video...', 'info');
            console.log('Recording stopped');
        }
    }

    handleRecordingStop() {
        // Create blob from recorded chunks
        const mimeType = this.mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });

        // Create URL for playback
        const videoUrl = URL.createObjectURL(blob);
        this.playback.src = videoUrl;

        // Set up download
        this.downloadBtn.href = videoUrl;
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        this.downloadBtn.download = `video-message-${Date.now()}.${extension}`;

        // Show envelope instead of modal
        this.videoEnvelope.classList.remove('hidden');
        this.showStatus('Recording ready to send!', 'success');

        // Auto-hide status after 2 seconds
        setTimeout(() => this.hideStatus(), 2000);

        // Store blob for upload
        this.currentBlob = blob;

        // Track achievement: video recorded
        if (window.achievementManager) {
            window.achievementManager.incrementVideoRecorded();
        }
    }

    playVideo() {
        // Toggle play/pause
        if (this.playback.paused) {
            this.playback.play();
            this.playEnvelopeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            `;
        } else {
            this.playback.pause();
            this.playEnvelopeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            `;
        }
    }

    async sendVideoMessage() {
        if (!this.currentBlob) {
            this.showStatus('No video to send', 'error');
            return;
        }

        try {
            // Check if recipient is selected
            const recipientSelect = document.getElementById('recipientSelect');
            const recipientId = recipientSelect ? recipientSelect.value : null;

            if (!recipientId) {
                this.showStatus('Please select a recipient first', 'error');
                return;
            }

            // Trigger flying animation
            this.sendEnvelopeBtn.classList.add('flying');
            this.envelopeContainer.classList.add('sending');
            this.showStatus('Sending video message...', 'info');
            this.sendEnvelopeBtn.disabled = true;

            // Upload video
            const formData = new FormData();
            const extension = this.mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
            formData.append('video', this.currentBlob, `recording-${Date.now()}.${extension}`);

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();

            if (data.success && window.connectionManager) {
                // Send video message to selected user
                window.connectionManager.sendVideoMessage(
                    data.url,
                    data.filename,
                    data.size,
                    recipientId
                );

                this.showStatus('Video message sent! ✉️', 'success');

                // Trigger celebration confetti!
                if (this.particleSystem) {
                    const centerX = this.particleSystem.canvas.width / 2;
                    const centerY = this.particleSystem.canvas.height / 2;
                    this.particleSystem.confettiBurst(centerX, centerY, 60);
                }

                // Track achievement: video sent
                if (window.achievementManager) {
                    window.achievementManager.incrementVideoSent();
                }

                // Wait for animation to complete before hiding envelope
                setTimeout(() => {
                    this.videoEnvelope.classList.add('hidden');
                    this.sendEnvelopeBtn.classList.remove('flying');
                    this.envelopeContainer.classList.remove('sending');
                    this.resetTimer();
                    this.recordedChunks = [];
                    this.currentBlob = null;
                }, 1000);
            } else {
                throw new Error(data.message || 'Send failed');
            }

        } catch (error) {
            console.error('Error sending video:', error);
            this.showStatus('Error sending video: ' + error.message, 'error');
            this.sendEnvelopeBtn.classList.remove('flying');
            this.envelopeContainer.classList.remove('sending');
        } finally {
            setTimeout(() => {
                this.sendEnvelopeBtn.disabled = false;
            }, 1000);
        }
    }

    discardRecording() {
        // Clear recorded data
        this.recordedChunks = [];
        this.currentBlob = null;

        // Reset UI
        this.videoEnvelope.classList.add('hidden');
        this.playback.src = '';
        this.playback.pause();
        this.resetTimer();

        // Reset play button icon
        this.playEnvelopeBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;

        this.showStatus('Recording discarded', 'info');
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.stopTimer();
        this.timer.textContent = '00:00';
        this.recordingStartTime = null;
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        this.status.classList.remove('hidden');
    }

    hideStatus() {
        this.status.classList.add('hidden');
    }
}

// Initialize the recorder when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.videoRecorder = new VideoRecorder();
});
