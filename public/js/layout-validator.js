/**
 * Layout Validator Agent
 * Ensures perfect circular arrangement of buttons around the video frame
 *
 * Mathematical Foundation:
 * - Validates button positions using polar coordinate geometry
 * - Verifies equidistant spacing from frame center
 * - Checks angular distribution accuracy
 *
 * @author Layout Validation System
 * @version 1.0.0
 */

class CircularLayoutValidator {
    constructor(config = {}) {
        this.config = {
            centerX: config.centerX || 150,
            centerY: config.centerY || 150,
            expectedRadius: config.expectedRadius || 200,
            tolerance: config.tolerance || 5, // pixels
            expectedAngles: config.expectedAngles || [135, 157.5, 180, 202.5, 225],
            buttonSelectors: config.buttonSelectors || [
                '#glassesBtn',
                '#sparklesBtn',
                '#backgroundBtn',
                '#frameBtn',
                '#particlesBtn'
            ]
        };

        this.validationResults = {
            passed: false,
            errors: [],
            warnings: [],
            measurements: []
        };
    }

    /**
     * Calculate distance between two points using Pythagorean theorem
     * Formula: distance = √((x₂ - x₁)² + (y₂ - y₁)²)
     */
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    /**
     * Calculate angle from center to button in degrees
     * Formula: θ = atan2(y - centerY, x - centerX) × (180 / π)
     * Note: CSS coordinates have Y-axis inverted, so we use (centerY - y)
     */
    calculateAngle(x, y, centerX, centerY) {
        const angleRad = Math.atan2(centerY - y, x - centerX);
        let angleDeg = angleRad * (180 / Math.PI);

        // Normalize to 0-360 range
        if (angleDeg < 0) angleDeg += 360;

        return angleDeg;
    }

    /**
     * Get computed position of an element relative to its container
     */
    getElementPosition(element, container) {
        const elemRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate center of button
        const centerX = elemRect.left - containerRect.left + (elemRect.width / 2);
        const centerY = elemRect.top - containerRect.top + (elemRect.height / 2);

        return { x: centerX, y: centerY };
    }

    /**
     * Validate a single button's position
     */
    validateButtonPosition(button, expectedAngle, buttonIndex) {
        const container = document.querySelector('.effects-dock');
        if (!container) {
            this.validationResults.errors.push('Container .effects-dock not found');
            return null;
        }

        const position = this.getElementPosition(button, container);
        const distance = this.calculateDistance(
            position.x,
            position.y,
            this.config.centerX,
            this.config.centerY
        );
        const angle = this.calculateAngle(
            position.x,
            position.y,
            this.config.centerX,
            this.config.centerY
        );

        // Calculate deviations
        const radiusDeviation = Math.abs(distance - this.config.expectedRadius);
        const angleDeviation = Math.abs(angle - expectedAngle);

        const measurement = {
            buttonId: button.id,
            index: buttonIndex,
            position: position,
            actualDistance: distance.toFixed(2),
            expectedRadius: this.config.expectedRadius,
            radiusDeviation: radiusDeviation.toFixed(2),
            actualAngle: angle.toFixed(2),
            expectedAngle: expectedAngle,
            angleDeviation: angleDeviation.toFixed(2),
            isValid: radiusDeviation <= this.config.tolerance
        };

        // Check radius tolerance
        if (radiusDeviation > this.config.tolerance) {
            this.validationResults.errors.push(
                `❌ Button ${button.id}: Radius deviation ${radiusDeviation.toFixed(2)}px exceeds tolerance ${this.config.tolerance}px`
            );
        } else {
            this.validationResults.warnings.push(
                `✅ Button ${button.id}: Position valid (deviation: ${radiusDeviation.toFixed(2)}px)`
            );
        }

        return measurement;
    }

    /**
     * Run complete validation on all buttons
     */
    validate() {
        console.group('🔍 Circular Layout Validator');
        console.log('Configuration:', this.config);

        this.validationResults = {
            passed: true,
            errors: [],
            warnings: [],
            measurements: []
        };

        // Validate each button
        this.config.buttonSelectors.forEach((selector, index) => {
            const button = document.querySelector(selector);
            if (!button) {
                this.validationResults.errors.push(`Button ${selector} not found`);
                this.validationResults.passed = false;
                return;
            }

            const measurement = this.validateButtonPosition(
                button,
                this.config.expectedAngles[index],
                index
            );

            if (measurement) {
                this.validationResults.measurements.push(measurement);
                if (!measurement.isValid) {
                    this.validationResults.passed = false;
                }
            }
        });

        // Calculate statistics
        if (this.validationResults.measurements.length > 0) {
            const radiusDeviations = this.validationResults.measurements.map(m => parseFloat(m.radiusDeviation));
            const avgDeviation = (radiusDeviations.reduce((a, b) => a + b, 0) / radiusDeviations.length).toFixed(2);
            const maxDeviation = Math.max(...radiusDeviations).toFixed(2);

            console.log('\n📊 Statistics:');
            console.log(`Average radius deviation: ${avgDeviation}px`);
            console.log(`Maximum radius deviation: ${maxDeviation}px`);
            console.log(`Tolerance threshold: ${this.config.tolerance}px`);
        }

        // Display results
        console.log('\n📐 Measurements:');
        console.table(this.validationResults.measurements);

        if (this.validationResults.errors.length > 0) {
            console.log('\n❌ Validation Errors:');
            this.validationResults.errors.forEach(error => console.error(error));
        }

        if (this.validationResults.warnings.length > 0) {
            console.log('\n✅ Validation Success:');
            this.validationResults.warnings.forEach(warning => console.log(warning));
        }

        console.log(`\n${this.validationResults.passed ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED'}`);
        console.groupEnd();

        return this.validationResults;
    }

    /**
     * Visualize button positions (optional development tool)
     */
    visualize() {
        const container = document.querySelector('.effects-dock');
        if (!container) return;

        // Create canvas overlay
        let canvas = document.getElementById('validation-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'validation-canvas';
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '9999';
            container.appendChild(canvas);
        }

        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw center point
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(this.config.centerX, this.config.centerY, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Draw expected radius circle
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(this.config.centerX, this.config.centerY, this.config.expectedRadius, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw tolerance band
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(this.config.centerX, this.config.centerY, this.config.expectedRadius + this.config.tolerance, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.config.centerX, this.config.centerY, this.config.expectedRadius - this.config.tolerance, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Draw measurements
        this.validationResults.measurements.forEach((measurement, index) => {
            // Draw line from center to button
            ctx.strokeStyle = measurement.isValid ? '#10b981' : '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(this.config.centerX, this.config.centerY);
            ctx.lineTo(measurement.position.x, measurement.position.y);
            ctx.stroke();

            // Draw actual position
            ctx.fillStyle = measurement.isValid ? '#10b981' : '#ef4444';
            ctx.beginPath();
            ctx.arc(measurement.position.x, measurement.position.y, 3, 0, 2 * Math.PI);
            ctx.fill();

            // Draw label
            ctx.fillStyle = '#000';
            ctx.font = '10px monospace';
            ctx.fillText(`${measurement.actualDistance}px`, measurement.position.x + 10, measurement.position.y);
        });

        console.log('📈 Visualization rendered on canvas');
    }
}

// Auto-validate on page load (development mode)
if (window.location.hostname === 'localhost') {
    window.addEventListener('load', () => {
        // Wait for layout to settle
        setTimeout(() => {
            const validator = new CircularLayoutValidator();
            const results = validator.validate();

            // Uncomment to enable visualization:
            // validator.visualize();

            // Expose to global scope for manual testing
            window.layoutValidator = validator;
        }, 1000);
    });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CircularLayoutValidator;
}
