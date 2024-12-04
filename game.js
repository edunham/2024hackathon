class CPRGame {
    constructor() {
        // Existing properties
        this.compressionCount = 0;
        this.currentLevel = 1;
        this.lastCompressionTime = 0;
        this.recentCompressions = [];
        this.targetMinRate = 100;
        this.targetMaxRate = 120;
        this.goodCompressions = 0;
        this.maxRate = 150;
        this.inactivityTimer = null;

        // Accelerometer properties
        this.lastButtonPressTime = 0;
        this.inCompression = false;
        this.peakThreshold = 11;
        this.minTimeBetween = 150;

        // Sound properties
        this.difficulty = 'low';
        this.metronome = null;
        this.crunchSound = null;
        this.isMetronomePlaying = false;

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
        this.setupSounds();
        this.updateDisplay();
        requestAnimationFrame(() => this.updateRateIndicator());
        
        // Start with welcome overlay
        this.showOverlay('welcome-overlay');
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

    handleAccelerometerReading(acceleration) {
        const total = Math.sqrt(
            acceleration.x * acceleration.x + 
            acceleration.y * acceleration.y + 
            acceleration.z * acceleration.z
        );

        const now = Date.now();
        
        // Don't process accelerometer for 1 second after button press
        if (now - this.lastButtonPressTime < 1000) {
            return;
        }

        if (total > this.peakThreshold && 
            !this.inCompression && 
            now - this.lastCompressionTime > this.minTimeBetween) {
            
            this.inCompression = true;
            this.flashGreen();
            this.registerCompression(true);
        }
        
        if (this.inCompression && total < this.peakThreshold * 0.7) {
            this.inCompression = false;
        }
    }

    flashGreen() {
        const originalBackground = this.target.style.background;
        this.target.style.background = '#4CAF50';
        setTimeout(() => {
            this.target.style.background = originalBackground;
        }, 150);
    }

    get compressionsPerLevel() {
        return this.currentLevel * 30;
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
        
        const currentRate = this.calculateCurrentRate();
        if (currentRate >= this.targetMinRate && currentRate <= this.targetMaxRate) {
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
        const position = Math.min(Math.max((rate / this.maxRate) * 100, 0), 100);
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