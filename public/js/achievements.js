// Achievement & Unlockables System
// Gamification to encourage engagement and reward creativity

class Achievement {
    constructor(id, name, description, icon, condition, reward) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.icon = icon;
        this.condition = condition; // Function that returns true when unlocked
        this.reward = reward; // { type: 'frame', id: 'spring' }
        this.unlocked = false;
        this.unlockedAt = null;
    }

    check(stats) {
        if (this.unlocked) return false;

        if (this.condition(stats)) {
            this.unlocked = true;
            this.unlockedAt = Date.now();
            return true;
        }

        return false;
    }
}

class AchievementManager {
    constructor(frameManager) {
        this.frameManager = frameManager;
        this.achievements = [];
        this.stats = this.loadStats();

        this.initAchievements();
        this.loadAchievements();
        this.checkAllAchievements();
        this.setupUI();

        console.log('Achievement system initialized');
    }

    setupUI() {
        // Setup achievements button
        const achievementsBtn = document.getElementById('achievementsBtn');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => {
                this.showDashboard();
            });
            this.updateAchievementsCounter();
        }
    }

    updateAchievementsCounter() {
        const counterElem = document.querySelector('.achievements-count');
        if (counterElem) {
            const unlockedCount = this.achievements.filter(a => a.unlocked).length;
            const totalCount = this.achievements.length;
            counterElem.textContent = `${unlockedCount}/${totalCount}`;
        }
    }

    initAchievements() {
        // Recording milestones
        this.achievements.push(new Achievement(
            'first_video',
            'First Steps',
            'Record your first video message',
            '🎬',
            (stats) => stats.videosRecorded >= 1,
            { type: 'confetti', amount: 50 }
        ));

        this.achievements.push(new Achievement(
            'video_enthusiast',
            'Video Enthusiast',
            'Record 10 video messages',
            '🎥',
            (stats) => stats.videosRecorded >= 10,
            { type: 'frame', id: 'doodle' }
        ));

        this.achievements.push(new Achievement(
            'video_master',
            'Video Master',
            'Record 50 video messages',
            '🏆',
            (stats) => stats.videosRecorded >= 50,
            { type: 'frame', id: 'spring' }
        ));

        // Sending milestones
        this.achievements.push(new Achievement(
            'first_send',
            'Messenger',
            'Send your first video message',
            '📮',
            (stats) => stats.videosSent >= 1,
            { type: 'sticker_pack', name: 'celebration' }
        ));

        this.achievements.push(new Achievement(
            'social_butterfly',
            'Social Butterfly',
            'Send 25 video messages',
            '🦋',
            (stats) => stats.videosSent >= 25,
            { type: 'frame', id: 'washi' }
        ));

        // Creative milestones
        this.achievements.push(new Achievement(
            'frame_explorer',
            'Frame Explorer',
            'Try all 5 unlocked frames',
            '🖼️',
            (stats) => stats.framesUsed >= 5,
            { type: 'particle_burst', count: 100 }
        ));

        this.achievements.push(new Achievement(
            'sticker_artist',
            'Sticker Artist',
            'Add 50 stickers across all videos',
            '🎨',
            (stats) => stats.stickersAdded >= 50,
            { type: 'frame', id: 'polaroid' }
        ));

        this.achievements.push(new Achievement(
            'effects_wizard',
            'Effects Wizard',
            'Use glasses, particles, and background removal',
            '🧙',
            (stats) => stats.glassesUsed && stats.particlesUsed && stats.backgroundUsed,
            { type: 'special_frame', id: 'magical' }
        ));

        // Time-based milestones
        this.achievements.push(new Achievement(
            'week_warrior',
            'Week Warrior',
            'Record videos for 7 consecutive days',
            '📅',
            (stats) => this.checkConsecutiveDays(stats, 7),
            { type: 'frame', id: 'winter' }
        ));

        // Seasonal achievements
        this.achievements.push(new Achievement(
            'spring_celebration',
            'Spring Has Sprung',
            'Send a video during spring season',
            '🌸',
            (stats) => this.isSpring(),
            { type: 'frame', id: 'spring' }
        ));
    }

    loadStats() {
        const savedStats = localStorage.getItem('videoMessageStats');
        if (savedStats) {
            return JSON.parse(savedStats);
        }

        // Default stats
        return {
            videosRecorded: 0,
            videosSent: 0,
            stickersAdded: 0,
            framesUsed: 0,
            glassesUsed: false,
            particlesUsed: false,
            backgroundUsed: false,
            recordingDays: [], // Array of timestamps
            totalRecordingTime: 0 // milliseconds
        };
    }

    saveStats() {
        localStorage.setItem('videoMessageStats', JSON.stringify(this.stats));
    }

    loadAchievements() {
        const savedAchievements = localStorage.getItem('achievements');
        if (savedAchievements) {
            const data = JSON.parse(savedAchievements);
            this.achievements.forEach(achievement => {
                const saved = data.find(a => a.id === achievement.id);
                if (saved) {
                    achievement.unlocked = saved.unlocked;
                    achievement.unlockedAt = saved.unlockedAt;
                }
            });
        }
    }

    saveAchievements() {
        const data = this.achievements.map(a => ({
            id: a.id,
            unlocked: a.unlocked,
            unlockedAt: a.unlockedAt
        }));
        localStorage.setItem('achievements', JSON.stringify(data));
    }

    // === STAT TRACKING ===

    incrementVideoRecorded() {
        this.stats.videosRecorded++;
        this.trackDay();
        this.saveStats();
        this.checkAllAchievements();
    }

    incrementVideoSent() {
        this.stats.videosSent++;
        this.saveStats();
        this.checkAllAchievements();
    }

    incrementStickersAdded(count = 1) {
        this.stats.stickersAdded += count;
        this.saveStats();
        this.checkAllAchievements();
    }

    incrementFrameUsed() {
        this.stats.framesUsed++;
        this.saveStats();
        this.checkAllAchievements();
    }

    markEffectUsed(effectType) {
        if (effectType === 'glasses') {
            this.stats.glassesUsed = true;
        } else if (effectType === 'particles') {
            this.stats.particlesUsed = true;
        } else if (effectType === 'background') {
            this.stats.backgroundUsed = true;
        }
        this.saveStats();
        this.checkAllAchievements();
    }

    trackDay() {
        const today = new Date().setHours(0, 0, 0, 0);
        if (!this.stats.recordingDays.includes(today)) {
            this.stats.recordingDays.push(today);
        }
    }

    addRecordingTime(milliseconds) {
        this.stats.totalRecordingTime += milliseconds;
        this.saveStats();
    }

    // === ACHIEVEMENT CHECKING ===

    checkAllAchievements() {
        const newlyUnlocked = [];

        this.achievements.forEach(achievement => {
            if (achievement.check(this.stats)) {
                newlyUnlocked.push(achievement);
                this.applyReward(achievement.reward);
            }
        });

        if (newlyUnlocked.length > 0) {
            this.saveAchievements();
            this.updateAchievementsCounter();
            newlyUnlocked.forEach(achievement => {
                this.showAchievementNotification(achievement);
            });
        }
    }

    applyReward(reward) {
        if (reward.type === 'frame' && this.frameManager) {
            // Unlock frame
            this.frameManager.unlockFrame(reward.id);
            console.log('Frame unlocked:', reward.id);
        } else if (reward.type === 'confetti') {
            // Trigger confetti celebration
            if (window.videoRecorder && window.videoRecorder.particleSystem) {
                window.videoRecorder.particleSystem.confettiBurst(
                    window.innerWidth / 2,
                    window.innerHeight / 2,
                    reward.amount || 50
                );
            }
        } else if (reward.type === 'particle_burst') {
            // Trigger massive particle burst
            if (window.videoRecorder && window.videoRecorder.particleSystem) {
                window.videoRecorder.particleSystem.confettiExplosion();
            }
        }
    }

    showAchievementNotification(achievement) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-content">
                <div class="achievement-title">Achievement Unlocked!</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.description}</div>
            </div>
        `;

        document.body.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 5000);

        // Play achievement sound (if available)
        this.playAchievementSound();
    }

    playAchievementSound() {
        // Simple success beep using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('Audio not available');
        }
    }

    // === HELPER METHODS ===

    checkConsecutiveDays(stats, requiredDays) {
        if (stats.recordingDays.length < requiredDays) return false;

        // Sort days
        const sorted = [...stats.recordingDays].sort((a, b) => a - b);

        // Check for consecutive streak
        let streak = 1;
        for (let i = 1; i < sorted.length; i++) {
            const diff = (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
                streak++;
                if (streak >= requiredDays) return true;
            } else {
                streak = 1;
            }
        }

        return false;
    }

    isSpring() {
        const month = new Date().getMonth();
        return month >= 2 && month <= 4; // March (2) to May (4)
    }

    // === PUBLIC API ===

    getProgress() {
        return {
            stats: this.stats,
            achievements: this.achievements.map(a => ({
                id: a.id,
                name: a.name,
                description: a.description,
                icon: a.icon,
                unlocked: a.unlocked,
                unlockedAt: a.unlockedAt
            })),
            unlockedCount: this.achievements.filter(a => a.unlocked).length,
            totalCount: this.achievements.length
        };
    }

    resetProgress() {
        if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
            localStorage.removeItem('videoMessageStats');
            localStorage.removeItem('achievements');
            this.stats = this.loadStats();
            this.achievements.forEach(a => {
                a.unlocked = false;
                a.unlockedAt = null;
            });
            this.saveStats();
            this.saveAchievements();
            console.log('Progress reset');
        }
    }

    showAchievementsDashboard() {
        const progress = this.getProgress();
        const dashboard = document.createElement('div');
        dashboard.className = 'achievements-dashboard';
        dashboard.innerHTML = `
            <div class="achievements-header">
                <h2>🏆 Achievements</h2>
                <button class="btn-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="achievements-stats">
                <div class="stat-item">
                    <div class="stat-value">${progress.stats.videosRecorded}</div>
                    <div class="stat-label">Videos Recorded</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${progress.stats.videosSent}</div>
                    <div class="stat-label">Videos Sent</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${progress.stats.stickersAdded}</div>
                    <div class="stat-label">Stickers Added</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${progress.unlockedCount}/${progress.totalCount}</div>
                    <div class="stat-label">Achievements</div>
                </div>
            </div>
            <div class="achievements-list">
                ${progress.achievements.map(a => `
                    <div class="achievement-item ${a.unlocked ? 'unlocked' : 'locked'}">
                        <div class="achievement-icon-large">${a.icon}</div>
                        <div class="achievement-info">
                            <div class="achievement-name">${a.name}</div>
                            <div class="achievement-desc">${a.description}</div>
                            ${a.unlocked ? `<div class="achievement-date">Unlocked ${new Date(a.unlockedAt).toLocaleDateString()}</div>` : ''}
                        </div>
                        ${a.unlocked ? '<div class="achievement-badge">✓</div>' : '<div class="achievement-badge">🔒</div>'}
                    </div>
                `).join('')}
            </div>
        `;

        document.body.appendChild(dashboard);

        // Fade in
        setTimeout(() => {
            dashboard.classList.add('show');
        }, 100);

        // Close on background click
        dashboard.addEventListener('click', (e) => {
            if (e.target === dashboard) {
                dashboard.classList.remove('show');
                setTimeout(() => dashboard.remove(), 300);
            }
        });
    }
}

// Export
if (typeof window !== 'undefined') {
    window.AchievementManager = AchievementManager;
}
