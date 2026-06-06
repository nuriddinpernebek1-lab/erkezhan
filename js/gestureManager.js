class GestureManager {
    constructor(handTracker) {
        this.handTracker = handTracker;
        this.previousLandmarks = [null, null];
        this.gestureHistory = [];
        this.maxHistory = 8;
        this.velocityThreshold = 0.04;
        this._clearTimer = null;
    }

    update() {
        const hands = this.handTracker.getHands();
        for (const hand of hands) {
            const gesture = this._detectGesture(hand.id);
            if (gesture) this._record(gesture, hand.id);
            this.previousLandmarks[hand.id] = this.handTracker.getLandmarksForHand(hand.id);
        }
    }

    _detectGesture(idx) {
        if (this._isPinch(idx)) return 'PINCH';
        if (this._isVictory(idx)) return 'VICTORY';
        if (this._isPoint(idx)) return 'POINT';
        if (this.handTracker.isHandOpen(idx)) return 'OPEN_PALM';
        if (this.handTracker.isHandClosed(idx)) return 'CLOSED_FIST';
        return this._detectSwipe(idx);
    }

    _isPinch(idx) {
        const thumb = this.handTracker.getThumbTip(idx);
        const index = this.handTracker.getIndexFingerTip(idx);
        if (!thumb || !index) return false;
        const d = Math.sqrt(Math.pow(thumb.x-index.x,2)+Math.pow(thumb.y-index.y,2)+Math.pow(thumb.z-index.z,2));
        return d < 0.06;
    }

    _isPoint(idx) {
        const lm = this.handTracker.getLandmarksForHand(idx);
        if (!lm) return false;
        return lm[8].y < lm[6].y && lm[12].y > lm[10].y;
    }

    _isVictory(idx) {
        const lm = this.handTracker.getLandmarksForHand(idx);
        if (!lm) return false;
        return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y > lm[14].y;
    }

    _detectSwipe(idx) {
        if (!this.previousLandmarks[idx]) return null;
        const vel = this.handTracker.getHandVelocity(idx, this.previousLandmarks[idx]);
        const spd = vel.length();
        if (spd < this.velocityThreshold) return null;
        if (vel.x > 0.08) return 'SWIPE_RIGHT';
        if (vel.x < -0.08) return 'SWIPE_LEFT';
        if (vel.y > 0.08) return 'SWIPE_DOWN';
        if (vel.y < -0.08) return 'SWIPE_UP';
        return null;
    }

    _record(gesture, handIdx) {
        this.gestureHistory.push({ gesture, handIdx, t: Date.now() });
        if (this.gestureHistory.length > this.maxHistory) this.gestureHistory.shift();
        clearTimeout(this._clearTimer);
        this._clearTimer = setTimeout(() => { this.gestureHistory = []; }, 400);
    }

    getLastGesture() {
        return this.gestureHistory.length ? this.gestureHistory[this.gestureHistory.length-1].gesture : null;
    }

    getGestureSequence() {
        return this.gestureHistory.map(g => g.gesture);
    }
}
