class HandTracker {
    constructor() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.results = null;
        this.landmarks = null;
        this.handedness = null;
        this.isReady = false;
        
        this.hands.onResults((results) => {
            this.results = results;
            if (results.multiHandLandmarks) {
                this.landmarks = results.multiHandLandmarks;
                this.handedness = results.multiHandedness;
            }
        });
        
        this.hands.initialize().then(() => {
            this.isReady = true;
        });
    }
    
    async process(videoElement) {
        if (!this.isReady) return;
        await this.hands.send({ image: videoElement });
    }
    
    getHands() {
        if (!this.landmarks) return [];
        
        const handsData = [];
        
        for (let i = 0; i < this.landmarks.length; i++) {
            handsData.push({
                id: i,
                handedness: this.handedness[i].label,
                landmarks: this.landmarks[i],
                confidence: this.handedness[i].score
            });
        }
        
        return handsData;
    }
    
    getLandmark(handIndex, landmarkIndex) {
        if (!this.landmarks || !this.landmarks[handIndex]) return null;
        return this.landmarks[handIndex][landmarkIndex];
    }
    
    getPalmCenter(handIndex) {
        const landmarks = this.getLandmarksForHand(handIndex);
        if (!landmarks) return null;
        
        const palm = landmarks.slice(0, 5);
        let x = 0, y = 0, z = 0;
        
        for (let landmark of palm) {
            x += landmark.x;
            y += landmark.y;
            z += landmark.z;
        }
        
        return {
            x: x / palm.length,
            y: y / palm.length,
            z: z / palm.length
        };
    }
    
    getFingerTip(handIndex, fingerIndex) {
        const tips = [4, 8, 12, 16, 20];
        return this.getLandmark(handIndex, tips[fingerIndex]);
    }
    
    getWrist(handIndex) {
        return this.getLandmark(handIndex, 0);
    }
    
    getIndexFingerTip(handIndex) {
        return this.getFingerTip(handIndex, 1);
    }
    
    getMiddleFingerTip(handIndex) {
        return this.getFingerTip(handIndex, 2);
    }
    
    getRingFingerTip(handIndex) {
        return this.getFingerTip(handIndex, 3);
    }
    
    getPinkyTip(handIndex) {
        return this.getFingerTip(handIndex, 4);
    }
    
    getThumbTip(handIndex) {
        return this.getFingerTip(handIndex, 0);
    }
    
    getLandmarksForHand(handIndex) {
        if (!this.landmarks || !this.landmarks[handIndex]) return null;
        return this.landmarks[handIndex];
    }
    
    getHandOrientation(handIndex) {
        const landmarks = this.getLandmarksForHand(handIndex);
        if (!landmarks) return null;
        
        const wrist = landmarks[0];
        const middleFinger = landmarks[9];
        const ringFinger = landmarks[13];
        
        const v1 = new THREE.Vector3(middleFinger.x - wrist.x, middleFinger.y - wrist.y, middleFinger.z - wrist.z);
        const v2 = new THREE.Vector3(ringFinger.x - wrist.x, ringFinger.y - wrist.y, ringFinger.z - wrist.z);
        
        const cross = new THREE.Vector3().crossVectors(v1, v2);
        
        return {
            forward: v1.normalize(),
            side: v2.normalize(),
            normal: cross.normalize()
        };
    }
    
    getDistance(handIndex1, landmarkIndex1, handIndex2, landmarkIndex2) {
        const l1 = this.getLandmark(handIndex1, landmarkIndex1);
        const l2 = this.getLandmark(handIndex2, landmarkIndex2);
        
        if (!l1 || !l2) return 0;
        
        const dx = l2.x - l1.x;
        const dy = l2.y - l1.y;
        const dz = l2.z - l1.z;
        
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    getHandVelocity(handIndex, prevLandmarks) {
        const landmarks = this.getLandmarksForHand(handIndex);
        if (!landmarks || !prevLandmarks) return new THREE.Vector3();
        
        const wrist = landmarks[0];
        const prevWrist = prevLandmarks[0];
        
        return new THREE.Vector3(
            wrist.x - prevWrist.x,
            wrist.y - prevWrist.y,
            wrist.z - prevWrist.z
        );
    }
    
    isHandOpen(handIndex) {
        const landmarks = this.getLandmarksForHand(handIndex);
        if (!landmarks) return false;
        
        const wrist = landmarks[0];
        let openFingers = 0;
        
        const tipIndices = [4, 8, 12, 16, 20];
        const pipIndices = [3, 6, 10, 14, 18];
        
        for (let i = 0; i < tipIndices.length; i++) {
            const tip = landmarks[tipIndices[i]];
            const pip = landmarks[pipIndices[i]];
            
            if (tip.y < pip.y) {
                openFingers++;
            }
        }
        
        return openFingers >= 4;
    }
    
    isHandClosed(handIndex) {
        return !this.isHandOpen(handIndex);
    }
    
    countFingers(handIndex) {
        const landmarks = this.getLandmarksForHand(handIndex);
        if (!landmarks) return 0;
        
        let count = 0;
        const tipIndices = [4, 8, 12, 16, 20];
        const pipIndices = [3, 6, 10, 14, 18];
        
        for (let i = 0; i < tipIndices.length; i++) {
            const tip = landmarks[tipIndices[i]];
            const pip = landmarks[pipIndices[i]];
            
            if (tip.y < pip.y) {
                count++;
            }
        }
        
        return count;
    }
}