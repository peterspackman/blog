import type { PatternType, PatternParams } from './types';

// ─── Shader sources ───────────────────────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform float u_half;
uniform int u_type;

// Rectangle
uniform vec2 u_rectSize;
// Double slit
uniform float u_slitW, u_slitSep, u_slitH;
// Circle
uniform float u_circleR;
// Grating
uniform float u_gratFreq, u_gratCos, u_gratSin;
// Gaussian
uniform vec2 u_sigma2;
// Point sources
uniform int u_ptCount;
uniform float u_ptSpacing, u_ptStartX;
// Rhombus
uniform float u_rhombW, u_rhombH, u_rhombGrad;
// Packed shapes
uniform int u_packShape, u_packPacking;
uniform float u_packElem, u_packSpace, u_packEnvR;

float coverage(float d) {
    return smoothstep(1.0, -1.0, d);
}

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    // Exact SDF: length(max(d,0)) + min(max(d.x,d.y),0)
    return max(d.x, d.y);
}

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float sdRhombus(vec2 p, float s) {
    return (abs(p.x) + abs(p.y) - s) * 0.7071068;
}

float shapeSDF(int shape, vec2 p, float size) {
    if (shape == 0) return sdCircle(p, size);
    if (shape == 1) return sdBox(p, vec2(size));
    return sdRhombus(p, size);
}

void main() {
    vec2 pos = gl_FragCoord.xy - u_half;
    float v = 0.0;

    if (u_type == 0) {
        // Rectangle
        v = coverage(sdBox(pos, u_rectSize));
    }
    else if (u_type == 1) {
        // Double slit — union of two rectangles
        vec2 sz = vec2(u_slitW, u_slitH);
        float dL = sdBox(pos + vec2(u_slitSep, 0.0), sz);
        float dR = sdBox(pos - vec2(u_slitSep, 0.0), sz);
        v = coverage(min(dL, dR));
    }
    else if (u_type == 2) {
        // Circle
        v = coverage(sdCircle(pos, u_circleR));
    }
    else if (u_type == 3) {
        // Grating — anti-aliased square wave
        float N2 = u_half * 2.0;
        vec2 uv = pos / N2;
        float rot = uv.x * u_gratCos + uv.y * u_gratSin;
        float s = sin(6.2831853 * u_gratFreq * rot);
        float slope = 6.2831853 * u_gratFreq / N2;
        v = coverage(-s / slope);
    }
    else if (u_type == 4) {
        // Gaussian
        v = exp(-pos.x * pos.x / u_sigma2.x - pos.y * pos.y / u_sigma2.y);
    }
    else if (u_type == 5) {
        // Point sources
        float best = 1e6;
        for (int i = 0; i < 8; i++) {
            if (i < u_ptCount) {
                float cx = u_ptStartX + float(i) * u_ptSpacing;
                best = min(best, length(pos - vec2(cx, 0.0)) - 2.0);
            }
        }
        v = coverage(best);
    }
    else if (u_type == 6) {
        // Rhombus
        float d = (abs(pos.x) / u_rhombW + abs(pos.y) / u_rhombH - 1.0) / u_rhombGrad;
        v = coverage(d);
    }
    else if (u_type == 7) {
        // Packed shapes
        float envD = length(pos) - u_packEnvR;
        float envC = coverage(envD);
        if (envC > 0.0) {
            float rowH = u_packPacking == 1 ? u_packSpace * 0.8660254 : u_packSpace;
            float rowIdx = floor(pos.y / rowH + 0.5);
            float isOdd = step(0.25, fract(rowIdx * 0.5));
            float rowOff = u_packPacking == 1 ? isOdd * u_packSpace * 0.5 : 0.0;
            float colIdx = floor((pos.x - rowOff) / u_packSpace + 0.5);
            vec2 center = vec2(colIdx * u_packSpace + rowOff, rowIdx * rowH);
            float sD = shapeSDF(u_packShape, pos - center, u_packElem);
            v = envC * coverage(sD);
        }
    }

    gl_FragColor = vec4(v, 0.0, 0.0, 1.0);
}
`;

// ─── Type → integer mapping ───────────────────────────────────────────────────

const TYPE_ID: Record<PatternType, number> = {
    rectangle: 0,
    doubleSlit: 1,
    circle: 2,
    grating: 3,
    gaussian: 4,
    pointSources: 5,
    rhombus: 6,
    packedShapes: 7,
};

const SHAPE_ID = { circle: 0, square: 1, rhombus: 2 } as const;
const PACKING_ID = { square: 0, hex: 1 } as const;

// ─── Uniform names ────────────────────────────────────────────────────────────

const UNIFORM_NAMES = [
    'u_half', 'u_type',
    'u_rectSize',
    'u_slitW', 'u_slitSep', 'u_slitH',
    'u_circleR',
    'u_gratFreq', 'u_gratCos', 'u_gratSin',
    'u_sigma2',
    'u_ptCount', 'u_ptSpacing', 'u_ptStartX',
    'u_rhombW', 'u_rhombH', 'u_rhombGrad',
    'u_packShape', 'u_packPacking',
    'u_packElem', 'u_packSpace', 'u_packEnvR',
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];

// ─── GPU renderer class ──────────────────────────────────────────────────────

export class PatternGPU {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private canvas: HTMLCanvasElement;
    private locs: Record<string, WebGLUniformLocation | null>;
    private currentN = 0;
    private readBuf: Uint8Array | null = null;

    private constructor(
        gl: WebGLRenderingContext,
        program: WebGLProgram,
        canvas: HTMLCanvasElement,
    ) {
        this.gl = gl;
        this.program = program;
        this.canvas = canvas;

        // Cache all uniform locations
        this.locs = {};
        for (const name of UNIFORM_NAMES) {
            this.locs[name] = gl.getUniformLocation(program, name);
        }

        // Fullscreen quad
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1,
        ]), gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, 'a_pos');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.useProgram(program);
    }

    /** Create a GPU renderer, or null if WebGL is unavailable. */
    static create(): PatternGPU | null {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl', {
                preserveDrawingBuffer: true,
                antialias: false,
            });
            if (!gl) return null;

            const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
            const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
            if (!vs || !fs) return null;

            const prog = gl.createProgram()!;
            gl.attachShader(prog, vs);
            gl.attachShader(prog, fs);
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                console.warn('PatternGPU link error:', gl.getProgramInfoLog(prog));
                return null;
            }

            return new PatternGPU(gl, prog, canvas);
        } catch {
            return null;
        }
    }

    /** Render pattern to Float32Array of size N*N. */
    generate(type: PatternType, params: PatternParams, N: number): Float32Array {
        const { gl, locs } = this;

        // Resize if needed
        if (this.currentN !== N) {
            this.canvas.width = N;
            this.canvas.height = N;
            gl.viewport(0, 0, N, N);
            this.currentN = N;
            this.readBuf = new Uint8Array(N * N * 4);
        }

        const half = N / 2;
        const loc = (name: UniformName) => locs[name]!;

        // Global
        gl.uniform1f(loc('u_half'), half);
        gl.uniform1i(loc('u_type'), TYPE_ID[type]);

        // Rectangle
        gl.uniform2f(loc('u_rectSize'), params.rectWidth * half, params.rectHeight * half);

        // Double slit
        gl.uniform1f(loc('u_slitW'), params.slitWidth * half);
        gl.uniform1f(loc('u_slitSep'), params.slitSeparation * half);
        gl.uniform1f(loc('u_slitH'), 0.4 * half);

        // Circle
        gl.uniform1f(loc('u_circleR'), params.circleRadius * half);

        // Grating (precompute trig on CPU)
        const angleRad = params.gratingAngle * Math.PI / 180;
        gl.uniform1f(loc('u_gratFreq'), params.gratingFrequency);
        gl.uniform1f(loc('u_gratCos'), Math.cos(angleRad));
        gl.uniform1f(loc('u_gratSin'), Math.sin(angleRad));

        // Gaussian
        const sx = params.sigmaX * half;
        const sy = params.sigmaY * half;
        gl.uniform2f(loc('u_sigma2'), 2 * sx * sx, 2 * sy * sy);

        // Point sources
        const count = Math.max(1, Math.round(params.pointCount));
        const ptSpacing = params.pointSpacing * half;
        gl.uniform1i(loc('u_ptCount'), count);
        gl.uniform1f(loc('u_ptSpacing'), ptSpacing);
        gl.uniform1f(loc('u_ptStartX'), -((count - 1) * ptSpacing) / 2);

        // Rhombus
        const rw = params.rhombusWidth * half;
        const rh = params.rhombusHeight * half;
        gl.uniform1f(loc('u_rhombW'), rw);
        gl.uniform1f(loc('u_rhombH'), rh);
        gl.uniform1f(loc('u_rhombGrad'), Math.sqrt(1 / (rw * rw) + 1 / (rh * rh)));

        // Packed shapes
        gl.uniform1i(loc('u_packShape'), SHAPE_ID[params.packShape]);
        gl.uniform1i(loc('u_packPacking'), PACKING_ID[params.packPacking]);
        gl.uniform1f(loc('u_packElem'), params.packElementSize * half);
        gl.uniform1f(loc('u_packSpace'), params.packSpacing * half);
        gl.uniform1f(loc('u_packEnvR'), params.packEnvelopeRadius * half);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Read back R channel → Float32Array
        const pixels = this.readBuf!;
        gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        const data = new Float32Array(N * N);
        const inv = 1 / 255;
        for (let i = 0; i < N * N; i++) {
            data[i] = pixels[i * 4] * inv;
        }
        return data;
    }

    dispose(): void {
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string,
): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('PatternGPU shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
