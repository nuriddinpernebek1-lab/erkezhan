// ============================================================
// AI Magic AR Hands - Main Application
// ============================================================
class App {
    constructor() {
        this.canvas  = document.getElementById('canvas');
        this.video   = document.getElementById('video');

        this.scene    = null;
        this.cam3d    = null;
        this.renderer = null;

        this.cameraManager  = null;
        this.handTracker    = null;
        this.gestureManager = null;
        this.particleSystem = null;
        this.effectsManager = null;
        this.airScreen      = null;

        this.mode       = 'air-screen';
        this.color      = new THREE.Color('#00ff88');
        this.particleCount = 500;
        this.speed      = 1.0;
        this.brightness = 1.0;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];

        this.lastTime   = performance.now();
        this.frameCount = 0;
        this.fpsTime    = 0;
        this.fps        = 0;
        this.time       = 0;

        this.videoTexture   = null;
        this.backgroundMesh = null;

        this.init();
    }

    // ── INIT ─────────────────────────────────────────────────
    async init() {
        this.showLoading('Initializing...');
        try {
            this.setupThree();
            await this.setupCamera();
            this.setupBackground();
            this.setupHandTracking();
            this.setupParticles();
            this.setupEffects();
            this.setupAirScreen();
            this.setupUI();
            this.hideLoading();
            this.animate();
        } catch(e) {
            console.error(e);
            this.showError('Failed to initialize. Please allow camera access and reload.');
        }
    }

    // ── THREE ─────────────────────────────────────────────────
    setupThree() {
        const w = window.innerWidth, h = window.innerHeight;
        this.scene  = new THREE.Scene();
        this.cam3d  = new THREE.PerspectiveCamera(60, w/h, 0.01, 1000);
        this.cam3d.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
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
        const mat = new THREE.MeshBasicMaterial({ map: this.videoTexture, depthWrite: false });
        this.backgroundMesh = new THREE.Mesh(geo, mat);
        this.backgroundMesh.position.z = -5;
        this.backgroundMesh.scale.x   = -1; // mirror
        this.scene.add(this.backgroundMesh);
    }

    // ── CAMERA ────────────────────────────────────────────────
    async setupCamera() {
        this.cameraManager = new CameraManager();
        await this.cameraManager.initialize();
    }

    // ── HANDS ─────────────────────────────────────────────────
    setupHandTracking() {
        this.handTracker    = new HandTracker();
        this.gestureManager = new GestureManager(this.handTracker);
    }

    // ── PARTICLES ─────────────────────────────────────────────
    setupParticles() {
        this.particleSystem = new ParticleSystem(this.scene, this.particleCount);
    }

    // ── EFFECTS ───────────────────────────────────────────────
    setupEffects() {
        this.effectsManager = new EffectsManager(this.scene, this.cam3d, this.renderer);
    }

    // ── AIR SCREEN ────────────────────────────────────────────
    setupAirScreen() {
        this.airScreen = new AirScreen(this.scene, this.video);
    }

    /** Convert normalized MediaPipe coords [0,1] to Three.js world coords */
    mpToWorld(lm) {
        // Camera frustum at z=0: fov=60, z=5 camera
        // tan(30deg) * 5 = 2.887 → world height ~5.77, width depends on aspect
        const aspect = window.innerWidth / window.innerHeight;
        const halfH = Math.tan(THREE.MathUtils.degToRad(30)) * 5;
        const halfW = halfH * aspect;
        // Mirror X (selfie)
        const x = -(lm.x - 0.5) * halfW * 2;
        const y = -(lm.y - 0.5) * halfH * 2;
        const z =  lm.z * -2; // depth (approximate)
        return new THREE.Vector3(x, y, z);
    }

    // ── MAIN LOOP ─────────────────────────────────────────────
    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const dt  = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;
        this.time += dt;

        this.frameCount++;
        this.fpsTime += dt;
        if (this.fpsTime >= 0.5) {
            this.fps = Math.round(this.frameCount / this.fpsTime);
            this.frameCount = 0; this.fpsTime = 0;
        }

        this.update(dt);
        this.renderer.render(this.scene, this.cam3d);
        this.updateUI();
    }

    update(dt) {
        if (this.videoTexture) this.videoTexture.needsUpdate = true;

        if (this.handTracker && this.handTracker.isReady && this.video.readyState >= 2) {
            this.handTracker.process(this.video);
            this.gestureManager.update();
        }

        if (this.effectsManager) this.effectsManager.update(dt, this.handTracker);

        // ── Air Screen logic ─────────────────────────────────
        if (this.mode === 'air-screen') {
            const hands = this.handTracker ? this.handTracker.getHands() : [];
            if (hands.length >= 2) {
                // Find left and right hand
                let leftHand = null, rightHand = null;
                hands.forEach(h => {
                    if (h.handedness === 'Left')  leftHand  = h;
                    if (h.handedness === 'Right') rightHand = h;
                });
                // Fallback: just use first two
                if (!leftHand)  leftHand  = hands[0];
                if (!rightHand) rightHand = hands[1];

                const lPalm = this.handTracker.getPalmCenter(leftHand.id);
                const rPalm = this.handTracker.getPalmCenter(rightHand.id);
                if (lPalm && rPalm) {
                    const lWorld = this.mpToWorld(lPalm);
                    const rWorld = this.mpToWorld(rPalm);
                    this.airScreen.update(this.time, lWorld, rWorld);
                } else {
                    this.airScreen.hide();
                }
            } else {
                this.airScreen.hide();
                // Single hand - show preview ring
                if (hands.length === 1) {
                    this._emitHandParticles(dt, hands[0]);
                }
            }
        } else {
            this.airScreen.hide();
            this.updateParticles(dt);
        }

        if (this.particleSystem) this.particleSystem.update(dt);
    }

    _emitHandParticles(dt, hand) {
        const wrist = this.handTracker.getWrist(hand.id);
        if (!wrist) return;
        const pos = this.mpToWorld(wrist);
        const vel = new THREE.Vector3(
            (Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)
        ).multiplyScalar(this.speed);
        const col = new THREE.Color('#00cfff');
        this.particleSystem.emit(pos, vel, col, 3, 5, 0.5);
    }

    updateParticles(dt) {
        if (!this.handTracker) return;
        const hands = this.handTracker.getHands();
        hands.forEach(hand => {
            const wrist = this.handTracker.getWrist(hand.id);
            if (!wrist) return;
            const pos = this.mpToWorld(wrist);
            const gesture = this.gestureManager.getLastGesture();
            const vel  = this.getParticleVelocity(gesture);
            const size = this.getParticleSize(gesture);
            const life = this.getParticleLife(gesture);
            const col  = this.color.clone().multiplyScalar(this.brightness);
            this.particleSystem.emit(pos, vel, col, this.getEmitCount(), size, life);

            // Fingertips
            [this.handTracker.getIndexFingerTip(hand.id),
             this.handTracker.getMiddleFingerTip(hand.id)].forEach(tip => {
                if (!tip) return;
                const tPos = this.mpToWorld(tip);
                const tVel = new THREE.Vector3(
                    (Math.random()-0.5)*3,(Math.random()-0.5)*3+1,(Math.random()-0.5)*2
                ).multiplyScalar(this.speed);
                this.particleSystem.emit(tPos, tVel, col, 2, size*0.5, life*0.5);
            });
        });
    }

    getEmitCount() {
        const base = Math.max(1, Math.floor(this.particleCount / 100));
        return this.mode === 'fire' ? base*3 : this.mode === 'lightning' ? base*2 : base;
    }
    getParticleVelocity(gesture) {
        const v = this.mode === 'fire'
            ? new THREE.Vector3((Math.random()-0.5)*2, Math.random()*4+1, (Math.random()-0.5))
            : this.mode === 'lightning'
            ? new THREE.Vector3((Math.random()-0.5)*6, (Math.random()-0.5)*6, (Math.random()-0.5)*2)
            : new THREE.Vector3((Math.random()-0.5)*3, (Math.random()-0.5)*3, (Math.random()-0.5)*2);
        return v.multiplyScalar(this.speed);
    }
    getParticleSize(g) {
        if (g==='OPEN_PALM') return 12*this.brightness;
        if (g==='PINCH')     return 4*this.brightness;
        return (this.mode==='fire'?10:7)*this.brightness;
    }
    getParticleLife(g) {
        return this.mode==='fire'?0.8:this.mode==='lightning'?0.3:1.0;
    }

    // ── UI ────────────────────────────────────────────────────
    setupUI() {
        document.getElementById('modeSelect').addEventListener('change', e => {
            this.mode = e.target.value;
            this.effectsManager.setMode(this.mode);
            this.particleSystem.clear();
            if (this.mode !== 'air-screen') this.airScreen.hide();
        });

        // Air Screen style switcher (inside the panel)
        const styleSelect = document.getElementById('airScreenStyle');
        if (styleSelect) {
            styleSelect.addEventListener('change', e => {
                this.airScreen.setStyle(parseInt(e.target.value));
            });
        }

        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.color = new THREE.Color(btn.dataset.color);
                this.effectsManager.setColor(btn.dataset.color);
            });
        });

        document.getElementById('particleCount').addEventListener('input', e => {
            this.particleCount = parseInt(e.target.value);
            document.getElementById('particleCountValue').textContent = this.particleCount;
            this.particleSystem.dispose();
            this.particleSystem = new ParticleSystem(this.scene, this.particleCount);
        });

        document.getElementById('speed').addEventListener('input', e => {
            this.speed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = this.speed.toFixed(1);
            this.effectsManager.setSpeed(this.speed);
        });

        document.getElementById('brightness').addEventListener('input', e => {
            this.brightness = parseFloat(e.target.value);
            document.getElementById('brightnessValue').textContent = this.brightness.toFixed(1);
            this.effectsManager.setBrightness(this.brightness);
        });

        document.getElementById('qualitySelect').addEventListener('change', e => {
            const pr = e.target.value==='low'?0.5:e.target.value==='medium'?1:Math.min(window.devicePixelRatio,2);
            this.renderer.setPixelRatio(pr);
        });

        document.getElementById('screenshotBtn').addEventListener('click', () => this.takeScreenshot());
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                document.body.classList.add('fullscreen');
            } else {
                document.exitFullscreen();
                document.body.classList.remove('fullscreen');
            }
        });
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.particleSystem.clear();
            this.effectsManager.clearObjects();
            this.effectsManager.setMode(this.mode);
        });
    }

    updateUI() {
        document.getElementById('fps').textContent = `FPS: ${this.fps}`;
        document.getElementById('performanceText').textContent =
            `FPS: ${this.fps} | Particles: ${this.particleSystem?.particles.length||0} | Hands: ${this.handTracker?.getHands().length||0}`;
        const hands = this.handTracker?.getHands()||[];
        document.getElementById('handStatus').textContent =
            hands.length ? `Hands: ${hands.map(h=>h.handedness).join(', ')}` : 'Hands: None';
        const g = this.gestureManager?.getLastGesture()||null;
        document.getElementById('gestureStatus').textContent = `Gesture: ${g||'None'}`;
        const ov = document.getElementById('gestureOverlay');
        if (g) { ov.textContent = g.replace('_',' '); ov.classList.add('active'); }
        else   { ov.classList.remove('active'); }
    }

    // ── UTILS ─────────────────────────────────────────────────
    onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.cam3d.aspect = w/h;
        this.cam3d.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        if (this.backgroundMesh) {
            const aspect = w/h;
            this.scene.remove(this.backgroundMesh);
            this.backgroundMesh.geometry.dispose();
            this.backgroundMesh.geometry = new THREE.PlaneGeometry(14*aspect, 14);
            this.backgroundMesh.scale.x = -1;
            this.scene.add(this.backgroundMesh);
        }
    }

    takeScreenshot() {
        this.renderer.render(this.scene, this.cam3d);
        const a = document.createElement('a');
        a.href = this.canvas.toDataURL('image/png');
        a.download = `magic-hands-${Date.now()}.png`;
        a.click();
    }

    toggleRecording() {
        const btn = document.getElementById('recordBtn');
        if (!this.isRecording) {
            const stream = this.canvas.captureStream(30);
            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            this.mediaRecorder.ondataavailable = e => { if (e.data.size>0) this.recordedChunks.push(e.data); };
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type:'video/webm' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `magic-hands-${Date.now()}.webm`;
                a.click();
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            btn.textContent = '⏹ Stop';
            btn.style.cssText = 'background:rgba(255,0,0,0.3);border-color:#f00;color:#f00;';
        } else {
            this.mediaRecorder.stop();
            this.isRecording = false;
            btn.textContent = '⏺ Rec';
            btn.style.cssText = '';
        }
    }

    showLoading(msg) {
        let el = document.getElementById('loadingOverlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'loadingOverlay';
            el.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,39,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:Courier New,monospace;color:#00ff88;';
            el.innerHTML = `
                <div style="font-size:22px;margin-bottom:16px;text-shadow:0 0 20px #00ff88;letter-spacing:4px;">✨ AI MAGIC HANDS ✨</div>
                <div id="loadingMsg" style="font-size:13px;opacity:0.7;">${msg}</div>
                <div style="margin-top:24px;width:180px;height:2px;background:rgba(0,255,136,0.15);border-radius:1px;">
                    <div id="loadingBar" style="width:30%;height:100%;background:#00ff88;border-radius:1px;transition:width 0.5s;box-shadow:0 0 10px #00ff88;"></div>
                </div>
                <div style="margin-top:16px;font-size:10px;opacity:0.4;letter-spacing:1px;">ALLOW CAMERA ACCESS WHEN PROMPTED</div>
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
            if (el) { el.style.transition='opacity 0.5s'; el.style.opacity='0'; setTimeout(()=>el.remove(),500); }
        }, 400);
    }

    showError(msg) {
        const msgEl = document.getElementById('loadingMsg');
        if (msgEl) { msgEl.textContent = msg; msgEl.style.color = '#ff4444'; }
    }
}

// ── BOOT ──────────────────────────────────────────────────────
let app;
function waitForLibs(cb, tries=0) {
    if (typeof THREE !== 'undefined' && typeof Hands !== 'undefined') cb();
    else if (tries < 100) setTimeout(() => waitForLibs(cb, tries+1), 100);
    else cb(); // try anyway
}
window.addEventListener('load', () => waitForLibs(() => { app = new App(); }));
