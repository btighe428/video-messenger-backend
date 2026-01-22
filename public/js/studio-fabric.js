/**
 * Studio Fabric.js - Core Canvas Controller
 *
 * Instagram Stories-style creative canvas powered by fabric.js
 * Features: Drawing, text, stickers, multiplayer sync, camera snapshots
 */

class StudioFabric {
    constructor() {
        this.canvas = null;
        this.isActive = false;

        // Zoom constraints
        this.minZoom = 0.25;
        this.maxZoom = 3;
        this.currentZoom = 1;

        // Tool state
        this.currentTool = 'select';
        this.currentBrush = 'pen';
        this.brushColor = '#141414';
        this.brushSize = 4;

        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;

        // Socket reference for multiplayer
        this.socket = null;

        // Object ID counter
        this.nextObjectId = 1;

        // Multiplayer cursors
        this.remoteCursors = new Map();
        this.cursorOverlay = null;

        // Cursor colors for multiplayer
        this.cursorColors = [
            '#7d2eff', '#0066ff', '#00b341', '#ff6b00',
            '#ff2d8a', '#00b3b3', '#e62e2e', '#e6b800'
        ];

        this.myCursorColor = this.cursorColors[Math.floor(Math.random() * this.cursorColors.length)];

        // Throttle cursor updates
        this.lastCursorUpdate = 0;
        this.cursorUpdateInterval = 50;

        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleWheel = this.handleWheel.bind(this);

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        const canvasEl = document.getElementById('studioFabricCanvas');
        if (!canvasEl) {
            console.warn('Studio fabric canvas not found');
            return;
        }

        // Initialize fabric.js canvas with Figma-style selection
        this.canvas = new fabric.Canvas('studioFabricCanvas', {
            backgroundColor: '#f5f5f5',
            selection: true,
            preserveObjectStacking: true,
            enableRetinaScaling: true,
            stopContextMenu: true,
            fireRightClick: true,
            // Figma-style marquee selection box
            selectionColor: 'rgba(125, 46, 255, 0.1)',
            selectionBorderColor: '#7d2eff',
            selectionLineWidth: 1
        });

        // Set initial size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Setup event listeners
        this.setupCanvasEvents();
        this.setupKeyboardEvents();

        // Create cursor overlay for multiplayer
        this.createCursorOverlay();

        // Custom selection styling
        this.setupSelectionStyle();

        // Setup drag and drop from panels
        this.setupDragDrop();

        // Auto-connect to socket if available
        this.autoConnectSocket();

        console.log('Studio Fabric initialized');
    }

    autoConnectSocket() {
        // Check for existing socket connection (try both window.socket and connectionManager)
        const checkSocket = () => {
            const socket = window.socket || window.connectionManager?.socket;
            if (socket && socket.connected) {
                this.setSocket(socket);
                console.log('Studio Fabric connected to socket:', socket.id);
            } else {
                // Retry in 500ms
                console.log('Socket not ready, retrying... (window.socket:', !!window.socket,
                    ', connectionManager:', !!window.connectionManager?.socket, ')');
                setTimeout(checkSocket, 500);
            }
        };
        checkSocket();
    }

    resizeCanvas() {
        if (!this.canvas) return;

        const container = document.getElementById('studioCanvasContainer');
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        if (width > 0 && height > 0) {
            this.canvas.setDimensions({ width, height });
            this.canvas.renderAll();
        }
    }

    setupSelectionStyle() {
        // Very dark gray selection outline
        fabric.Object.prototype.set({
            borderColor: '#323232',
            cornerColor: '#323232',
            cornerStrokeColor: '#ffffff',
            cornerSize: 12,
            cornerStyle: 'circle',
            transparentCorners: false,
            borderScaleFactor: 2,
            padding: 5
        });
    }

    // ==================== DRAG AND DROP ====================

    setupDragDrop() {
        const canvasContainer = document.getElementById('studioCanvasContainer');
        if (!canvasContainer) return;

        // Prevent default browser drag behavior
        canvasContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvasContainer.classList.add('drag-over');
        });

        canvasContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            canvasContainer.classList.remove('drag-over');
        });

        canvasContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            canvasContainer.classList.remove('drag-over');
            this.handleDrop(e);
        });

        console.log('Drag and drop initialized');
    }

    handleDrop(e) {
        // Get drop position relative to canvas
        const canvasRect = this.canvas.getElement().getBoundingClientRect();
        const dropX = (e.clientX - canvasRect.left) / this.currentZoom;
        const dropY = (e.clientY - canvasRect.top) / this.currentZoom;

        // Get drag data
        const dragType = e.dataTransfer.getData('text/drag-type');
        const dragData = e.dataTransfer.getData('text/drag-data');

        if (!dragType || !dragData) {
            console.warn('No drag data found');
            return;
        }

        console.log(`Drop: type=${dragType}, data=${dragData}, x=${dropX}, y=${dropY}`);

        switch (dragType) {
            case 'emoji':
                this.addEmoji(dragData, dropX, dropY);
                break;

            case 'image':
            case 'gif':
            case 'clipart':
                this.addImage(dragData, dropX, dropY);
                break;

            case 'text':
                this.addText(dragData, {
                    left: dropX,
                    top: dropY
                });
                break;

            default:
                console.warn('Unknown drag type:', dragType);
        }
    }

    setupCanvasEvents() {
        // Mouse wheel zoom
        this.canvas.on('mouse:wheel', (opt) => this.handleWheel(opt));

        // Object events for undo/redo
        this.canvas.on('object:added', (e) => this.onObjectAdded(e));
        this.canvas.on('object:modified', (e) => this.onObjectModified(e));
        this.canvas.on('object:removed', (e) => this.onObjectRemoved(e));

        // Mouse move for cursor tracking
        this.canvas.on('mouse:move', (opt) => this.onMouseMove(opt));

        // Drawing mode events
        this.canvas.on('path:created', (e) => this.onPathCreated(e));
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown(e) {
        if (!this.isActive) return;

        // Don't intercept if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Delete selected object
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelected();
            e.preventDefault();
        }

        // Undo: Ctrl/Cmd + Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            this.undo();
            e.preventDefault();
        }

        // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            this.redo();
            e.preventDefault();
        }

        // Emoji reactions (1-6)
        if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
            const reactions = ['❤️', '👍', '😂', '🔥', '👏', '🎉'];
            const emoji = reactions[parseInt(e.key) - 1];
            this.sendReaction(emoji);
        }
    }

    handleWheel(opt) {
        const e = opt.e;
        e.preventDefault();
        e.stopPropagation();

        // Figma-style navigation:
        // - Pinch (ctrlKey) = zoom
        // - Two-finger scroll (no ctrlKey) = pan
        if (e.ctrlKey || e.metaKey) {
            // PINCH TO ZOOM
            const delta = e.deltaY;
            let zoom = this.canvas.getZoom();

            // Zoom in/out (more sensitive for pinch gestures)
            zoom *= 0.995 ** delta;
            zoom = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);

            // Zoom toward mouse position
            const point = new fabric.Point(e.offsetX, e.offsetY);
            this.canvas.zoomToPoint(point, zoom);

            this.currentZoom = zoom;
            this.updateZoomDisplay();
        } else {
            // TWO-FINGER SCROLL TO PAN
            const vpt = this.canvas.viewportTransform.slice();
            vpt[4] -= e.deltaX;
            vpt[5] -= e.deltaY;
            this.canvas.setViewportTransform(vpt);
            this.canvas.renderAll();
        }

        // Emit viewport change for video circle canvas pinning
        this.emitViewportChange();
    }

    // ==================== TOOL SWITCHING ====================

    setTool(tool) {
        this.currentTool = tool;

        // Reset drawing mode
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;

        switch (tool) {
            case 'select':
                // Selection tool: click-drag creates marquee selection box
                this.canvas.defaultCursor = 'default';
                this.canvas.selection = true;
                this.canvas.selectionColor = 'rgba(125, 46, 255, 0.1)';
                this.canvas.selectionBorderColor = '#7d2eff';
                this.canvas.selectionLineWidth = 1;
                break;
            case 'draw':
                this.enableDrawingMode();
                break;
            case 'text':
                this.canvas.defaultCursor = 'text';
                this.canvas.selection = false;
                break;
            case 'pan':
                this.canvas.defaultCursor = 'grab';
                this.canvas.selection = false;
                break;
        }

        // Update toolbar UI
        this.updateToolbarUI(tool);
    }

    enableDrawingMode() {
        this.canvas.isDrawingMode = true;
        this.canvas.selection = false;
        this.updateBrush();
    }

    updateBrush() {
        if (!this.canvas.isDrawingMode) return;

        const brush = this.canvas.freeDrawingBrush;
        brush.color = this.brushColor;
        brush.width = this.brushSize;

        switch (this.currentBrush) {
            case 'pen':
                brush.shadow = null;
                break;
            case 'marker':
                brush.color = this.hexToRgba(this.brushColor, 0.5);
                brush.width = this.brushSize * 2;
                break;
            case 'neon':
                brush.shadow = new fabric.Shadow({
                    color: this.brushColor,
                    blur: 15,
                    offsetX: 0,
                    offsetY: 0
                });
                break;
            case 'eraser':
                brush.color = '#ffffff';
                brush.shadow = null;
                break;
        }
    }

    setBrushType(type) {
        this.currentBrush = type;
        this.updateBrush();
    }

    setBrushColor(color) {
        this.brushColor = color;
        this.updateBrush();
    }

    setBrushSize(size) {
        this.brushSize = size;
        this.updateBrush();
    }

    // ==================== OBJECT MANAGEMENT ====================

    addObject(fabricObj, broadcast = true) {
        // Assign unique ID
        fabricObj.set('objectId', this.nextObjectId++);

        this.canvas.add(fabricObj);
        this.canvas.setActiveObject(fabricObj);
        this.canvas.renderAll();

        if (broadcast) {
            this.broadcastObjectAdded(fabricObj);
        }

        return fabricObj;
    }

    deleteSelected() {
        const activeObjects = this.canvas.getActiveObjects();
        if (activeObjects.length === 0) return;

        activeObjects.forEach(obj => {
            this.broadcastObjectRemoved(obj);
            this.canvas.remove(obj);
        });

        this.canvas.discardActiveObject();
        this.canvas.renderAll();
        this.saveState();
    }

    // ==================== TEXT ====================

    addText(text = 'Double-click to edit', options = {}) {
        const textObj = new fabric.IText(text, {
            left: this.canvas.width / 2,
            top: this.canvas.height / 2,
            fontSize: options.fontSize || 32,
            fontFamily: options.fontFamily || 'Yahoo Product Sans VF, sans-serif',
            fill: options.fill || '#141414',
            originX: 'center',
            originY: 'center',
            ...options
        });

        return this.addObject(textObj);
    }

    // ==================== STICKERS/EMOJI ====================

    addEmoji(emoji, x, y) {
        const emojiObj = new fabric.Text(emoji, {
            left: x || this.canvas.width / 2,
            top: y || this.canvas.height / 2,
            fontSize: 64,
            originX: 'center',
            originY: 'center'
        });

        return this.addObject(emojiObj);
    }

    addImage(url, x, y) {
        return new Promise((resolve, reject) => {
            // Check if it's a GIF - needs special handling for animation
            const isGif = url.toLowerCase().includes('.gif') || url.toLowerCase().includes('giphy');

            if (isGif) {
                // For GIFs: create HTML img element to preserve animation
                const imgElement = document.createElement('img');
                imgElement.crossOrigin = 'anonymous';
                imgElement.src = url;

                imgElement.onload = () => {
                    const fabricImg = new fabric.Image(imgElement, {
                        left: x || this.canvas.width / 2,
                        top: y || this.canvas.height / 2,
                        originX: 'center',
                        originY: 'center',
                        objectCaching: false // Required for GIF animation
                    });

                    // Scale to reasonable size
                    const maxSize = 300;
                    const scale = Math.min(maxSize / fabricImg.width, maxSize / fabricImg.height, 1);
                    fabricImg.scaleX = scale;
                    fabricImg.scaleY = scale;

                    // Mark as animated GIF for render loop
                    fabricImg.isAnimatedGif = true;

                    resolve(this.addObject(fabricImg));

                    // Start animation render loop if not already running
                    this.startGifAnimationLoop();
                };

                imgElement.onerror = () => {
                    reject(new Error('Failed to load GIF'));
                };
            } else {
                // Regular images: use standard fromURL
                fabric.Image.fromURL(url, (img) => {
                    if (!img) {
                        reject(new Error('Failed to load image'));
                        return;
                    }

                    // Scale to reasonable size
                    const maxSize = 300;
                    const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

                    img.set({
                        left: x || this.canvas.width / 2,
                        top: y || this.canvas.height / 2,
                        scaleX: scale,
                        scaleY: scale,
                        originX: 'center',
                        originY: 'center'
                    });

                    resolve(this.addObject(img));
                }, { crossOrigin: 'anonymous' });
            }
        });
    }

    // Animation loop for GIFs - re-renders canvas to show GIF frames
    startGifAnimationLoop() {
        if (this.gifAnimationRunning) return;
        this.gifAnimationRunning = true;

        const animate = () => {
            if (!this.canvas) {
                this.gifAnimationRunning = false;
                return;
            }

            // Check if any animated GIFs exist on canvas
            const hasAnimatedGifs = this.canvas.getObjects().some(obj => obj.isAnimatedGif);

            if (hasAnimatedGifs) {
                this.canvas.requestRenderAll();
                requestAnimationFrame(animate);
            } else {
                this.gifAnimationRunning = false;
            }
        };

        requestAnimationFrame(animate);
    }

    // ==================== CAMERA SNAPSHOT (CIRCULAR) ====================

    addCameraSnapshot() {
        // Get the video element from the main preview
        const video = document.getElementById('preview') || document.getElementById('studioPreviewVideo');
        if (!video || !video.srcObject) {
            console.warn('No camera available');
            return;
        }

        // Start countdown then capture
        this.showCountdownAndCapture(video);
    }

    // Show 3, 2, 1 countdown then flash and capture
    showCountdownAndCapture(video) {
        // Create countdown overlay
        const overlay = document.createElement('div');
        overlay.id = 'selfie-countdown-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            pointer-events: none;
        `;

        const countdownText = document.createElement('div');
        countdownText.style.cssText = `
            font-size: 200px;
            font-weight: bold;
            color: white;
            text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            animation: countdown-pulse 0.5s ease-out;
        `;

        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes countdown-pulse {
                0% { transform: scale(1.5); opacity: 0; }
                50% { transform: scale(1); opacity: 1; }
                100% { transform: scale(0.9); opacity: 0.8; }
            }
            @keyframes flash {
                0% { opacity: 0; }
                50% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        overlay.appendChild(countdownText);
        document.body.appendChild(overlay);

        // Countdown sequence
        let count = 3;
        countdownText.textContent = count;

        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownText.textContent = count;
                // Re-trigger animation
                countdownText.style.animation = 'none';
                countdownText.offsetHeight; // Force reflow
                countdownText.style.animation = 'countdown-pulse 0.5s ease-out';
            } else {
                clearInterval(countdownInterval);
                // Flash and capture
                this.flashAndCapture(video, overlay, style);
            }
        }, 800);
    }

    // Flash screen white and capture the photo
    flashAndCapture(video, overlay, styleElement) {
        // Change overlay to white flash
        overlay.style.background = 'white';
        overlay.style.animation = 'flash 0.3s ease-out';
        overlay.querySelector('div').style.display = 'none';

        // Capture after brief delay (at peak of flash)
        setTimeout(() => {
            this.captureSnapshot(video);

            // Remove overlay and style
            setTimeout(() => {
                overlay.remove();
                styleElement.remove();
            }, 200);
        }, 100);
    }

    // Actually capture the snapshot
    captureSnapshot(video) {
        // Create a temporary canvas to capture the frame
        const tempCanvas = document.createElement('canvas');
        const size = Math.min(video.videoWidth, video.videoHeight);
        tempCanvas.width = size;
        tempCanvas.height = size;

        const ctx = tempCanvas.getContext('2d');

        // Calculate crop to center square
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;

        // Draw cropped square from video
        ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

        // Create circular clip
        const circleCanvas = document.createElement('canvas');
        circleCanvas.width = size;
        circleCanvas.height = size;
        const circleCtx = circleCanvas.getContext('2d');

        // Draw circular mask
        circleCtx.beginPath();
        circleCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        circleCtx.closePath();
        circleCtx.clip();

        // Draw the image inside the circular clip
        circleCtx.drawImage(tempCanvas, 0, 0);

        // Add subtle white border
        circleCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        circleCtx.lineWidth = 4;
        circleCtx.beginPath();
        circleCtx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        circleCtx.stroke();

        // Convert to data URL and add to canvas
        const dataUrl = circleCanvas.toDataURL('image/png');

        fabric.Image.fromURL(dataUrl, (img) => {
            // Scale down to reasonable size
            const displaySize = 150;
            const scale = displaySize / size;

            img.set({
                left: this.canvas.width / 2,
                top: this.canvas.height / 2,
                scaleX: scale,
                scaleY: scale,
                originX: 'center',
                originY: 'center'
            });

            this.addObject(img);
        });
    }

    // ==================== LIVE VIDEO ON CANVAS ====================

    addLiveVideo() {
        const video = document.getElementById('preview') || document.getElementById('studioPreviewVideo');
        if (!video || !video.srcObject) {
            console.warn('No camera available for live video');
            return null;
        }

        // Create a fabric video element
        const videoElement = new fabric.Image(video, {
            left: this.canvas.width - 200,
            top: this.canvas.height - 200,
            originX: 'center',
            originY: 'center',
            objectCaching: false  // Required for video to update
        });

        // Scale to reasonable size
        const maxSize = 200;
        const scale = Math.min(maxSize / video.videoWidth, maxSize / video.videoHeight, 1);
        videoElement.scale(scale);

        // Add circular clip path
        const radius = Math.min(videoElement.width * scale, videoElement.height * scale) / 2;
        videoElement.clipPath = new fabric.Circle({
            radius: radius,
            originX: 'center',
            originY: 'center'
        });

        // Mark as live video for special handling
        videoElement.isLiveVideo = true;

        this.addObject(videoElement);

        // Start render loop to update video frames
        this.startVideoRenderLoop();

        return videoElement;
    }

    startVideoRenderLoop() {
        if (this.videoRenderLoopActive) return;
        this.videoRenderLoopActive = true;

        const renderLoop = () => {
            if (!this.videoRenderLoopActive || !this.isActive) {
                this.videoRenderLoopActive = false;
                return;
            }

            // Check if there are any live video objects
            const hasLiveVideo = this.canvas.getObjects().some(obj => obj.isLiveVideo);
            if (hasLiveVideo) {
                this.canvas.renderAll();
            } else {
                this.videoRenderLoopActive = false;
                return;
            }

            requestAnimationFrame(renderLoop);
        };

        requestAnimationFrame(renderLoop);
    }

    // ==================== SAVE & EMAIL ====================

    getCanvasDataURL(format = 'jpeg', quality = 0.92) {
        return new Promise((resolve) => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvas.width * 2;
            tempCanvas.height = this.canvas.height * 2;
            const ctx = tempCanvas.getContext('2d');

            // Fill white background for JPEG
            if (format === 'jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            }

            // Draw the fabric canvas
            const fabricDataUrl = this.canvas.toDataURL({
                format: 'png',
                multiplier: 2
            });

            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);

                // Add watermark logo in lower left
                const logo = new Image();
                logo.onload = () => {
                    // Scale logo to 400% larger (640px wide at 2x = 320px display)
                    const logoWidth = 640;
                    const logoHeight = (logo.height / logo.width) * logoWidth;
                    const padding = 48;

                    // Position in lower left
                    const x = padding;
                    const y = tempCanvas.height - logoHeight - padding;

                    // Draw with slight transparency
                    ctx.globalAlpha = 0.7;
                    ctx.drawImage(logo, x, y, logoWidth, logoHeight);
                    ctx.globalAlpha = 1.0;

                    // Return final image
                    if (format === 'jpeg') {
                        resolve(tempCanvas.toDataURL('image/jpeg', quality));
                    } else {
                        resolve(tempCanvas.toDataURL('image/png'));
                    }
                };
                logo.onerror = () => {
                    // If logo fails to load, return without watermark
                    console.warn('Watermark logo failed to load');
                    if (format === 'jpeg') {
                        resolve(tempCanvas.toDataURL('image/jpeg', quality));
                    } else {
                        resolve(tempCanvas.toDataURL('image/png'));
                    }
                };
                logo.src = 'css/logo.png';
            };
            img.src = fabricDataUrl;
        });
    }

    async saveToEmail() {
        // Get canvas as JPG
        const dataUrl = await this.getCanvasDataURL('jpeg', 0.92);
        this.showEmailCompose(dataUrl);
    }

    async downloadAsJpg() {
        const dataUrl = await this.getCanvasDataURL('jpeg', 0.92);
        const link = document.createElement('a');
        link.download = `Yahoo-Fuchsia-Creation-${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();
    }

    async copyToClipboard() {
        try {
            const dataUrl = await this.getCanvasDataURL('png');
            const blob = await (await fetch(dataUrl)).blob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    }

    async showEmailCompose(imageDataUrl) {
        const existing = document.getElementById('studioEmailModal');
        if (existing) existing.remove();

        // Calculate file size
        const base64Length = imageDataUrl.length - 'data:image/jpeg;base64,'.length;
        const fileSizeKB = Math.round((base64Length * 0.75) / 1024);

        const modal = document.createElement('div');
        modal.id = 'studioEmailModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                width: 90%;
                max-width: 650px;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="
                    padding: 20px 24px;
                    border-bottom: 1px solid #323232;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #141414;">
                        Share Creation
                    </h2>
                    <button id="closeEmailModal" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 8px;
                        border-radius: 8px;
                        color: #5b636a;
                    ">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div style="padding: 24px; overflow-y: auto; flex: 1;">
                    <!-- Image Preview -->
                    <div style="margin-bottom: 20px; text-align: center;">
                        <img id="emailPreviewImg" src="${imageDataUrl}" style="
                            max-width: 100%;
                            max-height: 250px;
                            border-radius: 12px;
                            border: 1px solid #323232;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        ">
                        <div style="margin-top: 8px; font-size: 13px; color: #5b636a;">
                            Yahoo-Fuchsia-Creation.jpg · ${fileSizeKB} KB
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                        <button id="downloadJpgBtn" style="
                            flex: 1;
                            padding: 12px 16px;
                            border: 1px solid #323232;
                            border-radius: 8px;
                            background: white;
                            color: #141414;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        ">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download JPG
                        </button>
                        <button id="copyImageBtn" style="
                            flex: 1;
                            padding: 12px 16px;
                            border: 1px solid #323232;
                            border-radius: 8px;
                            background: white;
                            color: #141414;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        ">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            Copy Image
                        </button>
                    </div>

                    <div style="border-top: 1px solid #e3e3e3; padding-top: 20px;">
                        <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #141414;">
                            Send via Email
                        </h3>

                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 14px; font-weight: 500; color: #5b636a; margin-bottom: 6px;">To:</label>
                            <input type="email" id="emailTo" placeholder="recipient@example.com" style="
                                width: 100%;
                                padding: 12px 16px;
                                border: 1px solid #323232;
                                border-radius: 8px;
                                font-size: 16px;
                                outline: none;
                                box-sizing: border-box;
                            ">
                        </div>

                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 14px; font-weight: 500; color: #5b636a; margin-bottom: 6px;">Subject:</label>
                            <input type="text" id="emailSubject" value="Check out my creation! ✨" style="
                                width: 100%;
                                padding: 12px 16px;
                                border: 1px solid #323232;
                                border-radius: 8px;
                                font-size: 16px;
                                outline: none;
                                box-sizing: border-box;
                            ">
                        </div>

                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 14px; font-weight: 500; color: #5b636a; margin-bottom: 6px;">Message:</label>
                            <textarea id="emailBody" rows="3" placeholder="Add a personal message..." style="
                                width: 100%;
                                padding: 12px 16px;
                                border: 1px solid #323232;
                                border-radius: 8px;
                                font-size: 16px;
                                outline: none;
                                resize: vertical;
                                box-sizing: border-box;
                                font-family: inherit;
                            "></textarea>
                        </div>

                        <!-- Embed Option -->
                        <div style="margin-bottom: 16px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="embedInBody" checked style="
                                    width: 18px;
                                    height: 18px;
                                    accent-color: #7d2eff;
                                ">
                                <span style="font-size: 14px; color: #141414;">Embed image in email body</span>
                            </label>
                            <div style="margin-left: 28px; font-size: 12px; color: #5b636a;">
                                Image will appear inline. Uncheck to attach as file instead.
                            </div>
                        </div>
                    </div>
                </div>

                <div style="
                    padding: 16px 24px;
                    border-top: 1px solid #323232;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <button id="openInMailApp" style="
                        padding: 12px 20px;
                        border: 1px solid #323232;
                        border-radius: 8px;
                        background: white;
                        color: #141414;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        Open in Mail App
                    </button>
                    <div style="display: flex; gap: 12px;">
                        <button id="cancelEmail" style="
                            padding: 12px 24px;
                            border: 1px solid #323232;
                            border-radius: 8px;
                            background: white;
                            color: #141414;
                            font-size: 15px;
                            font-weight: 500;
                            cursor: pointer;
                        ">Cancel</button>
                        <button id="sendEmail" style="
                            padding: 12px 24px;
                            border: none;
                            border-radius: 8px;
                            background: #7d2eff;
                            color: white;
                            font-size: 15px;
                            font-weight: 600;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Send Email
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Store image data for later use
        this._currentImageDataUrl = imageDataUrl;

        // Event listeners
        modal.querySelector('#closeEmailModal').onclick = () => modal.remove();
        modal.querySelector('#cancelEmail').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        // Download JPG
        modal.querySelector('#downloadJpgBtn').onclick = async () => {
            const link = document.createElement('a');
            link.download = `Yahoo-Fuchsia-Creation-${Date.now()}.jpg`;
            link.href = imageDataUrl;
            link.click();

            // Show feedback
            const btn = modal.querySelector('#downloadJpgBtn');
            btn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00b341" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Downloaded!
            `;
            setTimeout(() => {
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download JPG
                `;
            }, 2000);
        };

        // Copy Image
        modal.querySelector('#copyImageBtn').onclick = async () => {
            const success = await this.copyToClipboard();
            const btn = modal.querySelector('#copyImageBtn');
            if (success) {
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00b341" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copied!
                `;
            } else {
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Failed
                `;
            }
            setTimeout(() => {
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy Image
                `;
            }, 2000);
        };

        // Open in Mail App (mailto with subject/body, image must be attached manually)
        modal.querySelector('#openInMailApp').onclick = () => {
            const to = document.getElementById('emailTo').value;
            const subject = encodeURIComponent(document.getElementById('emailSubject').value);
            const body = encodeURIComponent(document.getElementById('emailBody').value + '\n\n[Image attached]');

            // First download the image so user can attach it
            const link = document.createElement('a');
            link.download = `Yahoo-Fuchsia-Creation-${Date.now()}.jpg`;
            link.href = imageDataUrl;
            link.click();

            // Then open mailto
            setTimeout(() => {
                window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
            }, 500);
        };

        // Send Email (simulated - shows success)
        modal.querySelector('#sendEmail').onclick = () => {
            const to = document.getElementById('emailTo').value;
            const subject = document.getElementById('emailSubject').value;
            const body = document.getElementById('emailBody').value;
            const embedInBody = document.getElementById('embedInBody').checked;

            if (!to) {
                document.getElementById('emailTo').style.borderColor = '#ef4444';
                document.getElementById('emailTo').focus();
                return;
            }

            // In production, send to backend API
            console.log('Email payload:', {
                to,
                subject,
                body,
                embedInBody,
                imageDataUrl: imageDataUrl.substring(0, 100) + '...',
                timestamp: new Date().toISOString()
            });

            this.showEmailSentAnimation(modal);
        };

        // Focus email input
        setTimeout(() => document.getElementById('emailTo')?.focus(), 100);
    }

    showEmailSentAnimation(modal) {
        const content = modal.querySelector('div > div');
        content.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 80px 40px;
                text-align: center;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: #00b341;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 24px;
                    animation: scaleIn 0.3s ease-out;
                ">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #141414;">Email Sent!</h2>
                <p style="margin: 0; color: #5b636a; font-size: 16px;">Your creation has been delivered.</p>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);

        setTimeout(() => {
            modal.remove();
            style.remove();
        }, 2000);
    }

    // ==================== UNDO/REDO ====================

    saveState() {
        const json = this.canvas.toJSON(['objectId']);
        this.undoStack.push(json);

        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }

        this.redoStack = [];
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length <= 1) return;

        const current = this.undoStack.pop();
        this.redoStack.push(current);

        const previous = this.undoStack[this.undoStack.length - 1];
        this.loadState(previous);

        this.updateUndoRedoButtons();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const next = this.redoStack.pop();
        this.undoStack.push(next);

        this.loadState(next);

        this.updateUndoRedoButtons();
    }

    loadState(state) {
        this.canvas.loadFromJSON(state, () => {
            this.canvas.renderAll();
        });
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('studioUndoBtn');
        const redoBtn = document.getElementById('studioRedoBtn');

        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length <= 1;
        }
        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0;
        }
    }

    // ==================== ZOOM CONTROLS ====================

    zoomIn() {
        let zoom = this.canvas.getZoom() * 1.2;
        zoom = Math.min(zoom, this.maxZoom);
        this.canvas.setZoom(zoom);
        this.currentZoom = zoom;
        this.updateZoomDisplay();
        this.emitViewportChange();
    }

    zoomOut() {
        let zoom = this.canvas.getZoom() / 1.2;
        zoom = Math.max(zoom, this.minZoom);
        this.canvas.setZoom(zoom);
        this.currentZoom = zoom;
        this.updateZoomDisplay();
        this.emitViewportChange();
    }

    resetZoom() {
        this.canvas.setZoom(1);
        this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        this.currentZoom = 1;
        this.updateZoomDisplay();
        this.emitViewportChange();
    }

    updateZoomDisplay() {
        const display = document.getElementById('studioZoomDisplay');
        if (display) {
            display.textContent = Math.round(this.currentZoom * 100) + '%';
        }
    }

    // ==================== VIEWPORT CHANGE EVENT ====================
    // Emit viewport transform changes for external consumers (video circles)

    emitViewportChange() {
        if (!this.canvas) return;

        const vpt = this.canvas.viewportTransform;
        console.log('[StudioFabric] Emitting viewport change:', {
            zoom: this.currentZoom,
            translateX: vpt[4],
            translateY: vpt[5]
        });

        window.dispatchEvent(new CustomEvent('canvas-viewport-change', {
            detail: {
                transform: vpt,
                zoom: this.currentZoom,
                // Include center point for position calculations
                centerX: this.canvas.width / 2,
                centerY: this.canvas.height / 2
            }
        }));
    }

    // ==================== CURSOR OVERLAY ====================

    createCursorOverlay() {
        const container = document.getElementById('studioCanvasContainer');
        if (!container) return;

        this.cursorOverlay = document.createElement('div');
        this.cursorOverlay.className = 'studio-cursor-overlay';
        this.cursorOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        container.appendChild(this.cursorOverlay);
    }

    // ==================== EVENT HANDLERS ====================

    onObjectAdded(e) {
        if (!e.target._addedByRemote) {
            this.saveState();
        }
    }

    onObjectModified(e) {
        this.saveState();
        this.broadcastObjectModified(e.target);
    }

    onObjectRemoved(e) {
        // State already saved in deleteSelected
    }

    onMouseMove(opt) {
        if (!this.socket || !this.isActive) return;

        const now = Date.now();
        if (now - this.lastCursorUpdate < this.cursorUpdateInterval) return;
        this.lastCursorUpdate = now;

        const pointer = this.canvas.getPointer(opt.e);
        this.broadcastCursorPosition(pointer.x, pointer.y);
    }

    onPathCreated(e) {
        const path = e.path;
        path.set('objectId', this.nextObjectId++);

        if (this.currentBrush === 'eraser') {
            path.set('globalCompositeOperation', 'destination-out');
        }

        this.broadcastObjectAdded(path);
        this.saveState();
    }

    // ==================== MULTIPLAYER ====================

    setSocket(socket) {
        this.socket = socket;
        this.setupSocketHandlers();

        // Request current canvas state from other users
        if (this.isActive) {
            this.requestCanvasSync();
        }
    }

    setupSocketHandlers() {
        if (!this.socket) return;

        // Cursor updates
        this.socket.on('studio-cursor-update', (data) => {
            if (data.socketId === this.socket.id) return;
            this.updateRemoteCursor(data);
        });

        // Reactions
        this.socket.on('studio-reaction', (data) => {
            if (data.socketId === this.socket.id) return;
            this.showRemoteReaction(data);
        });

        // Object added
        this.socket.on('studio-object-added', (data) => {
            if (data.socketId === this.socket.id) return;
            this.handleRemoteObjectAdded(data);
        });

        // Object modified
        this.socket.on('studio-object-modified', (data) => {
            if (data.socketId === this.socket.id) return;
            this.handleRemoteObjectModified(data);
        });

        // Object removed
        this.socket.on('studio-object-removed', (data) => {
            if (data.socketId === this.socket.id) return;
            this.handleRemoteObjectRemoved(data);
        });

        // Full canvas sync (for new users joining)
        // Handle server-initiated state request (sent on studio-join)
        this.socket.on('studio-state-request', (data) => {
            if (!this.isActive) return;
            console.log('Received studio-state-request from:', data.requesterId);
            this.sendCanvasState(data.requesterId);
        });

        // Handle client-initiated sync request (backup mechanism)
        this.socket.on('studio-canvas-sync-request', (data) => {
            if (!this.isActive) return;
            console.log('Received studio-canvas-sync-request from:', data.requesterId);
            this.sendCanvasState(data.requesterId);
        });

        this.socket.on('studio-canvas-sync', (data) => {
            if (data.socketId === this.socket.id) return;
            this.receiveCanvasSync(data);
        });

        // User left - remove their cursor
        this.socket.on('user-left', (data) => {
            this.removeRemoteCursor(data.socketId);
        });
    }

    requestCanvasSync() {
        if (!this.socket) return;

        console.log('Requesting canvas sync from other users...');
        this.socket.emit('studio-canvas-sync-request', {
            requesterId: this.socket.id
        });
    }

    sendCanvasState(targetId) {
        if (!this.socket || !this.canvas || !this.isActive) {
            console.log('sendCanvasState skipped:', {
                hasSocket: !!this.socket,
                hasCanvas: !!this.canvas,
                isActive: this.isActive
            });
            return;
        }

        const objects = this.canvas.getObjects().map(obj => ({
            objectId: obj.objectId,
            json: obj.toJSON(['objectId'])
        }));

        console.log(`Sending canvas state to ${targetId}: ${objects.length} objects`);

        this.socket.emit('studio-canvas-sync', {
            targetId,
            objects,
            nextObjectId: this.nextObjectId
        });
    }

    receiveCanvasSync(data) {
        // Only process if this sync is for us or broadcast
        if (data.targetId && data.targetId !== this.socket.id) {
            console.log('Ignoring canvas sync - not for us:', data.targetId, 'vs', this.socket.id);
            return;
        }

        console.log(`Receiving canvas sync: ${data.objects?.length || 0} objects from ${data.socketId}`);

        // Clear current canvas
        this.canvas.clear();
        this.canvas.backgroundColor = '#f5f5f5';

        // Update object ID counter
        if (data.nextObjectId) {
            this.nextObjectId = Math.max(this.nextObjectId, data.nextObjectId);
        }

        // Add all objects
        if (data.objects && data.objects.length > 0) {
            let loadedCount = 0;
            data.objects.forEach(item => {
                fabric.util.enlivenObjects([item.json], (objects) => {
                    objects.forEach(obj => {
                        obj._addedByRemote = true;
                        obj.set('objectId', item.objectId);
                        this.canvas.add(obj);
                        loadedCount++;
                        console.log(`Loaded object ${loadedCount}/${data.objects.length}: ${obj.type}`);
                    });
                    this.canvas.renderAll();
                });
            });
        } else {
            console.log('Canvas sync received but no objects to load');
            this.canvas.renderAll();
        }
    }

    broadcastCursorPosition(x, y) {
        if (!this.socket) return;

        this.socket.emit('studio-cursor-update', {
            x,
            y,
            color: this.myCursorColor,
            name: this.socket.username || 'Guest'
        });
    }

    broadcastObjectAdded(obj) {
        if (!this.socket) return;

        this.socket.emit('studio-object-added', {
            objectId: obj.objectId,
            json: obj.toJSON(['objectId'])
        });
    }

    broadcastObjectModified(obj) {
        if (!this.socket) return;

        this.socket.emit('studio-object-modified', {
            objectId: obj.objectId,
            json: obj.toJSON(['objectId'])
        });
    }

    broadcastObjectRemoved(obj) {
        if (!this.socket) return;

        this.socket.emit('studio-object-removed', {
            objectId: obj.objectId
        });
    }

    sendReaction(emoji) {
        if (!this.socket) return;

        this.showLocalReaction(emoji);

        this.socket.emit('studio-reaction', {
            emoji,
            color: this.myCursorColor
        });
    }

    updateRemoteCursor(data) {
        let cursor = this.remoteCursors.get(data.socketId);

        if (!cursor) {
            cursor = this.createCursorElement(data);
            this.remoteCursors.set(data.socketId, cursor);
        }

        cursor.style.left = data.x + 'px';
        cursor.style.top = data.y + 'px';
    }

    removeRemoteCursor(socketId) {
        const cursor = this.remoteCursors.get(socketId);
        if (cursor) {
            cursor.remove();
            this.remoteCursors.delete(socketId);
        }
    }

    createCursorElement(data) {
        const cursor = document.createElement('div');
        cursor.className = 'remote-cursor';
        cursor.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${data.color}">
                <path d="M5.65 3.15L20.85 10.85L12.35 12.35L10.85 20.85L5.65 3.15Z"/>
            </svg>
            <span class="cursor-label" style="background: ${data.color}">${data.name}</span>
        `;
        cursor.style.cssText = `
            position: absolute;
            pointer-events: none;
            transition: left 0.05s, top 0.05s;
        `;

        if (this.cursorOverlay) {
            this.cursorOverlay.appendChild(cursor);
        }

        return cursor;
    }

    showLocalReaction(emoji) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.animateReaction(emoji, centerX, centerY);
    }

    showRemoteReaction(data) {
        const cursor = this.remoteCursors.get(data.socketId);
        if (cursor) {
            const rect = cursor.getBoundingClientRect();
            this.animateReaction(data.emoji, rect.left, rect.top);
        }
    }

    animateReaction(emoji, x, y) {
        const reaction = document.createElement('div');
        reaction.className = 'cursor-reaction';
        reaction.textContent = emoji;
        reaction.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            font-size: 32px;
            pointer-events: none;
            z-index: 10000;
            animation: reactionFloat 1.5s ease-out forwards;
        `;

        document.body.appendChild(reaction);
        setTimeout(() => reaction.remove(), 1500);
    }

    handleRemoteObjectAdded(data) {
        fabric.util.enlivenObjects([data.json], (objects) => {
            objects.forEach(obj => {
                obj._addedByRemote = true;
                obj.set('objectId', data.objectId);
                this.canvas.add(obj);

                // Update our nextObjectId to avoid conflicts
                if (data.objectId >= this.nextObjectId) {
                    this.nextObjectId = data.objectId + 1;
                }
            });
            this.canvas.renderAll();
        });
    }

    handleRemoteObjectModified(data) {
        const obj = this.canvas.getObjects().find(o => o.objectId === data.objectId);
        if (obj) {
            obj.set(data.json);
            obj.setCoords();
            this.canvas.renderAll();
        }
    }

    handleRemoteObjectRemoved(data) {
        const obj = this.canvas.getObjects().find(o => o.objectId === data.objectId);
        if (obj) {
            this.canvas.remove(obj);
            this.canvas.renderAll();
        }
    }

    // ==================== ACTIVATION ====================

    activate() {
        this.isActive = true;

        requestAnimationFrame(() => {
            this.resizeCanvas();
            this.saveState();
            this.updateZoomDisplay();

            // Emit initial viewport change for video circle canvas pinning
            this.emitViewportChange();

            // Join studio mode on server (required for sync)
            this.joinStudioWithRetry();
        });

        console.log('Studio Fabric activated');
    }

    joinStudioWithRetry(attempts = 0) {
        const maxAttempts = 10;

        if (this.socket && this.socket.connected) {
            this.socket.emit('studio-join');
            console.log('Emitted studio-join (attempt ' + (attempts + 1) + ')');

            // Request sync from other users after joining
            setTimeout(() => {
                this.requestCanvasSync();
            }, 100);
        } else if (attempts < maxAttempts) {
            console.log(`Socket not ready, retrying studio-join in 500ms (attempt ${attempts + 1}/${maxAttempts})`);
            setTimeout(() => this.joinStudioWithRetry(attempts + 1), 500);
        } else {
            console.error('Failed to join studio - socket not connected after', maxAttempts, 'attempts');
        }
    }

    deactivate() {
        this.isActive = false;

        // Leave studio mode on server
        if (this.socket && this.socket.connected) {
            this.socket.emit('studio-leave');
            console.log('Emitted studio-leave');
        }

        console.log('Studio Fabric deactivated');
    }

    clearCanvas() {
        if (confirm('Clear all items from the canvas?')) {
            this.canvas.clear();
            this.canvas.backgroundColor = '#f5f5f5';
            this.canvas.renderAll();
            this.undoStack = [];
            this.redoStack = [];
            this.saveState();
        }
    }

    // ==================== UTILITIES ====================

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    updateToolbarUI(activeTool) {
        document.querySelectorAll('.studio-tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === activeTool);
        });
    }
}

// Initialize
const studioFabric = new StudioFabric();
window.studioFabric = studioFabric;
