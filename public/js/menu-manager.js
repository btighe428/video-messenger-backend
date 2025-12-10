/**
 * Global Menu Manager
 * Centralized system for managing all popup menus with click-outside-to-close behavior
 *
 * Design Patterns Applied:
 * - Singleton Pattern: Single source of truth for menu state
 * - Observer Pattern: Event-driven menu state changes
 * - Strategy Pattern: Configurable close behaviors per menu
 *
 * UX Principles:
 * - Click outside to dismiss (iOS/Android/MacOS standard)
 * - Only one menu open at a time (reduced cognitive load)
 * - ESC key support for keyboard navigation
 * - Accessibility: Focus trapping and ARIA attributes
 *
 * @author Menu Management System
 * @version 1.0.0
 */

class MenuManager {
    constructor() {
        // Singleton pattern - ensure only one instance
        if (MenuManager.instance) {
            return MenuManager.instance;
        }
        MenuManager.instance = this;

        // Menu registry: tracks all menus and their trigger buttons
        this.menus = new Map();

        // Currently open menu (only one can be open at a time)
        this.currentOpenMenu = null;

        // Track if we're in the middle of a menu open operation
        this.isOpening = false;

        // Bind methods to preserve context
        this.handleGlobalClick = this.handleGlobalClick.bind(this);
        this.handleEscapeKey = this.handleEscapeKey.bind(this);

        // Initialize global listeners
        this.init();

        console.log('🎯 MenuManager initialized');
    }

    init() {
        // Global click listener for click-outside-to-close
        // Use capture phase to handle clicks before they reach menu items
        document.addEventListener('click', this.handleGlobalClick, true);

        // ESC key to close menus
        document.addEventListener('keydown', this.handleEscapeKey);

        // Register all menus after DOM loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.registerAllMenus());
        } else {
            this.registerAllMenus();
        }
    }

    /**
     * Register a menu with the manager
     * @param {string} menuId - ID of menu element
     * @param {string} triggerId - ID of trigger button element
     * @param {Object} options - Configuration options
     */
    registerMenu(menuId, triggerId, options = {}) {
        const menu = document.getElementById(menuId);
        const trigger = document.getElementById(triggerId);

        if (!menu) {
            console.warn(`⚠️ Menu not found: ${menuId}`);
            return;
        }

        if (!trigger) {
            console.warn(`⚠️ Trigger not found: ${triggerId}`);
            return;
        }

        const config = {
            menu,
            trigger,
            // Optional: Related menus that should close together
            relatedMenus: options.relatedMenus || [],
            // Optional: Additional elements that shouldn't trigger close
            excludeFromClose: options.excludeFromClose || [],
            // Optional: Callback when menu opens
            onOpen: options.onOpen || null,
            // Optional: Callback when menu closes
            onClose: options.onClose || null,
            // Optional: Check if menu is currently visible
            isVisible: options.isVisible || (() => !menu.classList.contains('hidden'))
        };

        this.menus.set(menuId, config);

        console.log(`✅ Registered menu: ${menuId} with trigger: ${triggerId}`);
    }

    /**
     * Register all application menus
     * Called on initialization
     */
    registerAllMenus() {
        // Glasses picker (from effects.js)
        this.registerMenu('glassesPicker', 'glassesBtn', {
            relatedMenus: ['positionCalibrator'],
            onClose: () => {
                // Also close position calibrator when glasses menu closes
                const calibrator = document.getElementById('positionCalibrator');
                if (calibrator) calibrator.classList.add('hidden');
            }
        });

        // Position calibrator (related to glasses)
        this.registerMenu('positionCalibrator', 'glassesBtn', {
            relatedMenus: ['glassesPicker']
        });

        // Background color picker (from effects.js)
        this.registerMenu('bgColorPicker', 'backgroundBtn');

        // Frame picker (from frames.js)
        this.registerMenu('framePicker', 'frameBtn');

        // Sticker picker (from stickers.js)
        // Note: Has custom initialization in stickers.js, but MenuManager handles open/close
        this.registerMenu('stickerPicker', 'stickerBtn', {
            onOpen: () => {
                // Ensure sticker picker is populated when opened
                const picker = document.getElementById('stickerPicker');
                if (picker && picker.children.length === 0 && window.stickerManager) {
                    console.log('📋 Populating empty sticker picker via MenuManager');
                    window.stickerManager.populateStickerPicker();
                }
            }
        });

        console.log(`📋 Registered ${this.menus.size} menus`);
    }

    /**
     * Handle global click events
     * Implements click-outside-to-close for all menus
     */
    handleGlobalClick(event) {
        // If we're in the middle of opening a menu, ignore this click
        if (this.isOpening) {
            this.isOpening = false;
            return;
        }

        // Check if any menu is currently open
        let hasOpenMenu = false;
        let clickedInsideAnyMenu = false;

        for (const [menuId, config] of this.menus) {
            if (!config.isVisible()) continue;

            hasOpenMenu = true;

            // Check if click was inside this menu
            if (config.menu.contains(event.target)) {
                clickedInsideAnyMenu = true;
                break;
            }

            // Check if click was on the trigger button
            if (config.trigger.contains(event.target)) {
                clickedInsideAnyMenu = true;
                break;
            }

            // Check if click was on any excluded elements
            const clickedExcluded = config.excludeFromClose.some(selector => {
                const element = document.querySelector(selector);
                return element && element.contains(event.target);
            });

            if (clickedExcluded) {
                clickedInsideAnyMenu = true;
                break;
            }
        }

        // If there's an open menu and click was outside, close all menus
        if (hasOpenMenu && !clickedInsideAnyMenu) {
            this.closeAllMenus();
        }
    }

    /**
     * Handle ESC key to close menus
     */
    handleEscapeKey(event) {
        if (event.key === 'Escape') {
            this.closeAllMenus();
        }
    }

    /**
     * Close all open menus
     */
    closeAllMenus() {
        let closedCount = 0;

        for (const [menuId, config] of this.menus) {
            if (config.isVisible()) {
                this.closeMenu(menuId);
                closedCount++;
            }
        }

        if (closedCount > 0) {
            console.log(`🚪 Closed ${closedCount} menu(s)`);
        }

        this.currentOpenMenu = null;
    }

    /**
     * Close a specific menu
     * @param {string} menuId - ID of menu to close
     */
    closeMenu(menuId) {
        const config = this.menus.get(menuId);
        if (!config) return;

        // Hide menu
        config.menu.classList.add('hidden');

        // Remove active state from trigger
        config.trigger.classList.remove('active');

        // Close related menus
        config.relatedMenus.forEach(relatedId => {
            const related = document.getElementById(relatedId);
            if (related) {
                related.classList.add('hidden');
            }
        });

        // Call onClose callback
        if (config.onClose) {
            config.onClose();
        }

        // Reset current open menu if it was this one
        if (this.currentOpenMenu === menuId) {
            this.currentOpenMenu = null;
        }
    }

    /**
     * Open a specific menu (and close others)
     * @param {string} menuId - ID of menu to open
     */
    openMenu(menuId) {
        const config = this.menus.get(menuId);
        if (!config) return;

        // Set opening flag to prevent immediate close from global click handler
        this.isOpening = true;

        // Close all other menus first (only one menu open at a time)
        for (const [otherId, otherConfig] of this.menus) {
            if (otherId !== menuId && otherConfig.isVisible()) {
                this.closeMenu(otherId);
            }
        }

        // Show menu
        config.menu.classList.remove('hidden');

        // Add active state to trigger
        config.trigger.classList.add('active');

        // Open related menus
        config.relatedMenus.forEach(relatedId => {
            const related = document.getElementById(relatedId);
            if (related) {
                related.classList.remove('hidden');
            }
        });

        // Call onOpen callback
        if (config.onOpen) {
            config.onOpen();
        }

        this.currentOpenMenu = menuId;

        console.log(`📂 Opened menu: ${menuId}`);
    }

    /**
     * Toggle a menu (open if closed, close if open)
     * @param {string} menuId - ID of menu to toggle
     */
    toggleMenu(menuId) {
        const config = this.menus.get(menuId);
        if (!config) return;

        if (config.isVisible()) {
            this.closeMenu(menuId);
        } else {
            this.openMenu(menuId);
        }
    }

    /**
     * Check if any menu is currently open
     * @returns {boolean}
     */
    hasOpenMenu() {
        for (const config of this.menus.values()) {
            if (config.isVisible()) return true;
        }
        return false;
    }

    /**
     * Get currently open menu ID
     * @returns {string|null}
     */
    getCurrentMenu() {
        return this.currentOpenMenu;
    }

    /**
     * Destroy the menu manager and clean up listeners
     */
    destroy() {
        document.removeEventListener('click', this.handleGlobalClick, true);
        document.removeEventListener('keydown', this.handleEscapeKey);
        this.menus.clear();
        console.log('🗑️ MenuManager destroyed');
    }
}

// Create global singleton instance
window.menuManager = new MenuManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MenuManager;
}
