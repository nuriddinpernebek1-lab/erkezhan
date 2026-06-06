const SHADERS = {
    particleVertex: `
        attribute float size;
        attribute vec3 color;
        attribute float opacity;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
            vColor = color;
            vOpacity = opacity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    particleFragment: `
        uniform sampler2D texture;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
            vec4 texColor = texture2D(texture, gl_PointCoord);
            gl_FragColor = vec4(vColor, vOpacity) * texColor;
        }
    `,
    portalVertex: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
            vUv = uv;
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    portalFragment: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        varying vec2 vUv;
        float spiral(vec2 uv, float t) {
            float angle = atan(uv.y - 0.5, uv.x - 0.5);
            float radius = length(uv - 0.5);
            return sin(angle * 5.0 - radius * 20.0 + t * 2.0) * 0.5 + 0.5;
        }
        void main() {
            float s = spiral(vUv, time);
            float radius = length(vUv - 0.5);
            vec3 col = mix(color1, color2, s);
            float alpha = smoothstep(0.5, 0.3, radius);
            gl_FragColor = vec4(col, alpha);
        }
    `
};

function createShaderMaterial(vertexShader, fragmentShader, uniforms) {
    return new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: uniforms || {},
        transparent: true,
        side: THREE.DoubleSide
    });
}
