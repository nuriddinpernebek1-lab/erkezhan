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
        uniform sampler2D tex;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
            vec4 texColor = texture2D(tex, gl_PointCoord);
            gl_FragColor = vec4(vColor, vOpacity) * texColor;
        }
    `,

    // Air Screen: renders video texture on a plane between hands
    airScreenVertex: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    airScreenFragment: `
        uniform sampler2D videoTex;
        uniform float time;
        uniform float style; // 0=normal, 1=cyanotype, 2=glitch, 3=halftone
        uniform float edgeGlow;
        varying vec2 vUv;

        float rand(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
        }

        vec3 cyanotype(vec3 col) {
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            // Dark areas -> white, bright -> deep blue (like cyanotype print)
            vec3 cyan = vec3(0.05, 0.25, 0.55);
            vec3 white = vec3(0.95, 0.96, 0.98);
            return mix(white, cyan, lum);
        }

        vec3 halftone(vec3 col, vec2 uv) {
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            vec2 grid = floor(uv * 80.0) / 80.0;
            vec2 center = grid + vec2(0.5/80.0);
            float dist = length(uv - center);
            float radius = lum * 0.007;
            float dot_ = step(dist, radius);
            return vec3(1.0 - dot_) * vec3(0.95, 0.2, 0.2);
        }

        void main() {
            vec2 uv = vUv;
            // Mirror UV (selfie view)
            uv.x = 1.0 - uv.x;

            // Edge glow
            float edge = 0.0;
            float ew = 0.04;
            if (uv.x < ew || uv.x > 1.0-ew || uv.y < ew || uv.y > 1.0-ew) {
                edge = 1.0 - min(
                    min(uv.x, 1.0-uv.x),
                    min(uv.y, 1.0-uv.y)
                ) / ew;
            }

            if (style < 0.5) {
                // Normal with slight vignette
                vec4 col = texture2D(videoTex, uv);
                col.rgb = mix(col.rgb, vec3(0.0), edge * 0.5);
                gl_FragColor = col;

            } else if (style < 1.5) {
                // Cyanotype
                vec4 col = texture2D(videoTex, uv);
                vec3 cyan = cyanotype(col.rgb);
                // Add some texture noise
                float noise = rand(uv + time * 0.01) * 0.04;
                cyan += noise;
                // Edge glow blue
                cyan = mix(cyan, vec3(0.2, 0.6, 1.0), edge * edgeGlow);
                gl_FragColor = vec4(cyan, 1.0);

            } else if (style < 2.5) {
                // Glitch
                float glitchAmt = rand(vec2(floor(time * 8.0), floor(uv.y * 15.0))) * 0.08;
                vec2 guv = uv + vec2(glitchAmt, 0.0);
                float r = texture2D(videoTex, guv + vec2(0.01, 0.0)).r;
                float g = texture2D(videoTex, uv).g;
                float b = texture2D(videoTex, guv - vec2(0.01, 0.0)).b;
                vec3 col = vec3(r, g, b);
                col = mix(col, vec3(0.0, 1.0, 0.8), edge * edgeGlow);
                gl_FragColor = vec4(col, 1.0);

            } else {
                // Halftone + cyanotype base
                vec4 col = texture2D(videoTex, uv);
                vec3 cyan = cyanotype(col.rgb);
                vec3 dots = halftone(col.rgb, uv);
                vec3 final = cyan + dots;
                final = mix(final, vec3(0.2, 0.8, 1.0), edge * edgeGlow);
                gl_FragColor = vec4(final, 1.0);
            }
        }
    `,

    // Edge/border glow for the screen frame
    frameVertex: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    frameFragment: `
        uniform vec3 color;
        uniform float time;
        varying vec2 vUv;
        void main() {
            float border = 1.0 - smoothstep(0.0, 0.15, min(min(vUv.x, 1.0-vUv.x), min(vUv.y, 1.0-vUv.y)));
            float pulse = 0.7 + 0.3 * sin(time * 3.0);
            gl_FragColor = vec4(color * pulse, border * 0.9);
        }
    `,

    portalVertex: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
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

function createShaderMaterial(vs, fs, uniforms) {
    return new THREE.ShaderMaterial({
        vertexShader: vs, fragmentShader: fs,
        uniforms: uniforms || {},
        transparent: true, side: THREE.DoubleSide
    });
}
