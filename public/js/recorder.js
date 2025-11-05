// Video Recorder Application
class VideoRecorder {
    constructor() {
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
        this.uploadBtn = document.getElementById('uploadBtn');
        this.discardBtn = document.getElementById('discardBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.playbackSection = document.getElementById('playbackSection');
        this.recordingIndicator = document.getElementById('recording-indicator');
        this.timer = document.getElementById('timer');
        this.status = document.getElementById('status');
        this.qualitySelect = document.getElementById('quality');
        this.videoPreviewDock = document.getElementById('videoPreviewDock');
        this.draggableUI = document.getElementById('draggableUI');
        this.zoomBtn = document.getElementById('zoomBtn');
        this.minimizeBtn = document.getElementById('minimizeBtn');

        this.isMinimized = false;

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
        this.uploadBtn.addEventListener('click', () => this.uploadVideo());
        this.discardBtn.addEventListener('click', () => this.discardRecording());
        this.zoomBtn.addEventListener('click', () => this.toggleZoom());
        this.minimizeBtn.addEventListener('click', () => this.toggleMinimize());

        // Set up dragging
        this.setupDragging();

        // Initialize camera on page load
        this.initializeCamera();
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
            // Don't drag if clicking on buttons, effect controls, or picker options
            if (e.target.closest('button') ||
                e.target.closest('.btn-icon') ||
                e.target.closest('.glasses-option') ||
                e.target.closest('.color-option')) {
                return;
            }

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

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                this.draggableUI.classList.remove('dragging');
            }
        });

        // Touch support
        this.draggableUI.addEventListener('touchstart', (e) => {
            if (e.target.closest('button') || e.target.closest('.btn-icon')) {
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

    async startRecording() {
        try {
            this.recordedChunks = [];

            // Create media recorder
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

            this.mediaRecorder = new MediaRecorder(this.stream, options);

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
            this.playbackSection.classList.add('hidden');
            this.hideStatus();

            // Start timer
            this.startTimer();

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showStatus('Error starting recording: ' + error.message, 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.stopTimer();

            // Update UI
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.recordingIndicator.classList.add('hidden');

            this.showStatus('Processing video...', 'info');
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

        // Show playback modal
        this.playbackSection.classList.remove('hidden');
        this.showStatus('Recording complete! Review your video.', 'success');

        // Store blob for upload
        this.currentBlob = blob;
    }

    async uploadVideo() {
        if (!this.currentBlob) {
            this.showStatus('No video to upload', 'error');
            return;
        }

        try {
            this.showStatus('Uploading video...', 'info');
            this.uploadBtn.disabled = true;

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

            if (data.success) {
                this.showStatus(`Video uploaded successfully! URL: ${data.url}`, 'success');

                // Copy URL to clipboard
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(data.url);
                    this.showStatus(`Video uploaded! URL copied to clipboard: ${data.url}`, 'success');
                }
            } else {
                throw new Error(data.message || 'Upload failed');
            }

        } catch (error) {
            console.error('Error uploading video:', error);
            this.showStatus('Error uploading video: ' + error.message, 'error');
        } finally {
            this.uploadBtn.disabled = false;
        }
    }

    discardRecording() {
        // Clear recorded data
        this.recordedChunks = [];
        this.currentBlob = null;

        // Reset UI
        this.playbackSection.classList.add('hidden');
        this.playback.src = '';
        this.resetTimer();

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
    new VideoRecorder();
});
