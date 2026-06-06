class CameraManager {
    constructor() {
        this.video = document.getElementById('video');
        this.isActive = false;
        this.stream = null;
    }

    async initialize() {
        const constraints = {
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: false
        };
        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();
            this.isActive = true;
        } catch (err) {
            console.error('Camera error:', err);
            alert('Camera access denied. Please allow camera access and reload.');
            throw err;
        }
    }

    getVideoElement() { return this.video; }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.isActive = false;
        }
    }
}
