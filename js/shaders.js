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
    
    bloomVertex: `
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    bloomFragment: `
        uniform sampler2D tDiffuse;
        uniform float threshold;
        uniform float smoothWidth;
        
        varying vec2 vUv;
        
        vec3 brightFilter(vec3 color) {
            float lum = dot(color, vec3(0.299, 0.587, 0.114));
            if (lum < threshold) return vec3(0.0);
            return color * smoothstep(threshold - smoothWidth, threshold + smoothWidth, lum);
        }
        
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 brightColor = brightFilter(texel.rgb);
            gl_FragColor = vec4(brightColor, texel.a);
        }
    `,
    
    glowVertex: `
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    glowFragment: `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float strength;
        
        varying vec2 vUv;
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            
            float glow = 0.0;
            float pixelSize = 1.0 / uResolution.x;
            
            for (float i = -4.0; i <= 4.0; i += 1.0) {
                for (float j = -4.0; j <= 4.0; j += 1.0) {
                    vec2 offset = vec2(i * pixelSize, j * pixelSize / (uResolution.y / uResolution.x));
                    vec4 sampleColor = texture2D(tDiffuse, vUv + offset);
                    float dist = sqrt(i * i + j * j);
                    glow += dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114)) / (dist + 1.0);
                }
            }
            
            glow = glow / 81.0 * strength;
            vec3 finalColor = color.rgb + vec3(glow);
            gl_FragColor = vec4(finalColor, color.a);
        }
    `,
    
    glitchVertex: `
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    glitchFragment: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float amount;
        
        varying vec2 vUv;
        
        float rand(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
            vec2 glitchUv = vUv;
            float glitch = rand(vec2(time)) * amount;
            
            float r = texture2D(tDiffuse, vUv + vec2(glitch * 0.05, 0.0)).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - vec2(glitch * 0.05, 0.0)).b;
            
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `,
    
    lightningVertex: `
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    lightningFragment: `
        uniform float time;
        uniform vec3 color;
        
        varying vec2 vUv;
        
        float noise(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        float fnoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float n = mix(mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x),
                         mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x), f.y);
            return n;
        }
        
        void main() {
            vec2 uv = vUv * 3.0;
            float n = fnoise(uv + time * 2.0);
            float lightning = pow(abs(sin(n * 3.14159)), 2.0) * (1.0 - abs(vUv.x - 0.5) * 2.0);
            gl_FragColor = vec4(color * lightning, lightning);
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
        varying vec3 vPosition;
        
        float spiral(vec2 uv, float time) {
            float angle = atan(uv.y, uv.x);
            float radius = length(uv - 0.5);
            float spiral = sin(angle * 5.0 - radius * 20.0 + time * 2.0);
            return spiral * 0.5 + 0.5;
        }
        
        void main() {
            vec2 center = vUv - 0.5;
            float s = spiral(vUv, time);
            float radius = length(center);
            
            vec3 color = mix(color1, color2, s);
            float alpha = 1.0 - radius;
            alpha = smoothstep(0.0, 1.0, alpha);
            
            gl_FragColor = vec4(color, alpha);
        }
    `,
    
    cyberpunkVertex: `
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    cyberpunkFragment: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        
        varying vec2 vUv;
        
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            
            float scanline = sin(vUv.y * resolution.y * 0.5 + time * 10.0) * 0.1 + 0.9;
            float chromatic = sin(vUv.x * 50.0 + time) * 0.02;
            
            vec4 color = texel * vec4(scanline);
            color += texture2D(tDiffuse, vUv + vec2(chromatic, 0.0)) * 0.1;
            
            gl_FragColor = color;
        }
    `,
    
    sphereVertex: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    sphereFragment: `
        uniform vec3 color;
        uniform float time;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(-vPosition);
            
            float fresnel = pow(1.0 - dot(normal, viewDir), 3.0);
            float glow = sin(length(vPosition) * 10.0 + time * 2.0) * 0.5 + 0.5;
            
            vec3 finalColor = color * (1.0 + fresnel * 0.5 + glow * 0.3);
            gl_FragColor = vec4(finalColor, 0.8);
        }
    `,
    
    circleVertex: `
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    circleFragment: `
        uniform float time;
        uniform vec3 color;
        
        varying vec2 vUv;
        
        void main() {
            vec2 center = vUv - 0.5;
            float radius = length(center);
            float angle = atan(center.y, center.x);
            
            float ring1 = sin(radius * 20.0 - time * 3.0) * 0.5 + 0.5;
            float ring2 = sin(radius * 30.0 + angle * 8.0 - time * 2.0) * 0.5 + 0.5;
            
            float circle = smoothstep(0.5, 0.4, radius);
            circle += smoothstep(0.4, 0.35, radius) * ring1;
            circle += smoothstep(0.35, 0.3, radius) * ring2;
            
            gl_FragColor = vec4(color, circle);
        }
    `,
    
    heatDistortionVertex: `
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    heatDistortionFragment: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 hotSpot;
        uniform float radius;
        
        varying vec2 vUv;
        
        void main() {
            vec2 distortion = vUv - hotSpot;
            float dist = length(distortion);
            
            float wave = sin(dist * 20.0 - time * 5.0) * 0.02;
            float waveAmount = smoothstep(radius, 0.0, dist);
            
            vec2 uv = vUv + distortion * wave * waveAmount;
            gl_FragColor = texture2D(tDiffuse, uv);
        }
    `
};

function createShaderMaterial(vertexShader, fragmentShader, uniforms = {}) {
    return new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            ...uniforms
        },
        transparent: true,
        side: THREE.DoubleSide
    });
}