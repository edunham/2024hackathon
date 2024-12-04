class CPRGame {
    constructor() {
        this.compressionCount = 0;
        this.currentLevel = 1;
        this.lastCompressionTime = 0;
        this.recentCompressions = [];
        this.targetMinRate = 100;
        this.targetMaxRate = 120;
        this.goodCompressions = 0;
        this.maxRate = 150;
        this.inactivityTimer = null;

        // DOM elements
        this.target = document.querySelector('.compression-target');
        this.rateIndicator = document.querySelector('.rate-indicator');
        this.rateDisplay = document.getElementById('rate-number');
        this.compressionCounter = document.getElementById('compression-count');
        this.compressionsNeeded = document.getElementById('compressions-needed');
        this.levelDisplay = document.getElementById('current-level');
        this.progressBar = document.querySelector('.progress-fill');
        this.resetButton = document.getElementById('reset-button');

        // Initialize
        this.updateCompressionsNeeded();
        this.setupEventListeners();
        this.updateDisplay();
        requestAnimationFrame(() => this.updateRateIndicator());
        
        // Start with welcome overlay
        this.showOverlay('welcome-overlay');
    }

    get compressionsPerLevel() {
        return this.currentLevel * 30;
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
            this.registerCompression();
        };

        this.target.addEventListener('mousedown', handleCompression);
        this.target.addEventListener('touchstart', handleCompression);
        
        this.target.addEventListener('mouseup', () => this.target.classList.remove('active'));
        this.target.addEventListener('touchend', () => this.target.classList.remove('active'));

        this.resetButton.addEventListener('click', () => this.resetLevel());
    }

    registerCompression() {
        const now = Date.now();
        
        // Check debounce before updating lastCompressionTime
        if (now - this.lastCompressionTime < 250) return;
        
        // Update the compression time for both compression tracking and inactivity timer
        this.lastCompressionTime = now;
        
        // Add active class for animation
        this.target.classList.add('active');
        
        // Track compression
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
        this.updateDisplay();
        if (this.inactivityTimer) {
            clearInterval(this.inactivityTimer);
        }
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

        // Update completion overlay
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
}

// Start the game when the page loads
window.addEventListener('load', () => {
    window.game = new CPRGame();
});