// ============================================================
// AI Magic AR Hands - Main Application
// ============================================================

class App {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.video = document.getElementById('video');

        // Three.js core
        this.scene = null;
        this.camera3d = null;
        this.renderer = null;

        // Managers
        this.cameraManager = null;
        this.handTracker = null;
        this.gestureManager = null;
        this.particleSystem = null;
        this.effectsManager = null;

        // State
        this.mode = 'air-screen';
        this.color = new THREE.Color('#00ff88');
        this.particleCount = 500;
        this.speed = 1.0;
        this.brightness = 1.0;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRunning = false;

        // Timing
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fpsTime = 0;
        this.fps = 0;

        // Video texture for background
        this.videoTexture = null;
        this.backgroundMesh = null;

        this.init();
    }

    async init() {
        this.showLoading('Initializing...');

        try {
            this.setupThree();
            await this.setupCamera();
            this.setupBackground();
            this.setupHandTracking();
            this.setupParticles();
            this.setupEffects();
            this.setupUI();
            this.isRunning = true;
            this.hideLoading();
            this.animate();
        } catch (err) {
            console.error('Init error:', err);
            this.showError('Failed to initialize. Please allow camera access and refresh.');
        }
    }

    // ─── THREE.JS SETUP ───────────────────────────────────────

    setupThree() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.scene = new THREE.Scene();

        this.camera3d = new THREE.PerspectiveCamera(60, w / h, 0.01, 1000);
        this.camera3d.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);

        window.addEventListener('resize', () => this.onResize());
    }

    setupBackground() {
        this.videoTexture = new THREE.VideoTexture(this.video);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;

        const aspect = window.innerWidth / window.innerHeight;
        const geo = new THREE.PlaneGeometry(14 * aspect, 14);
        const mat = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            depthWrite: false
        });

        this.backgroundMesh = new THREE.Mesh(geo, mat);
        this.backgroundMesh.position.z = -5;
        // Mirror horizontally (selfie view)
        this.backgroundMesh.scale.x = -1;
        this.scene.add(this.backgroundMesh);
    }

    // ─── CAMERA SETUP ─────────────────────────────────────────

    async setupCamera() {
        this.cameraManager = new CameraManager();
        await this.cameraManager.initialize();
    }

    // ─── HAND TRACKING ────────────────────────────────────────

    setupHandTracking() {
        this.handTracker = new HandTracker();
        this.gestureManager = new GestureManager(this.handTracker);
    }

    // ─── PARTICLES ────────────────────────────────────────────

    setupParticles() {
        this.particleSystem = new ParticleSystem(this.scene, this.particleCount);
    }

    // ─── EFFECTS ──────────────────────────────────────────────

    setupEffects() {
        this.effectsManager = new EffectsManager(this.scene, this.camera3d, this.renderer);
    }

    // ─── UI ───────────────────────────────────────────────────

    setupUI() {
        // Mode select
        document.getElementById('modeSelect').addEventListener('change', (e) => {
            this.mode = e.target.value;
            this.effectsManager.setMode(this.mode);
            this.particleSystem.clear();
        });

        // Color buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const hex = btn.dataset.color;
                this.color = new THREE.Color(hex);
                this.effectsManager.setColor(hex);
            });
        });

        // Particle count
        const pcSlider = document.getElementById('particleCount');
        pcSlider.addEventListener('input', (e) => {
            this.particleCount = parseInt(e.target.value);
            document.getElementById('particleCountValue').textContent = this.particleCount;
            this.particleSystem.dispose();
            this.particleSystem = new ParticleSystem(this.scene, this.particleCount);
        });

        // Speed
        const speedSlider = document.getElementById('speed');
        speedSlider.addEventListener('input', (e) => {
            this.speed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = this.speed.toFixed(1);
            this.effectsManager.setSpeed(this.speed);
        });

        // Brightness
        const brightnessSlider = document.getElementById('brightness');
        brightnessSlider.addEventListener('input', (e) => {
            this.brightness = parseFloat(e.target.value);
            document.getElementById('brightnessValue').textContent = this.brightness.toFixed(1);
            this.effectsManager.setBrightness(this.brightness);
        });

        // Quality
        document.getElementById('qualitySelect').addEventListener('change', (e) => {
            const q = e.target.value;
            const pixelRatio = q === 'low' ? 0.5 : q === 'medium' ? 1 : Math.min(window.devicePixelRatio, 2);
            this.renderer.setPixelRatio(pixelRatio);
        });

        // Screenshot
        document.getElementById('screenshotBtn').addEventListener('click', () => {
            this.takeScreenshot();
        });

        // Record
        document.getElementById('recordBtn').addEventListener('click', () => {
            this.toggleRecording();
        });

        // Fullscreen
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                document.body.classList.add('fullscreen');
            } else {
                document.exitFullscreen();
                document.body.classList.remove('fullscreen');
            }
        });

        // Reset
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.particleSystem.clear();
            this.effectsManager.clearObjects();
            this.effectsManager.setMode(this.mode);
        });
    }

    // ─── MAIN LOOP ────────────────────────────────────────────

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const deltaTime = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;

        // FPS
        this.frameCount++;
        this.fpsTime += deltaTime;
        if (this.fpsTime >= 0.5) {
            this.fps = Math.round(this.frameCount / this.fpsTime);
            this.frameCount = 0;
            this.fpsTime = 0;
        }

        this.update(deltaTime);
        this.render();
        this.updateUI();
    }

    update(deltaTime) {
        // Update video texture
        if (this.videoTexture) {
            this.videoTexture.needsUpdate = true;
        }

        // Process hand tracking
        if (this.handTracker && this.handTracker.isReady && this.video.readyState >= 2) {
            this.handTracker.process(this.video);
            this.gestureManager.update();
        }

        // Update effects
        if (this.effectsManager) {
            this.effectsManager.update(deltaTime, this.handTracker);
        }

        // Update particles based on hands
        this.updateParticles(deltaTime);

        // Update particles system
        if (this.particleSystem) {
            this.particleSystem.update(deltaTime);
        }
    }

    updateParticles(deltaTime) {
        if (!this.handTracker) return;
        const hands = this.handTracker.getHands();

        hands.forEach(hand => {
            const wrist = this.handTracker.getWrist(hand.id);
            if (!wrist) return;

            // Convert normalized coords to world space
            const x = (wrist.x - 0.5) * 8;
            const y = -(wrist.y - 0.5) * 6;
            const z = 0;

            const position = new THREE.Vector3(x, y, z);

            const emitCount = this.getEmitCount();
            const particleColor = this.color.clone();
            particleColor.multiplyScalar(this.brightness);

            const gesture = this.gestureManager.getLastGesture();
            const velocity = this.getParticleVelocity(gesture);
            const size = this.getParticleSize(gesture);
            const life = this.getParticleLife(gesture);

            this.particleSystem.emit(position, velocity, particleColor, emitCount, size, life);

            // Add fingertip particles for non-fist gestures
            if (gesture !== 'CLOSED_FIST') {
                const tips = [
                    this.handTracker.getIndexFingerTip(hand.id),
                    this.handTracker.getMiddleFingerTip(hand.id),
                ];
                tips.forEach(tip => {
                    if (!tip) return;
                    const tx = (tip.x - 0.5) * 8;
                    const ty = -(tip.y - 0.5) * 6;
                    const tPos = new THREE.Vector3(tx, ty, 0);
                    const tVel = new THREE.Vector3(
                        (Math.random() - 0.5) * 3,
                        (Math.random() - 0.5) * 3 + 1,
                        (Math.random() - 0.5) * 2
                    );
                    this.particleSystem.emit(tPos, tVel, particleColor, 2, size * 0.5, life * 0.5);
                });
            }
        });
    }

    getEmitCount() {
        const base = Math.floor(this.particleCount / 100);
        switch (this.mode) {
            case 'fire': return base * 3;
            case 'lightning': return base * 2;
            case 'doctor-strange': return base * 2;
            default: return base;
        }
    }

    getParticleVelocity(gesture) {
        switch (this.mode) {
            case 'fire':
                return new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 4 + 1,
                    (Math.random() - 0.5) * 1
                ).multiplyScalar(this.speed);
            case 'lightning':
                return new THREE.Vector3(
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 2
                ).multiplyScalar(this.speed);
            case 'telekinesis':
                return new THREE.Vector3(
                    (Math.random() - 0.5) * 1,
                    (Math.random() - 0.5) * 1,
                    (Math.random() - 0.5) * 3
                ).multiplyScalar(this.speed);
            default:
                return new THREE.Vector3(
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 2
                ).multiplyScalar(this.speed);
        }
    }

    getParticleSize(gesture) {
        if (gesture === 'OPEN_PALM') return 12 * this.brightness;
        if (gesture === 'PINCH') return 4 * this.brightness;
        if (gesture === 'VICTORY') return 8 * this.brightness;
        switch (this.mode) {
            case 'fire': return 10 * this.brightness;
            case 'lightning': return 6 * this.brightness;
            default: return 7 * this.brightness;
        }
    }

    getParticleLife(gesture) {
        switch (this.mode) {
            case 'fire': return 0.8 * this.speed;
            case 'lightning': return 0.3 * this.speed;
            case 'doctor-strange': return 1.5;
            default: return 1.0;
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera3d);
    }

    updateUI() {
        document.getElementById('fps').textContent = `FPS: ${this.fps}`;
        document.getElementById('performanceText').textContent =
            `FPS: ${this.fps} | Particles: ${this.particleSystem ? this.particleSystem.particles.length : 0} | Hands: ${this.handTracker ? this.handTracker.getHands().length : 0}`;

        const hands = this.handTracker ? this.handTracker.getHands() : [];
        document.getElementById('handStatus').textContent =
            hands.length > 0 ? `Hands: ${hands.map(h => h.handedness).join(', ')}` : 'Hands: None';

        const gesture = this.gestureManager ? this.gestureManager.getLastGesture() : null;
        document.getElementById('gestureStatus').textContent = `Gesture: ${gesture || 'None'}`;

        // Gesture overlay
        const overlay = document.getElementById('gestureOverlay');
        if (gesture) {
            overlay.textContent = gesture.replace('_', ' ');
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    // ─── UTILITIES ────────────────────────────────────────────

    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera3d.aspect = w / h;
        this.camera3d.updateProjectionMatrix();
        this.renderer.setSize(w, h);

        if (this.backgroundMesh) {
            const aspect = w / h;
            this.backgroundMesh.scale.x = -1;
            this.backgroundMesh.geometry = new THREE.PlaneGeometry(14 * aspect, 14);
        }
    }

    takeScreenshot() {
        this.renderer.render(this.scene, this.camera3d);
        const dataURL = this.canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `magic-hands-${Date.now()}.png`;
        a.click();
    }

    toggleRecording() {
        const btn = document.getElementById('recordBtn');
        if (!this.isRecording) {
            const stream = this.canvas.captureStream(30);
            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.recordedChunks.push(e.data);
            };
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `magic-hands-${Date.now()}.webm`;
                a.click();
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            btn.textContent = '⏹ Stop';
            btn.style.background = 'rgba(255, 0, 0, 0.3)';
            btn.style.borderColor = '#ff0000';
            btn.style.color = '#ff0000';
        } else {
            this.mediaRecorder.stop();
            this.isRecording = false;
            btn.textContent = '⏹ Record';
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    }

    showLoading(msg) {
        let el = document.getElementById('loadingOverlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'loadingOverlay';
            el.style.cssText = `
                position:fixed;top:0;left:0;width:100%;height:100%;
                background:rgba(10,14,39,0.95);display:flex;flex-direction:column;
                align-items:center;justify-content:center;z-index:9999;
                font-family:'Courier New',monospace;color:#00ff88;
            `;
            el.innerHTML = `
                <div style="font-size:24px;margin-bottom:20px;text-shadow:0 0 20px #00ff88;">✨ AI MAGIC HANDS ✨</div>
                <div id="loadingMsg" style="font-size:14px;opacity:0.8;">${msg}</div>
                <div style="margin-top:30px;width:200px;height:2px;background:rgba(0,255,136,0.2);border-radius:1px;">
                    <div id="loadingBar" style="width:0%;height:100%;background:#00ff88;border-radius:1px;transition:width 0.3s;box-shadow:0 0 10px #00ff88;"></div>
                </div>
                <div style="margin-top:20px;font-size:11px;opacity:0.5;">Allow camera access when prompted</div>
            `;
            document.body.appendChild(el);
        } else {
            document.getElementById('loadingMsg').textContent = msg;
        }
    }

    hideLoading() {
        const bar = document.getElementById('loadingBar');
        if (bar) bar.style.width = '100%';
        setTimeout(() => {
            const el = document.getElementById('loadingOverlay');
            if (el) {
                el.style.transition = 'opacity 0.5s';
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 500);
            }
        }, 400);
    }

    showError(msg) {
        this.showLoading('');
        const msgEl = document.getElementById('loadingMsg');
        if (msgEl) {
            msgEl.textContent = msg;
            msgEl.style.color = '#ff4444';
        }
    }
}

// ─── BOOT ─────────────────────────────────────────────────────

let app;

function waitForLibs(callback, tries = 0) {
    if (typeof THREE !== 'undefined' && typeof Hands !== 'undefined') {
        callback();
    } else if (tries < 100) {
        setTimeout(() => waitForLibs(callback, tries + 1), 100);
    } else {
        console.error('Libraries failed to load');
        // Try to start anyway — some features may not work
        callback();
    }
}

window.addEventListener('load', () => {
    waitForLibs(() => {
        app = new App();
    });
});
