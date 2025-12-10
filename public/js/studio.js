/**
 * Studio Mode - Collaborative Infinite Canvas
 *
 * A Miro-inspired collaborative whiteboard with:
 * - Infinite canvas with zoom/pan (scroll wheel zoom, click-drag pan)
 * - Image paste support (Ctrl+V / Cmd+V)
 * - Draggable clipart from bottom drawer
 * - Real-time multiplayer cursor synchronization
 * - Session-based state (clears on disconnect)
 *
 * Architecture follows the Observer pattern for state synchronization
 * and implements a transform matrix for viewport management.
 */

class StudioCanvas {
    constructor() {
        // Canvas state
        this.canvas = null;
        this.ctx = null;
        this.isActive = false;

        // Viewport transform (pan/zoom)
        this.transform = {
            x: 0,      // Pan offset X
            y: 0,      // Pan offset Y
            scale: 1   // Zoom level (1 = 100%)
        };

        // Zoom constraints - reasonable limits to prevent unusable zoom levels
        this.minScale = 0.25;  // 25% minimum (was 10% - too small)
        this.maxScale = 3;     // 300% maximum (was 500% - too large)
        this.zoomSensitivity = 0.0008; // Slightly less sensitive

        // Pan state
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };

        // Objects on canvas
        this.objects = []; // Array of { id, type, x, y, width, height, data, zIndex }
        this.selectedObject = null;
        this.isDraggingObject = false;
        this.dragOffset = { x: 0, y: 0 };

        // Resizing state
        this.isResizing = false;
        this.resizeHandle = null; // 'nw', 'ne', 'sw', 'se'
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0, objX: 0, objY: 0 };

        // Object ID counter
        this.nextObjectId = 1;

        // Remote cursors { odIds: { odIds, x, y, color, name } }
        this.remoteCursors = new Map();

        // Cursor colors for multiplayer
        this.cursorColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
        ];

        // My cursor color (assigned on connect)
        this.myCursorColor = this.cursorColors[Math.floor(Math.random() * this.cursorColors.length)];

        // Socket reference (will be set from connection.js)
        this.socket = null;

        // Users currently in studio mode
        this.studioUsers = [];

        // Throttle cursor updates (send every 50ms max)
        this.lastCursorUpdate = 0;
        this.cursorUpdateInterval = 50;

        // Animation frame ID
        this.animationFrameId = null;

        // Pending broadcast queue (for when socket is temporarily unavailable)
        this.pendingBroadcast = false;
        this.broadcastRetryTimeout = null;

        // Track if we've already set up socket handlers (prevent duplicates)
        this.socketHandlersSetup = false;

        // Track if we've already joined studio (prevent duplicate joins)
        this.hasJoinedStudio = false;

        // Reconnect debounce timer
        this._reconnectTimer = null;

        // Join retry timer
        this._joinRetryTimer = null;

        // Drawer state
        this.isDrawerOpen = false;

        // Clipart definitions - SVG files from /clipart folder
        this.clipartItems = [
            { id: '54', src: '/clipart/Untitled design (54).svg', name: 'Design 1' },
            { id: '55', src: '/clipart/Untitled design (55).svg', name: 'Design 2' },
            { id: '56', src: '/clipart/Untitled design (56).svg', name: 'Design 3' },
            { id: '57', src: '/clipart/Untitled design (57).svg', name: 'Design 4' },
            { id: '58', src: '/clipart/Untitled design (58).svg', name: 'Design 5' },
            { id: '59', src: '/clipart/Untitled design (59).svg', name: 'Design 6' },
            { id: '60', src: '/clipart/Untitled design (60).svg', name: 'Design 7' },
            { id: '61', src: '/clipart/Untitled design (61).svg', name: 'Design 8' },
            { id: '62', src: '/clipart/Untitled design (62).svg', name: 'Design 9' },
            { id: '63', src: '/clipart/Untitled design (63).svg', name: 'Design 10' },
            { id: '64', src: '/clipart/Untitled design (64).svg', name: 'Design 11' },
            { id: '65', src: '/clipart/Untitled design (65).svg', name: 'Design 12' },
            { id: '66', src: '/clipart/Untitled design (66).svg', name: 'Design 13' },
            { id: '67', src: '/clipart/Untitled design (67).svg', name: 'Design 14' },
            { id: '68', src: '/clipart/Untitled design (68).svg', name: 'Design 15' },
            { id: '69', src: '/clipart/Untitled design (69).svg', name: 'Design 16' },
            { id: '70', src: '/clipart/Untitled design (70).svg', name: 'Design 17' },
            { id: '71', src: '/clipart/Untitled design (71).svg', name: 'Design 18' },
            { id: '72', src: '/clipart/Untitled design (72).svg', name: 'Design 19' },
            { id: '73', src: '/clipart/Untitled design (73).svg', name: 'Design 20' },
            { id: '74', src: '/clipart/Untitled design (74).svg', name: 'Design 21' },
            { id: '75', src: '/clipart/Untitled design (75).svg', name: 'Design 22' }
        ];

        // Winter/Skier emoji clipart
        this.emojiClipart = [
            { id: 'ski', emoji: '⛷️', name: 'Skier' },
            { id: 'snowboard', emoji: '🏂', name: 'Snowboard' },
            { id: 'snowflake', emoji: '❄️', name: 'Snowflake' },
            { id: 'snowman', emoji: '⛄', name: 'Snowman' },
            { id: 'mountain', emoji: '🏔️', name: 'Mountain' },
            { id: 'cablecar', emoji: '🚡', name: 'Cable Car' },
            { id: 'evergreen', emoji: '🌲', name: 'Pine Tree' },
            { id: 'cold', emoji: '🥶', name: 'Cold Face' },
            { id: 'hotcocoa', emoji: '☕', name: 'Hot Cocoa' },
            { id: 'gloves', emoji: '🧤', name: 'Gloves' },
            { id: 'scarf', emoji: '🧣', name: 'Scarf' },
            { id: 'sled', emoji: '🛷', name: 'Sled' },
            { id: 'iceskate', emoji: '⛸️', name: 'Ice Skate' },
            { id: 'cloud-snow', emoji: '🌨️', name: 'Snow Cloud' },
            { id: 'wind', emoji: '💨', name: 'Wind' },
            { id: 'star', emoji: '⭐', name: 'Star' },
            { id: 'sparkles', emoji: '✨', name: 'Sparkles' },
            { id: 'fire', emoji: '🔥', name: 'Fire' },
            { id: 'heart', emoji: '❤️', name: 'Heart' },
            { id: 'medal', emoji: '🏅', name: 'Medal' }
        ];

        // Preload clipart images
        this.clipartImages = new Map();
        this.clipartItems.forEach(item => {
            const img = new Image();
            img.onload = () => {
                this.clipartImages.set(item.id, img);
            };
            img.src = item.src;
        });

        // Video recording state
        this.videoStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.timerInterval = null;

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
        this.canvas = document.getElementById('studioCanvas');
        if (!this.canvas) {
            console.warn('Studio canvas not found in DOM');
            return;
        }

        this.ctx = this.canvas.getContext('2d');

        // Set up canvas sizing
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Set up event listeners
        this.setupEventListeners();

        // Set up drawer
        this.setupDrawer();

        // Set up tab switching
        this.setupTabSwitching();

        console.log('Studio mode initialized');
    }

    resizeCanvas() {
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        let width, height;

        if (container && container.clientWidth > 0 && container.clientHeight > 0) {
            width = container.clientWidth;
            height = container.clientHeight;
        } else {
            // Fallback to window dimensions if container has no size
            width = window.innerWidth;
            height = window.innerHeight;
        }

        // Only update if dimensions are valid and different
        if (width > 0 && height > 0) {
            if (this.canvas.width !== width || this.canvas.height !== height) {
                this.canvas.width = width;
                this.canvas.height = height;
                console.log('Canvas resized to:', width, 'x', height);
            }
        }

        // Re-render after resize
        if (this.isActive) {
            this.render();
        }
    }

    setupEventListeners() {
        // Mouse wheel for zoom
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Mouse events for pan and object manipulation
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Paste event for images
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    setupTabSwitching() {
        const studioTab = document.getElementById('studioToggleBtn');
        const bgTab = document.getElementById('bgToggleBtn');
        const studioContainer = document.getElementById('studioContainer');
        const draggableUI = document.getElementById('draggableUI');

        if (studioTab) {
            studioTab.addEventListener('click', () => {
                // IMPORTANT: Make container visible BEFORE activating canvas
                // Otherwise canvas dimensions will be 0
                studioTab.classList.add('active');
                if (bgTab) bgTab.classList.remove('active');
                if (studioContainer) studioContainer.classList.remove('hidden');
                if (draggableUI) draggableUI.classList.add('hidden');

                // Activate after container is visible
                this.activate();
            });
        }

        if (bgTab) {
            bgTab.addEventListener('click', () => {
                this.deactivate();
                bgTab.classList.add('active');
                if (studioTab) studioTab.classList.remove('active');
                if (studioContainer) studioContainer.classList.add('hidden');
                if (draggableUI) draggableUI.classList.remove('hidden');
            });
        }
    }

    setupDrawer() {
        const drawer = document.getElementById('studioDrawer');
        const drawerToggle = document.getElementById('drawerToggle');
        const clipartGrid = document.getElementById('clipartGrid');

        if (!drawer || !clipartGrid) return;

        // Add winter emoji clipart first
        this.emojiClipart.forEach(item => {
            const clipartEl = document.createElement('div');
            clipartEl.className = 'clipart-item emoji-clipart';
            clipartEl.setAttribute('data-clipart-id', item.id);
            clipartEl.setAttribute('draggable', 'true');
            clipartEl.innerHTML = `
                <span class="clipart-emoji">${item.emoji}</span>
                <span class="clipart-name">${item.name}</span>
            `;

            // Drag start
            clipartEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/x-clipart', JSON.stringify({ ...item, type: 'emoji' }));
                e.dataTransfer.effectAllowed = 'copy';
                clipartEl.classList.add('dragging');
            });

            clipartEl.addEventListener('dragend', () => {
                clipartEl.classList.remove('dragging');
            });

            // Click to add at center
            clipartEl.addEventListener('click', () => {
                this.addEmojiClipartAtCenter(item);
            });

            clipartGrid.appendChild(clipartEl);
        });

        // Populate SVG clipart grid
        this.clipartItems.forEach(item => {
            const clipartEl = document.createElement('div');
            clipartEl.className = 'clipart-item';
            clipartEl.setAttribute('data-clipart-id', item.id);
            clipartEl.setAttribute('draggable', 'true');
            clipartEl.innerHTML = `
                <img class="clipart-thumbnail" src="${item.src}" alt="${item.name}" />
                <span class="clipart-name">${item.name}</span>
            `;

            // Drag start
            clipartEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/x-clipart', JSON.stringify({ ...item, type: 'svg' }));
                e.dataTransfer.effectAllowed = 'copy';
                clipartEl.classList.add('dragging');
            });

            clipartEl.addEventListener('dragend', () => {
                clipartEl.classList.remove('dragging');
            });

            // Click to add at center
            clipartEl.addEventListener('click', () => {
                this.addClipartAtCenter(item);
            });

            clipartGrid.appendChild(clipartEl);
        });

        // Canvas drop zone
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.canvas.classList.add('drag-over');
        });

        this.canvas.addEventListener('dragleave', (e) => {
            this.canvas.classList.remove('drag-over');
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            this.canvas.classList.remove('drag-over');

            const canvasPos = this.screenToCanvas(e.clientX, e.clientY);

            // Check for clipart data first
            const clipartData = e.dataTransfer.getData('application/x-clipart');
            if (clipartData) {
                const item = JSON.parse(clipartData);
                if (item.type === 'emoji') {
                    this.addEmojiClipart(item, canvasPos.x, canvasPos.y);
                } else {
                    this.addClipart(item, canvasPos.x, canvasPos.y);
                }
                return;
            }

            // Check for external image files
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        this.addImageFromFile(file, canvasPos.x, canvasPos.y);
                        break; // Only add first image
                    }
                }
                return;
            }

            // Check for image URL (dragged from browser)
            const imageUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
            if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:'))) {
                this.addImageFromUrl(imageUrl, canvasPos.x, canvasPos.y);
            }
        });

        // Drawer toggle
        if (drawerToggle) {
            drawerToggle.addEventListener('click', () => {
                this.toggleDrawer();
            });
        }
    }

    toggleDrawer() {
        const drawer = document.getElementById('studioDrawer');
        if (!drawer) return;

        this.isDrawerOpen = !this.isDrawerOpen;
        drawer.classList.toggle('open', this.isDrawerOpen);
    }

    // ==================== COORDINATE TRANSFORMS ====================

    /**
     * Convert screen coordinates to canvas (world) coordinates
     * Accounts for pan and zoom transformations
     */
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (screenX - rect.left - this.transform.x) / this.transform.scale;
        const y = (screenY - rect.top - this.transform.y) / this.transform.scale;
        return { x, y };
    }

    /**
     * Convert canvas (world) coordinates to screen coordinates
     */
    canvasToScreen(canvasX, canvasY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = canvasX * this.transform.scale + this.transform.x + rect.left;
        const y = canvasY * this.transform.scale + this.transform.y + rect.top;
        return { x, y };
    }

    // ==================== EVENT HANDLERS ====================

    handleWheel(e) {
        if (!this.isActive) return;
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate zoom
        const delta = -e.deltaY * this.zoomSensitivity;
        const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.transform.scale * (1 + delta)));

        // Zoom toward mouse position
        const scaleFactor = newScale / this.transform.scale;
        this.transform.x = mouseX - (mouseX - this.transform.x) * scaleFactor;
        this.transform.y = mouseY - (mouseY - this.transform.y) * scaleFactor;
        this.transform.scale = newScale;

        this.render();
        this.updateZoomIndicator();
    }

    handleMouseDown(e) {
        if (!this.isActive) return;

        const canvasPos = this.screenToCanvas(e.clientX, e.clientY);

        // First check if clicking on a resize handle of selected object
        const resizeHandle = this.getResizeHandleAtPosition(canvasPos.x, canvasPos.y);
        if (resizeHandle && this.selectedObject) {
            this.isResizing = true;
            this.resizeHandle = resizeHandle;
            this.resizeStart = {
                x: canvasPos.x,
                y: canvasPos.y,
                width: this.selectedObject.width,
                height: this.selectedObject.height,
                objX: this.selectedObject.x,
                objY: this.selectedObject.y
            };
            this.canvas.style.cursor = this.getResizeCursor(resizeHandle);
            this.render();
            return;
        }

        // Check if clicking on an object
        const clickedObject = this.getObjectAtPosition(canvasPos.x, canvasPos.y);

        if (clickedObject) {
            // Start dragging object
            this.selectedObject = clickedObject;
            this.isDraggingObject = true;
            this.dragOffset = {
                x: canvasPos.x - clickedObject.x,
                y: canvasPos.y - clickedObject.y
            };
            this.canvas.style.cursor = 'grabbing';
        } else {
            // Start panning
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
            this.canvas.style.cursor = 'grabbing';
            this.selectedObject = null;
        }

        this.render();
    }

    handleMouseMove(e) {
        if (!this.isActive) return;

        const rect = this.canvas.getBoundingClientRect();
        const canvasPos = this.screenToCanvas(e.clientX, e.clientY);

        // Send cursor position to other users
        this.broadcastCursorPosition(canvasPos.x, canvasPos.y);

        if (this.isResizing && this.selectedObject) {
            // Handle resize
            const deltaX = canvasPos.x - this.resizeStart.x;
            const deltaY = canvasPos.y - this.resizeStart.y;
            const minSize = 20; // Minimum object size

            // Calculate aspect ratio for proportional scaling
            const aspectRatio = this.resizeStart.width / this.resizeStart.height;

            let newWidth, newHeight, newX, newY;

            switch (this.resizeHandle) {
                case 'se': // Bottom-right: just change size
                    newWidth = Math.max(minSize, this.resizeStart.width + deltaX);
                    newHeight = Math.max(minSize, this.resizeStart.height + deltaY);
                    newX = this.resizeStart.objX;
                    newY = this.resizeStart.objY;
                    break;
                case 'sw': // Bottom-left: change x and width, height
                    newWidth = Math.max(minSize, this.resizeStart.width - deltaX);
                    newHeight = Math.max(minSize, this.resizeStart.height + deltaY);
                    newX = this.resizeStart.objX + (this.resizeStart.width - newWidth);
                    newY = this.resizeStart.objY;
                    break;
                case 'ne': // Top-right: change y and height, width
                    newWidth = Math.max(minSize, this.resizeStart.width + deltaX);
                    newHeight = Math.max(minSize, this.resizeStart.height - deltaY);
                    newX = this.resizeStart.objX;
                    newY = this.resizeStart.objY + (this.resizeStart.height - newHeight);
                    break;
                case 'nw': // Top-left: change x, y, width, height
                    newWidth = Math.max(minSize, this.resizeStart.width - deltaX);
                    newHeight = Math.max(minSize, this.resizeStart.height - deltaY);
                    newX = this.resizeStart.objX + (this.resizeStart.width - newWidth);
                    newY = this.resizeStart.objY + (this.resizeStart.height - newHeight);
                    break;
            }

            // Apply proportional scaling if shift is held (optional enhancement)
            // For now, allow free resize

            this.selectedObject.width = newWidth;
            this.selectedObject.height = newHeight;
            this.selectedObject.x = newX;
            this.selectedObject.y = newY;

            this.render();
            // Don't broadcast on every move - only on mouseUp
        } else if (this.isDraggingObject && this.selectedObject) {
            // Move selected object
            this.selectedObject.x = canvasPos.x - this.dragOffset.x;
            this.selectedObject.y = canvasPos.y - this.dragOffset.y;
            this.render();
            // Don't broadcast on every move - only on mouseUp
        } else if (this.isPanning) {
            // Pan canvas
            this.transform.x = e.clientX - this.panStart.x;
            this.transform.y = e.clientY - this.panStart.y;
            this.render();
        } else {
            // Update cursor based on hover - check resize handles first
            const resizeHandle = this.getResizeHandleAtPosition(canvasPos.x, canvasPos.y);
            if (resizeHandle) {
                this.canvas.style.cursor = this.getResizeCursor(resizeHandle);
            } else {
                const hoveredObject = this.getObjectAtPosition(canvasPos.x, canvasPos.y);
                this.canvas.style.cursor = hoveredObject ? 'grab' : 'default';
            }
        }
    }

    handleMouseUp(e) {
        if (!this.isActive) return;

        if (this.isDraggingObject || this.isResizing) {
            this.broadcastCanvasState();
        }

        this.isPanning = false;
        this.isDraggingObject = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.canvas.style.cursor = 'default';
    }

    handleMouseLeave(e) {
        this.isPanning = false;
        this.isDraggingObject = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.canvas.style.cursor = 'default';
    }

    handleTouchStart(e) {
        if (!this.isActive || e.touches.length !== 1) return;
        e.preventDefault();

        const touch = e.touches[0];
        this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }

    handleTouchMove(e) {
        if (!this.isActive || e.touches.length !== 1) return;
        e.preventDefault();

        const touch = e.touches[0];
        this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    handleTouchEnd(e) {
        this.handleMouseUp(e);
    }

    handlePaste(e) {
        if (!this.isActive) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                this.addImageFromFile(file);
                break;
            }
        }
    }

    handleKeyDown(e) {
        if (!this.isActive) return;

        // Delete selected object
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedObject) {
            this.removeObject(this.selectedObject.id);
            this.selectedObject = null;
            this.render();
            this.broadcastCanvasState();
        }

        // Reset zoom (Ctrl/Cmd + 0)
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            this.resetView();
        }
    }

    // ==================== OBJECT MANAGEMENT ====================

    getObjectAtPosition(x, y) {
        // Check objects in reverse order (top-most first)
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (x >= obj.x && x <= obj.x + obj.width &&
                y >= obj.y && y <= obj.y + obj.height) {
                return obj;
            }
        }
        return null;
    }

    /**
     * Check if position is over a resize handle of the selected object
     * Returns handle name ('nw', 'ne', 'sw', 'se') or null
     */
    getResizeHandleAtPosition(x, y) {
        if (!this.selectedObject) return null;

        const obj = this.selectedObject;
        const handleSize = 12 / this.transform.scale; // Size in canvas coordinates
        const padding = 5; // Selection box padding

        const handles = {
            'nw': { x: obj.x - padding, y: obj.y - padding },
            'ne': { x: obj.x + obj.width + padding - handleSize, y: obj.y - padding },
            'sw': { x: obj.x - padding, y: obj.y + obj.height + padding - handleSize },
            'se': { x: obj.x + obj.width + padding - handleSize, y: obj.y + obj.height + padding - handleSize }
        };

        for (const [name, pos] of Object.entries(handles)) {
            if (x >= pos.x && x <= pos.x + handleSize &&
                y >= pos.y && y <= pos.y + handleSize) {
                return name;
            }
        }

        return null;
    }

    /**
     * Get cursor style for resize handle
     */
    getResizeCursor(handle) {
        const cursors = {
            'nw': 'nwse-resize',
            'se': 'nwse-resize',
            'ne': 'nesw-resize',
            'sw': 'nesw-resize'
        };
        return cursors[handle] || 'default';
    }

    addObject(type, x, y, width, height, data) {
        const obj = {
            id: this.nextObjectId++,
            type,
            x,
            y,
            width,
            height,
            data,
            zIndex: this.objects.length
        };

        this.objects.push(obj);
        console.log('Added object:', type, 'at', x, y, 'Total objects:', this.objects.length);
        console.log('Socket state:', this.socket ? 'exists' : 'null', 'connected:', this.socket?.connected, 'isActive:', this.isActive);
        this.render();
        this.broadcastCanvasState();

        return obj;
    }

    removeObject(id) {
        const index = this.objects.findIndex(obj => obj.id === id);
        if (index !== -1) {
            this.objects.splice(index, 1);
        }
    }

    addClipart(item, x, y) {
        const size = 120; // Default clipart size
        this.addObject('clipart', x - size/2, y - size/2, size, size, {
            src: item.src,
            id: item.id,
            name: item.name
        });
    }

    addClipartAtCenter(item) {
        const centerX = (this.canvas.width / 2 - this.transform.x) / this.transform.scale;
        const centerY = (this.canvas.height / 2 - this.transform.y) / this.transform.scale;
        this.addClipart(item, centerX, centerY);
    }

    addEmojiClipart(item, x, y) {
        const size = 80; // Emoji size
        this.addObject('emoji', x - size/2, y - size/2, size, size, {
            emoji: item.emoji,
            name: item.name
        });
    }

    addEmojiClipartAtCenter(item) {
        const centerX = (this.canvas.width / 2 - this.transform.x) / this.transform.scale;
        const centerY = (this.canvas.height / 2 - this.transform.y) / this.transform.scale;
        this.addEmojiClipart(item, centerX, centerY);
    }

    addImageFromFile(file, dropX = null, dropY = null) {
        console.log('Adding image from file:', file.name, 'type:', file.type);
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            console.log('FileReader loaded, data URL length:', dataUrl.length);

            const img = new Image();
            img.onload = () => {
                console.log('Image element loaded:', img.width, 'x', img.height, 'complete:', img.complete);

                // Validate image loaded correctly
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    console.error('Image has zero dimensions');
                    return;
                }

                // Scale image to reasonable size
                const maxSize = 400;
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width *= ratio;
                    height *= ratio;
                }

                // Place at drop position or center of viewport
                let x, y;
                if (dropX !== null && dropY !== null) {
                    x = dropX - width/2;
                    y = dropY - height/2;
                } else {
                    const centerX = (this.canvas.width / 2 - this.transform.x) / this.transform.scale;
                    const centerY = (this.canvas.height / 2 - this.transform.y) / this.transform.scale;
                    x = centerX - width/2;
                    y = centerY - height/2;
                }

                // Store the image reference in the object data
                const imageData = {
                    src: dataUrl,
                    image: img  // Keep reference to loaded image
                };

                const obj = this.addObject('image', x, y, width, height, imageData);
                console.log('Image object added at:', x, y, 'size:', width, 'x', height);

                // Force immediate re-render to show the image
                requestAnimationFrame(() => this.render());
            };
            img.onerror = (err) => {
                console.error('Failed to load image element:', err);
            };
            img.src = dataUrl;
        };
        reader.onerror = (err) => {
            console.error('FileReader error:', err);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Take a snapshot from a video element and add it to the canvas
     * @param {HTMLVideoElement} videoElement - The video element to capture from
     */
    takeSnapshot(videoElement) {
        if (!videoElement || videoElement.readyState < 2) {
            console.error('Video not ready for snapshot');
            return;
        }

        console.log('Taking snapshot from video:', videoElement.videoWidth, 'x', videoElement.videoHeight);

        // Create a temporary canvas to capture the video frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoElement.videoWidth;
        tempCanvas.height = videoElement.videoHeight;

        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(videoElement, 0, 0);

        // Convert to data URL (JPEG for smaller size)
        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
        console.log('Snapshot captured, data URL length:', dataUrl.length);

        // Add the snapshot to the canvas at the center
        this.addImageFromUrl(dataUrl);

        // Broadcast the update
        this.broadcastCanvasState();
    }

    addImageFromUrl(url, dropX = null, dropY = null) {
        console.log('Adding image from URL:', url?.substring(0, 100));

        // For data URLs, load directly. For external URLs, try with CORS first
        const isDataUrl = url.startsWith('data:');

        const loadImage = (withCors) => {
            const img = new Image();
            if (withCors && !isDataUrl) {
                img.crossOrigin = 'anonymous';
            }

            img.onload = () => {
                console.log('URL Image loaded:', img.naturalWidth, 'x', img.naturalHeight);

                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    console.error('URL image has zero dimensions');
                    return;
                }

                // Scale image to reasonable size
                const maxSize = 400;
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width *= ratio;
                    height *= ratio;
                }

                // Place at drop position or center of viewport
                let x, y;
                if (dropX !== null && dropY !== null) {
                    x = dropX - width/2;
                    y = dropY - height/2;
                } else {
                    const centerX = (this.canvas.width / 2 - this.transform.x) / this.transform.scale;
                    const centerY = (this.canvas.height / 2 - this.transform.y) / this.transform.scale;
                    x = centerX - width/2;
                    y = centerY - height/2;
                }

                const obj = this.addObject('image', x, y, width, height, {
                    src: url,
                    image: img
                });
                console.log('URL Image object added at:', x, y);

                // Force immediate re-render
                requestAnimationFrame(() => this.render());
            };

            img.onerror = () => {
                if (withCors && !isDataUrl) {
                    // Retry without CORS
                    console.warn('CORS failed, retrying without crossOrigin');
                    loadImage(false);
                } else {
                    console.error('Failed to load image from URL:', url?.substring(0, 100));
                }
            };

            img.src = url;
        };

        loadImage(!isDataUrl);
    }

    // ==================== RENDERING ====================

    render() {
        if (!this.ctx || !this.canvas) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background grid
        this.drawGrid();

        // Apply transform
        this.ctx.save();
        this.ctx.translate(this.transform.x, this.transform.y);
        this.ctx.scale(this.transform.scale, this.transform.scale);

        // Draw objects
        this.objects.forEach(obj => this.drawObject(obj));

        // Draw selection indicator
        if (this.selectedObject) {
            this.drawSelectionBox(this.selectedObject);
        }

        // Draw remote cursors
        this.drawRemoteCursors();

        this.ctx.restore();
    }

    drawGrid() {
        const gridSize = 50;
        const scaledGridSize = gridSize * this.transform.scale;

        // Only draw grid if not too zoomed out
        if (scaledGridSize < 10) return;

        this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        this.ctx.lineWidth = 1;

        // Calculate visible area
        const startX = Math.floor(-this.transform.x / scaledGridSize) * scaledGridSize + (this.transform.x % scaledGridSize);
        const startY = Math.floor(-this.transform.y / scaledGridSize) * scaledGridSize + (this.transform.y % scaledGridSize);

        // Draw vertical lines
        for (let x = startX; x < this.canvas.width; x += scaledGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = startY; y < this.canvas.height; y += scaledGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawObject(obj) {
        switch (obj.type) {
            case 'clipart':
                this.drawClipart(obj);
                break;
            case 'emoji':
                this.drawEmoji(obj);
                break;
            case 'image':
                this.drawImage(obj);
                break;
        }
    }

    drawEmoji(obj) {
        const fontSize = Math.max(obj.width * 0.8, 20);
        this.ctx.save();
        this.ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(obj.data.emoji, obj.x + obj.width/2, obj.y + obj.height/2);
        this.ctx.restore();
    }

    drawClipart(obj) {
        // Check if we have a preloaded image
        let img = this.clipartImages.get(obj.data.id);

        // For SVGs, complete may be true but naturalWidth/naturalHeight might be 0
        if (img && img.complete && (img.naturalWidth > 0 || img.width > 0)) {
            this.ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
            return;
        }

        // Try object's own image reference
        if (obj.data.image && obj.data.image.complete && (obj.data.image.naturalWidth > 0 || obj.data.image.width > 0)) {
            this.ctx.drawImage(obj.data.image, obj.x, obj.y, obj.width, obj.height);
            return;
        }

        // Load image if not loaded yet
        if (obj.data.src && !obj.data.loading) {
            obj.data.loading = true;
            const newImg = new Image();
            newImg.onload = () => {
                obj.data.image = newImg;
                obj.data.loading = false;
                console.log('Clipart loaded:', obj.data.name || obj.data.id);
                // Trigger re-render to show loaded image
                if (this.isActive) {
                    requestAnimationFrame(() => this.render());
                }
            };
            newImg.onerror = () => {
                obj.data.loading = false;
                console.error('Failed to load clipart:', obj.data.src);
            };
            newImg.src = obj.data.src;
        }

        // Draw placeholder while loading
        if (!obj.data.image || !obj.data.image.complete) {
            this.ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
            this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        }
    }

    drawImage(obj) {
        // Check if image is ready to draw
        if (obj.data.image) {
            const img = obj.data.image;
            if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
                try {
                    this.ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
                    return;
                } catch (err) {
                    console.error('Error drawing image:', err);
                }
            }
        }

        // Load image if not yet loaded
        if (obj.data.src && !obj.data.loading) {
            obj.data.loading = true;
            console.log('Loading image from src:', obj.data.src.substring(0, 50) + '...');
            const img = new Image();
            img.onload = () => {
                obj.data.image = img;
                obj.data.loading = false;
                console.log('Image loaded successfully:', img.naturalWidth, 'x', img.naturalHeight);
                // Trigger re-render to show loaded image
                if (this.isActive) {
                    requestAnimationFrame(() => this.render());
                }
            };
            img.onerror = (err) => {
                obj.data.loading = false;
                console.error('Failed to load image:', obj.data.src.substring(0, 50), err);
            };
            img.src = obj.data.src;
        }

        // Draw placeholder while loading
        this.drawImagePlaceholder(obj);
    }

    drawImagePlaceholder(obj) {
        // Draw a loading placeholder
        this.ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 2 / this.transform.scale;
        this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

        // Draw loading icon
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const iconSize = Math.min(obj.width, obj.height) * 0.3;

        this.ctx.fillStyle = '#666';
        this.ctx.font = `${iconSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🖼️', centerX, centerY);
    }

    drawSelectionBox(obj) {
        const padding = 5;

        // Draw selection border
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 2 / this.transform.scale;
        this.ctx.setLineDash([5 / this.transform.scale, 5 / this.transform.scale]);
        this.ctx.strokeRect(obj.x - padding, obj.y - padding, obj.width + padding * 2, obj.height + padding * 2);
        this.ctx.setLineDash([]);

        // Draw corner handles - larger and with border for better visibility
        const handleSize = 12 / this.transform.scale;
        const corners = [
            { x: obj.x - padding, y: obj.y - padding, cursor: 'nw' },
            { x: obj.x + obj.width + padding - handleSize, y: obj.y - padding, cursor: 'ne' },
            { x: obj.x - padding, y: obj.y + obj.height + padding - handleSize, cursor: 'sw' },
            { x: obj.x + obj.width + padding - handleSize, y: obj.y + obj.height + padding - handleSize, cursor: 'se' }
        ];

        corners.forEach(corner => {
            // White border
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(corner.x - 1/this.transform.scale, corner.y - 1/this.transform.scale,
                              handleSize + 2/this.transform.scale, handleSize + 2/this.transform.scale);
            // Blue fill
            this.ctx.fillStyle = '#3b82f6';
            this.ctx.fillRect(corner.x, corner.y, handleSize, handleSize);
        });
    }

    drawRemoteCursors() {
        this.remoteCursors.forEach((cursor, odIds) => {
            // Draw cursor arrow
            this.ctx.save();
            this.ctx.translate(cursor.x, cursor.y);

            // Cursor arrow path
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(0, 20 / this.transform.scale);
            this.ctx.lineTo(5 / this.transform.scale, 16 / this.transform.scale);
            this.ctx.lineTo(12 / this.transform.scale, 24 / this.transform.scale);
            this.ctx.lineTo(16 / this.transform.scale, 20 / this.transform.scale);
            this.ctx.lineTo(9 / this.transform.scale, 12 / this.transform.scale);
            this.ctx.lineTo(14 / this.transform.scale, 12 / this.transform.scale);
            this.ctx.closePath();

            // Fill with user's color
            this.ctx.fillStyle = cursor.color;
            this.ctx.fill();
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1 / this.transform.scale;
            this.ctx.stroke();

            // Draw name label
            if (cursor.name) {
                const fontSize = 12 / this.transform.scale;
                this.ctx.font = `${fontSize}px Arial`;
                this.ctx.fillStyle = cursor.color;
                this.ctx.fillText(cursor.name, 18 / this.transform.scale, 20 / this.transform.scale);
            }

            this.ctx.restore();
        });
    }

    updateZoomIndicator() {
        const indicator = document.getElementById('zoomIndicator');
        if (indicator) {
            indicator.textContent = `${Math.round(this.transform.scale * 100)}%`;
        }
    }

    // ==================== VIEW CONTROLS ====================

    resetView() {
        this.transform = { x: 0, y: 0, scale: 1 };
        this.render();
        this.updateZoomIndicator();
    }

    zoomIn() {
        const newScale = Math.min(this.maxScale, this.transform.scale * 1.2);
        this.zoomToCenter(newScale);
    }

    zoomOut() {
        const newScale = Math.max(this.minScale, this.transform.scale / 1.2);
        this.zoomToCenter(newScale);
    }

    zoomToCenter(newScale) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const scaleFactor = newScale / this.transform.scale;

        this.transform.x = centerX - (centerX - this.transform.x) * scaleFactor;
        this.transform.y = centerY - (centerY - this.transform.y) * scaleFactor;
        this.transform.scale = newScale;

        this.render();
        this.updateZoomIndicator();
    }

    // ==================== MULTIPLAYER SYNC ====================

    setSocket(socket) {
        // Don't re-setup if same socket instance
        if (this.socket === socket) {
            console.log('setSocket: Same socket instance, skipping');
            return;
        }

        // Clean up old socket handlers if we had a previous socket
        if (this.socket && this.socketHandlersSetup) {
            this.cleanupSocketHandlers();
        }

        this.socket = socket;
        this.socketHandlersSetup = false;
        this.setupSocketHandlers();

        // If Studio is already active when socket connects, join now
        if (this.isActive && !this.hasJoinedStudio && socket.connected) {
            this.emitStudioJoin();
        }
    }

    cleanupSocketHandlers() {
        if (!this.socket) return;
        console.log('Cleaning up old socket handlers');

        // Remove all studio-specific handlers
        this.socket.off('connect', this._onConnect);
        this.socket.off('disconnect', this._onDisconnect);
        this.socket.off('studio-cursor-update');
        this.socket.off('studio-canvas-update');
        this.socket.off('user-left');
        this.socket.off('studio-user-left');
        this.socket.off('studio-user-joined');
        this.socket.off('studio-users-list');
        this.socket.off('studio-state-request');

        this.socketHandlersSetup = false;
    }

    setupSocketHandlers() {
        if (!this.socket) return;

        // Prevent duplicate handler registration
        if (this.socketHandlersSetup) {
            console.log('Socket handlers already setup, skipping');
            return;
        }
        this.socketHandlersSetup = true;
        console.log('Setting up socket handlers');

        // Create bound handlers so we can remove them later
        this._onConnect = () => {
            console.log('Socket connected/reconnected');

            // Debounce re-join to prevent rapid reconnect spam
            if (this._reconnectTimer) {
                clearTimeout(this._reconnectTimer);
            }

            this._reconnectTimer = setTimeout(() => {
                this._reconnectTimer = null;
                // Only re-join if we were in studio and haven't already joined
                if (this.isActive && !this.hasJoinedStudio) {
                    console.log('Re-joining studio after reconnect');
                    // Note: Don't reset hasJoinedStudio here - emitStudioJoin checks it
                    this.emitStudioJoin();

                    // Re-broadcast our state after joining
                    setTimeout(() => {
                        if (this.isActive && this.objects.length > 0) {
                            console.log('Re-broadcasting state after reconnect');
                            this.broadcastCanvasState();
                        }
                    }, 500);
                }
            }, 300); // 300ms debounce
        };

        this._onDisconnect = (reason) => {
            console.log('Socket disconnected:', reason);
            // Don't immediately reset - wait for reconnect debounce
        };

        // Handle socket reconnection
        this.socket.on('connect', this._onConnect);
        this.socket.on('disconnect', this._onDisconnect);

        // Receive cursor updates from other users
        this.socket.on('studio-cursor-update', (data) => {
            if (data.socketId === this.socket.id) return;

            this.remoteCursors.set(data.socketId, {
                x: data.x,
                y: data.y,
                color: data.color,
                name: data.name
            });

            if (this.isActive) {
                this.render();
            }
        });

        // Receive canvas state updates
        this.socket.on('studio-canvas-update', (data) => {
            console.log('=== studio-canvas-update received ===');
            console.log('From socket:', data.socketId);
            console.log('My socket:', this.socket.id);
            console.log('Objects count:', data.objects?.length);
            console.log('Is same socket:', data.socketId === this.socket.id);
            console.log('isActive:', this.isActive);

            if (data.socketId === this.socket.id) {
                console.log('Ignoring update from self');
                return;
            }

            if (data.objects && data.objects.length > 0) {
                console.log('Object types:', data.objects.map(o => o.type).join(', '));
                this.syncCanvasState(data.objects);
            } else {
                console.log('No objects in update or empty array');
            }
        });

        // Handle user disconnect - remove their cursor
        this.socket.on('user-left', (data) => {
            this.remoteCursors.delete(data.socketId);
            this.updateUsersIndicator();
            if (this.isActive) {
                this.render();
            }
        });

        // Handle studio-specific user left
        this.socket.on('studio-user-left', (data) => {
            this.remoteCursors.delete(data.socketId);
            this.studioUsers = this.studioUsers.filter(u => u.socketId !== data.socketId);
            this.updateUsersIndicator();
            if (this.isActive) {
                this.render();
            }
        });

        // Handle studio user joined
        this.socket.on('studio-user-joined', (data) => {
            console.log('studio-user-joined event:', data.socketId, 'username:', data.username);
            console.log('My state: isActive=', this.isActive, 'objects=', this.objects.length);

            if (!this.studioUsers) this.studioUsers = [];
            this.studioUsers.push({
                socketId: data.socketId,
                username: data.username
            });
            this.updateUsersIndicator();

            // Share our current state with the new user (send directly to them, not broadcast)
            if (this.isActive && this.objects.length > 0) {
                console.log('Sending canvas state to new user:', data.socketId, 'objects:', this.objects.length);
                this.sendCanvasStateTo(data.socketId);
            } else {
                console.log('Not sending state - isActive:', this.isActive, 'objects:', this.objects.length);
            }
        });

        // Receive list of users in studio
        this.socket.on('studio-users-list', (users) => {
            console.log('Received studio users list:', users.length, 'users');
            this.studioUsers = users;
            this.updateUsersIndicator();

            // If we have no objects and there are other users, request state from them
            // This is a fallback in case the studio-state-request didn't work
            if (this.objects.length === 0 && users.length > 0 && this.isActive) {
                console.log('No objects locally, requesting state from other users');
                // The server already sent studio-state-request, but let's also
                // wait a moment and check if we received any objects
                setTimeout(() => {
                    if (this.objects.length === 0 && users.length > 0) {
                        console.log('Still no objects, broadcasting request again');
                        // Request state from the first user in the list
                        this.socket.emit('studio-state-request', { requesterId: this.socket.id });
                    }
                }, 1000);
            }
        });

        // Request initial state when joining - send directly to requester
        this.socket.on('studio-state-request', (data) => {
            console.log('Received state request from:', data.requesterId, 'isActive:', this.isActive, 'objects:', this.objects.length);
            // Only respond if we're in studio and have objects
            if (this.isActive && this.objects.length > 0 && data.requesterId) {
                console.log('Responding to state request with', this.objects.length, 'objects');
                this.sendCanvasStateTo(data.requesterId);
            }
        });
    }

    /**
     * Send canvas state to a specific user (for initial sync)
     */
    sendCanvasStateTo(targetSocketId) {
        if (!this.socket || !this.isActive) return;

        // Serialize objects (exclude loaded Image objects)
        const serializedObjects = this.objects.map(obj => ({
            ...obj,
            data: obj.type === 'image'
                ? { src: obj.data.src }
                : obj.type === 'clipart'
                ? { src: obj.data.src, id: obj.data.id, name: obj.data.name }
                : obj.data
        }));

        this.socket.emit('studio-canvas-update', {
            objects: serializedObjects,
            to: targetSocketId
        });

        console.log('Sent canvas state to', targetSocketId, ':', serializedObjects.length, 'objects');
    }

    updateUsersIndicator() {
        const indicator = document.getElementById('studioUsersIndicator');
        const avatarsContainer = document.getElementById('usersAvatars');
        const countEl = document.getElementById('usersCount');

        if (!indicator || !avatarsContainer || !countEl) return;

        const users = this.studioUsers || [];
        const totalCount = users.length + 1; // +1 for self

        if (totalCount > 1) {
            indicator.classList.remove('hidden');

            // Clear existing avatars
            avatarsContainer.innerHTML = '';

            // Add self avatar
            const selfAvatar = document.createElement('div');
            selfAvatar.className = 'user-avatar';
            selfAvatar.style.backgroundColor = this.myCursorColor;
            selfAvatar.textContent = 'Me';
            avatarsContainer.appendChild(selfAvatar);

            // Add other user avatars (max 4 displayed)
            users.slice(0, 4).forEach((user, index) => {
                const avatar = document.createElement('div');
                avatar.className = 'user-avatar';
                avatar.style.backgroundColor = this.cursorColors[index % this.cursorColors.length];
                avatar.textContent = user.username?.charAt(0)?.toUpperCase() || '?';
                avatar.title = user.username || 'Guest';
                avatarsContainer.appendChild(avatar);
            });

            countEl.textContent = `${totalCount} in studio`;
        } else {
            indicator.classList.add('hidden');
        }
    }

    broadcastCursorPosition(x, y) {
        if (!this.socket || !this.isActive) return;

        const now = Date.now();
        if (now - this.lastCursorUpdate < this.cursorUpdateInterval) return;
        this.lastCursorUpdate = now;

        this.socket.emit('studio-cursor-update', {
            x,
            y,
            color: this.myCursorColor,
            name: this.socket.username || 'Guest'
        });
    }

    /**
     * Check if socket is truly ready to send messages
     * Socket.io's .connected can be true while WebSocket is closing
     */
    isSocketReady() {
        if (!this.socket) return false;
        if (!this.socket.connected) return false;

        // Check the underlying engine.io transport state
        try {
            const transport = this.socket.io?.engine?.transport;
            if (transport && transport.writable === false) {
                return false;
            }
            // Also check if websocket is in a bad state
            if (transport?.ws) {
                const wsState = transport.ws.readyState;
                // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
                if (wsState !== 1) {
                    return false;
                }
            }
        } catch (e) {
            // If we can't check, assume it's okay
        }

        return true;
    }

    broadcastCanvasState() {
        if (!this.socket) {
            console.log('broadcastCanvasState: No socket, skipping');
            return;
        }
        if (!this.isActive) {
            console.log('broadcastCanvasState: Not active, skipping');
            return;
        }

        // Check if socket is truly ready
        if (!this.isSocketReady()) {
            console.log('broadcastCanvasState: Socket not ready, scheduling retry');
            this.pendingBroadcast = true;

            // Clear existing retry timeout
            if (this.broadcastRetryTimeout) {
                clearTimeout(this.broadcastRetryTimeout);
            }

            // Retry in 500ms
            this.broadcastRetryTimeout = setTimeout(() => {
                if (this.pendingBroadcast && this.isActive) {
                    console.log('broadcastCanvasState: Retrying broadcast');
                    this.pendingBroadcast = false;
                    this.broadcastCanvasState();
                }
            }, 500);
            return;
        }

        console.log('broadcastCanvasState: Sending', this.objects.length, 'objects');
        this.pendingBroadcast = false;

        // Serialize objects (exclude loaded Image objects)
        const serializedObjects = this.objects.map(obj => {
            let data;
            if (obj.type === 'image') {
                // Ensure we have the src
                const src = obj.data.src;
                if (!src) {
                    console.error('Image object has no src!', obj.id);
                }
                data = { src: src };
                // Log image data size for debugging
                const srcSize = src?.length || 0;
                console.log('Serializing image:', obj.id, 'src size:', srcSize, 'bytes');
                if (srcSize > 5000000) {
                    console.warn('Very large image data URL:', srcSize, 'bytes - may exceed Socket.IO limits');
                }
            } else if (obj.type === 'clipart') {
                data = { src: obj.data.src, id: obj.data.id, name: obj.data.name };
            } else {
                data = obj.data;
            }
            return { ...obj, data };
        });

        // Log total payload size
        const payloadStr = JSON.stringify(serializedObjects);
        console.log('Total payload size:', payloadStr.length, 'bytes');

        try {
            this.socket.emit('studio-canvas-update', {
                objects: serializedObjects
            });
        } catch (err) {
            console.error('broadcastCanvasState: Error emitting', err);
            // Schedule a retry
            this.pendingBroadcast = true;
            this.broadcastRetryTimeout = setTimeout(() => {
                if (this.pendingBroadcast && this.isActive) {
                    this.pendingBroadcast = false;
                    this.broadcastCanvasState();
                }
            }, 1000);
        }
    }

    syncCanvasState(remoteObjects) {
        console.log('syncCanvasState called with', remoteObjects.length, 'remote objects');
        console.log('Current local objects:', this.objects.length);

        // Log what we're receiving for debugging
        remoteObjects.forEach(obj => {
            console.log('Remote obj:', obj.id, obj.type,
                obj.type === 'image' ? ('src length: ' + (obj.data?.src?.length || 0)) : '');
        });

        // Merge remote objects with local state
        // Strategy: Add/update objects from remote, but don't remove local objects
        // This prevents the "last-write-wins" problem in multi-user scenarios

        remoteObjects.forEach(remoteObj => {
            console.log('Processing remote object:', remoteObj.id, remoteObj.type, 'at', remoteObj.x, remoteObj.y);

            const localObj = this.objects.find(o => o.id === remoteObj.id);
            if (localObj) {
                // Update existing object position/size
                console.log('Updating existing object:', localObj.id);
                localObj.x = remoteObj.x;
                localObj.y = remoteObj.y;
                localObj.width = remoteObj.width;
                localObj.height = remoteObj.height;

                // For images, update src if it changed or if we don't have an image loaded
                if ((localObj.type === 'image' || localObj.type === 'clipart') && remoteObj.data?.src) {
                    if (!localObj.data.image || localObj.data.src !== remoteObj.data.src) {
                        localObj.data.src = remoteObj.data.src;
                        localObj.data.loading = false;
                        localObj.data.image = null; // Will be reloaded
                        console.log('Updated image src for:', localObj.id);
                    }
                }
            } else {
                // Add new object
                console.log('Adding new object:', remoteObj.id, remoteObj.type);
                const newObj = { ...remoteObj, data: { ...remoteObj.data } };

                // Images and clipart need their image element loaded
                if ((newObj.type === 'image' || newObj.type === 'clipart') && newObj.data.src) {
                    newObj.data.loading = false;
                    newObj.data.image = null; // Will be loaded by draw function
                    console.log('Image/clipart will load from src length:', newObj.data.src?.length);
                }

                this.objects.push(newObj);
                this.nextObjectId = Math.max(this.nextObjectId, newObj.id + 1);
                console.log('Object added, total objects:', this.objects.length);
            }
        });

        // NOTE: We no longer remove local objects that aren't in remote update
        // This allows true multi-user collaboration where each user can have their own objects
        // Objects are only removed via explicit delete action which should broadcast deletion

        console.log('Sync complete. Total objects:', this.objects.length);

        // Force immediate render after sync
        if (this.isActive) {
            console.log('Triggering render after sync');
            this.render();
        }
    }

    // ==================== MODE ACTIVATION ====================

    activate() {
        this.isActive = true;

        // Use requestAnimationFrame to ensure DOM has updated after visibility change
        // This fixes the issue where canvas has 0 dimensions when first shown
        requestAnimationFrame(() => {
            // Force a reflow to ensure container dimensions are correct
            const container = this.canvas?.parentElement;
            if (container) {
                // Trigger reflow by reading offsetHeight
                void container.offsetHeight;
            }

            this.resizeCanvas();
            this.render();

            // Second render after a short delay to catch any timing issues
            setTimeout(() => {
                this.resizeCanvas();
                this.render();
                console.log('Canvas dimensions:', this.canvas?.width, 'x', this.canvas?.height);
            }, 50);

            // Start animation loop for smooth cursor updates
            this.startAnimationLoop();

            // Request state from other users - emit join when socket is ready
            this.emitStudioJoin();

            console.log('Studio mode activated');
        });
    }

    emitStudioJoin() {
        // Prevent duplicate joins
        if (this.hasJoinedStudio) {
            console.log('Already joined studio, skipping duplicate join');
            return;
        }

        // Clear any pending join retry
        if (this._joinRetryTimer) {
            clearTimeout(this._joinRetryTimer);
            this._joinRetryTimer = null;
        }

        if (this.socket && this.socket.connected) {
            this.hasJoinedStudio = true;
            this.socket.emit('studio-join');
            console.log('Emitted studio-join, socket id:', this.socket.id);
        } else {
            // Socket not ready, try again shortly (but only once)
            console.log('Socket not ready for studio-join, will retry in 500ms');
            this._joinRetryTimer = setTimeout(() => {
                this._joinRetryTimer = null;
                if (this.isActive && !this.hasJoinedStudio) {
                    this.emitStudioJoin();
                }
            }, 500);
        }
    }

    deactivate() {
        this.isActive = false;
        this.hasJoinedStudio = false;

        // Clear any pending timers
        if (this._joinRetryTimer) {
            clearTimeout(this._joinRetryTimer);
            this._joinRetryTimer = null;
        }
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        this.stopAnimationLoop();

        // Notify others we left
        if (this.socket) {
            this.socket.emit('studio-leave');
        }

        console.log('Studio mode deactivated');
    }

    startAnimationLoop() {
        const animate = () => {
            if (!this.isActive) return;
            // Always render to ensure images/clipart show up when they load
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // ==================== CLEAR CANVAS ====================

    clearCanvas() {
        this.objects = [];
        this.selectedObject = null;
        this.nextObjectId = 1;
        this.render();
        this.broadcastCanvasState();
    }
}

// Initialize Studio
const studioCanvas = new StudioCanvas();

// Export for use in other modules
window.studioCanvas = studioCanvas;

// Integration with ConnectionManager
// This runs after connection.js has loaded
document.addEventListener('DOMContentLoaded', () => {
    // Continuously check for socket (it may be created later when user clicks Connect)
    const checkConnection = setInterval(() => {
        if (window.connectionManager && window.connectionManager.socket) {
            // Only set socket if we don't have one yet, or if it changed
            if (!studioCanvas.socket || studioCanvas.socket !== window.connectionManager.socket) {
                studioCanvas.setSocket(window.connectionManager.socket);
                console.log('Studio connected to socket');
            }
        }
    }, 500);

    // Don't clear the interval - keep checking in case socket reconnects

    // Setup zoom buttons
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
    const clearCanvasBtn = document.getElementById('clearCanvasBtn');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => studioCanvas.zoomIn());
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => studioCanvas.zoomOut());
    }
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => studioCanvas.resetView());
    }
    if (clearCanvasBtn) {
        clearCanvasBtn.addEventListener('click', () => {
            if (confirm('Clear all items from the canvas?')) {
                studioCanvas.clearCanvas();
            }
        });
    }

    // Setup Studio Connect Button and Connection Status
    const studioConnectBtn = document.getElementById('studioConnectBtn');
    const studioConnectionStatus = document.getElementById('studioConnectionStatus');

    // Helper to update studio connection status UI
    function updateStudioConnectionStatus(status) {
        // Update status indicator
        if (studioConnectionStatus) {
            const dot = studioConnectionStatus.querySelector('.status-dot');
            const text = studioConnectionStatus.querySelector('.status-text');

            if (status === 'connected') {
                dot.classList.remove('disconnected', 'connecting');
                dot.classList.add('connected');
                text.textContent = 'Connected';
            } else if (status === 'connecting') {
                dot.classList.remove('disconnected', 'connected');
                dot.classList.add('connecting');
                text.textContent = 'Connecting...';
            } else {
                dot.classList.remove('connected', 'connecting');
                dot.classList.add('disconnected');
                text.textContent = 'Not Connected';
            }
        }

        // Update PIP connect button
        if (studioConnectBtn) {
            if (status === 'connected') {
                studioConnectBtn.classList.remove('connecting');
                studioConnectBtn.classList.add('connected');
            } else if (status === 'connecting') {
                studioConnectBtn.classList.remove('connected');
                studioConnectBtn.classList.add('connecting');
            } else {
                studioConnectBtn.classList.remove('connected', 'connecting');
            }
        }
    }

    if (studioConnectBtn) {
        studioConnectBtn.addEventListener('click', () => {
            // Use the same login flow as the main connect button
            if (window.connectionManager) {
                if (window.connectionManager.isLoggedIn) {
                    // Already connected
                    updateStudioConnectionStatus('connected');
                } else {
                    // Show connecting state
                    updateStudioConnectionStatus('connecting');

                    // Login without password (same as joinVideoBtn)
                    window.connectionManager.login('no-password-required', 'User-' + Math.floor(Math.random() * 1000));
                    // Update button state and socket after login
                    const waitForLogin = setInterval(() => {
                        if (window.connectionManager.isLoggedIn && window.connectionManager.socket) {
                            updateStudioConnectionStatus('connected');
                            // Also set the socket for studio
                            studioCanvas.setSocket(window.connectionManager.socket);
                            console.log('Studio socket set after Connect button click');
                            clearInterval(waitForLogin);
                        }
                    }, 200);
                    // Give up after 10 seconds
                    setTimeout(() => {
                        clearInterval(waitForLogin);
                        if (!window.connectionManager?.isLoggedIn) {
                            updateStudioConnectionStatus('disconnected');
                        }
                    }, 10000);
                }
            }
        });

        // Check initial state and update connect button/status
        const checkConnectState = setInterval(() => {
            if (window.connectionManager && window.connectionManager.isLoggedIn) {
                updateStudioConnectionStatus('connected');
            }
        }, 1000);
    }

    // Setup Studio Video Recording
    setupStudioVideo();

    // ==================== AUTO-START STUDIO MODE ====================
    // Default to studio view and auto-connect on page load
    setTimeout(() => {
        console.log('🚀 Auto-starting Studio mode...');

        // 1. Auto-open Studio view by triggering the toggle button click
        const studioToggleBtn = document.getElementById('studioToggleBtn');
        if (studioToggleBtn) {
            studioToggleBtn.click();
            console.log('✓ Studio view opened');
        }

        // 2. Auto-connect after a short delay to let Studio initialize
        setTimeout(() => {
            console.log('🔌 Auto-connecting...');

            if (window.connectionManager) {
                if (!window.connectionManager.isLoggedIn) {
                    // Update UI to show connecting state
                    updateStudioConnectionStatus('connecting');

                    // Login with auto-generated username
                    const autoUsername = 'User-' + Math.floor(Math.random() * 1000);
                    window.connectionManager.login('no-password-required', autoUsername);

                    // Wait for login to complete and set socket
                    const waitForAutoLogin = setInterval(() => {
                        if (window.connectionManager.isLoggedIn && window.connectionManager.socket) {
                            updateStudioConnectionStatus('connected');
                            studioCanvas.setSocket(window.connectionManager.socket);
                            console.log('✓ Auto-connected as', autoUsername);
                            clearInterval(waitForAutoLogin);
                        }
                    }, 200);

                    // Give up after 10 seconds
                    setTimeout(() => {
                        clearInterval(waitForAutoLogin);
                        if (!window.connectionManager?.isLoggedIn) {
                            updateStudioConnectionStatus('disconnected');
                            console.log('⚠ Auto-connect timed out');
                        }
                    }, 10000);
                } else {
                    // Already connected
                    updateStudioConnectionStatus('connected');
                    console.log('✓ Already connected');
                }
            } else {
                console.log('⚠ ConnectionManager not available for auto-connect');
            }
        }, 500); // Wait 500ms for Studio to initialize before connecting

    }, 100); // Small delay to ensure DOM is fully ready
});

// Studio Video Recording Functions
async function setupStudioVideo() {
    const videoPreview = document.getElementById('studioPreviewVideo');
    const recordBtn = document.getElementById('studioRecordBtn');
    const stopBtn = document.getElementById('studioStopBtn');
    const snapshotBtn = document.getElementById('studioSnapshotBtn');
    const timerEl = document.getElementById('studioTimer');

    if (!videoPreview || !recordBtn || !stopBtn) return;

    // Snapshot button handler
    if (snapshotBtn) {
        snapshotBtn.addEventListener('click', () => {
            if (!videoPreview.srcObject || videoPreview.readyState < 2) {
                alert('Camera not ready. Please wait for the camera to initialize.');
                return;
            }

            // Flash effect
            snapshotBtn.classList.add('flash');
            setTimeout(() => snapshotBtn.classList.remove('flash'), 300);

            // Take the snapshot and add to canvas
            studioCanvas.takeSnapshot(videoPreview);
            console.log('Snapshot taken and added to canvas');
        });
    }

    let mediaRecorder = null;
    let recordedChunks = [];
    let stream = null;
    let timerInterval = null;
    let startTime = null;

    // Initialize camera when entering studio mode
    const studioToggleBtn = document.getElementById('studioToggleBtn');
    if (studioToggleBtn) {
        studioToggleBtn.addEventListener('click', async () => {
            if (!stream) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 640, height: 480, facingMode: 'user' },
                        audio: true
                    });
                    videoPreview.srcObject = stream;
                    console.log('Studio camera initialized');
                } catch (err) {
                    console.error('Failed to get camera:', err);
                }
            }
        });
    }

    // Start recording
    recordBtn.addEventListener('click', () => {
        if (!stream) {
            alert('Camera not ready. Please wait or check permissions.');
            return;
        }

        recordedChunks = [];
        const options = { mimeType: 'video/webm;codecs=vp9,opus' };

        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            // Fallback
            mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);

            // Show download option or integrate with existing playback
            if (window.videoRecorder && window.videoRecorder.showPlayback) {
                window.videoRecorder.recordedBlob = blob;
                window.videoRecorder.showPlayback(url);
            } else {
                // Fallback: download directly
                const a = document.createElement('a');
                a.href = url;
                a.download = `studio-recording-${Date.now()}.webm`;
                a.click();
            }
        };

        mediaRecorder.start(100);
        startTime = Date.now();

        // Update UI
        recordBtn.disabled = true;
        recordBtn.classList.add('recording');
        stopBtn.disabled = false;

        // Start timer
        timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const secs = String(elapsed % 60).padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 100);

        console.log('Studio recording started');
    });

    // Stop recording
    stopBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }

        // Update UI
        recordBtn.disabled = false;
        recordBtn.classList.remove('recording');
        stopBtn.disabled = true;

        // Stop timer
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        timerEl.textContent = '00:00';

        console.log('Studio recording stopped');
    });

    // Setup draggable video preview
    setupDraggableVideoPreview();
}

/**
 * Makes the studio video preview draggable around the screen
 * Uses a combination of mouse and touch events for cross-device compatibility
 */
function setupDraggableVideoPreview() {
    const videoPreview = document.getElementById('studioVideoPreview');
    const dragHandle = document.getElementById('studioVideoDragHandle');

    if (!videoPreview) return;

    let isDragging = false;
    let startX, startY;
    let initialX, initialY;

    // Get the current position from CSS or stored position
    const getPosition = () => {
        const rect = videoPreview.getBoundingClientRect();
        const parent = videoPreview.parentElement.getBoundingClientRect();
        return {
            x: rect.left - parent.left,
            y: rect.top - parent.top
        };
    };

    // Set position using left/top instead of right/bottom for dragging
    const setPosition = (x, y) => {
        const parent = videoPreview.parentElement;
        const parentRect = parent.getBoundingClientRect();
        const previewRect = videoPreview.getBoundingClientRect();

        // Constrain to parent bounds
        const maxX = parentRect.width - previewRect.width;
        const maxY = parentRect.height - previewRect.height;

        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));

        // Switch from right/bottom positioning to left/top
        videoPreview.style.right = 'auto';
        videoPreview.style.bottom = 'auto';
        videoPreview.style.left = x + 'px';
        videoPreview.style.top = y + 'px';
    };

    const onDragStart = (e) => {
        // Only start drag from handle or video frame area
        const target = e.target;
        const isHandle = dragHandle && dragHandle.contains(target);
        const isVideoFrame = target.closest('.studio-video-frame');
        const isControl = target.closest('.studio-video-controls');

        // Don't drag when clicking controls
        if (isControl && !isHandle) return;

        isDragging = true;
        videoPreview.classList.add('dragging');

        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        // Get current position
        const pos = getPosition();
        startX = clientX;
        startY = clientY;
        initialX = pos.x;
        initialY = pos.y;

        if (e.type.includes('touch')) {
            e.preventDefault();
        }
    };

    const onDragMove = (e) => {
        if (!isDragging) return;

        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        setPosition(initialX + deltaX, initialY + deltaY);

        if (e.type.includes('touch')) {
            e.preventDefault();
        }
    };

    const onDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        videoPreview.classList.remove('dragging');
    };

    // Mouse events
    videoPreview.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    // Touch events
    videoPreview.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);

    // Prevent text selection while dragging
    videoPreview.addEventListener('selectstart', (e) => {
        if (isDragging) e.preventDefault();
    });

    console.log('Draggable video preview initialized');
}
