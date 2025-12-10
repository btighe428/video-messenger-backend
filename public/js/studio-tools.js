/**
 * Studio Tools - Tool State Management & UI
 *
 * Handles the toolbar interactions, Create button menu, and tool switching.
 */

class StudioTools {
    constructor() {
        this.currentTool = 'select';
        this.quickMenuOpen = false;

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
        this.setupToolButtons();
        this.setupCreateButton();
        this.setupZoomControls();
        this.setupUndoRedo();
        this.setupCameraButton();
        this.setupSendButton();
        this.setupImageButton();

        console.log('Studio Tools initialized');
    }

    setupToolButtons() {
        document.querySelectorAll('.studio-tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.setTool(tool);
            });
        });
    }

    setTool(tool) {
        this.currentTool = tool;

        // Update button active states
        document.querySelectorAll('.studio-tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Update fabric canvas
        if (window.studioFabric) {
            window.studioFabric.setTool(tool);
        }

        // Close any open panel when switching to select
        if (tool === 'select' && window.studioPanels) {
            window.studioPanels.closePanel();
        }
    }

    // ==================== CREATE BUTTON ====================

    setupCreateButton() {
        const createBtn = document.getElementById('studioFloatingCreateBtn');
        const quickMenu = document.getElementById('studioQuickMenu');

        if (!createBtn || !quickMenu) return;

        createBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleQuickMenu();
        });

        // Close menu when clicking outside
        document.addEventListener('click', () => {
            if (this.quickMenuOpen) {
                this.closeQuickMenu();
            }
        });

        // Setup menu item clicks
        quickMenu.querySelectorAll('.studio-quick-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleQuickAction(action);
                this.closeQuickMenu();
            });
        });
    }

    toggleQuickMenu() {
        if (this.quickMenuOpen) {
            this.closeQuickMenu();
        } else {
            this.openQuickMenu();
        }
    }

    openQuickMenu() {
        const quickMenu = document.getElementById('studioQuickMenu');
        if (quickMenu) {
            quickMenu.classList.add('open');
            this.quickMenuOpen = true;
        }
    }

    closeQuickMenu() {
        const quickMenu = document.getElementById('studioQuickMenu');
        if (quickMenu) {
            quickMenu.classList.remove('open');
            this.quickMenuOpen = false;
        }
    }

    handleQuickAction(action) {
        switch (action) {
            case 'draw':
                this.setTool('draw');
                if (window.studioPanels) {
                    window.studioPanels.openPanel('draw');
                }
                break;
            case 'text':
                if (window.studioPanels) {
                    window.studioPanels.openPanel('text');
                }
                break;
            case 'sticker':
                if (window.studioPanels) {
                    window.studioPanels.openPanel('stickers');
                }
                break;
            case 'gif':
                if (window.studioPanels) {
                    window.studioPanels.openPanel('gifs');
                }
                break;
            case 'image':
                this.openImagePicker();
                break;
        }
    }

    openImagePicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file && window.studioFabric) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    window.studioFabric.addImage(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    // ==================== ZOOM CONTROLS ====================

    setupZoomControls() {
        const zoomIn = document.getElementById('studioZoomIn');
        const zoomOut = document.getElementById('studioZoomOut');
        const zoomDisplay = document.getElementById('studioZoomDisplay');

        if (zoomIn) {
            zoomIn.addEventListener('click', () => {
                if (window.studioFabric) {
                    window.studioFabric.zoomIn();
                }
            });
        }

        if (zoomOut) {
            zoomOut.addEventListener('click', () => {
                if (window.studioFabric) {
                    window.studioFabric.zoomOut();
                }
            });
        }

        if (zoomDisplay) {
            zoomDisplay.addEventListener('click', () => {
                if (window.studioFabric) {
                    window.studioFabric.resetZoom();
                }
            });
        }
    }

    // ==================== UNDO/REDO ====================

    setupUndoRedo() {
        const undoBtn = document.getElementById('studioUndoBtn');
        const redoBtn = document.getElementById('studioRedoBtn');

        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (window.studioFabric) {
                    window.studioFabric.undo();
                }
            });
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                if (window.studioFabric) {
                    window.studioFabric.redo();
                }
            });
        }
    }

    // ==================== CAMERA SELFIE ====================

    setupCameraButton() {
        const cameraBtn = document.getElementById('studioCameraBtn');

        if (cameraBtn) {
            // Single click for snapshot
            cameraBtn.addEventListener('click', (e) => {
                if (e.shiftKey) {
                    // Shift+click for live video
                    if (window.studioFabric) {
                        window.studioFabric.addLiveVideo();
                    }
                } else {
                    // Normal click for snapshot
                    if (window.studioFabric) {
                        window.studioFabric.addCameraSnapshot();
                    }
                }
            });

            // Update tooltip to indicate both options
            cameraBtn.title = 'Selfie (Shift+click for live video)';
        }
    }

    // ==================== SEND TO EMAIL ====================

    setupSendButton() {
        const sendBtn = document.getElementById('studioSendEmailBtn');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                if (window.studioFabric) {
                    window.studioFabric.saveToEmail();
                }
            });
        }
    }

    // ==================== IMAGE UPLOAD ====================

    setupImageButton() {
        const imageBtn = document.getElementById('studioImageBtn');

        if (imageBtn) {
            imageBtn.addEventListener('click', () => {
                this.openImagePicker();
            });
        }
    }
}

// Initialize
const studioTools = new StudioTools();
window.studioTools = studioTools;
