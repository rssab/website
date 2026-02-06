/**
 * Resonant Background Shader
 * Direct port from shadertoy.com/view/4lyBR3
 */

class ResonantBackground {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.startTime = Date.now();
        this.animationId = null;
        this.isVisible = true;
        
        // Pan for page transitions
        this.panX = 0;
        this.panY = 0;
        this.targetPanX = 0;
        this.targetPanY = 0;
        this.panSpeed = 0.04;
        
        this.pageDeltas = {
            '/': { x: 0, y: 0.3 },
            '/home': { x: 0, y: 0.3 },
            '/technology': { x: 0.4, y: 0 },
            '/kits': { x: -0.4, y: 0 },
            '/community': { x: 0, y: -0.3 },
            '/about': { x: -0.3, y: 0.2 },
            '/contact': { x: 0.3, y: -0.2 },
            '/equipment': { x: 0.2, y: 0.25 },
        };
        
        this.init();
        this.setupVisibilityHandling();
        this.setupPageTransitions();
    }
    
    updatePan() {
        this.panX += (this.targetPanX - this.panX) * this.panSpeed;
        this.panY += (this.targetPanY - this.panY) * this.panSpeed;
    }
    
    setupPageTransitions() {
        document.body.addEventListener('htmx:beforeSwap', (e) => {
            const path = e.detail.pathInfo?.requestPath || e.detail.requestConfig?.path || '';
            const delta = this.pageDeltas[path] || { x: 0, y: 0 };
            this.targetPanX = this.panX + delta.x;
            this.targetPanY = this.panY + delta.y;
        });
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
        document.body.style.background = '#0a0a0a';
    }
    
    setupWebGL() {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, `#version 300 es
            in vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `);
        
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `#version 300 es
            precision highp float;
            out vec4 fragColor;
            
            uniform float iTime;
            uniform vec2 iResolution;
            uniform vec2 u_pan;
            
            const float PI = 3.14159265359;
            const int MAX_MARCHING_STEPS = 35;
            const float EPSILON = 0.0001;
            
            vec2 rotate2d(vec2 v, float a) {
                return vec2(v.x * cos(a) - v.y * sin(a), v.y * cos(a) + v.x * sin(a)); 
            }
            
            void pR(inout vec2 p, float a) {
                p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
            }
            
            float sdTorus(vec3 p, vec2 t) {
                vec2 q = vec2(length(p.xz)-t.x, p.y);
                return length(q)-t.y;
            }
            
            float opTwist(vec3 p, float fftValue, float time) {
                float c = cos((fftValue*1.5) * p.y);
                float s = sin((fftValue+0.5) * p.y);
                mat2 m = mat2(c,-s,s,c);
                vec3 q = vec3(m * p.xz, p.y);
                return sdTorus(q, vec2(abs(sin(time*0.1))+0.5*(fftValue*0.2), fftValue*0.0001));
            }
            
            float opRep(vec3 p, vec3 c, float time) {
                float idx = mod(floor(p.x/c.x), 32.0);
                float idy = mod(floor(p.y/c.y), 32.0);
                float idz = mod(floor(p.z/c.z), 32.0);
                
                float id = length(vec3(idx, idy, idz));
                
                // Simulated FFT value (original uses audio texture)
                float fftValue = 0.5;
                
                vec3 q = mod(p, c) - 0.5 * c;
                vec3 r = q;
                
                float rotationAmount = (id * 5.0) + (time * 2.0);
                
                bool xmod2 = mod(idx, 2.0) == 0.0;
                
                if (xmod2) {
                    q.y += 1.5;
                    r.y -= 1.5;
                }
                
                pR(q.xy, rotationAmount);
                pR(q.xz, rotationAmount * 0.1);
                
                float shape1 = opTwist(q, fftValue, time);
                
                if (xmod2) {
                    pR(r.xy, rotationAmount);
                    pR(r.xz, rotationAmount * 0.1);
                    float shape2 = opTwist(r, fftValue, time);
                    return min(shape1, shape2);
                } else {
                    return shape1;
                }
            }
            
            float sceneSDF(vec3 samplePoint, float time) {
                return opRep(samplePoint, vec3(3.0, 3.0, 3.0), time);
            }
            
            vec3 castRay(vec3 pos, vec3 dir, float time) {
                for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
                    float dist = sceneSDF(pos, time);
                    if (dist < EPSILON) {
                        return pos;
                    }
                    pos += dist * dir;
                }    
                return pos;
            }
            
            float lightPointDiffuse(vec3 pos, vec3 lightPos) {
                float lightDist = length(lightPos - pos);
                float color = 3.0 / (lightDist * lightDist);
                return max(0.0, color);
            }
            
            void main() {
                vec2 fragCoord = gl_FragCoord.xy;
                
                vec4 mousePos = vec4(0.5, -0.2, 0.0, 0.0);
                
                vec2 screenPos = (fragCoord.xy / iResolution.xy) * 2.0 - 1.0;
                
                vec3 cameraPos = vec3(0.0, 0.0, -8.0);
                
                vec3 cameraDir = vec3(0.0, 0.0, 1.0);
                vec3 planeU = vec3(2.0, 0.0, 0.0);
                vec3 planeV = vec3(0.0, iResolution.y / iResolution.x * 2.0, 0.0);
                vec3 rayDir = normalize(cameraDir + screenPos.x * planeU + screenPos.y * planeV);
                
                cameraPos.yz = rotate2d(cameraPos.yz, mousePos.y);
                rayDir.yz = rotate2d(rayDir.yz, mousePos.y);
                
                cameraPos.xz = rotate2d(cameraPos.xz, mousePos.x + u_pan.x * 0.3);
                rayDir.xz = rotate2d(rayDir.xz, mousePos.x + u_pan.x * 0.3);
                
                cameraPos.zy += iTime;
                cameraPos.x += u_pan.x * 2.0;
                cameraPos.y += u_pan.y * 2.0;
                
                vec3 rayPos = castRay(cameraPos, rayDir, iTime);
                
                // base color (orange instead of blue)
                vec3 color = vec3(0.43, 0.12, 0.01);
                
                color += (rayDir*0.02);
                
                vec3 lightPos = cameraPos;
                
                float lighting = lightPointDiffuse(rayPos, lightPos);
                lighting = min(lighting, 0.1); // Cap max brightness
                color *= 2.0 * lighting * 2.0;
                
                color = pow(color, vec3(0.5));
                
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
        // Render at lower resolution for performance, CSS scales up
        const scale = 0.25; // 25% resolution
        const width = Math.floor(window.innerWidth * scale);
        const height = Math.floor(window.innerHeight * scale);
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        
        if (this.gl) {
            this.gl.viewport(0, 0, width, height);
            
            const resolutionLocation = this.gl.getUniformLocation(this.program, 'iResolution');
            this.gl.uniform2f(resolutionLocation, width, height);
        }
    }
    
    animate() {
        if (!this.isVisible) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        const currentTime = ((Date.now() - this.startTime) / 1000.0 + 300.0) * 0.015; // Start 300s ahead
        const timeLocation = this.gl.getUniformLocation(this.program, 'iTime');
        this.gl.uniform1f(timeLocation, currentTime);
        
        // Update pan
        this.updatePan();
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
