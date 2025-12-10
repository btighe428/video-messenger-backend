// Particle Effects System
// Supports confetti, hearts, stars, sparkles for fun, playful video recording

class Particle {
    constructor(x, y, type, config = {}) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 1.0;  // 1.0 = fully alive, 0.0 = dead
        this.alive = true;

        // Physics
        this.vx = config.vx || (Math.random() - 0.5) * 8;
        this.vy = config.vy || (Math.random() - 0.5) * 8 - 2;  // Initial upward bias
        this.rotation = config.rotation || Math.random() * Math.PI * 2;
        this.rotationSpeed = config.rotationSpeed || (Math.random() - 0.5) * 0.2;
        this.gravity = config.gravity !== undefined ? config.gravity : 0.3;
        this.friction = config.friction || 0.98;
        this.size = config.size || (15 + Math.random() * 15);
        this.maxLife = config.maxLife || 120;  // frames
        this.lifeDecay = 1.0 / this.maxLife;

        // Appearance
        this.color = config.color || this.getRandomColor();
        this.shape = config.shape || this.getShapeForType();
        this.scale = 1.0;
        this.wobble = config.wobble || 0;
        this.wobbleSpeed = config.wobbleSpeed || 0.1;
        this.wobbleAmount = config.wobbleAmount || 5;
    }

    getRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
            '#F8B739', '#52B788', '#F72585', '#7209B7'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getShapeForType() {
        switch(this.type) {
            case 'confetti':
                return ['rectangle', 'circle', 'triangle'][Math.floor(Math.random() * 3)];
            case 'heart':
                return 'heart';
            case 'star':
                return 'star';
            case 'sparkle':
                return 'sparkle';
            default:
                return 'circle';
        }
    }

    update() {
        if (!this.alive) return;

        // Apply physics
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;

        this.x += this.vx;
        this.y += this.vy;

        // Apply rotation
        this.rotation += this.rotationSpeed;

        // Apply wobble (for floating effects)
        this.wobble += this.wobbleSpeed;

        // Decay life
        this.life -= this.lifeDecay;
        this.scale = Math.max(0, this.life);  // Shrink as life fades

        // Kill particle if life runs out
        if (this.life <= 0) {
            this.alive = false;
        }
    }

    draw(ctx) {
        if (!this.alive || this.life <= 0) return;

        ctx.save();

        // Apply wobble offset
        const wobbleX = Math.sin(this.wobble) * this.wobbleAmount;
        const wobbleY = Math.cos(this.wobble * 0.5) * this.wobbleAmount * 0.5;

        ctx.translate(this.x + wobbleX, this.y + wobbleY);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        ctx.globalAlpha = this.life;

        // Draw shape based on type
        switch(this.shape) {
            case 'rectangle':
                this.drawRectangle(ctx);
                break;
            case 'circle':
                this.drawCircle(ctx);
                break;
            case 'triangle':
                this.drawTriangle(ctx);
                break;
            case 'heart':
                this.drawHeart(ctx);
                break;
            case 'star':
                this.drawStar(ctx);
                break;
            case 'sparkle':
                this.drawSparkle(ctx);
                break;
        }

        ctx.restore();
    }

    drawRectangle(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
    }

    drawCircle(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    drawTriangle(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.size / 2);
        ctx.lineTo(-this.size / 2, this.size / 2);
        ctx.lineTo(this.size / 2, this.size / 2);
        ctx.closePath();
        ctx.fill();
    }

    drawHeart(ctx) {
        ctx.fillStyle = this.color;
        const size = this.size / 2;

        ctx.beginPath();
        ctx.moveTo(0, size * 0.3);

        // Left curve
        ctx.bezierCurveTo(-size, -size * 0.3, -size * 1.5, size * 0.5, 0, size * 1.5);

        // Right curve
        ctx.bezierCurveTo(size * 1.5, size * 0.5, size, -size * 0.3, 0, size * 0.3);

        ctx.fill();
    }

    drawStar(ctx) {
        ctx.fillStyle = this.color;
        const spikes = 5;
        const outerRadius = this.size / 2;
        const innerRadius = this.size / 4;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
    }

    drawSparkle(ctx) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        const size = this.size / 2;

        // Draw cross sparkle
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.stroke();

        // Draw diagonal lines
        ctx.beginPath();
        ctx.moveTo(-size * 0.7, -size * 0.7);
        ctx.lineTo(size * 0.7, size * 0.7);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.7, -size * 0.7);
        ctx.lineTo(-size * 0.7, size * 0.7);
        ctx.stroke();
    }
}

class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas || this.createCanvas();
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.isActive = false;
        this.animationFrame = null;

        // Settings
        this.enabled = true;
        this.autoFloatingParticles = false;  // Continuous floating particles during recording
        this.floatingInterval = null;

        // Bind methods
        this.update = this.update.bind(this);
    }

    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        return canvas;
    }

    setCanvasSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    // Start the particle system animation loop
    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.update();
    }

    // Stop the particle system
    stop() {
        this.isActive = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.stopFloatingParticles();
    }

    // Update and render all particles
    update() {
        if (!this.isActive) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        this.particles = this.particles.filter(particle => {
            particle.update();
            particle.draw(this.ctx);
            return particle.alive;
        });

        // Continue loop
        this.animationFrame = requestAnimationFrame(this.update);
    }

    // Add a single particle
    addParticle(x, y, type, config) {
        const particle = new Particle(x, y, type, config);
        this.particles.push(particle);
    }

    // Clear all particles
    clear() {
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // === EFFECT TRIGGERS ===

    // Confetti burst - celebration effect
    confettiBurst(x, y, count = 50) {
        if (!this.enabled) return;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 5 + Math.random() * 5;

            this.addParticle(x, y, 'confetti', {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,  // Slight upward bias
                gravity: 0.4,
                friction: 0.98,
                maxLife: 90 + Math.random() * 60,
                size: 10 + Math.random() * 15,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            });
        }
    }

    // Confetti explosion from top of screen (recording start)
    confettiExplosion() {
        if (!this.enabled) return;

        const centerX = this.canvas.width / 2;
        const topY = 0;

        for (let i = 0; i < 80; i++) {
            const spreadX = (Math.random() - 0.5) * this.canvas.width * 0.6;

            this.addParticle(centerX + spreadX, topY, 'confetti', {
                vx: (Math.random() - 0.5) * 6,
                vy: Math.random() * 3 + 2,  // Downward
                gravity: 0.3,
                friction: 0.99,
                maxLife: 120 + Math.random() * 60,
                size: 12 + Math.random() * 18,
                rotationSpeed: (Math.random() - 0.5) * 0.25
            });
        }
    }

    // Floating hearts - romantic/cute effect
    floatingHearts(count = 5) {
        if (!this.enabled) return;

        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.canvas.width;
            const y = this.canvas.height + 50;  // Start below screen

            this.addParticle(x, y, 'heart', {
                vx: (Math.random() - 0.5) * 1,
                vy: -2 - Math.random() * 2,  // Float upward
                gravity: -0.02,  // Negative gravity (float up)
                friction: 0.99,
                maxLife: 150 + Math.random() * 60,
                size: 20 + Math.random() * 20,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.05 + Math.random() * 0.05,
                wobbleAmount: 15,
                color: ['#FF69B4', '#FF1493', '#FF6B6B', '#FFC0CB'][Math.floor(Math.random() * 4)]
            });
        }
    }

    // Floating stars - magical effect
    floatingStars(count = 5) {
        if (!this.enabled) return;

        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.canvas.width;
            const y = this.canvas.height + 50;

            this.addParticle(x, y, 'star', {
                vx: (Math.random() - 0.5) * 1.5,
                vy: -1.5 - Math.random() * 2,
                gravity: -0.02,
                friction: 0.99,
                maxLife: 140 + Math.random() * 60,
                size: 18 + Math.random() * 18,
                rotationSpeed: 0.1 + Math.random() * 0.1,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.06 + Math.random() * 0.06,
                wobbleAmount: 12,
                color: ['#FFD700', '#FFA500', '#FFFF00', '#F7DC6F', '#F8B739'][Math.floor(Math.random() * 5)]
            });
        }
    }

    // Sparkles - quick, snappy effect
    sparkles(x, y, count = 10) {
        if (!this.enabled) return;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 2 + Math.random() * 3;

            this.addParticle(x, y, 'sparkle', {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0,
                friction: 0.95,
                maxLife: 30 + Math.random() * 20,
                size: 15 + Math.random() * 10,
                rotationSpeed: 0.2 + Math.random() * 0.2,
                color: ['#FFFFFF', '#FFD700', '#87CEEB', '#FF69B4'][Math.floor(Math.random() * 4)]
            });
        }
    }

    // Auto-spawn floating particles during recording
    startFloatingParticles() {
        if (this.floatingInterval) return;

        this.autoFloatingParticles = true;

        this.floatingInterval = setInterval(() => {
            if (!this.autoFloatingParticles) return;

            // Randomly spawn hearts or stars
            if (Math.random() > 0.5) {
                this.floatingHearts(2);
            } else {
                this.floatingStars(2);
            }
        }, 1500);  // Every 1.5 seconds
    }

    stopFloatingParticles() {
        this.autoFloatingParticles = false;
        if (this.floatingInterval) {
            clearInterval(this.floatingInterval);
            this.floatingInterval = null;
        }
    }

    // Toggle particles on/off
    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.clear();
        }
        return this.enabled;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ParticleSystem = ParticleSystem;
}
