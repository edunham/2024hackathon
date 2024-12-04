class CPRGame {
    constructor() {
        // Basic game properties
        this.compressionCount = 0;
        this.currentLevel = 1;
        this.lastCompressionTime = 0;
        this.recentCompressions = [];
        this.targetMinRate = 100;
        this.targetMaxRate = 120;
        this.goodCompressions = 0;
        this.maxRate = 150;
        this.inactivityTimer = null;

        // Sound properties
        this.difficulty = 'low';
        this.metronome = null;
        this.crunchSound = null;
        this.isMetronomePlaying = false;

        // Accelerometer properties
        this.lastButtonPressTime = 0;
        this.inCompression = false;
        this.peakThreshold = localStorage.getItem('peakThreshold') ?
            parseFloat(localStorage.getItem('peakThreshold')) : 11;
        this.minTimeBetween = 150;
        this.accelerometerData = [];
        this.detectedCompressions = [];
        this.isDraggingThreshold = false;

        // Canvas setup with proper scaling
        this.graphCanvas = document.getElementById('acceleration-graph');
        this.graphCtx = this.graphCanvas.getContext('2d');
        this.resizeGraphCanvas();

        // DOM elements
        this.target = document.querySelector('.compression-target');
        this.rateIndicator = document.querySelector('.rate-indicator');
        this.rateDisplay = document.getElementById('rate-number');
        this.compressionCounter = document.getElementById('compression-count');
        this.compressionsNeeded = document.getElementById('compressions-needed');
        this.levelDisplay = document.getElementById('current-level');
        this.progressBar = document.querySelector('.progress-fill');
        this.resetButton = document.getElementById('reset-button');
        this.difficultySlider = document.getElementById('difficulty');

        // Initialize
        this.setupAccelerometer();
        this.updateCompressionsNeeded();
        this.setupEventListeners();
        this.setupGraphInteraction();
        this.setupSounds();
        this.updateDisplay();

        this.targetMinRate = 100; // compressions per minute
        this.targetMaxRate = 120;
        this.maxRate = 150;

        // Add new time-based properties
        this.targetMaxSecondsPerCompression = 60 / this.targetMinRate; // 0.6 seconds for 100 bpm
        this.targetMinSecondsPerCompression = 60 / this.targetMaxRate; // 0.5 seconds for 120 bpm


        // Start animation loops
        requestAnimationFrame(() => this.updateRateIndicator());
        this.showOverlay('welcome-overlay');

        // Handle window resize
        window.addEventListener('resize', () => this.resizeGraphCanvas());
    }

    resizeGraphCanvas() {
        const container = this.graphCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.graphCanvas.style.width = '100%';
        this.graphCanvas.style.height = '300px';

        this.graphCanvas.width = rect.width * dpr;
        this.graphCanvas.height = 300 * dpr;

        this.graphCtx.scale(dpr, dpr);
    }
    calculateCurrentRate() {
        if (this.recentCompressions.length < 2) return 0;

        // Calculate average seconds per compression over recent compressions
        const timeSpans = [];
        for (let i = 1; i < this.recentCompressions.length; i++) {
            const secondsBetween = (this.recentCompressions[i] - this.recentCompressions[i - 1]) / 1000;
            timeSpans.push(secondsBetween);
        }

        const avgSecondsPerCompression = timeSpans.reduce((a, b) => a + b) / timeSpans.length;

        // Convert to compressions per minute for display
        return avgSecondsPerCompression > 0 ? 60 / avgSecondsPerCompression : 0;
    }
    setupAccelerometer() {
        if ('Accelerometer' in window) {
            try {
                const accelerometer = new Accelerometer({ frequency: 60 });
                accelerometer.addEventListener('reading', () => {
                    this.handleAccelerometerReading(accelerometer);
                });
                accelerometer.start();
            } catch (error) {
                console.log('Accelerometer error:', error);
            }
        } else if ('DeviceMotionEvent' in window) {
            window.addEventListener('devicemotion', (event) => {
                if (event.accelerationIncludingGravity) {
                    this.handleAccelerometerReading(event.accelerationIncludingGravity);
                }
            });
        }
    }

    setupGraphInteraction() {
        const handleStart = (e) => {
            const rect = this.graphCanvas.getBoundingClientRect();
            const y = (e.clientY || e.touches[0].clientY) - rect.top;
            if (Math.abs(this.accelerationToY(this.peakThreshold) - y) < 10) {
                this.isDraggingThreshold = true;
            }
        };

        const handleMove = (e) => {
            if (!this.isDraggingThreshold) return;
            e.preventDefault();
            const rect = this.graphCanvas.getBoundingClientRect();
            const y = (e.clientY || e.touches[0].clientY) - rect.top;
            this.peakThreshold = Math.max(1, this.yToAcceleration(y));
            localStorage.setItem('peakThreshold', this.peakThreshold.toString());
            this.drawGraph();
        };

        const handleEnd = () => {
            this.isDraggingThreshold = false;
        };

        // Mouse events
        this.graphCanvas.addEventListener('mousedown', handleStart);
        this.graphCanvas.addEventListener('mousemove', handleMove);
        this.graphCanvas.addEventListener('mouseup', handleEnd);
        this.graphCanvas.addEventListener('mouseleave', handleEnd);

        // Touch events
        this.graphCanvas.addEventListener('touchstart', handleStart);
        this.graphCanvas.addEventListener('touchmove', handleMove);
        this.graphCanvas.addEventListener('touchend', handleEnd);
    }

    handleAccelerometerReading(acceleration) {
        const total = Math.sqrt(
            acceleration.x * acceleration.x +
            acceleration.y * acceleration.y +
            acceleration.z * acceleration.z
        );

        const now = Date.now();

        // Clean up old data (keep last 30 seconds)
        const cutoff = now - 30000;
        this.accelerometerData = this.accelerometerData.filter(d => d.timestamp > cutoff);

        this.accelerometerData.push({
            timestamp: now,
            total: total,
            x: acceleration.x,
            y: acceleration.y,
            z: acceleration.z
        });

        // Don't process if button was recently pressed
        if (now - this.lastButtonPressTime < 1000) return;

        if (total > this.peakThreshold &&
            !this.inCompression &&
            now - this.lastCompressionTime > this.minTimeBetween) {

            this.inCompression = true;
            this.flashGreen();
            this.registerCompression(true);
            this.detectedCompressions.push({
                timestamp: now,
                magnitude: total
            });
        }

        if (this.inCompression && total < this.peakThreshold * 0.7) {
            this.inCompression = false;
        }
    }

    drawGraph() {
        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        const padding = 40;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (this.accelerometerData.length < 2) return;

        const maxAcc = Math.max(
            ...this.accelerometerData.map(d => d.total),
            this.peakThreshold + 5
        );
        const minTime = Math.min(...this.accelerometerData.map(d => d.timestamp));
        const maxTime = Math.max(...this.accelerometerData.map(d => d.timestamp));
        const timeRange = maxTime - minTime;

        // Draw grid
        ctx.strokeStyle = '#eee';
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) {
            const y = padding + (i / 5) * (height - 2 * padding);
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
        }
        ctx.stroke();

        // Draw axes
        ctx.strokeStyle = '#666';
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        // Draw y-axis labels
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) {
            const value = (maxAcc * (5 - i) / 5).toFixed(1);
            const y = padding + (i / 5) * (height - 2 * padding);
            ctx.fillText(`${value}`, padding - 5, y);
        }

        // Draw time labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const x = padding + (i / 5) * (width - 2 * padding);
            const time = (-timeRange * (5 - i) / 5 / 1000).toFixed(1);
            ctx.fillText(`${time}s`, x, height - padding + 5);
        }

        // Draw acceleration data
        ctx.beginPath();
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        this.accelerometerData.forEach((point, i) => {
            const x = padding + ((point.timestamp - minTime) / timeRange) * (width - 2 * padding);
            const y = height - padding - (point.total / maxAcc) * (height - 2 * padding);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw detected compressions
        ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
        this.detectedCompressions.forEach(comp => {
            if (comp.timestamp >= minTime && comp.timestamp <= maxTime) {
                const x = padding + ((comp.timestamp - minTime) / timeRange) * (width - 2 * padding);
                ctx.beginPath();
                ctx.arc(x, height - padding - (comp.magnitude / maxAcc) * (height - 2 * padding), 5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Draw threshold line
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const thresholdY = height - padding - (this.peakThreshold / maxAcc) * (height - 2 * padding);
        ctx.moveTo(padding, thresholdY);
        ctx.lineTo(width - padding, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw threshold value
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Threshold: ${this.peakThreshold.toFixed(1)} m/s²`, padding + 10, thresholdY - 5);
    }

    yToAcceleration(y) {
        const height = this.graphCanvas.height / (window.devicePixelRatio || 1);
        const padding = 40;
        const maxAcc = Math.max(...this.accelerometerData.map(d => d.total), 20);
        return maxAcc * (1 - ((y - padding) / (height - 2 * padding)));
    }

    accelerationToY(acceleration) {
        const height = this.graphCanvas.height / (window.devicePixelRatio || 1);
        const padding = 40;
        const maxAcc = Math.max(...this.accelerometerData.map(d => d.total), 20);
        return padding + (height - 2 * padding) * (1 - (acceleration / maxAcc));
    }

    flashGreen() {
        const originalBackground = this.target.style.background;
        this.target.style.background = '#4CAF50';
        setTimeout(() => {
            this.target.style.background = originalBackground;
        }, 150);
    }

    setupSounds() {
        this.metronome = new Audio('metronome.wav');
        this.metronome.loop = true;
        this.crunchSound = new Audio('crunch.wav');
    }

    showOverlay(overlayId) {
        document.querySelectorAll('.overlay').forEach(overlay => {
            overlay.style.display = 'none';
        });
        document.getElementById(overlayId).style.display = 'flex';
    }

    hideOverlays() {
        document.querySelectorAll('.overlay').forEach(overlay => {
            overlay.style.display = 'none';
        });
    }

    startGame() {
        this.hideOverlays();
        this.resetLevel();
        this.startInactivityTimer();
        this.setDifficulty(this.difficultySlider.value === '0' ? 'low' : 'high');
    }

    startInactivityTimer() {
        if (this.inactivityTimer) {
            clearInterval(this.inactivityTimer);
        }
        this.lastCompressionTime = Date.now();
        this.inactivityTimer = setInterval(() => {
            if (Date.now() - this.lastCompressionTime > 30000) {
                this.showOverlay('try-again-overlay');
                clearInterval(this.inactivityTimer);
            }
        }, 1000);
    }

    nextLevel() {
        this.currentLevel++;
        this.updateCompressionsNeeded();
        this.hideOverlays();
        this.resetLevel();
        this.startInactivityTimer();
    }

    restartLevel() {
        this.hideOverlays();
        this.resetLevel();
        this.startInactivityTimer();
    }

    updateCompressionsNeeded() {
        this.compressionsNeeded.textContent = this.compressionsPerLevel;
    }

    get compressionsPerLevel() {
        return this.currentLevel * 30;
    }

    setupEventListeners() {
        const handleCompression = (e) => {
            e.preventDefault();
            this.lastButtonPressTime = Date.now();
            this.registerCompression(false);
        };

        this.target.addEventListener('mousedown', handleCompression);
        this.target.addEventListener('touchstart', handleCompression);
        this.target.addEventListener('mouseup', () => this.target.classList.remove('active'));
        this.target.addEventListener('touchend', () => this.target.classList.remove('active'));
        this.resetButton.addEventListener('click', () => this.resetLevel());

        this.difficultySlider.addEventListener('change', () => {
            this.setDifficulty(this.difficultySlider.value === '0' ? 'low' : 'high');
        });
    }

    setDifficulty(level) {
        this.difficulty = level;

        if (level === 'low') {
            if (!this.isMetronomePlaying) {
                this.metronome.play().catch(e => console.log('Audio not loaded yet'));
                this.isMetronomePlaying = true;
            }
        } else {
            this.metronome.pause();
            this.metronome.currentTime = 0;
            this.isMetronomePlaying = false;
        }
    }

    registerCompression(isAccelerometer) {
        const now = Date.now();
        
        if (!isAccelerometer && now - this.lastCompressionTime < 250) return;
        
        const secondsSinceLastCompression = (now - this.lastCompressionTime) / 1000;
        
        this.lastCompressionTime = now;
        
        if (!isAccelerometer) {
            this.target.classList.add('active');
            if (this.difficulty === 'high') {
                this.crunchSound.currentTime = 0;
                this.crunchSound.play().catch(e => console.log('Audio not loaded yet'));
            }
        }
        
        this.recentCompressions.push(now);
        
        if (this.recentCompressions.length > 3) {
            this.recentCompressions.shift();
        }

        this.compressionCount++;
        
        // Check if compression timing was good
        if (secondsSinceLastCompression >= this.targetMinSecondsPerCompression && 
            secondsSinceLastCompression <= this.targetMaxSecondsPerCompression) {
            this.goodCompressions++;
        }

        this.updateDisplay();

        if (this.compressionCount >= this.compressionsPerLevel) {
            this.completeLevel();
        }
    }

    calculateCurrentRate() {
        if (this.recentCompressions.length < 2) return 0;

        const timeSpan = (this.recentCompressions[this.recentCompressions.length - 1] -
            this.recentCompressions[0]) / 1000;
        const compressionCount = this.recentCompressions.length - 1;

        return (compressionCount / timeSpan) * 60;
    }

    updateRateIndicator() {
        const rate = this.calculateCurrentRate();
        
        // Calculate position based on seconds per compression
        let position;
        if (rate === 0) {
            position = 0;
        } else {
            const secondsPerCompression = 60 / rate;
            // Invert the scale since shorter time = higher rate
            const maxSeconds = 60 / 0; // Infinity
            const minSeconds = 60 / this.maxRate;
            position = 100 - (((secondsPerCompression - minSeconds) / (maxSeconds - minSeconds)) * 100);
        }
        
        position = Math.min(Math.max(position, 0), 100);
        this.rateIndicator.style.left = `${position}%`;
        this.rateDisplay.textContent = Math.round(rate);
        
        requestAnimationFrame(() => this.updateRateIndicator());
    }

    updateDisplay() {
        this.compressionCounter.textContent = this.compressionCount;
        this.levelDisplay.textContent = this.currentLevel;
        this.progressBar.style.width = `${(this.compressionCount / this.compressionsPerLevel) * 100}%`;
    }

    resetLevel() {
        this.compressionCount = 0;
        this.goodCompressions = 0;
        this.recentCompressions = [];
        this.inCompression = false;
        this.lastButtonPressTime = 0;
        this.updateDisplay();
        if (this.inactivityTimer) {
            clearInterval(this.inactivityTimer);
        }
        this.metronome.pause();
        this.metronome.currentTime = 0;
        this.isMetronomePlaying = false;
        this.setDifficulty(this.difficulty);
    }

    completeLevel() {
        if (this.inactivityTimer) {
            clearInterval(this.inactivityTimer);
        }

        try {
            const levelData = {
                level: this.currentLevel,
                totalCompressions: this.compressionCount,
                goodCompressions: this.goodCompressions,
                timestamp: new Date().toISOString()
            };

            localStorage.setItem(`level_${this.currentLevel}`, JSON.stringify(levelData));
        } catch (e) {
            console.log('Unable to save level data:', e);
        }

        document.getElementById('completed-level').textContent = this.currentLevel;
        document.getElementById('avg-rate').textContent = this.rateDisplay.textContent;
        document.getElementById('good-compressions').textContent = this.goodCompressions;

        this.showOverlay('level-complete-overlay');
    }

    shareToTwitter() {
        console.log('Sharing to Twitter...');
    }

    shareToLinkedIn() {
        console.log('Sharing to LinkedIn...');
    }

    shareToFacebook() {
        console.log('Sharing to Facebook...');
    }

    static init() {
        window.game = new CPRGame();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    CPRGame.init();
});