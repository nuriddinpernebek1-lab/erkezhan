class EffectsManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.currentMode = 'air-screen';
        this.color = new THREE.Color('#00ff88');
        this.time = 0;
        this.objects = [];
        this.trails = [];
        this.maxTrailLength = 30;
        this.brightness = 1.0;
        this.speed = 1.0;
    }

    setMode(mode) {
        this.clearObjects();
        this.currentMode = mode;
        this.initMode(mode);
    }

    setColor(hex) {
        this.color = new THREE.Color(hex);
        this.objects.forEach(obj => {
            if (obj.material && obj.material.uniforms && obj.material.uniforms.color) {
                obj.material.uniforms.color.value = this.color;
            }
            if (obj.material && obj.material.color) {
                obj.material.color = this.color;
            }
        });
    }

    setBrightness(val) { this.brightness = val; }
    setSpeed(val) { this.speed = val; }

    initMode(mode) {
        switch (mode) {
            case 'doctor-strange':
                this.initDoctorStrange();
                break;
            case 'portal':
                this.initPortal();
                break;
            case 'iron-man':
                this.initIronMan();
                break;
            case 'cyberpunk':
                this.initCyberpunk();
                break;
            default:
                break;
        }
    }

    initDoctorStrange() {
        for (let i = 0; i < 3; i++) {
            const geo = new THREE.TorusGeometry(0.3 + i * 0.15, 0.02, 16, 100);
            const mat = new THREE.MeshBasicMaterial({ color: this.color, wireframe: true });
            const ring = new THREE.Mesh(geo, mat);
            ring.userData.rotSpeed = (i + 1) * 0.8;
            ring.userData.axis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
            this.scene.add(ring);
            this.objects.push(ring);
        }
    }

    initPortal() {
        const geo = new THREE.CircleGeometry(0.5, 64);
        const mat = new THREE.ShaderMaterial({
            vertexShader: SHADERS.portalVertex,
            fragmentShader: SHADERS.portalFragment,
            uniforms: {
                time: { value: 0 },
                color1: { value: this.color },
                color2: { value: new THREE.Color('#ffffff') }
            },
            transparent: true,
            side: THREE.DoubleSide
        });
        const portal = new THREE.Mesh(geo, mat);
        this.scene.add(portal);
        this.objects.push(portal);
    }

    initIronMan() {
        const geo = new THREE.RingGeometry(0.3, 0.35, 64);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(geo, mat);
        this.scene.add(ring);
        this.objects.push(ring);

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const segGeo = new THREE.PlaneGeometry(0.08, 0.02);
            const segMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 });
            const seg = new THREE.Mesh(segGeo, segMat);
            seg.position.x = Math.cos(angle) * 0.32;
            seg.position.y = Math.sin(angle) * 0.32;
            seg.rotation.z = angle;
            this.scene.add(seg);
            this.objects.push(seg);
        }
    }

    initCyberpunk() {
        for (let i = 0; i < 5; i++) {
            const points = [];
            for (let j = 0; j < 10; j++) {
                points.push(new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 0.5
                ));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: this.color });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            this.objects.push(line);
        }
    }

    update(deltaTime, handTracker) {
        this.time += deltaTime * this.speed;

        if (handTracker) {
            this.updateHandEffects(handTracker);
        }

        this.updateObjects();
    }

    updateHandEffects(handTracker) {
        const hands = handTracker.getHands();
        if (hands.length === 0) return;

        const hand = hands[0];
        const wrist = handTracker.getWrist(hand.id);
        if (!wrist) return;

        const x = (wrist.x - 0.5) * 4;
        const y = -(wrist.y - 0.5) * 3;

        this.objects.forEach(obj => {
            if (obj.isMesh || obj.isLine) {
                switch (this.currentMode) {
                    case 'doctor-strange':
                        obj.position.x = x;
                        obj.position.y = y;
                        break;
                    case 'portal':
                        obj.position.x = x;
                        obj.position.y = y;
                        break;
                    case 'iron-man':
                        obj.position.x = x;
                        obj.position.y = y;
                        break;
                    case 'cyberpunk':
                        obj.position.x += (x - obj.position.x) * 0.05;
                        obj.position.y += (y - obj.position.y) * 0.05;
                        break;
                }
            }
        });

        // Add trail for fire/lightning mode
        if (this.currentMode === 'fire' || this.currentMode === 'lightning') {
            this.addTrailPoint(x, y);
        }
    }

    addTrailPoint(x, y) {
        this.trails.push({ x, y, life: 1.0 });
        if (this.trails.length > this.maxTrailLength) {
            this.trails.shift();
        }
    }

    updateObjects() {
        this.objects.forEach(obj => {
            if (obj.material && obj.material.uniforms) {
                if (obj.material.uniforms.time) {
                    obj.material.uniforms.time.value = this.time;
                }
            }

            if (this.currentMode === 'doctor-strange' && obj.userData.rotSpeed) {
                obj.rotateOnAxis(obj.userData.axis || new THREE.Vector3(0, 1, 0), obj.userData.rotSpeed * 0.02 * this.speed);
            }

            if (this.currentMode === 'iron-man') {
                obj.rotation.z += 0.02 * this.speed;
            }
        });
    }

    clearObjects() {
        this.objects.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        this.objects = [];
        this.trails = [];
    }

    dispose() {
        this.clearObjects();
    }
}
