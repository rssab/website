/**
 * Resonant Background Shader
 * WebGL2 animated background with slow, subtle radiating wave patterns
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
        
        this.gl = this.canvas.getContext('webgl2', {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            powerPreference: 'low-power',
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
        this.canvas.remove();
        document.body.style.background = `
            radial-gradient(ellipse 800px 400px at 30% 30%, rgba(249, 115, 22, 0.03) 0%, transparent 70%),
            radial-gradient(ellipse 600px 300px at 70% 70%, rgba(251, 146, 60, 0.02) 0%, transparent 60%),
            #0a0a0a
        `;
        document.body.style.animation = 'cssWaves 20s ease-in-out infinite alternate';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes cssWaves {
                0% { background-position: 0% 0%, 100% 100%; }
                100% { background-position: 50% 50%, 50% 50%; }
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
            
            // Colors - very subtle
            const vec3 bg = vec3(0.039, 0.039, 0.039);
            const vec3 orange1 = vec3(0.976, 0.451, 0.086);
            const vec3 orange2 = vec3(0.984, 0.573, 0.235);
            const vec3 orange3 = vec3(0.992, 0.729, 0.455);
            
            // Slow radiating ring from a point
            float radiatingRing(vec2 uv, vec2 center, float time, float speed, float spacing) {
                float dist = length(uv - center);
                // Very slow expansion
                float wave = sin((dist - time * speed) * spacing) * 0.5 + 0.5;
                // Fade out with distance
                float fade = exp(-dist * 1.5);
                // Soft ring shape
                float ring = wave * fade;
                return ring;
            }
            
            // Multiple concentric rings
            float concentricWaves(vec2 uv, vec2 center, float time) {
                float result = 0.0;
                // Layer multiple ring frequencies - all very slow
                result += radiatingRing(uv, center, time, 0.02, 8.0) * 0.4;
                result += radiatingRing(uv, center, time, 0.015, 12.0) * 0.3;
                result += radiatingRing(uv, center, time, 0.01, 16.0) * 0.2;
                return result;
            }
            
            void main() {
                vec2 uv = v_uv;
                vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                vec2 uvAspect = (uv - 0.5) * aspect + 0.5;
                
                // Very slow time
                float time = u_time * 0.0003;
                
                vec3 color = bg;
                
                // Multiple radiating wave sources - subtle but visible
                float intensity = 0.025;
                
                // Center emanation
                color += concentricWaves(uvAspect, vec2(0.5, 0.5), time) * orange1 * intensity;
                
                // Corner emanations - offset timing for variety
                color += concentricWaves(uvAspect, vec2(0.15, 0.2), time + 10.0) * orange2 * intensity * 0.8;
                color += concentricWaves(uvAspect, vec2(0.85, 0.8), time + 20.0) * orange3 * intensity * 0.8;
                color += concentricWaves(uvAspect, vec2(0.8, 0.25), time + 30.0) * orange1 * intensity * 0.6;
                color += concentricWaves(uvAspect, vec2(0.2, 0.75), time + 40.0) * orange2 * intensity * 0.6;
                
                // Very subtle vignette
                float vignette = 1.0 - length(uv - 0.5) * 0.3;
                color *= vignette;
                
                // Subtle breathing - very slow
                color *= 0.85 + 0.15 * sin(time * 0.5);
                
                fragColor = vec4(color, 1.0);
            }
        `);
        
        this.program = this.createProgram(vertexShader, fragmentShader);
        
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ResonantBackground();
    });
} else {
    new ResonantBackground();
}