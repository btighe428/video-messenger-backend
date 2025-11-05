// Face Effects System with MediaPipe
class FaceEffects {
    constructor() {
        this.canvas = document.getElementById('effectsCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('preview');

        // Create separate canvas for background removal
        this.bgCanvas = document.createElement('canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');

        this.faceMesh = null;
        this.selfieSegmentation = null;
        this.isInitialized = false;
        this.faceLandmarks = null;
        this.segmentationMask = null;

        // Active effects
        this.activeEffects = {
            glasses: false,
            particles: false,
            sparkles: false,
            background: false
        };

        // Background settings
        this.backgroundColor = '#8b5cf6';

        // Glasses settings
        // positionType: 'eyes' = positioned at eye level, 'head' = positioned on forehead/top of head
        this.glassesOptions = [
            { name: 'Red Glasses', path: 'vtube/Red.png', img: null, positionType: 'eyes' },
            { name: 'Deer Antlers 1', path: 'vtube/Deer 1.png', img: null, positionType: 'eyes' },
            { name: 'Deer Antlers 2', path: 'vtube/Deer 2.png', img: null, positionType: 'eyes' },
            { name: 'Santa Hat 1', path: 'vtube/SantaHat1.png', img: null, positionType: 'head' },
            { name: 'Santa Hat 2', path: 'vtube/SantaHat2.png', img: null, positionType: 'head' },
            { name: 'Dwarf Hat', path: 'vtube/DwarfHat.png', img: null, positionType: 'head' },
            { name: 'Xmas Hat 1', path: 'vtube/xmass hat 1.png', img: null, positionType: 'head' },
            { name: 'Xmas Hat 2', path: 'vtube/xmass hat 2.png', img: null, positionType: 'head' },
            { name: 'Xmas Hat 3', path: 'vtube/xmass hat 3.png', img: null, positionType: 'head' },
            { name: 'Xmas Hat 4', path: 'vtube/xmass hat 4.png', img: null, positionType: 'head' },
            { name: 'Tree 1', path: 'vtube/Tree1.png', img: null, positionType: 'head' },
            { name: 'Tree 2', path: 'vtube/Tree2.png', img: null, positionType: 'head' },
            { name: 'Snowman', path: 'vtube/Snowman.png', img: null, positionType: 'head' },
            { name: 'Gingerbread', path: 'vtube/GingerBread.png', img: null, positionType: 'head' }
        ];
        this.selectedGlasses = 0;
        this.positionOffset = 0; // Vertical offset for calibration

        // Particles array
        this.particles = [];
        this.sparkles = [];

        // Animation frame
        this.animationId = null;

        this.init();
    }

    async init() {
        // Wait for video to be ready
        if (!this.video) {
            console.log('Video element not ready, waiting...');
            setTimeout(() => this.init(), 500);
            return;
        }

        // Set up canvas size to match video
        this.video.addEventListener('loadedmetadata', () => {
            this.resizeCanvas();
        });

        // Load glasses images
        await this.loadGlassesImages();

        // Initialize MediaPipe Face Mesh
        await this.initFaceMesh();

        // Initialize MediaPipe Selfie Segmentation
        await this.initSelfieSegmentation();

        // Set up button listeners
        this.setupControls();

        console.log('Face Effects initialized');
    }

    async loadGlassesImages() {
        const loadPromises = this.glassesOptions.map((option, index) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.glassesOptions[index].img = img;
                    console.log(`Loaded glasses [${index}]: ${option.name} from ${option.path}`);
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to load glasses [${index}]: ${option.name} from ${option.path}`);
                    reject();
                };
                img.src = option.path;
            });
        });

        try {
            await Promise.all(loadPromises);
            console.log('All glasses images loaded successfully');
            console.log('Loaded glasses:', this.glassesOptions.map((opt, i) => `[${i}] ${opt.name}: ${opt.img ? 'OK' : 'MISSING'}`));
        } catch (error) {
            console.error('Error loading some glasses images:', error);
        }
    }

    resizeCanvas() {
        const rect = this.video.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.bgCanvas.width = this.video.videoWidth || rect.width;
        this.bgCanvas.height = this.video.videoHeight || rect.height;
    }

    async initFaceMesh() {
        try {
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });

            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.faceMesh.onResults((results) => this.onResults(results));

            this.isInitialized = true;
            console.log('MediaPipe Face Mesh initialized');

            // Start processing
            this.startProcessing();
        } catch (error) {
            console.error('Error initializing Face Mesh:', error);
        }
    }

    async initSelfieSegmentation() {
        try {
            this.selfieSegmentation = new SelfieSegmentation({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                }
            });

            this.selfieSegmentation.setOptions({
                modelSelection: 1, // 0 for general, 1 for landscape
                selfieMode: true
            });

            this.selfieSegmentation.onResults((results) => this.onSegmentationResults(results));

            console.log('MediaPipe Selfie Segmentation initialized');
        } catch (error) {
            console.error('Error initializing Selfie Segmentation:', error);
        }
    }

    async startProcessing() {
        const processFrame = async () => {
            if (this.video && this.video.readyState >= 2) {
                await this.faceMesh.send({ image: this.video });
                if (this.activeEffects.background && this.selfieSegmentation) {
                    await this.selfieSegmentation.send({ image: this.video });
                }
            }

            if (this.isInitialized) {
                this.animationId = requestAnimationFrame(processFrame);
            }
        };

        processFrame();
    }

    onSegmentationResults(results) {
        this.segmentationMask = results.segmentationMask;
        // Render when we get segmentation results
        if (this.activeEffects.background) {
            this.render();
        }
    }

    onResults(results) {
        this.faceLandmarks = results.multiFaceLandmarks;
        this.render();
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background replacement first (behind everything)
        if (this.activeEffects.background && this.segmentationMask) {
            this.drawBackgroundReplacement();
        }

        // If only background effect is active and no face landmarks, still show the background
        if (this.activeEffects.background && this.segmentationMask && (!this.faceLandmarks || this.faceLandmarks.length === 0)) {
            return; // Just show the background without face effects
        }

        if (!this.faceLandmarks || this.faceLandmarks.length === 0) {
            return;
        }

        const landmarks = this.faceLandmarks[0];

        // Draw active effects
        if (this.activeEffects.glasses) {
            this.drawGlasses(landmarks);
        }

        if (this.activeEffects.particles) {
            this.updateAndDrawParticles(landmarks);
        }

        if (this.activeEffects.sparkles) {
            this.updateAndDrawSparkles(landmarks);
        }
    }

    drawBackgroundReplacement() {
        if (!this.video || !this.segmentationMask) return;

        // Set background canvas size to match video
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) return;

        this.bgCanvas.width = videoWidth;
        this.bgCanvas.height = videoHeight;

        // Draw the video frame
        this.bgCtx.drawImage(this.video, 0, 0, videoWidth, videoHeight);

        // Get the image data
        const imageData = this.bgCtx.getImageData(0, 0, videoWidth, videoHeight);
        const data = imageData.data;

        // Get mask dimensions
        const maskWidth = this.segmentationMask.width;
        const maskHeight = this.segmentationMask.height;

        // Apply background color based on segmentation mask
        for (let y = 0; y < videoHeight; y++) {
            for (let x = 0; x < videoWidth; x++) {
                // Map video coordinates to mask coordinates
                const maskX = Math.floor((x / videoWidth) * maskWidth);
                const maskY = Math.floor((y / videoHeight) * maskHeight);
                const maskIndex = maskY * maskWidth + maskX;

                const maskValue = this.segmentationMask.data[maskIndex];

                // If background (maskValue < 0.5), replace with chosen color
                if (maskValue < 0.5) {
                    const pixelIndex = (y * videoWidth + x) * 4;
                    const rgb = this.hexToRgb(this.backgroundColor);
                    data[pixelIndex] = rgb.r;
                    data[pixelIndex + 1] = rgb.g;
                    data[pixelIndex + 2] = rgb.b;
                    // Keep alpha at 255 (data[pixelIndex + 3])
                }
            }
        }

        // Put the modified image back
        this.bgCtx.putImageData(imageData, 0, 0);

        // Draw the result to the main canvas, scaled to fit
        this.ctx.drawImage(this.bgCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 139, g: 92, b: 246 };
    }

    drawGlasses(landmarks) {
        // Log current selection every 60 frames (about once per second)
        if (!this.frameCount) this.frameCount = 0;
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            console.log('Drawing glasses index:', this.selectedGlasses, 'Name:', this.glassesOptions[this.selectedGlasses].name);
        }

        const glassesImage = this.glassesOptions[this.selectedGlasses].img;

        if (!glassesImage) {
            console.warn('Glasses image not loaded yet for index:', this.selectedGlasses);
            return;
        }

        // Get face key points for positioning
        // Nose bridge (between eyes): landmark 168
        // Left temple: landmark 234
        // Right temple: landmark 454
        // Left eye center: landmark 468
        // Right eye center: landmark 473
        // Forehead top: landmark 10

        const toCanvas = (point) => ({
            x: point.x * this.canvas.width,
            y: point.y * this.canvas.height
        });

        const noseBridge = toCanvas(landmarks[168]);
        const leftTemple = toCanvas(landmarks[234]);
        const rightTemple = toCanvas(landmarks[454]);
        const leftEyeCenter = toCanvas(landmarks[468]);
        const rightEyeCenter = toCanvas(landmarks[473]);
        const foreheadTop = toCanvas(landmarks[10]);

        // Calculate face width and position
        const faceWidth = Math.abs(rightTemple.x - leftTemple.x);
        const centerX = (leftTemple.x + rightTemple.x) / 2;
        const eyesY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

        // Scale the image based on face width (increased by 15%)
        // Make it wider than face to ensure coverage
        const imageWidth = faceWidth * 1.725;
        const imageHeight = (glassesImage.height / glassesImage.width) * imageWidth;

        // Position based on accessory type
        const accessoryType = this.glassesOptions[this.selectedGlasses].positionType;
        const imageX = centerX - imageWidth / 2;
        let imageY;

        if (accessoryType === 'head') {
            // Position at forehead/top of head for hats
            imageY = foreheadTop.y - imageHeight * 0.7 + this.positionOffset;
        } else {
            // Position at eye level for glasses/antlers
            imageY = eyesY - imageHeight * 0.45 - 15 + this.positionOffset;
        }

        // Draw the glasses/accessory image
        this.ctx.save();
        this.ctx.drawImage(
            glassesImage,
            imageX,
            imageY,
            imageWidth,
            imageHeight
        );
        this.ctx.restore();

        // Debug: Draw the glasses name on screen occasionally
        if (this.frameCount % 60 === 0) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`Glasses: ${this.glassesOptions[this.selectedGlasses].name}`, 10, 20);
            this.ctx.restore();
        }
    }

    updateAndDrawParticles(landmarks) {
        // Get face bounds
        const noseTip = landmarks[1];
        const faceCenter = {
            x: noseTip.x * this.canvas.width,
            y: noseTip.y * this.canvas.height
        };

        // Add new particles
        if (Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 50;

            this.particles.push({
                x: faceCenter.x + Math.cos(angle) * distance,
                y: faceCenter.y + Math.sin(angle) * distance,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 1.0,
                size: 3 + Math.random() * 4,
                color: `hsl(${250 + Math.random() * 50}, 80%, ${50 + Math.random() * 30}%)`
            });
        }

        // Update and draw particles
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 0.02;

            if (particle.life <= 0) return false;

            this.ctx.save();
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            return true;
        });
    }

    updateAndDrawSparkles(landmarks) {
        // Get eye positions
        const leftEyeCenter = landmarks[468];
        const rightEyeCenter = landmarks[473];

        const eyes = [
            { x: leftEyeCenter.x * this.canvas.width, y: leftEyeCenter.y * this.canvas.height },
            { x: rightEyeCenter.x * this.canvas.width, y: rightEyeCenter.y * this.canvas.height }
        ];

        // Add new sparkles
        if (Math.random() < 0.2) {
            const eye = eyes[Math.floor(Math.random() * eyes.length)];
            const offset = 30;

            this.sparkles.push({
                x: eye.x + (Math.random() - 0.5) * offset,
                y: eye.y + (Math.random() - 0.5) * offset,
                size: 0,
                maxSize: 8 + Math.random() * 8,
                life: 1.0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }

        // Update and draw sparkles
        this.sparkles = this.sparkles.filter(sparkle => {
            sparkle.life -= 0.03;
            sparkle.rotation += sparkle.rotationSpeed;

            if (sparkle.life > 0.7) {
                sparkle.size = (1 - sparkle.life) / 0.3 * sparkle.maxSize;
            } else {
                sparkle.size = sparkle.life / 0.7 * sparkle.maxSize;
            }

            if (sparkle.life <= 0) return false;

            this.drawStar(sparkle.x, sparkle.y, 4, sparkle.size, sparkle.size * 0.5, sparkle.rotation, sparkle.life);

            return true;
        });
    }

    drawStar(x, y, spikes, outerRadius, innerRadius, rotation, alpha) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);
        this.ctx.globalAlpha = alpha;

        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#ffd700');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();

        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI / spikes) * i;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;

            if (i === 0) {
                this.ctx.moveTo(px, py);
            } else {
                this.ctx.lineTo(px, py);
            }
        }

        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    setupControls() {
        const glassesBtn = document.getElementById('glassesBtn');
        const particlesBtn = document.getElementById('particlesBtn');
        const sparklesBtn = document.getElementById('sparklesBtn');
        const glassesPicker = document.getElementById('glassesPicker');
        const glassesOptions = document.querySelectorAll('.glasses-option');

        const positionCalibrator = document.getElementById('positionCalibrator');
        const moveUpBtn = document.getElementById('moveUpBtn');
        const moveDownBtn = document.getElementById('moveDownBtn');
        const offsetDisplay = document.getElementById('offsetDisplay');

        glassesBtn.addEventListener('click', () => {
            this.activeEffects.glasses = !this.activeEffects.glasses;
            glassesBtn.classList.toggle('active');

            // Show/hide glasses picker and calibrator
            if (this.activeEffects.glasses) {
                glassesPicker.classList.remove('hidden');
                positionCalibrator.classList.remove('hidden');
            } else {
                glassesPicker.classList.add('hidden');
                positionCalibrator.classList.add('hidden');
            }
        });

        // Position calibrator controls
        moveUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.positionOffset -= 5;
            offsetDisplay.textContent = this.positionOffset;
        });

        moveDownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.positionOffset += 5;
            offsetDisplay.textContent = this.positionOffset;
        });

        // Glasses picker options
        glassesOptions.forEach((option, index) => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent drag handler from interfering
                console.log('=== GLASSES CLICK EVENT ===');
                console.log('Clicked option index:', index);
                console.log('Dataset glasses value:', option.dataset.glasses);
                console.log('Before change - selectedGlasses:', this.selectedGlasses);

                // Remove selected from all
                glassesOptions.forEach(opt => opt.classList.remove('selected'));
                // Add selected to clicked
                option.classList.add('selected');

                // Update selected glasses
                const newIndex = parseInt(option.dataset.glasses);
                this.selectedGlasses = newIndex;

                console.log('After change - selectedGlasses:', this.selectedGlasses);
                console.log('Selected glasses name:', this.glassesOptions[this.selectedGlasses].name);
                console.log('Image loaded?:', this.glassesOptions[this.selectedGlasses].img ? 'YES' : 'NO');
                console.log('========================');
            }, true); // Use capture phase
        });

        // Set default selected glasses
        if (glassesOptions.length > 0) {
            glassesOptions[0].classList.add('selected');
        }
        console.log('Glasses picker initialized with', glassesOptions.length, 'options');

        // Add test function to window for manual testing
        window.testGlassesSelection = (index) => {
            console.log('Manual test - setting glasses to index:', index);
            this.selectedGlasses = index;
            console.log('selectedGlasses is now:', this.selectedGlasses);
        };

        particlesBtn.addEventListener('click', () => {
            this.activeEffects.particles = !this.activeEffects.particles;
            particlesBtn.classList.toggle('active');
            if (!this.activeEffects.particles) {
                this.particles = [];
            }
        });

        sparklesBtn.addEventListener('click', () => {
            this.activeEffects.sparkles = !this.activeEffects.sparkles;
            sparklesBtn.classList.toggle('active');
            if (!this.activeEffects.sparkles) {
                this.sparkles = [];
            }
        });

        const backgroundBtn = document.getElementById('backgroundBtn');
        const bgColorPicker = document.getElementById('bgColorPicker');
        const colorOptions = document.querySelectorAll('.color-option');
        const videoFrame = document.querySelector('.video-frame');

        backgroundBtn.addEventListener('click', () => {
            this.activeEffects.background = !this.activeEffects.background;
            backgroundBtn.classList.toggle('active');

            // Show/hide color picker and toggle video visibility
            if (this.activeEffects.background) {
                bgColorPicker.classList.remove('hidden');
                videoFrame.classList.add('bg-active');
            } else {
                bgColorPicker.classList.add('hidden');
                videoFrame.classList.remove('bg-active');
                this.segmentationMask = null;
            }
        });

        // Color picker options
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove selected from all
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                // Add selected to clicked
                option.classList.add('selected');
                // Update background color
                this.backgroundColor = option.dataset.color;
            });
        });

        // Set default selected color
        colorOptions[0].classList.add('selected');
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.faceMesh) {
            this.faceMesh.close();
        }
        if (this.selfieSegmentation) {
            this.selfieSegmentation.close();
        }
    }
}

// Initialize effects when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for video to initialize
    setTimeout(() => {
        window.faceEffects = new FaceEffects();
    }, 1000);
});
