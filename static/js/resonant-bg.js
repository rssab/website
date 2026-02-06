/**
 * Resonant Background Shader
 * WebGL2 animated background with sound wave patterns
 */

class ResonantBackground {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.startTime = Date.now();
        this.animationId = null;
        this.isVisible = true;
        
        this.init();
        this.setupVisibilityHandling();
    }
    
    init() {
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: none;
        `;
        document.body.appendChild(this.canvas);
        
        // Try WebGL2
        this.gl = this.canvas.getContext('webgl2', {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            powerPreference: 'low-power'
        });
        
        if (!this.gl) {
            this.fallbackToCss();
            return;
        }
        
        this.setupWebGL();
        this.resize();
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
    }
    
    fallbackToCss() {
        // CSS gradient fallback
        this.canvas.remove();
        document.body.style.background = `
            radial-gradient(ellipse 600px 300px at 25% 25%, rgba(249, 115, 22, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 400px 200px at 75% 75%, rgba(251, 146, 60, 0.03) 0%, transparent 50%),
            #0a0a0a
        `;
        document.body.style.animation = 'cssWaves 8s ease-in-out infinite alternate';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes cssWaves {
                0% { background-position: 0% 0%, 100% 100%; }
                100% { background-position: 100% 100%, 0% 0%; }
            }
        `;
        document.head.appendChild(style);
    }
    
    setupWebGL() {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, `#version 300 es
            in vec2 a_position;
            out vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `);
        
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `#version 300 es
            precision mediump float;
            in vec2 v_uv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            
            // Colors
            const vec3 bg = vec3(0.039, 0.039, 0.039); // #0a0a0a
            const vec3 orange1 = vec3(0.976, 0.451, 0.086); // #f97316
            const vec3 orange2 = vec3(0.984, 0.573, 0.235); // #fb923c
            const vec3 orange3 = vec3(0.992, 0.729, 0.455); // #fdba74
            
            float sdCircle(vec2 p, float r) {
                return length(p) - r;
            }
            
            float resonanceRing(vec2 uv, vec2 center, float time) {
                float dist = length(uv - center);
                float wave = sin(dist * 15.0 - time * 2.0) * 0.5 + 0.5;
                float ring = 1.0 - smoothstep(0.0, 0.1, abs(dist - 0.3 - sin(time) * 0.1));
                return wave * ring * 0.3;
            }
            
            float waveform(vec2 uv, float time) {
                float y = sin(uv.x * 10.0 + time) * 0.1 + 
                         sin(uv.x * 20.0 + time * 1.5) * 0.05 +
                         sin(uv.x * 5.0 + time * 0.8) * 0.03;
                float line = 1.0 - smoothstep(0.0, 0.02, abs(uv.y - 0.5 - y));
                return line * 0.2;
            }
            
            void main() {
                vec2 uv = v_uv;
                vec2 center = uv - 0.5;
                float time = u_time * 0.001;
                
                vec3 color = bg;
                
                // Resonance rings
                color += resonanceRing(uv, vec2(0.3, 0.7), time) * orange1;
                color += resonanceRing(uv, vec2(0.8, 0.3), time + 2.0) * orange2;
                color += resonanceRing(uv, vec2(0.2, 0.2), time + 4.0) * orange3;
                
                // Waveforms
                color += waveform(vec2(uv.x, uv.y + 0.3), time) * orange2;
                color += waveform(vec2(uv.x, uv.y - 0.2), time + 1.5) * orange3;
                
                // Vignette
                float vignette = smoothstep(1.2, 0.3, length(center));
                color *= vignette;
                
                // Subtle overall animation
                color *= 0.7 + 0.3 * sin(time * 0.5);
                
                fragColor = vec4(color, 1.0);
            }
        `);
        
        this.program = this.createProgram(vertexShader, fragmentShader);
        
        // Create fullscreen quad
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        
        const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.useProgram(this.program);
    }
    
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }
    
    resize() {
        const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
        const width = window.innerWidth * pixelRatio;
        const height = window.innerHeight * pixelRatio;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        
        if (this.gl) {
            this.gl.viewport(0, 0, width, height);
            
            const resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
            this.gl.uniform2f(resolutionLocation, width, height);
        }
    }
    
    animate() {
        if (!this.isVisible) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        const currentTime = Date.now() - this.startTime;
        const timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
        this.gl.uniform1f(timeLocation, currentTime);
        
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
        });
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas) {
            this.canvas.remove();
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ResonantBackground();
    });
} else {
    new ResonantBackground();
}