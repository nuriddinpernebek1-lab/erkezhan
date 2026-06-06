class ParticleSystem {
    constructor(scene, maxParticles = 1000) {
        this.scene = scene;
        this.maxParticles = maxParticles;
        this.particles = [];
        this.particlePool = [];
        this.active = true;
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(maxParticles * 3);
        this.colors = new Float32Array(maxParticles * 3);
        this.sizes = new Float32Array(maxParticles);
        this.opacities = new Float32Array(maxParticles);
        
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
        this.geometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));
        
        const material = new THREE.ShaderMaterial({
            vertexShader: SHADERS.particleVertex,
            fragmentShader: SHADERS.particleFragment,
            uniforms: {
                texture: { value: this.createParticleTexture() }
            },
            transparent: true,
            sizeAttenuation: true
        });
        
        this.mesh = new THREE.Points(this.geometry, material);
        this.scene.add(this.mesh);
    }
    
    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    emit(position, velocity, color, count = 1, size = 5, life = 1) {
        for (let i = 0; i < count; i++) {
            let particle;
            if (this.particlePool.length > 0) {
                particle = this.particlePool.pop();
            } else {
                particle = {
                    position: new THREE.Vector3(),
                    velocity: new THREE.Vector3(),
                    acceleration: new THREE.Vector3(),
                    color: new THREE.Color(),
                    size: 5,
                    maxLife: 1,
                    life: 1,
                    opacity: 1
                };
            }
            
            particle.position.copy(position);
            particle.velocity.copy(velocity);
            particle.velocity.x += (Math.random() - 0.5) * 2;
            particle.velocity.y += (Math.random() - 0.5) * 2;
            particle.velocity.z += (Math.random() - 0.5) * 2;
            particle.acceleration.set(0, -0.5, 0);
            particle.color.copy(color);
            particle.size = size;
            particle.maxLife = life;
            particle.life = life;
            particle.opacity = 1;
            
            this.particles.push(particle);
        }
    }
    
    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.life -= deltaTime;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
                this.particlePool.push(particle);
                continue;
            }
            
            particle.velocity.add(particle.acceleration.clone().multiplyScalar(deltaTime));
            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
            
            const lifeRatio = particle.life / particle.maxLife;
            particle.opacity = lifeRatio;
        }
        
        this.updateGeometry();
    }
    
    updateGeometry() {
        const count = Math.min(this.particles.length, this.maxParticles);
        
        for (let i = 0; i < count; i++) {
            const particle = this.particles[i];
            const idx = i * 3;
            
            this.positions[idx] = particle.position.x;
            this.positions[idx + 1] = particle.position.y;
            this.positions[idx + 2] = particle.position.z;
            
            this.colors[idx] = particle.color.r;
            this.colors[idx + 1] = particle.color.g;
            this.colors[idx + 2] = particle.color.b;
            
            this.sizes[i] = particle.size;
            this.opacities[i] = particle.opacity;
        }
        
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.opacity.needsUpdate = true;
    }
    
    clear() {
        this.particles = [];
    }
    
    dispose() {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.mesh.material.dispose();
    }
}