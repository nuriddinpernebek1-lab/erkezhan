class CameraManager {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.camera = null;
        this.constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: false
        };
        this.isActive = false;
    }
    
    async initialize() {
        try {
            this.camera = await navigator.mediaDevices.getUserMedia(this.constraints);
            this.video.srcObject = this.camera;
            
            return new Promise((resolve) => {
                this.video.addEventListener('loadedmetadata', () => {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    this.isActive = true;
                    resolve();
                }, { once: true });
            });
        } catch (error) {
            console.error('Failed to access camera:', error);
            alert('Camera access denied. Please enable camera permissions.');
            throw error;
        }
    }
    
    captureFrame() {
        if (!this.isActive) return null;
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        return this.canvas;
    }
    
    getVideoElement() {
        return this.video;
    }
    
    getCanvasElement() {
        return this.canvas;
    }
    
    stop() {
        if (this.camera) {
            this.camera.getTracks().forEach(track => track.stop());
            this.isActive = false;
        }
    }
}