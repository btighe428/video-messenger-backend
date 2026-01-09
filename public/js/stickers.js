// Sticker System - Drag, drop, resize, rotate stickers on video
class Sticker {
    constructor(emoji, x, y, size = 60) {
        this.id = Date.now() + Math.random();
        this.emoji = emoji;
        this.x = x;
        this.y = y;
        this.size = size;
        this.rotation = 0;
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.selected = false;

        // Drag offset
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // Bounds for hit detection
        this.bounds = this.calculateBounds();
    }

    calculateBounds() {
        return {
            left: this.x - this.size / 2,
            right: this.x + this.size / 2,
            top: this.y - this.size / 2,
            bottom: this.y + this.size / 2
        };
    }

    contains(x, y) {
        const bounds = this.calculateBounds();
        return x >= bounds.left && x <= bounds.right &&
               y >= bounds.top && y <= bounds.bottom;
    }

    draw(ctx) {
        ctx.save();

        // Translate to sticker position
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw emoji
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);

        // Draw selection outline if selected
        if (this.selected) {
            ctx.strokeStyle = '#7C3AED';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
            ctx.setLineDash([]); // Reset dash

            // Draw resize handle (bottom-right corner)
            ctx.fillStyle = '#7C3AED';
            ctx.fillRect(this.size / 2 - 8, this.size / 2 - 8, 16, 16);

            // Draw rotation handle (top-right corner)
            ctx.beginPath();
            ctx.arc(this.size / 2, -this.size / 2, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    update(deltaX, deltaY) {
        if (this.isDragging) {
            this.x += deltaX;
            this.y += deltaY;
            this.bounds = this.calculateBounds();
        }
    }
}

class StickerManager {
    constructor(canvas, videoRecorder) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.videoRecorder = videoRecorder;
        this.stickers = [];
        this.selectedSticker = null;

        // Interaction state
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Remote stickers (from other user)
        this.remoteStickers = [];

        // Remote sticker canvas (overlay on remote video)
        this.remoteCanvas = null;
        this.remoteCtx = null;
        this.remoteRenderInterval = null;

        // UI elements
        this.stickerBtn = null;
        this.stickerPicker = null;

        // Available stickers - Communication & Fun emojis
        this.stickerLibrary = [
            // Communication & Mail themed
            { emoji: '📧', name: 'Email' },
            { emoji: '💌', name: 'Love Letter' },
            { emoji: '📬', name: 'Mailbox' },
            { emoji: '📮', name: 'Post Box' },
            { emoji: '✉️', name: 'Envelope' },
            { emoji: '📨', name: 'Incoming' },
            { emoji: '📤', name: 'Outbox' },
            { emoji: '📥', name: 'Inbox' },
            { emoji: '💬', name: 'Chat' },
            { emoji: '📱', name: 'Phone' },
            { emoji: '📞', name: 'Telephone' },
            { emoji: '📲', name: 'Call' },
            { emoji: '📝', name: 'Memo' },
            { emoji: '💭', name: 'Thinking' },
            { emoji: '📡', name: 'Signal' },
            // Fun & Celebration
            { emoji: '❤️', name: 'Heart' },
            { emoji: '⭐', name: 'Star' },
            { emoji: '🎉', name: 'Party' },
            { emoji: '😊', name: 'Happy' },
            { emoji: '😎', name: 'Cool' },
            { emoji: '🔥', name: 'Fire' },
            { emoji: '💕', name: 'Hearts' },
            { emoji: '✨', name: 'Sparkle' },
            { emoji: '🌈', name: 'Rainbow' },
            { emoji: '🎈', name: 'Balloon' },
            { emoji: '🎂', name: 'Cake' },
            { emoji: '🎁', name: 'Gift' },
            { emoji: '💐', name: 'Flowers' },
            { emoji: '🌸', name: 'Blossom' },
            { emoji: '🌟', name: 'Glowing' },
            { emoji: '💫', name: 'Dizzy' },
            { emoji: '🎵', name: 'Music' },
            { emoji: '🍕', name: 'Pizza' },
            { emoji: '🍰', name: 'Dessert' },
            { emoji: '☀️', name: 'Sun' },
            { emoji: '🌙', name: 'Moon' },
            { emoji: '🎭', name: 'Theater' },
            { emoji: '🎨', name: 'Art' },
            { emoji: '📸', name: 'Camera' }
        ];

        this.init();
    }

    init() {
        // NOTE: Canvas sizing is handled by effects.js, not here
        // We're sharing the effectsCanvas which is already sized correctly

        // Get UI elements
        this.stickerBtn = document.getElementById('stickerBtn');
        this.stickerPicker = document.getElementById('stickerPicker');

        if (!this.stickerBtn || !this.stickerPicker) {
            console.warn('Sticker UI elements not found');
            return;
        }

        console.log('Using effectsCanvas:', this.canvas.width, 'x', this.canvas.height);

        // Set up button toggle - integrate with MenuManager
        this.stickerBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent MenuManager from closing immediately
            console.log('Sticker button clicked');

            // Use MenuManager if available, otherwise fallback to direct toggle
            if (window.menuManager) {
                window.menuManager.toggleMenu('stickerPicker');
            } else {
                this.toggleStickerPicker();
            }
        });

        // Populate sticker picker
        this.populateStickerPicker();

        // Set up canvas interaction
        this.setupCanvasInteraction();

        // Set initial cursor
        this.canvas.style.cursor = 'crosshair';

        // NOTE: No separate render loop needed - stickers are drawn by effects.js render loop

        // Set up remote sticker rendering
        this.setupRemoteStickerCanvas();

        console.log('Sticker system initialized');
    }

    setupRemoteStickerCanvas() {
        // Find remote video element
        const remoteVideo = document.getElementById('remoteVideo');
        const remoteVideoFrame = document.getElementById('remoteVideoFrame');

        if (!remoteVideo || !remoteVideoFrame) {
            console.log('⚠️ Remote video elements not found, remote stickers disabled');
            return;
        }

        // Create canvas overlay for remote stickers
        this.remoteCanvas = document.createElement('canvas');
        this.remoteCanvas.id = 'remoteStickerCanvas';
        this.remoteCanvas.style.position = 'absolute';
        this.remoteCanvas.style.top = '0';
        this.remoteCanvas.style.left = '0';
        this.remoteCanvas.style.width = '100%';
        this.remoteCanvas.style.height = '100%';
        this.remoteCanvas.style.pointerEvents = 'none'; // Allow clicks to pass through
        this.remoteCanvas.style.zIndex = '10'; // Above video, below controls

        this.remoteCtx = this.remoteCanvas.getContext('2d');

        // Insert canvas into remote video frame
        remoteVideoFrame.appendChild(this.remoteCanvas);

        // Sync canvas size with remote video
        const resizeRemoteCanvas = () => {
            const rect = remoteVideo.getBoundingClientRect();
            this.remoteCanvas.width = remoteVideo.videoWidth || rect.width;
            this.remoteCanvas.height = remoteVideo.videoHeight || rect.height;
            console.log(`📐 Remote sticker canvas resized: ${this.remoteCanvas.width}x${this.remoteCanvas.height}`);
        };

        remoteVideo.addEventListener('loadedmetadata', resizeRemoteCanvas);
        remoteVideo.addEventListener('playing', resizeRemoteCanvas);
        window.addEventListener('resize', resizeRemoteCanvas);

        // Initial resize
        setTimeout(resizeRemoteCanvas, 100);

        // Start render loop for remote stickers
        this.startRemoteStickerRenderLoop();

        console.log('✅ Remote sticker canvas initialized');
    }

    startRemoteStickerRenderLoop() {
        // Render remote stickers at 30 FPS
        if (this.remoteRenderInterval) {
            clearInterval(this.remoteRenderInterval);
        }

        this.remoteRenderInterval = setInterval(() => {
            this.renderRemoteStickers();
        }, 1000 / 30); // 30 FPS
    }

    renderRemoteStickers() {
        if (!this.remoteCanvas || !this.remoteCtx) return;

        // Clear canvas
        this.remoteCtx.clearRect(0, 0, this.remoteCanvas.width, this.remoteCanvas.height);

        // Draw each remote sticker
        this.remoteStickers.forEach(stickerData => {
            this.remoteCtx.save();

            // Translate to sticker position
            this.remoteCtx.translate(stickerData.x, stickerData.y);
            this.remoteCtx.rotate(stickerData.rotation || 0);

            // Draw emoji
            this.remoteCtx.font = `${stickerData.size}px Arial`;
            this.remoteCtx.textAlign = 'center';
            this.remoteCtx.textBaseline = 'middle';
            this.remoteCtx.fillText(stickerData.emoji, 0, 0);

            this.remoteCtx.restore();
        });
    }

    populateStickerPicker() {
        this.stickerPicker.innerHTML = '';
        console.log('Populating sticker picker with', this.stickerLibrary.length, 'stickers');

        this.stickerLibrary.forEach((sticker, index) => {
            const option = document.createElement('div');
            option.className = 'sticker-option';
            option.title = sticker.name;
            option.textContent = sticker.emoji;

            // Add explicit pointer events style
            option.style.pointerEvents = 'auto';
            option.style.cursor = 'pointer';

            option.addEventListener('click', (e) => {
                console.log('🎯 EMOJI CLICK DETECTED!', sticker.emoji, 'index:', index);
                console.log('Event target:', e.target);
                e.stopPropagation();
                this.addStickerToCenter(sticker.emoji);
                // Picker stays open until user manually closes it
            });

            // Also add mousedown as backup
            option.addEventListener('mousedown', () => {
                console.log('🎯 MOUSEDOWN on emoji:', sticker.emoji);
            });

            this.stickerPicker.appendChild(option);
        });

        console.log('Sticker picker populated with', this.stickerPicker.children.length, 'emoji elements');
        console.log('First emoji element:', this.stickerPicker.children[0]);
    }

    toggleStickerPicker() {
        const wasHidden = this.stickerPicker.classList.contains('hidden');
        this.stickerPicker.classList.toggle('hidden');
        this.stickerBtn.classList.toggle('active');

        const isNowHidden = this.stickerPicker.classList.contains('hidden');
        console.log('Sticker picker toggled:', wasHidden ? 'showing' : 'hiding', '→', isNowHidden ? 'hidden' : 'visible');
        console.log('Sticker picker children count:', this.stickerPicker.children.length);
        console.log('Sticker picker innerHTML length:', this.stickerPicker.innerHTML.length);

        // If opening and picker is empty, repopulate it
        if (this.stickerPicker.children.length === 0 && !isNowHidden) {
            console.warn('Sticker picker is empty! Repopulating...');
            this.populateStickerPicker();
        }

        // Close other menus when opening stickers (if not using MenuManager)
        if (!isNowHidden && !window.menuManager) {
            const otherPickers = ['glassesPicker', 'bgColorPicker', 'positionCalibrator', 'framePicker'];
            otherPickers.forEach(id => {
                const picker = document.getElementById(id);
                if (picker) picker.classList.add('hidden');
            });
        }
    }

    addStickerToCenter(emoji) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const rect = this.canvas.getBoundingClientRect();
        console.log(`Adding sticker "${emoji}" at center: (${centerX}, ${centerY})`);
        console.log(`Canvas internal: ${this.canvas.width}x${this.canvas.height}`);
        console.log(`Canvas display: ${rect.width}x${rect.height}`);

        const sticker = new Sticker(emoji, centerX, centerY);
        this.stickers.push(sticker);

        // Select the new sticker
        this.selectSticker(sticker);

        // Update video recorder's sticker array
        this.syncStickersToRecorder();

        console.log('✓ Sticker added successfully:', emoji, '| Total stickers:', this.stickers.length);
    }

    setupCanvasInteraction() {
        // Mouse down
        this.canvas.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Prevent UI dragging from intercepting
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

            this.handleMouseDown(x, y);
        });

        // Mouse move
        this.canvas.addEventListener('mousemove', (e) => {
            e.stopPropagation(); // Prevent UI dragging from intercepting
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

            this.handleMouseMove(x, y);
        });

        // Mouse up
        this.canvas.addEventListener('mouseup', (e) => {
            e.stopPropagation(); // Prevent UI dragging from intercepting
            this.handleMouseUp();
        });

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent UI dragging from intercepting
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

            this.handleMouseDown(x, y);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent UI dragging from intercepting
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

            this.handleMouseMove(x, y);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.stopPropagation(); // Prevent UI dragging from intercepting
            this.handleMouseUp();
        });

        // Delete key to remove selected sticker
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelectedSticker();
            }
        });
    }

    handleMouseDown(x, y) {
        console.log('🖱️ Mouse down on canvas at:', x, y, '| Total stickers:', this.stickers.length);
        this.lastMouseX = x;
        this.lastMouseY = y;

        // Check if clicking on a sticker
        for (let i = this.stickers.length - 1; i >= 0; i--) {
            const sticker = this.stickers[i];
            console.log(`Checking sticker ${i}: ${sticker.emoji} at (${sticker.x}, ${sticker.y})`);

            // Check if clicking resize or rotate handles (needs to account for rotation)
            if (sticker.selected) {
                // Transform handle positions from local (rotated) space to canvas space
                const cos = Math.cos(sticker.rotation);
                const sin = Math.sin(sticker.rotation);

                // Resize handle at bottom-right corner (local coords: size/2, size/2)
                const resizeLocalX = sticker.size / 2;
                const resizeLocalY = sticker.size / 2;
                const resizeHandleX = sticker.x + (resizeLocalX * cos - resizeLocalY * sin);
                const resizeHandleY = sticker.y + (resizeLocalX * sin + resizeLocalY * cos);
                const distToResize = Math.hypot(x - resizeHandleX, y - resizeHandleY);

                if (distToResize < 20) { // Increased hit area for better UX
                    this.isResizing = true;
                    this.selectedSticker = sticker;
                    this.canvas.style.cursor = 'nwse-resize';
                    console.log('🔄 Resize handle clicked');
                    return;
                }

                // Rotate handle at top-right corner (local coords: size/2, -size/2)
                const rotateLocalX = sticker.size / 2;
                const rotateLocalY = -sticker.size / 2;
                const rotateHandleX = sticker.x + (rotateLocalX * cos - rotateLocalY * sin);
                const rotateHandleY = sticker.y + (rotateLocalX * sin + rotateLocalY * cos);
                const distToRotate = Math.hypot(x - rotateHandleX, y - rotateHandleY);

                if (distToRotate < 20) { // Increased hit area
                    this.isRotating = true;
                    this.selectedSticker = sticker;
                    this.canvas.style.cursor = 'grabbing';
                    console.log('🔄 Rotate handle clicked');
                    return;
                }
            }

            if (sticker.contains(x, y)) {

                // Start dragging
                this.isDragging = true;
                this.canvas.style.cursor = 'move';
                sticker.isDragging = true;
                sticker.dragOffsetX = x - sticker.x;
                sticker.dragOffsetY = y - sticker.y;
                this.selectSticker(sticker);
                return;
            }
        }

        // Clicked empty space, deselect
        this.deselectAll();
        this.canvas.style.cursor = 'crosshair';
    }

    handleMouseMove(x, y) {
        const deltaX = x - this.lastMouseX;
        const deltaY = y - this.lastMouseY;

        if (this.isDragging && this.selectedSticker) {
            this.selectedSticker.x = x - this.selectedSticker.dragOffsetX;
            this.selectedSticker.y = y - this.selectedSticker.dragOffsetY;
            this.syncStickersToRecorder();
        }

        if (this.isResizing && this.selectedSticker) {
            // Calculate new size based on distance from center
            const distFromCenter = Math.hypot(
                x - this.selectedSticker.x,
                y - this.selectedSticker.y
            );
            this.selectedSticker.size = Math.max(20, Math.min(200, distFromCenter * 2));
            this.syncStickersToRecorder();
        }

        if (this.isRotating && this.selectedSticker) {
            // Calculate angle from center to mouse
            const angle = Math.atan2(
                y - this.selectedSticker.y,
                x - this.selectedSticker.x
            );
            this.selectedSticker.rotation = angle;
            this.syncStickersToRecorder();
        }

        // Update cursor based on hover state (only if not currently dragging/resizing/rotating)
        if (!this.isDragging && !this.isResizing && !this.isRotating) {
            this.updateCursor(x, y);
        }

        this.lastMouseX = x;
        this.lastMouseY = y;
    }

    updateCursor(x, y) {
        let cursorStyle = 'crosshair'; // default

        // Check if hovering over any sticker
        for (let i = this.stickers.length - 1; i >= 0; i--) {
            const sticker = this.stickers[i];

            if (sticker.selected) {
                // Transform handle positions from local (rotated) space to canvas space
                const cos = Math.cos(sticker.rotation);
                const sin = Math.sin(sticker.rotation);

                // Check if hovering over resize handle
                const resizeLocalX = sticker.size / 2;
                const resizeLocalY = sticker.size / 2;
                const resizeHandleX = sticker.x + (resizeLocalX * cos - resizeLocalY * sin);
                const resizeHandleY = sticker.y + (resizeLocalX * sin + resizeLocalY * cos);
                const distToResize = Math.hypot(x - resizeHandleX, y - resizeHandleY);

                if (distToResize < 20) {
                    cursorStyle = 'nwse-resize';
                    break;
                }

                // Check if hovering over rotate handle
                const rotateLocalX = sticker.size / 2;
                const rotateLocalY = -sticker.size / 2;
                const rotateHandleX = sticker.x + (rotateLocalX * cos - rotateLocalY * sin);
                const rotateHandleY = sticker.y + (rotateLocalX * sin + rotateLocalY * cos);
                const distToRotate = Math.hypot(x - rotateHandleX, y - rotateHandleY);

                if (distToRotate < 20) {
                    cursorStyle = 'grab';
                    break;
                }

                // Hovering over sticker body
                if (sticker.contains(x, y)) {
                    cursorStyle = 'move';
                    break;
                }
            } else if (sticker.contains(x, y)) {
                // Hovering over unselected sticker
                cursorStyle = 'pointer';
                break;
            }
        }

        this.canvas.style.cursor = cursorStyle;
    }

    handleMouseUp() {
        // Stop all interaction modes
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;

        this.stickers.forEach(sticker => {
            sticker.isDragging = false;
        });

        // Update cursor based on current mouse position
        // This provides proper visual feedback after release
        if (this.lastMouseX !== undefined && this.lastMouseY !== undefined) {
            this.updateCursor(this.lastMouseX, this.lastMouseY);
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    selectSticker(sticker) {
        this.deselectAll();
        sticker.selected = true;
        this.selectedSticker = sticker;
        // Enable pointer events on stickersCanvas for interaction
        if (this.canvas) {
            this.canvas.classList.add('sticker-editing');
        }
    }

    deselectAll() {
        this.stickers.forEach(sticker => {
            sticker.selected = false;
        });
        this.selectedSticker = null;
        // Disable pointer events to allow dragging the video preview
        if (this.canvas) {
            this.canvas.classList.remove('sticker-editing');
        }
    }

    deleteSelectedSticker() {
        if (this.selectedSticker) {
            const index = this.stickers.indexOf(this.selectedSticker);
            if (index > -1) {
                this.stickers.splice(index, 1);
                this.selectedSticker = null;
                this.syncStickersToRecorder();
                console.log('Sticker deleted');
            }
        }
    }

    syncStickersToRecorder() {
        if (this.videoRecorder) {
            // Convert stickers to format expected by recorder
            this.videoRecorder.stickers = this.stickers.map(sticker => ({
                emoji: sticker.emoji,
                x: sticker.x,
                y: sticker.y,
                size: sticker.size,
                rotation: sticker.rotation
            }));
        }

        // Broadcast sticker state to remote users via Socket.io
        this.broadcastStickers();
    }

    broadcastStickers() {
        // Only broadcast if we have a connection manager and are connected
        if (window.connectionManager && window.connectionManager.socket) {
            const stickerData = this.stickers.map(sticker => ({
                emoji: sticker.emoji,
                x: sticker.x,
                y: sticker.y,
                size: sticker.size,
                rotation: sticker.rotation
            }));

            window.connectionManager.socket.emit('stickers-update', {
                stickers: stickerData
            });
        }
    }

    // Receive remote stickers and store them
    receiveRemoteStickers(stickerData) {
        // Store remote stickers for rendering on remote video
        this.remoteStickers = stickerData || [];
        console.log('📥 Received remote stickers:', this.remoteStickers.length);
    }

    drawStickers() {
        // Called by effects.js render loop - do NOT clear canvas here
        if (!this.ctx) return;

        // Draw all stickers
        if (this.stickers.length > 0) {
            console.log(`Drawing ${this.stickers.length} stickers on canvas ${this.canvas.width}x${this.canvas.height}`);
        }
        this.stickers.forEach(sticker => {
            sticker.draw(this.ctx);
        });
    }

    clear() {
        this.stickers = [];
        this.selectedSticker = null;
        // Disable pointer events to allow dragging
        if (this.canvas) {
            this.canvas.classList.remove('sticker-editing');
        }
        this.syncStickersToRecorder();
    }
}

// Export
if (typeof window !== 'undefined') {
    window.StickerManager = StickerManager;
}
