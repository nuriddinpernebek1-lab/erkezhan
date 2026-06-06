class HandTracker {
    constructor() {
        this.isReady = false;
        this.landmarks = null;
        this.handedness = null;
        this._handsLib = null;

        this._init();
    }

    _init() {
        if (typeof Hands === 'undefined') {
            // Retry after libs load
            setTimeout(() => this._init(), 500);
            return;
        }
        try {
            this._handsLib = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            this._handsLib.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.5
            });
            this._handsLib.onResults((results) => {
                this.landmarks = results.multiHandLandmarks || [];
                this.handedness = results.multiHandedness || [];
            });
            this._handsLib.initialize().then(() => {
                this.isReady = true;
                console.log('Hand tracking ready');
            }).catch(e => console.warn('Hands init error:', e));
        } catch(e) {
            console.warn('HandTracker init failed:', e);
        }
    }

    async process(videoElement) {
        if (!this.isReady || !this._handsLib) return;
        try {
            await this._handsLib.send({ image: videoElement });
        } catch(e) { /* ignore frame errors */ }
    }

    getHands() {
        if (!this.landmarks) return [];
        return this.landmarks.map((lm, i) => ({
            id: i,
            handedness: this.handedness[i] ? this.handedness[i].label : 'Unknown',
            landmarks: lm,
            confidence: this.handedness[i] ? this.handedness[i].score : 0
        }));
    }

    getLandmarksForHand(idx) {
        return this.landmarks && this.landmarks[idx] ? this.landmarks[idx] : null;
    }

    getLandmark(handIdx, lmIdx) {
        const lm = this.getLandmarksForHand(handIdx);
        return lm ? lm[lmIdx] : null;
    }

    getWrist(handIdx) { return this.getLandmark(handIdx, 0); }
    getThumbTip(handIdx) { return this.getLandmark(handIdx, 4); }
    getIndexFingerTip(handIdx) { return this.getLandmark(handIdx, 8); }
    getMiddleFingerTip(handIdx) { return this.getLandmark(handIdx, 12); }
    getRingFingerTip(handIdx) { return this.getLandmark(handIdx, 16); }
    getPinkyTip(handIdx) { return this.getLandmark(handIdx, 20); }

    getPalmCenter(handIdx) {
        const lm = this.getLandmarksForHand(handIdx);
        if (!lm) return null;
        const pts = [0, 1, 5, 9, 13, 17];
        let x=0, y=0, z=0;
        pts.forEach(i => { x+=lm[i].x; y+=lm[i].y; z+=lm[i].z; });
        return { x: x/pts.length, y: y/pts.length, z: z/pts.length };
    }

    isHandOpen(handIdx) {
        const lm = this.getLandmarksForHand(handIdx);
        if (!lm) return false;
        const tips = [8,12,16,20], pips = [6,10,14,18];
        let open = 0;
        for (let i=0; i<tips.length; i++) if (lm[tips[i]].y < lm[pips[i]].y) open++;
        return open >= 3;
    }

    isHandClosed(handIdx) { return !this.isHandOpen(handIdx); }

    countFingers(handIdx) {
        const lm = this.getLandmarksForHand(handIdx);
        if (!lm) return 0;
        const tips=[4,8,12,16,20], pips=[3,6,10,14,18];
        let c=0;
        for (let i=0; i<tips.length; i++) if (lm[tips[i]].y < lm[pips[i]].y) c++;
        return c;
    }

    getHandVelocity(handIdx, prevLandmarks) {
        const lm = this.getLandmarksForHand(handIdx);
        if (!lm || !prevLandmarks) return new THREE.Vector3();
        return new THREE.Vector3(
            lm[0].x - prevLandmarks[0].x,
            lm[0].y - prevLandmarks[0].y,
            lm[0].z - prevLandmarks[0].z
        );
    }

    getHandOrientation(handIdx) {
        const lm = this.getLandmarksForHand(handIdx);
        if (!lm) return null;
        const w = lm[0], m = lm[9];
        const fwd = new THREE.Vector3(m.x-w.x, m.y-w.y, m.z-w.z).normalize();
        return { forward: fwd, side: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1) };
    }

    getDistance(hi1, li1, hi2, li2) {
        const a = this.getLandmark(hi1, li1), b = this.getLandmark(hi2, li2);
        if (!a || !b) return 0;
        return Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2)+Math.pow(a.z-b.z,2));
    }
}
