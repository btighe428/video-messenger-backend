// Frame Management System
class FrameManager {
    constructor(videoRecorder) {
        this.videoRecorder = videoRecorder;
        this.currentFrame = 'frame.png';
        this.frameBtn = null;
        this.framePicker = null;
        this.frameOptions = [];

        // Frame image paths - using custom SVG designs
        this.frames = {
            'frame.png': { name: 'Original', path: 'css/frame.png', locked: false },
            'doodle': { name: 'Doodle', path: 'css/frames/svg/doodle.svg', locked: false },
            'washi': { name: 'Washi', path: 'css/frames/svg/washi.svg', locked: false },
            'polaroid': { name: 'Polaroid', path: 'css/frames/svg/polaroid.svg', locked: false },
            'stickers': { name: 'Stickers', path: 'css/frames/svg/stickers.svg', locked: false },
            'winter': { name: 'Winter', path: 'css/frames/svg/winter.svg', locked: false },
            'spring': { name: 'Spring', path: 'css/frames/svg/spring.svg', locked: true }
        };

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
        this.frameBtn = document.getElementById('frameBtn');
        this.framePicker = document.getElementById('framePicker');
        this.frameOptions = document.querySelectorAll('.frame-option:not(.locked)');

        if (!this.frameBtn || !this.framePicker) {
            console.error('Frame picker elements not found');
            return;
        }

        // Toggle frame picker
        this.frameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFramePicker();
        });

        // Frame selection
        this.frameOptions.forEach(option => {
            option.addEventListener('click', () => {
                const frameId = option.getAttribute('data-frame');
                if (frameId && !option.classList.contains('locked')) {
                    this.selectFrame(frameId);
                }
            });
        });

        // Close picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.framePicker.contains(e.target) &&
                !this.frameBtn.contains(e.target) &&
                !this.framePicker.classList.contains('hidden')) {
                this.hideFramePicker();
            }
        });

        // Load saved frame from localStorage
        const savedFrame = localStorage.getItem('selectedFrame');
        if (savedFrame && this.frames[savedFrame] && !this.frames[savedFrame].locked) {
            this.selectFrame(savedFrame, false);
        }

        console.log('Frame manager initialized');
    }

    toggleFramePicker() {
        const isHidden = this.framePicker.classList.contains('hidden');

        if (isHidden) {
            this.showFramePicker();
        } else {
            this.hideFramePicker();
        }
    }

    showFramePicker() {
        // Hide other pickers
        const glassesPicker = document.getElementById('glassesPicker');
        const bgColorPicker = document.getElementById('bgColorPicker');
        const positionCalibrator = document.getElementById('positionCalibrator');

        if (glassesPicker) glassesPicker.classList.add('hidden');
        if (bgColorPicker) bgColorPicker.classList.add('hidden');
        if (positionCalibrator) positionCalibrator.classList.add('hidden');

        this.framePicker.classList.remove('hidden');
        this.frameBtn.classList.add('active');
    }

    hideFramePicker() {
        this.framePicker.classList.add('hidden');
        this.frameBtn.classList.remove('active');
    }

    selectFrame(frameId, playAnimation = true) {
        const frameData = this.frames[frameId];

        if (!frameData) {
            console.error('Frame not found:', frameId);
            return;
        }

        if (frameData.locked) {
            console.log('Frame is locked:', frameId);
            return;
        }

        // Update active state in UI
        document.querySelectorAll('.frame-option').forEach(opt => {
            opt.classList.remove('active');
        });

        const selectedOption = document.querySelector(`.frame-option[data-frame="${frameId}"]`);
        if (selectedOption) {
            selectedOption.classList.add('active');
        }

        // Load new frame image
        this.currentFrame = frameId;
        const frameImage = new Image();
        frameImage.src = frameData.path;

        frameImage.onload = () => {
            // Update video recorder's frame
            if (this.videoRecorder) {
                this.videoRecorder.frameImage = frameImage;
                this.videoRecorder.currentFrame = frameId;
                this.videoRecorder.frameCached = false;
                this.videoRecorder.cacheFrame();
                console.log('Frame updated:', frameData.name);
            }

            // Save to localStorage
            localStorage.setItem('selectedFrame', frameId);

            // Play bounce animation if requested
            if (playAnimation && selectedOption) {
                const previewCircle = selectedOption.querySelector('.preview-circle');
                if (previewCircle) {
                    previewCircle.style.animation = 'none';
                    setTimeout(() => {
                        previewCircle.style.animation = '';
                    }, 10);
                }
            }
        };

        frameImage.onerror = () => {
            console.error('Failed to load frame:', frameData.path);
            // Fallback to original frame
            if (frameId !== 'frame.png') {
                this.selectFrame('frame.png', false);
            }
        };

        // Close picker after selection
        setTimeout(() => {
            this.hideFramePicker();
        }, 300);
    }

    unlockFrame(frameId) {
        if (this.frames[frameId]) {
            this.frames[frameId].locked = false;

            // Update UI
            const frameOption = document.querySelector(`.frame-option[data-frame="${frameId}"]`);
            if (frameOption) {
                frameOption.classList.remove('locked');

                // Add unlock animation
                frameOption.style.animation = 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';

                // Show notification
                if (this.videoRecorder && this.videoRecorder.showStatus) {
                    this.videoRecorder.showStatus(`🎉 New frame unlocked: ${this.frames[frameId].name}!`, 'success');
                }
            }

            console.log('Frame unlocked:', frameId);
        }
    }

    getUnlockedFrames() {
        return Object.entries(this.frames)
            .filter(([id, data]) => !data.locked)
            .map(([id]) => id);
    }

    getCurrentFrame() {
        return this.currentFrame;
    }

    unlockFrame(frameId) {
        const frameData = this.frames[frameId];
        if (!frameData) {
            console.warn('Frame not found:', frameId);
            return;
        }

        if (frameData.locked) {
            frameData.locked = false;
            console.log('Frame unlocked:', frameData.name);

            // Update UI if frame picker is open
            const frameOption = document.querySelector(`.frame-option[data-frame="${frameId}"]`);
            if (frameOption) {
                frameOption.classList.remove('locked');
                frameOption.title = frameData.name;

                // Update label
                const label = frameOption.querySelector('.frame-label');
                if (label) {
                    label.textContent = frameData.name;
                }

                // Update icon (remove lock)
                const circle = frameOption.querySelector('.preview-circle');
                if (circle) {
                    const span = circle.querySelector('span');
                    if (span && span.textContent === '🔒') {
                        // Set appropriate icon based on frame type
                        const icons = {
                            'spring': '🌸',
                            'doodle': '✏️',
                            'washi': '📎',
                            'polaroid': '📷',
                            'winter': '❄️'
                        };
                        span.textContent = icons[frameId] || '🖼️';
                    }
                }

                // Make it clickable
                frameOption.addEventListener('click', () => {
                    this.selectFrame(frameId);
                });
            }

            // Trigger unlock animation
            if (frameOption) {
                frameOption.style.animation = 'none';
                setTimeout(() => {
                    frameOption.style.animation = 'bounceIn 0.6s var(--ease-ios)';
                }, 10);
            }
        }
    }
}

// Initialize frame manager when video recorder is ready
window.addEventListener('load', () => {
    setTimeout(() => {
        if (window.videoRecorder) {
            window.frameManager = new FrameManager(window.videoRecorder);
            console.log('Frame manager connected to video recorder');

            // Initialize achievement manager after frame manager
            if (window.AchievementManager) {
                window.achievementManager = new window.AchievementManager(window.frameManager);
                console.log('Achievement manager initialized');
            }
        } else {
            console.warn('Video recorder not found, retrying...');
            setTimeout(() => {
                if (window.videoRecorder) {
                    window.frameManager = new FrameManager(window.videoRecorder);

                    // Initialize achievement manager after frame manager
                    if (window.AchievementManager) {
                        window.achievementManager = new window.AchievementManager(window.frameManager);
                        console.log('Achievement manager initialized');
                    }
                }
            }, 1000);
        }
    }, 100);
});
