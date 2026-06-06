/**
 * AirScreen - stretches a virtual screen between two hands.
 * Mimics the reference video: a physical-looking plane that tracks
 * hand positions, rotates in 3D and shows stylized camera feed.
 */
class AirScreen {
    constructor(scene, videoElement) {
        this.scene = scene;
        this.video = videoElement;
        this.active = false;
        this.style = 1; // 0=normal,1=cyanotype,2=glitch,3=halftone

        // Smoothed positions
        this._leftSmooth  = new THREE.Vector3();
        this._rightSmooth = new THREE.Vector3();
        this._firstFrame  = true;

        this._buildScreen();
        this._buildFrame();
        this._buildCornerSparks();
        this.hide();
    }

    _buildScreen() {
        const geo = new THREE.PlaneGeometry(1, 1);
        this._videoTex = new THREE.VideoTexture(this.video);
        this._videoTex.minFilter = THREE.LinearFilter;
        this._videoTex.magFilter = THREE.LinearFilter;

        this._mat = new THREE.ShaderMaterial({
            vertexShader:   SHADERS.airScreenVertex,
            fragmentShader: SHADERS.airScreenFragment,
            uniforms: {
                videoTex:  { value: this._videoTex },
                time:      { value: 0 },
                style:     { value: this.style },
                edgeGlow:  { value: 1.0 }
            },
            transparent: false,
            side: THREE.DoubleSide
        });

        this._screen = new THREE.Mesh(geo, this._mat);
        this._screen.renderOrder = 1;
        this.scene.add(this._screen);
    }

    _buildFrame() {
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.ShaderMaterial({
            vertexShader:   SHADERS.frameVertex,
            fragmentShader: SHADERS.frameFragment,
            uniforms: {
                color: { value: new THREE.Color(0x00cfff) },
                time:  { value: 0 }
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this._frame = new THREE.Mesh(geo, mat);
        this._frame.renderOrder = 2;
        this.scene.add(this._frame);
    }

    _buildCornerSparks() {
        // Glowing dots at the 4 corners (like finger anchors)
        this._corners = [];
        const geo = new THREE.SphereGeometry(0.04, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ffee });
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(geo, mat);
            this.scene.add(m);
            this._corners.push(m);
        }
    }

    setStyle(s) {
        this.style = s;
        this._mat.uniforms.style.value = s;
    }

    show() {
        this.active = true;
        this._screen.visible = true;
        this._frame.visible  = true;
        this._corners.forEach(c => c.visible = true);
    }

    hide() {
        this.active = false;
        this._screen.visible = false;
        this._frame.visible  = false;
        this._corners.forEach(c => c.visible = false);
    }

    /**
     * Update given two hand palm centers in world-space coords.
     * leftPos / rightPos: THREE.Vector3
     */
    update(time, leftPos, rightPos) {
        this._mat.uniforms.time.value  = time;
        this._frame.material.uniforms.time.value = time;
        this._videoTex.needsUpdate = true;

        if (!leftPos || !rightPos) { this.hide(); return; }
        this.show();

        // Smooth lerp so the screen doesn't jitter
        const alpha = this._firstFrame ? 1.0 : 0.2;
        this._firstFrame = false;
        this._leftSmooth.lerp(leftPos, alpha);
        this._rightSmooth.lerp(rightPos, alpha);

        const L = this._leftSmooth;
        const R = this._rightSmooth;

        // Center = midpoint
        const center = new THREE.Vector3().addVectors(L, R).multiplyScalar(0.5);

        // Width = distance between hands
        const dx = R.x - L.x;
        const dy = R.y - L.y;
        const dz = R.z - L.z;
        const width  = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const height = width * 0.55; // ~16:9ish aspect

        // Rotation: angle from left to right hand (in XY plane)
        const angle = Math.atan2(dy, dx);

        // Slight depth tilt based on Z difference
        const tiltZ = Math.atan2(dz, width) * 0.8;

        // Apply to screen & frame
        [this._screen, this._frame].forEach(obj => {
            obj.position.copy(center);
            obj.scale.set(width, height, 1);
            obj.rotation.set(tiltZ, 0, angle);
        });

        // Place corner dots
        const hw = width  * 0.5;
        const hh = height * 0.5;
        const cos = Math.cos(angle), sin_ = Math.sin(angle);
        const cornerOffsets = [
            [-hw, -hh], [ hw, -hh],
            [-hw,  hh], [ hw,  hh]
        ];
        cornerOffsets.forEach(([ox, oy], i) => {
            // Rotate offset by screen angle
            const rx = ox * cos - oy * sin_;
            const ry = ox * sin_ + oy * cos;
            this._corners[i].position.set(center.x + rx, center.y + ry, center.z);
            // Pulse scale
            const s = 1.0 + 0.3 * Math.sin(time * 4.0 + i);
            this._corners[i].scale.setScalar(s);
        });
    }

    dispose() {
        [this._screen, this._frame, ...this._corners].forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }
}
