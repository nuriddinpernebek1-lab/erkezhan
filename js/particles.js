class ParticleSystem {
    constructor(scene, maxParticles) {
        this.scene = scene;
        this.maxParticles = maxParticles || 1000;
        this.particles = [];
        this.particlePool = [];
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.maxParticles * 3);
        this.colors = new Float32Array(this.maxParticles * 3);
        this.sizes = new Float32Array(this.maxParticles);
        this.opacities = new Float32Array(this.maxParticles);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
        this.geometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));

        this.material = new THREE.ShaderMaterial({
            vertexShader: SHADERS.particleVertex,
            fragmentShader: SHADERS.particleFragment,
            uniforms: { texture: { value: this.createTexture() } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.mesh);
    }

    createTexture() {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    }

    emit(position, velocity, color, count, size, life) {
        count = count || 1;
        size = size || 5;
        life = life || 1;
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;
            let p = this.particlePool.pop() || {
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                acceleration: new THREE.Vector3(),
                color: new THREE.Color()
            };
            p.position.copy(position);
            p.velocity.copy(velocity);
            p.velocity.x += (Math.random() - 0.5) * 1.5;
            p.velocity.y += (Math.random() - 0.5) * 1.5;
            p.velocity.z += (Math.random() - 0.5) * 1.0;
            p.acceleration.set(0, -0.8, 0);
            p.color.copy(color);
            p.size = size * (0.7 + Math.random() * 0.6);
            p.maxLife = life * (0.7 + Math.random() * 0.6);
            p.life = p.maxLife;
            p.opacity = 1;
            this.particles.push(p);
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particlePool.push(this.particles.splice(i, 1)[0]);
                continue;
            }
            p.velocity.addScaledVector(p.acceleration, dt);
            p.position.addScaledVector(p.velocity, dt);
            p.opacity = Math.max(0, p.life / p.maxLife);
        }
        this._updateGeometry();
    }

    _updateGeometry() {
        const count = Math.min(this.particles.length, this.maxParticles);
        for (let i = 0; i < count; i++) {
            const p = this.particles[i];
            const idx = i * 3;
            this.positions[idx] = p.position.x;
            this.positions[idx+1] = p.position.y;
            this.positions[idx+2] = p.position.z;
            this.colors[idx] = p.color.r;
            this.colors[idx+1] = p.color.g;
            this.colors[idx+2] = p.color.b;
            this.sizes[i] = p.size;
            this.opacities[i] = p.opacity;
        }
        // Zero out unused slots
        for (let i = count; i < this.maxParticles; i++) {
            this.opacities[i] = 0;
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.opacity.needsUpdate = true;
        this.geometry.setDrawRange(0, count);
    }

    clear() { this.particles = []; }

    dispose() {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
    }
}
