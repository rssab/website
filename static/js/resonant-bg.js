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
        
        // Pan offset for page transitions
        this.panX = 0;
        this.panY = 0;
        this.targetPanX = 0;
        this.targetPanY = 0;
        this.panSpeed = 0.04;
        
        // Direction mapping for pages (stronger movement)
        this.pageDirections = {
            '/': { x: 0, y: -0.5 },            // Home: from top
            '/home': { x: 0, y: -0.5 },        // Home: from top
            '/technology': { x: 0.6, y: 0 },   // Technology: from right
            '/kits': { x: -0.6, y: 0 },        // Kits: from left
            '/community': { x: 0, y: 0.5 },    // Community: from bottom
            '/about': { x: -0.4, y: -0.3 },    // About: from top-left
            '/contact': { x: 0.4, y: 0.3 },    // Contact: from bottom-right
        };
        
        this.init();
        this.setupVisibilityHandling();
        this.setupPageTransitions();
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
            uniform vec2 u_pan;
            
            // Colors - very subtle
            const vec3 bg = vec3(0.039, 0.039, 0.039);
            const vec3 orange1 = vec3(0.976, 0.451, 0.086);
            const vec3 orange2 = vec3(0.984, 0.573, 0.235);
            const vec3 orange3 = vec3(0.992, 0.729, 0.455);
            
            // Radiating ring from a point - sharp and visible
            float radiatingRing(vec2 uv, vec2 center, float time, float speed, float spacing) {
                float dist = length(uv - center);
                // Ring expansion
                float phase = (dist - time * speed) * spacing;
                // Sharper rings using pow for more defined edges
                float wave = pow(sin(phase) * 0.5 + 0.5, 0.5);
                // Gentler fade to keep rings visible further out
                float fade = exp(-dist * 0.8);
                // Ring shape
                float ring = wave * fade;
                return ring;
            }
            
            // Multiple concentric rings - sharp and radiating outward
            float concentricWaves(vec2 uv, vec2 center, float time) {
                float result = 0.0;
                // Layer multiple ring frequencies with different speeds
                result += radiatingRing(uv, center, time, 0.08, 12.0) * 0.5;
                result += radiatingRing(uv, center, time, 0.06, 8.0) * 0.4;
                result += radiatingRing(uv, center, time, 0.04, 16.0) * 0.3;
                return result;
            }
            
            void main() {
                vec2 uv = v_uv;
                vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                vec2 uvAspect = (uv - 0.5) * aspect + 0.5;
                
                // Apply pan offset for page transitions
                vec2 panOffset = u_pan * 0.5;
                uvAspect += panOffset;
                
                // Animation speed (doubled)
                float time = u_time * 0.0006;
                
                vec3 color = bg;
                
                // Multiple radiating wave sources - subtle but visible
                float intensity = 0.07;
                
                // Center emanation - strongest (moves with pan)
                vec2 center = vec2(0.5, 0.5) + panOffset * 0.3;
                color += concentricWaves(uvAspect, center, time) * orange1 * intensity * 1.1;
                
                // Corner emanations - offset timing for variety (move with pan)
                color += concentricWaves(uvAspect, vec2(0.1, 0.15) + panOffset * 0.2, time + 10.0) * orange2 * intensity * 0.9;
                color += concentricWaves(uvAspect, vec2(0.9, 0.85) + panOffset * 0.2, time + 20.0) * orange3 * intensity * 0.9;
                color += concentricWaves(uvAspect, vec2(0.85, 0.2) + panOffset * 0.2, time + 30.0) * orange1 * intensity * 0.7;
                color += concentricWaves(uvAspect, vec2(0.15, 0.8) + panOffset * 0.2, time + 40.0) * orange2 * intensity * 0.7;
                
                // Gentle vignette
                float vignette = 1.0 - length(uv - 0.5) * 0.2;
                color *= vignette;
                
                // Breathing effect
                color *= 0.8 + 0.2 * sin(time * 0.3);
                
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
        
        // Update pan interpolation
        this.updatePan();
        
        const currentTime = Date.now() - this.startTime;
        const timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
        this.gl.uniform1f(timeLocation, currentTime);
        
        // Update pan uniform
        const panLocation = this.gl.getUniformLocation(this.program, 'u_pan');
        this.gl.uniform2f(panLocation, this.panX, this.panY);
        
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
        });
    }
    
    setupPageTransitions() {
        // Listen for HTMX navigation
        document.body.addEventListener('htmx:beforeRequest', (e) => {
            const path = e.detail.pathInfo?.requestPath || e.detail.path || '';
            const direction = this.pageDirections[path] || { x: 0, y: 0 };
            
            // Set target to new position - waves drift in that direction
            this.targetPanX = direction.x;
            this.targetPanY = direction.y;
            
            // Store direction for content animation
            window.currentPageDirection = direction;
        });
    }
    
    updatePan() {
        // Smooth interpolation toward target
        this.panX += (this.targetPanX - this.panX) * this.panSpeed;
        this.panY += (this.targetPanY - this.panY) * this.panSpeed;
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