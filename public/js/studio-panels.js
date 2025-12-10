/**
 * Studio Panels - Secondary Slide-out Panel System
 *
 * Manages the slide-out panels for Draw, Text, Stickers, GIFs, and Clipart tools.
 */

class StudioPanels {
    constructor() {
        this.activePanel = null;
        this.panelElement = null;
        this.contentElement = null;

        // Color palette
        this.colors = [
            '#141414', '#5b636a', '#ffffff', '#ef4444',
            '#f97316', '#eab308', '#22c55e', '#3b82f6',
            '#8b5cf6', '#ec4899', '#7d2eff', '#06b6d4',
            '#84cc16', '#f59e0b', '#6366f1', '#d946ef'
        ];

        // Font styles
        this.fonts = [
            { id: 'classic', name: 'Classic', family: 'Yahoo Product Sans VF, sans-serif', weight: 400 },
            { id: 'handwritten', name: 'Handwritten', family: 'Comic Sans MS, cursive', weight: 400 },
            { id: 'bold', name: 'Bold Display', family: 'Yahoo Product Sans VF, sans-serif', weight: 800 },
            { id: 'typewriter', name: 'Typewriter', family: 'Courier New, monospace', weight: 400 },
            { id: 'neon', name: 'Neon Glow', family: 'Yahoo Product Sans VF, sans-serif', weight: 600, glow: true }
        ];

        // Current selections
        this.currentBrush = 'pen';
        this.currentColor = '#141414';
        this.currentSize = 4;
        this.currentFont = 'classic';
        this.currentBgStyle = 'none';

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
        this.panelElement = document.getElementById('studioSecondaryPanel');
        this.contentElement = document.getElementById('studioPanelContent');

        if (!this.panelElement || !this.contentElement) {
            console.warn('Studio panel elements not found');
            return;
        }

        // Setup tool button listeners
        this.setupToolButtons();

        // Setup drag event delegation
        this.setupDragListeners();

        console.log('Studio Panels initialized');
    }

    setupDragListeners() {
        // Use event delegation on the panel content for all draggable items
        if (!this.contentElement) return;

        this.contentElement.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.draggable-item');
            if (!item) return;

            const dragType = item.dataset.dragType;
            const dragData = item.dataset.dragData;

            if (dragType && dragData) {
                e.dataTransfer.setData('text/drag-type', dragType);
                e.dataTransfer.setData('text/drag-data', dragData);
                e.dataTransfer.effectAllowed = 'copy';

                // Add dragging class for visual feedback
                item.classList.add('dragging');

                console.log(`Drag start: type=${dragType}, data=${dragData}`);
            }
        });

        this.contentElement.addEventListener('dragend', (e) => {
            const item = e.target.closest('.draggable-item');
            if (item) {
                item.classList.remove('dragging');
            }
        });
    }

    setupToolButtons() {
        document.querySelectorAll('.studio-tool-btn[data-panel]').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelType = btn.dataset.panel;
                this.togglePanel(panelType);
            });
        });
    }

    togglePanel(panelType) {
        if (this.activePanel === panelType) {
            this.closePanel();
        } else {
            this.openPanel(panelType);
        }
    }

    openPanel(panelType) {
        this.activePanel = panelType;
        this.renderPanelContent(panelType);
        this.panelElement.classList.add('open');

        // Update active states on tool buttons
        document.querySelectorAll('.studio-tool-btn[data-panel]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === panelType);
        });
    }

    closePanel() {
        this.activePanel = null;
        this.panelElement.classList.remove('open');

        // Remove active states
        document.querySelectorAll('.studio-tool-btn[data-panel]').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    renderPanelContent(panelType) {
        switch (panelType) {
            case 'draw':
                this.renderDrawPanel();
                break;
            case 'text':
                this.renderTextPanel();
                break;
            case 'stickers':
                this.renderStickersPanel();
                break;
            case 'gifs':
                this.renderGifsPanel();
                break;
            case 'clipart':
                this.renderClipartPanel();
                break;
            case 'premium':
                this.renderPremiumPanel();
                break;
            default:
                this.contentElement.innerHTML = '';
        }
    }

    // ==================== DRAW PANEL ====================

    renderDrawPanel() {
        this.contentElement.innerHTML = `
            <div class="studio-panel-header">
                <span class="studio-panel-title">Draw</span>
                <button class="studio-panel-close" onclick="studioPanels.closePanel()">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <div class="studio-panel-section">
                <div class="studio-panel-section-title">Brush Type</div>
                <div class="studio-brush-types">
                    <button class="studio-brush-btn ${this.currentBrush === 'pen' ? 'active' : ''}"
                            data-brush="pen" onclick="studioPanels.setBrush('pen')" title="Pen">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456l-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                        </svg>
                    </button>
                    <button class="studio-brush-btn ${this.currentBrush === 'marker' ? 'active' : ''}"
                            data-brush="marker" onclick="studioPanels.setBrush('marker')" title="Marker">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" opacity="0.5">
                            <rect x="4" y="4" width="12" height="12" rx="2"/>
                        </svg>
                    </button>
                    <button class="studio-brush-btn ${this.currentBrush === 'neon' ? 'active' : ''}"
                            data-brush="neon" onclick="studioPanels.setBrush('neon')" title="Neon">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="#7d2eff" style="filter: drop-shadow(0 0 3px #7d2eff)">
                            <circle cx="10" cy="10" r="6"/>
                        </svg>
                    </button>
                    <button class="studio-brush-btn ${this.currentBrush === 'eraser' ? 'active' : ''}"
                            data-brush="eraser" onclick="studioPanels.setBrush('eraser')" title="Eraser">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828l6.879-6.879z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="studio-panel-section">
                <div class="studio-panel-section-title">Size</div>
                <input type="range" class="studio-size-slider" min="2" max="20" value="${this.currentSize}"
                       oninput="studioPanels.setSize(this.value)">
            </div>

            <div class="studio-panel-section">
                <div class="studio-panel-section-title">Colors</div>
                <div class="studio-color-palette">
                    ${this.colors.map(color => `
                        <button class="studio-color-btn ${this.currentColor === color ? 'active' : ''}"
                                style="background: ${color}; ${color === '#ffffff' ? 'border: 1px solid #cdcdcd;' : ''}"
                                onclick="studioPanels.setColor('${color}')">
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    setBrush(brush) {
        this.currentBrush = brush;

        // Update UI
        document.querySelectorAll('.studio-brush-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.brush === brush);
        });

        // Update fabric canvas
        if (window.studioFabric) {
            window.studioFabric.setBrushType(brush);
        }
    }

    setSize(size) {
        this.currentSize = parseInt(size);

        if (window.studioFabric) {
            window.studioFabric.setBrushSize(this.currentSize);
        }
    }

    setColor(color) {
        this.currentColor = color;

        // Update UI
        document.querySelectorAll('.studio-color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.style.background === color);
        });

        if (window.studioFabric) {
            window.studioFabric.setBrushColor(color);
        }
    }

    // ==================== TEXT PANEL ====================

    renderTextPanel() {
        this.contentElement.innerHTML = `
            <div class="studio-panel-header">
                <span class="studio-panel-title">Text</span>
                <button class="studio-panel-close" onclick="studioPanels.closePanel()">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <div class="studio-panel-section">
                <div class="studio-panel-section-title">Font Style</div>
                <div class="studio-font-list">
                    ${this.fonts.map(font => `
                        <button class="studio-font-btn font-${font.id} ${this.currentFont === font.id ? 'active' : ''}"
                                style="font-family: ${font.family}; font-weight: ${font.weight};
                                       ${font.glow ? 'text-shadow: 0 0 10px #7d2eff; color: #7d2eff;' : ''}"
                                onclick="studioPanels.setFont('${font.id}')">
                            ${font.name}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="studio-panel-section">
                <div class="studio-panel-section-title">Background</div>
                <div class="studio-bg-styles">
                    <button class="studio-bg-btn ${this.currentBgStyle === 'none' ? 'active' : ''}"
                            onclick="studioPanels.setBgStyle('none')">None</button>
                    <button class="studio-bg-btn ${this.currentBgStyle === 'solid' ? 'active' : ''}"
                            onclick="studioPanels.setBgStyle('solid')">Solid</button>
                    <button class="studio-bg-btn ${this.currentBgStyle === 'pill' ? 'active' : ''}"
                            onclick="studioPanels.setBgStyle('pill')">Pill</button>
                </div>
            </div>

            <div class="studio-panel-section">
                <div class="studio-panel-section-title">Colors</div>
                <div class="studio-color-palette">
                    ${this.colors.map(color => `
                        <button class="studio-color-btn ${this.currentColor === color ? 'active' : ''}"
                                style="background: ${color}; ${color === '#ffffff' ? 'border: 1px solid #cdcdcd;' : ''}"
                                onclick="studioPanels.setColor('${color}')">
                        </button>
                    `).join('')}
                </div>
            </div>

            <button class="studio-add-text-btn" onclick="studioPanels.addText()"
                    style="width: 100%; padding: 12px; background: var(--studio-brand); color: white;
                           border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
                           margin-top: 16px;">
                Add Text
            </button>
        `;
    }

    setFont(fontId) {
        this.currentFont = fontId;

        document.querySelectorAll('.studio-font-btn').forEach(btn => {
            btn.classList.toggle('active', btn.classList.contains(`font-${fontId}`));
        });
    }

    setBgStyle(style) {
        this.currentBgStyle = style;

        document.querySelectorAll('.studio-bg-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }

    addText() {
        const font = this.fonts.find(f => f.id === this.currentFont);
        const options = {
            fontFamily: font.family,
            fontWeight: font.weight,
            fill: this.currentColor
        };

        if (font.glow) {
            options.shadow = new fabric.Shadow({
                color: this.currentColor,
                blur: 15
            });
        }

        if (window.studioFabric) {
            window.studioFabric.addText('Your text here', options);
        }

        this.closePanel();
    }

    // ==================== STICKERS PANEL ====================

    renderStickersPanel() {
        // Common emoji categories
        const emojis = [
            '😀', '😂', '🥰', '😎', '🤩', '😇',
            '❤️', '🔥', '✨', '💯', '👍', '👏',
            '🎉', '🎊', '🎁', '🎈', '🌟', '⭐',
            '💪', '🙌', '🤝', '💕', '💖', '💗',
            '🌈', '☀️', '🌙', '⚡', '💥', '💫',
            '🍕', '🍔', '🍟', '🍩', '🎂', '🍰',
            '🐱', '🐶', '🐰', '🦊', '🐻', '🐼',
            '🌸', '🌺', '🌻', '🌹', '🌷', '💐'
        ];

        this.contentElement.innerHTML = `
            <div class="studio-panel-header">
                <span class="studio-panel-title">Stickers</span>
                <button class="studio-panel-close" onclick="studioPanels.closePanel()">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <input type="text" class="studio-emoji-search" placeholder="Search emoji..."
                   oninput="studioPanels.searchEmoji(this.value)">

            <div class="studio-emoji-grid" id="studioEmojiGrid">
                ${emojis.map(emoji => `
                    <button class="studio-emoji-btn draggable-item"
                            draggable="true"
                            data-drag-type="emoji"
                            data-drag-data="${emoji}"
                            onclick="studioPanels.addEmoji('${emoji}')">
                        ${emoji}
                    </button>
                `).join('')}
            </div>
        `;
    }

    searchEmoji(query) {
        // Simple filter - in production would use emoji search library
        const grid = document.getElementById('studioEmojiGrid');
        const buttons = grid.querySelectorAll('.studio-emoji-btn');

        buttons.forEach(btn => {
            // Show all if no query
            btn.style.display = query.length === 0 ? '' : 'none';
        });
    }

    addEmoji(emoji) {
        if (window.studioFabric) {
            window.studioFabric.addEmoji(emoji);
        }
    }

    // ==================== GIFS PANEL ====================

    renderGifsPanel() {
        this.contentElement.innerHTML = `
            <div class="studio-panel-header">
                <span class="studio-panel-title">GIFs</span>
                <button class="studio-panel-close" onclick="studioPanels.closePanel()">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <input type="text" class="studio-emoji-search" placeholder="Search Giphy..."
                   id="studioGiphySearch" onkeypress="if(event.key==='Enter') studioPanels.searchGiphy()">

            <div class="studio-panel-section">
                <div class="studio-panel-section-title">Quick Reactions</div>
                <div class="studio-emoji-grid" style="grid-template-columns: repeat(4, 1fr);">
                    <button class="studio-emoji-btn" onclick="studioPanels.addEmoji('👏')">👏</button>
                    <button class="studio-emoji-btn" onclick="studioPanels.addEmoji('😂')">😂</button>
                    <button class="studio-emoji-btn" onclick="studioPanels.addEmoji('🔥')">🔥</button>
                    <button class="studio-emoji-btn" onclick="studioPanels.addEmoji('💯')">💯</button>
                </div>
            </div>

            <div class="studio-panel-section">
                <div class="studio-panel-section-title">Trending</div>
                <div class="studio-giphy-grid" id="studioGiphyGrid">
                    <div style="text-align: center; padding: 20px; color: var(--studio-fg-tertiary);">
                        Enter a search term above
                    </div>
                </div>
            </div>

            <div class="studio-giphy-attribution">
                Powered by GIPHY
            </div>
        `;

        // Load trending GIFs
        this.loadTrendingGifs();
    }

    async searchGiphy() {
        const query = document.getElementById('studioGiphySearch').value;
        if (!query) return;

        const grid = document.getElementById('studioGiphyGrid');
        grid.innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>';

        try {
            const apiKey = '6zVkALwKx9D9WJxYUOpgvxaXk52FQrdN';
            const response = await fetch(
                `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=12&rating=g`
            );
            const data = await response.json();

            this.renderGiphyResults(data.data);
        } catch (error) {
            console.error('Giphy search error:', error);
            grid.innerHTML = '<div style="text-align: center; padding: 20px; color: #ef4444;">Search failed</div>';
        }
    }

    async loadTrendingGifs() {
        const grid = document.getElementById('studioGiphyGrid');
        if (!grid) return;

        grid.innerHTML = '<div style="text-align: center; padding: 20px;">Loading trending...</div>';

        try {
            const apiKey = '6zVkALwKx9D9WJxYUOpgvxaXk52FQrdN';
            const response = await fetch(
                `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=12&rating=g`
            );
            const data = await response.json();

            this.renderGiphyResults(data.data);
        } catch (error) {
            console.error('Giphy trending error:', error);
            grid.innerHTML = '<div style="text-align: center; padding: 20px; color: #ef4444;">Failed to load</div>';
        }
    }

    renderGiphyResults(gifs) {
        const grid = document.getElementById('studioGiphyGrid');
        if (!grid) return;

        if (!gifs || gifs.length === 0) {
            grid.innerHTML = '<div style="text-align: center; padding: 20px;">No results</div>';
            return;
        }

        grid.innerHTML = gifs.map(gif => `
            <div class="studio-giphy-item draggable-item"
                 draggable="true"
                 data-drag-type="gif"
                 data-drag-data="${gif.images.fixed_height.url}"
                 onclick="studioPanels.addGif('${gif.images.fixed_height.url}')">
                <img src="${gif.images.fixed_height_small.url}" alt="${gif.title}" draggable="false">
            </div>
        `).join('');
    }

    addGif(url) {
        if (window.studioFabric) {
            window.studioFabric.addImage(url);
        }
    }

    // ==================== CLIPART PANEL ====================

    renderClipartPanel() {
        // Get clipart items from existing studio
        const clipartItems = [];
        for (let i = 54; i <= 75; i++) {
            clipartItems.push({
                id: i.toString(),
                src: `/clipart/Untitled design (${i}).svg`,
                name: `Design ${i - 53}`
            });
        }

        this.contentElement.innerHTML = `
            <div class="studio-panel-header">
                <span class="studio-panel-title">Clipart</span>
                <button class="studio-panel-close" onclick="studioPanels.closePanel()">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <div class="studio-clipart-grid">
                ${clipartItems.map(item => `
                    <div class="studio-clipart-item draggable-item"
                         draggable="true"
                         data-drag-type="clipart"
                         data-drag-data="${item.src}"
                         onclick="studioPanels.addClipart('${item.src}')">
                        <img src="${item.src}" alt="${item.name}" draggable="false">
                    </div>
                `).join('')}
            </div>
        `;
    }

    addClipart(src) {
        if (window.studioFabric) {
            window.studioFabric.addImage(src);
        }
    }

    // ==================== PREMIUM PANEL ====================

    renderPremiumPanel() {
        const templates = [
            { id: 'one', name: 'Template 1', src: 'css/one.png' },
            { id: 'two', name: 'Template 2', src: 'css/two.png' },
            { id: 'three', name: 'Template 3', src: 'css/three.png' },
            { id: 'four', name: 'Template 4', src: 'css/four.png' },
            { id: 'five', name: 'Template 5', src: 'css/five.png' },
            { id: 'six', name: 'Template 6', src: 'css/six.png' }
        ];

        this.contentElement.innerHTML = `
            <div class="studio-panel-header">
                <h3>✨ Premium Templates</h3>
                <span class="studio-premium-badge">PRO</span>
            </div>
            <div class="studio-premium-templates">
                ${templates.map(t => `
                    <div class="studio-premium-template" data-template="${t.id}" onclick="studioPanels.showPremiumUpsell()">
                        <img src="${t.src}" alt="${t.name}">
                        <span class="template-lock">🔒</span>
                    </div>
                `).join('')}
            </div>
            <div class="studio-premium-footer">
                <p>Unlock all templates with Premium</p>
            </div>
        `;
    }

    showPremiumUpsell() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('premiumUpsellModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'premiumUpsellModal';
            modal.className = 'premium-upsell-modal';
            modal.innerHTML = `
                <div class="premium-upsell-content">
                    <button class="premium-upsell-close" onclick="studioPanels.closePremiumUpsell()">&times;</button>
                    <div class="premium-upsell-icon">✨</div>
                    <h2>Upgrade to Premium</h2>
                    <p class="premium-upsell-price"><span class="price">$5</span>/month</p>
                    <ul class="premium-upsell-features">
                        <li>🎨 7 Premium Templates</li>
                        <li>🎬 HD Video Export</li>
                        <li>🚫 No Watermarks</li>
                        <li>☁️ Cloud Storage</li>
                        <li>🎯 Priority Support</li>
                    </ul>
                    <button class="premium-upsell-btn" onclick="studioPanels.closePremiumUpsell()">
                        Start Free Trial
                    </button>
                    <p class="premium-upsell-note">7-day free trial, cancel anytime</p>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.classList.add('visible');
    }

    closePremiumUpsell() {
        const modal = document.getElementById('premiumUpsellModal');
        if (modal) {
            modal.classList.remove('visible');
        }
    }
}

// Initialize
const studioPanels = new StudioPanels();
window.studioPanels = studioPanels;
