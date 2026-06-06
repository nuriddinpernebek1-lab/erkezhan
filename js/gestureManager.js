class GestureManager {
    constructor(handTracker) {
        this.handTracker = handTracker;
        this.previousLandmarks = [null, null];
        this.gestureHistory = [];
        this.maxHistoryLength = 10;
        this.currentGestureTimeout = null;
        this.velocityThreshold = 0.05;
    }
    
    update() {
        this.detectGestures();
    }
    
    detectGestures() {
        const hands = this.handTracker.getHands();
        
        for (let i = 0; i < hands.length; i++) {
            const handIndex = hands[i].id;
            
            const gesture = this.detectHandGesture(handIndex);
            if (gesture) {
                this.recordGesture(gesture, handIndex);
            }
            
            this.previousLandmarks[handIndex] = this.handTracker.getLandmarksForHand(handIndex);
        }
    }
    
    detectHandGesture(handIndex) {
        const landmarks = this.handTracker.getLandmarksForHand(handIndex);
        if (!landmarks) return null;
        
        if (this.isPinch(handIndex)) {
            return 'PINCH';
        }
        
        if (this.isPoint(handIndex)) {
            return 'POINT';
        }
        
        if (this.isVictory(handIndex)) {
            return 'VICTORY';
        }
        
        if (this.handTracker.isHandOpen(handIndex)) {
            return 'OPEN_PALM';
        }
        
        if (this.handTracker.isHandClosed(handIndex)) {
            return 'CLOSED_FIST';
        }
        
        if (this.isGrab(handIndex)) {
            return 'GRAB';
        }
        
        const swipe = this.detectSwipe(handIndex);
        if (swipe) {
            return swipe;
        }
        
        const rotation = this.detectRotation(handIndex);
        if (rotation) {
            return rotation;
        }
        
        return null;
    }
    
    isPinch(handIndex) {
        const thumbTip = this.handTracker.getThumbTip(handIndex);
        const indexTip = this.handTracker.getIndexFingerTip(handIndex);
        
        if (!thumbTip || !indexTip) return false;
        
        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2) +
            Math.pow(thumbTip.z - indexTip.z, 2)
        );
        
        return distance < 0.05;
    }
    
    isPoint(handIndex) {
        const landmarks = this.handTracker.getLandmarksForHand(handIndex);
        if (!landmarks) return false;
        
        const indexTip = landmarks[8];
        const indexPip = landmarks[6];
        const middleTip = landmarks[12];
        const middlePip = landmarks[10];
        
        const indexExtended = indexTip.y < indexPip.y;
        const middleRetracted = middleTip.y > middlePip.y;
        
        return indexExtended && middleRetracted;
    }
    
    isVictory(handIndex) {
        const landmarks = this.handTracker.getLandmarksForHand(handIndex);
        if (!landmarks) return false;
        
        const indexTip = landmarks[8];
        const indexPip = landmarks[6];
        const middleTip = landmarks[12];
        const middlePip = landmarks[10];
        const ringTip = landmarks[16];
        const ringPip = landmarks[14];
        
        const indexExtended = indexTip.y < indexPip.y;
        const middleExtended = middleTip.y < middlePip.y;
        const ringRetracted = ringTip.y > ringPip.y;
        
        return indexExtended && middleExtended && ringRetracted;
    }
    
    isGrab(handIndex) {
        const landmarks = this.handTracker.getLandmarksForHand(handIndex);
        if (!landmarks) return false;
        
        const fingers = [4, 8, 12, 16, 20];
        const pips = [3, 6, 10, 14, 18];
        
        let closedFingers = 0;
        
        for (let i = 0; i < fingers.length; i++) {
            const tip = landmarks[fingers[i]];
            const pip = landmarks[pips[i]];
            
            if (tip.y > pip.y) {
                closedFingers++;
            }
        }
        
        return closedFingers >= 4;
    }
    
    detectSwipe(handIndex) {
        if (!this.previousLandmarks[handIndex]) return null;
        
        const velocity = this.handTracker.getHandVelocity(handIndex, this.previousLandmarks[handIndex]);
        const speed = velocity.length();
        
        if (speed < this.velocityThreshold) return null;
        
        if (velocity.x > 0.1) return 'SWIPE_RIGHT';
        if (velocity.x < -0.1) return 'SWIPE_LEFT';
        if (velocity.y > 0.1) return 'SWIPE_DOWN';
        if (velocity.y < -0.1) return 'SWIPE_UP';
        
        return null;
    }
    
    detectRotation(handIndex) {
        if (!this.previousLandmarks[handIndex]) return null;
        
        const landmarks = this.handTracker.getLandmarksForHand(handIndex);
        const prevLandmarks = this.previousLandmarks[handIndex];
        
        const orientation = this.handTracker.getHandOrientation(handIndex);
        if (!orientation) return null;
        
        const angle = Math.acos(Math.min(1, Math.max(-1, orientation.forward.dot(new THREE.Vector3(0, 0, 1)))));
        
        if (angle > 0.3) {
            return 'ROTATE_WRIST';
        }
        
        return null;
    }
    
    recordGesture(gesture, handIndex) {
        this.gestureHistory.push({
            gesture,
            handIndex,
            timestamp: Date.now()
        });
        
        if (this.gestureHistory.length > this.maxHistoryLength) {
            this.gestureHistory.shift();
        }
        
        if (this.currentGestureTimeout) {
            clearTimeout(this.currentGestureTimeout);
        }
        
        this.currentGestureTimeout = setTimeout(() => {
            this.gestureHistory = [];
        }, 300);
    }
    
    getLastGesture() {
        if (this.gestureHistory.length === 0) return null;
        return this.gestureHistory[this.gestureHistory.length - 1].gesture;
    }
    
    getGestureSequence() {
        return this.gestureHistory.map(g => g.gesture);
    }
}