/**
 * Full GPU pipeline: pattern SDF → fftshift → Stockham FFT → display.
 * Uses WebGL 2 with RGBA32F textures. No readPixels in the hot path
 * except a single 1×1 read of the DC component for normalization.
 */
import type { PatternType, PatternParams, DisplayMode, ColormapType } from './types';

// ─── Pattern shader (same SDFs as patternGPU.ts, ported to GLSL ES 3.00) ─────

const PATTERN_FRAG = `#version 300 es
precision highp float;

uniform float u_half;
uniform int u_type;
uniform vec2 u_rectSize;
uniform float u_slitW, u_slitSep, u_slitH;
uniform float u_circleR;
uniform float u_gratFreq, u_gratCos, u_gratSin;
uniform vec2 u_sigma2;
uniform int u_ptCount;
uniform float u_ptSpacing, u_ptStartX;
uniform float u_rhombW, u_rhombH, u_rhombGrad;
uniform int u_packShape, u_packPacking;
uniform float u_packElem, u_packSpace, u_packEnvR;

out vec4 fragColor;

float coverage(float d) { return smoothstep(1.0, -1.0, d); }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return max(d.x, d.y); }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdRhombus(vec2 p, float s) { return (abs(p.x) + abs(p.y) - s) * 0.7071068; }
float shapeSDF(int sh, vec2 p, float sz) {
    if (sh == 0) return sdCircle(p, sz);
    if (sh == 1) return sdBox(p, vec2(sz));
    return sdRhombus(p, sz);
}

void main() {
    vec2 pos = gl_FragCoord.xy - u_half;
    float v = 0.0;

    if (u_type == 0) {
        v = coverage(sdBox(pos, u_rectSize));
    } else if (u_type == 1) {
        vec2 sz = vec2(u_slitW, u_slitH);
        v = coverage(min(sdBox(pos + vec2(u_slitSep, 0.0), sz),
                         sdBox(pos - vec2(u_slitSep, 0.0), sz)));
    } else if (u_type == 2) {
        v = coverage(sdCircle(pos, u_circleR));
    } else if (u_type == 3) {
        float N2 = u_half * 2.0;
        vec2 uv = pos / N2;
        float rot = uv.x * u_gratCos + uv.y * u_gratSin;
        float s = sin(6.2831853 * u_gratFreq * rot);
        float slope = 6.2831853 * u_gratFreq / N2;
        v = coverage(-s / slope);
    } else if (u_type == 4) {
        v = exp(-pos.x * pos.x / u_sigma2.x - pos.y * pos.y / u_sigma2.y);
    } else if (u_type == 5) {
        float best = 1e6;
        for (int i = 0; i < 8; i++) {
            if (i < u_ptCount) {
                float cx = u_ptStartX + float(i) * u_ptSpacing;
                best = min(best, length(pos - vec2(cx, 0.0)) - 2.0);
            }
        }
        v = coverage(best);
    } else if (u_type == 6) {
        v = coverage((abs(pos.x) / u_rhombW + abs(pos.y) / u_rhombH - 1.0) / u_rhombGrad);
    } else if (u_type == 7) {
        float envC = coverage(length(pos) - u_packEnvR);
        if (envC > 0.0) {
            float rowH = u_packPacking == 1 ? u_packSpace * 0.8660254 : u_packSpace;
            float rowIdx = floor(pos.y / rowH + 0.5);
            float isOdd = step(0.25, fract(rowIdx * 0.5));
            float rowOff = u_packPacking == 1 ? isOdd * u_packSpace * 0.5 : 0.0;
            float colIdx = floor((pos.x - rowOff) / u_packSpace + 0.5);
            vec2 center = vec2(colIdx * u_packSpace + rowOff, rowIdx * rowH);
            v = envC * coverage(shapeSDF(u_packShape, pos - center, u_packElem));
        }
    }

    fragColor = vec4(v, 0.0, 0.0, 1.0);
}
`;

// ─── FFT-shift pre-multiplication: multiply by (-1)^(x+y) ────────────────────

const PRESHIFT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_input;
out vec4 fragColor;
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 v = texelFetch(u_input, p, 0);
    float shift = ((p.x + p.y) & 1) == 0 ? 1.0 : -1.0;
    fragColor = vec4(v.r * shift, 0.0, 0.0, 1.0);
}
`;

// ─── Stockham FFT pass ────────────────────────────────────────────────────────

const FFT_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_input;
uniform int u_N;
uniform int u_pass;       // 0 .. log2(N)-1
uniform int u_direction;  // 0 = rows (x), 1 = columns (y)

out vec4 fragColor;

void main() {
    ivec2 pixel = ivec2(gl_FragCoord.xy);
    int k     = u_direction == 0 ? pixel.x : pixel.y;
    int other = u_direction == 0 ? pixel.y : pixel.x;

    int m = 1 << u_pass;       // half butterfly size
    int M = m << 1;            // full butterfly size
    int group = k / M;
    int pos   = k - group * M;

    bool isBottom = pos >= m;
    int j = isBottom ? pos - m : pos;

    int evenIdx = group * m + j;
    int oddIdx  = evenIdx + (u_N >> 1);

    ivec2 eCoord = u_direction == 0 ? ivec2(evenIdx, other) : ivec2(other, evenIdx);
    ivec2 oCoord = u_direction == 0 ? ivec2(oddIdx, other)  : ivec2(other, oddIdx);

    vec2 a = texelFetch(u_input, eCoord, 0).rg;
    vec2 b = texelFetch(u_input, oCoord, 0).rg;

    float angle = -6.2831853 * float(j) / float(M);
    float cs = cos(angle);
    float sn = sin(angle);
    vec2 bw = vec2(b.x * cs - b.y * sn, b.x * sn + b.y * cs);

    vec2 result = isBottom ? a - bw : a + bw;
    fragColor = vec4(result, 0.0, 1.0);
}
`;

// ─── Display shader: FFT complex → component → normalize → colormap ──────────

const DISPLAY_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_fft;
uniform int u_displayMode; // 0=mag, 1=phase, 2=real, 3=imag
uniform int u_colormap;    // 0=viridis, 1=inferno, 2=magma
uniform float u_gamma;
uniform float u_normMax;   // max magnitude (DC) for normalization

out vec4 fragColor;

vec3 viridis(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.267, 0.004, 0.329);
    vec3 c1 = vec3(0.282, 0.140, 0.458);
    vec3 c2 = vec3(0.254, 0.265, 0.530);
    vec3 c3 = vec3(0.206, 0.372, 0.553);
    vec3 c4 = vec3(0.163, 0.471, 0.558);
    vec3 c5 = vec3(0.128, 0.567, 0.551);
    vec3 c6 = vec3(0.135, 0.659, 0.518);
    vec3 c7 = vec3(0.267, 0.749, 0.441);
    vec3 c8 = vec3(0.478, 0.821, 0.318);
    vec3 c9 = vec3(0.741, 0.873, 0.150);
    vec3 c10 = vec3(0.993, 0.906, 0.144);
    float idx = t * 10.0; int i = int(idx); float f = fract(idx);
    if (i >= 10) return c10;
    if (i == 0) return mix(c0, c1, f); if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f); if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f); if (i == 5) return mix(c5, c6, f);
    if (i == 6) return mix(c6, c7, f); if (i == 7) return mix(c7, c8, f);
    if (i == 8) return mix(c8, c9, f); return mix(c9, c10, f);
}

vec3 inferno(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.001, 0.000, 0.014);
    vec3 c1 = vec3(0.122, 0.047, 0.283);
    vec3 c2 = vec3(0.323, 0.059, 0.434);
    vec3 c3 = vec3(0.518, 0.105, 0.404);
    vec3 c4 = vec3(0.691, 0.190, 0.306);
    vec3 c5 = vec3(0.839, 0.310, 0.174);
    vec3 c6 = vec3(0.939, 0.465, 0.027);
    vec3 c7 = vec3(0.978, 0.634, 0.004);
    vec3 c8 = vec3(0.955, 0.808, 0.177);
    vec3 c9 = vec3(0.932, 0.950, 0.536);
    vec3 c10 = vec3(0.988, 1.000, 0.644);
    float idx = t * 10.0; int i = int(idx); float f = fract(idx);
    if (i >= 10) return c10;
    if (i == 0) return mix(c0, c1, f); if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f); if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f); if (i == 5) return mix(c5, c6, f);
    if (i == 6) return mix(c6, c7, f); if (i == 7) return mix(c7, c8, f);
    if (i == 8) return mix(c8, c9, f); return mix(c9, c10, f);
}

vec3 magma(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.001, 0.000, 0.014);
    vec3 c1 = vec3(0.112, 0.065, 0.276);
    vec3 c2 = vec3(0.282, 0.091, 0.471);
    vec3 c3 = vec3(0.466, 0.098, 0.502);
    vec3 c4 = vec3(0.640, 0.132, 0.448);
    vec3 c5 = vec3(0.802, 0.210, 0.377);
    vec3 c6 = vec3(0.926, 0.347, 0.335);
    vec3 c7 = vec3(0.981, 0.529, 0.378);
    vec3 c8 = vec3(0.995, 0.711, 0.485);
    vec3 c9 = vec3(0.996, 0.876, 0.664);
    vec3 c10 = vec3(0.987, 0.991, 0.750);
    float idx = t * 10.0; int i = int(idx); float f = fract(idx);
    if (i >= 10) return c10;
    if (i == 0) return mix(c0, c1, f); if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f); if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f); if (i == 5) return mix(c5, c6, f);
    if (i == 6) return mix(c6, c7, f); if (i == 7) return mix(c7, c8, f);
    if (i == 8) return mix(c8, c9, f); return mix(c9, c10, f);
}

void main() {
    vec2 complex = texelFetch(u_fft, ivec2(gl_FragCoord.xy), 0).rg;
    float val;

    if (u_displayMode == 0) {
        // Magnitude: log normalize
        float mag = length(complex);
        float logMag = log(1.0 + mag);
        float logMax = log(1.0 + u_normMax);
        val = logMax > 0.0 ? logMag / logMax : 0.0;
    } else if (u_displayMode == 1) {
        // Phase: [-pi, pi] → [0, 1]
        val = (atan(complex.y, complex.x) + 3.14159265) / 6.2831853;
    } else if (u_displayMode == 2) {
        // Real: bipolar, normalize by DC magnitude
        val = u_normMax > 0.0 ? (complex.x / u_normMax + 1.0) * 0.5 : 0.5;
    } else {
        // Imaginary: bipolar, normalize by DC magnitude
        val = u_normMax > 0.0 ? (complex.y / u_normMax + 1.0) * 0.5 : 0.5;
    }

    val = pow(clamp(val, 0.0, 1.0), u_gamma);

    vec3 color;
    if (u_colormap == 0) color = viridis(val);
    else if (u_colormap == 1) color = inferno(val);
    else color = magma(val);

    fragColor = vec4(color, 1.0);
}
`;

// ─── Wallpaper shader: backward-map through symmetry ops on GPU ───────────────

const WALLPAPER_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_rawTex;
uniform float u_cellW, u_cellH, u_shear;
uniform int u_opCount;
uniform vec4 u_ops[24]; // pairs per op: vec4(a,b,tx,0), vec4(c,d,ty,0)
uniform float u_N;

out vec4 fragColor;

void main() {
    vec2 pos = gl_FragCoord.xy;

    // Flip Y: Canvas2D has y=0 at top, GL has y=0 at bottom.
    // The raw buffer was written in canvas coords, so match that convention.
    float py = u_N - pos.y;

    // Pixel → fractional coords (invert affine lattice matrix)
    float fy = py / u_cellH;
    float fx = (pos.x - u_shear * fy) / u_cellW;

    // Reduce to unit cell
    float fxCell = fract(fx);
    float fyCell = fract(fy);

    float best = 0.0;
    for (int i = 0; i < 12; i++) {
        if (i >= u_opCount) break;
        vec4 row0 = u_ops[i * 2];
        vec4 row1 = u_ops[i * 2 + 1];
        float sx = row0.x * fxCell + row0.y * fyCell + row0.z;
        float sy = row1.x * fxCell + row1.y * fyCell + row1.z;
        // mod1
        sx = fract(sx);
        sy = fract(sy);
        float val = texture(u_rawTex, vec2(sx, sy)).r;
        best = max(best, val);
    }

    fragColor = vec4(best, 0.0, 0.0, 1.0);
}
`;

// ─── Blit shader: render texture as grayscale (for input panel display) ───────

const BLIT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_input;
out vec4 fragColor;
void main() {
    float v = texelFetch(u_input, ivec2(gl_FragCoord.xy), 0).r;
    fragColor = vec4(v, v, v, 1.0);
}
`;

// ─── Shared vertex shader ─────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// ─── Type mappings ────────────────────────────────────────────────────────────

const TYPE_ID: Record<PatternType, number> = {
    rectangle: 0, doubleSlit: 1, circle: 2, grating: 3,
    gaussian: 4, pointSources: 5, rhombus: 6, packedShapes: 7,
};
const SHAPE_ID = { circle: 0, square: 1, rhombus: 2 } as const;
const PACKING_ID = { square: 0, hex: 1 } as const;
const DISPLAY_ID: Record<DisplayMode, number> = {
    magnitude: 0, phase: 1, real: 2, imaginary: 3,
};
const COLORMAP_ID: Record<ColormapType, number> = {
    viridis: 0, inferno: 1, magma: 2,
};

// ─── FourierGPU class ─────────────────────────────────────────────────────────

export class FourierGPU {
    private gl: WebGL2RenderingContext;
    private canvas: HTMLCanvasElement;

    // Programs
    private patternProg: WebGLProgram;
    private preshiftProg: WebGLProgram;
    private fftProg: WebGLProgram;
    private displayProg: WebGLProgram;
    private blitProg: WebGLProgram;
    private wallpaperProg: WebGLProgram;

    // Uniform locations (cached)
    private patternLocs: Record<string, WebGLUniformLocation | null>;
    private fftLocs: Record<string, WebGLUniformLocation | null>;
    private displayLocs: Record<string, WebGLUniformLocation | null>;
    private wallpaperLocs: Record<string, WebGLUniformLocation | null>;

    // Textures + FBOs (N × N, RGBA32F)
    private texPattern!: WebGLTexture;
    private texA!: WebGLTexture;
    private texB!: WebGLTexture;
    private fbPattern!: WebGLFramebuffer;
    private fbA!: WebGLFramebuffer;
    private fbB!: WebGLFramebuffer;

    // Raw drawing texture (128×128, R32F)
    private texRaw: WebGLTexture | null = null;

    private N = 0;
    private logN = 0;
    private dcReadBuf = new Float32Array(4);

    private constructor(
        gl: WebGL2RenderingContext,
        canvas: HTMLCanvasElement,
        patternProg: WebGLProgram,
        preshiftProg: WebGLProgram,
        fftProg: WebGLProgram,
        displayProg: WebGLProgram,
        blitProg: WebGLProgram,
        wallpaperProg: WebGLProgram,
    ) {
        this.gl = gl;
        this.canvas = canvas;
        this.patternProg = patternProg;
        this.preshiftProg = preshiftProg;
        this.fftProg = fftProg;
        this.displayProg = displayProg;
        this.blitProg = blitProg;
        this.wallpaperProg = wallpaperProg;

        // Cache uniform locations
        this.patternLocs = getUniforms(gl, patternProg, [
            'u_half', 'u_type', 'u_rectSize',
            'u_slitW', 'u_slitSep', 'u_slitH', 'u_circleR',
            'u_gratFreq', 'u_gratCos', 'u_gratSin', 'u_sigma2',
            'u_ptCount', 'u_ptSpacing', 'u_ptStartX',
            'u_rhombW', 'u_rhombH', 'u_rhombGrad',
            'u_packShape', 'u_packPacking', 'u_packElem', 'u_packSpace', 'u_packEnvR',
        ]);
        this.fftLocs = getUniforms(gl, fftProg, ['u_input', 'u_N', 'u_pass', 'u_direction']);
        this.displayLocs = getUniforms(gl, displayProg, [
            'u_fft', 'u_displayMode', 'u_colormap', 'u_gamma', 'u_normMax',
        ]);
        this.wallpaperLocs = getUniforms(gl, wallpaperProg, [
            'u_rawTex', 'u_cellW', 'u_cellH', 'u_shear', 'u_opCount', 'u_N',
            ...Array.from({ length: 24 }, (_, i) => `u_ops[${i}]`),
        ]);

        // Fullscreen quad VAO
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        const buf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
        ]), gl.STATIC_DRAW);
        // Bind a_pos for all programs at location 0
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }

    static create(): FourierGPU | null {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2', {
                antialias: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
            });
            if (!gl) return null;

            // Need float color buffer for rendering to RGBA32F textures
            const ext = gl.getExtension('EXT_color_buffer_float');
            if (!ext) return null;

            const progs = [
                compileProgram(gl, VERT, PATTERN_FRAG),
                compileProgram(gl, VERT, PRESHIFT_FRAG),
                compileProgram(gl, VERT, FFT_FRAG),
                compileProgram(gl, VERT, DISPLAY_FRAG),
                compileProgram(gl, VERT, BLIT_FRAG),
                compileProgram(gl, VERT, WALLPAPER_FRAG),
            ];
            if (progs.some(p => !p)) return null;

            return new FourierGPU(
                gl, canvas,
                progs[0]!, progs[1]!, progs[2]!, progs[3]!, progs[4]!, progs[5]!,
            );
        } catch {
            return null;
        }
    }

    /** Ensure textures/FBOs are allocated at the right size. */
    private ensureSize(N: number): void {
        if (this.N === N) return;
        this.N = N;
        this.logN = Math.log2(N) | 0;
        const gl = this.gl;

        // (Re)create three RGBA32F textures + FBOs
        const makeTex = (): WebGLTexture => {
            const tex = gl.createTexture()!;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return tex;
        };
        const makeFB = (tex: WebGLTexture): WebGLFramebuffer => {
            const fb = gl.createFramebuffer()!;
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            return fb;
        };

        // Delete old
        if (this.texPattern) {
            gl.deleteTexture(this.texPattern);
            gl.deleteTexture(this.texA);
            gl.deleteTexture(this.texB);
            gl.deleteFramebuffer(this.fbPattern);
            gl.deleteFramebuffer(this.fbA);
            gl.deleteFramebuffer(this.fbB);
        }

        this.texPattern = makeTex();
        this.texA = makeTex();
        this.texB = makeTex();
        this.fbPattern = makeFB(this.texPattern);
        this.fbA = makeFB(this.texA);
        this.fbB = makeFB(this.texB);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /** Run full pipeline and render the display to our canvas at N×N. */
    render(
        type: PatternType,
        params: PatternParams,
        N: number,
        displayMode: DisplayMode,
        colormap: ColormapType,
        gamma: number,
    ): void {
        const { gl } = this;
        this.ensureSize(N);

        // 1. Pattern SDF → texPattern
        this.renderPattern(type, params);

        // 2. Preshift (fftshift) → texA
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbA);
        gl.viewport(0, 0, N, N);
        gl.useProgram(this.preshiftProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texPattern);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 3. Row FFT: log2(N) passes, ping-pong A ↔ B
        let src = this.texA;
        let dstFb = this.fbB;
        let resultTex = this.texB;

        gl.useProgram(this.fftProg);
        gl.uniform1i(this.fftLocs['u_N']!, N);
        gl.uniform1i(this.fftLocs['u_direction']!, 0); // rows

        for (let p = 0; p < this.logN; p++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, dstFb);
            gl.viewport(0, 0, N, N);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, src);
            gl.uniform1i(this.fftLocs['u_input']!, 0);
            gl.uniform1i(this.fftLocs['u_pass']!, p);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // Swap
            if (dstFb === this.fbB) {
                src = this.texB; dstFb = this.fbA; resultTex = this.texB;
            } else {
                src = this.texA; dstFb = this.fbB; resultTex = this.texA;
            }
        }

        // 4. Column FFT: log2(N) passes
        gl.uniform1i(this.fftLocs['u_direction']!, 1); // columns

        // src is now the result of row FFT (resultTex from last swap was the written-to)
        // After the swap, src points to what was just written. Let me fix the logic:
        // After row FFT, the result is in resultTex. We need src = resultTex for the first col pass.
        src = resultTex;
        dstFb = (resultTex === this.texB) ? this.fbA : this.fbB;

        for (let p = 0; p < this.logN; p++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, dstFb);
            gl.viewport(0, 0, N, N);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, src);
            gl.uniform1i(this.fftLocs['u_input']!, 0);
            gl.uniform1i(this.fftLocs['u_pass']!, p);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            if (dstFb === this.fbB) {
                src = this.texB; dstFb = this.fbA; resultTex = this.texB;
            } else {
                src = this.texA; dstFb = this.fbB; resultTex = this.texA;
            }
        }

        // 5. Read DC component (center pixel) for normalization
        const fftResultFb = (resultTex === this.texA) ? this.fbA : this.fbB;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fftResultFb);
        gl.readPixels(N / 2, N / 2, 1, 1, gl.RGBA, gl.FLOAT, this.dcReadBuf);
        const dcRe = this.dcReadBuf[0];
        const dcIm = this.dcReadBuf[1];
        const normMax = Math.sqrt(dcRe * dcRe + dcIm * dcIm);

        // 6. Display shader → canvas (default framebuffer) at N×N
        if (this.canvas.width !== N || this.canvas.height !== N) {
            this.canvas.width = N;
            this.canvas.height = N;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, N, N);
        gl.useProgram(this.displayProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, resultTex);
        gl.uniform1i(this.displayLocs['u_fft']!, 0);
        gl.uniform1i(this.displayLocs['u_displayMode']!, DISPLAY_ID[displayMode]);
        gl.uniform1i(this.displayLocs['u_colormap']!, COLORMAP_ID[colormap]);
        gl.uniform1f(this.displayLocs['u_gamma']!, gamma);
        gl.uniform1f(this.displayLocs['u_normMax']!, normMax);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /** Render just the pattern (grayscale) to our canvas at N×N. */
    renderPatternOnly(
        type: PatternType,
        params: PatternParams,
        N: number,
    ): void {
        const { gl } = this;
        this.ensureSize(N);
        this.renderPattern(type, params);

        // Blit texPattern to canvas as grayscale at N×N
        if (this.canvas.width !== N || this.canvas.height !== N) {
            this.canvas.width = N;
            this.canvas.height = N;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, N, N);
        gl.useProgram(this.blitProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texPattern);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /** Upload the 128×128 raw drawing buffer to GPU. */
    uploadRawBuffer(data: Float32Array): void {
        const { gl } = this;
        if (!this.texRaw) {
            this.texRaw = gl.createTexture()!;
            gl.bindTexture(gl.TEXTURE_2D, this.texRaw);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.texRaw);
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 128, 128, 0, gl.RED, gl.FLOAT, data);
    }

    /**
     * Full wallpaper GPU pipeline: raw → wallpaper expand → fftshift → FFT → display.
     * opsData: flat Float32Array of 6 floats per op [a,b,tx,c,d,ty].
     */
    renderWallpaper(
        N: number,
        cellW: number, cellH: number, shear: number,
        opsData: Float32Array, opCount: number,
        displayMode: DisplayMode, colormap: ColormapType, gamma: number,
    ): void {
        const { gl } = this;
        this.ensureSize(N);

        // 1. Wallpaper expand → texPattern
        this.renderWallpaperToPattern(N, cellW, cellH, shear, opsData, opCount);

        // 2. Preshift → texA
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbA);
        gl.viewport(0, 0, N, N);
        gl.useProgram(this.preshiftProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texPattern);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 3–4. FFT (rows then columns) — same as render()
        let src = this.texA;
        let dstFb = this.fbB;
        let resultTex = this.texB;

        gl.useProgram(this.fftProg);
        gl.uniform1i(this.fftLocs['u_N']!, N);
        gl.uniform1i(this.fftLocs['u_direction']!, 0);
        for (let p = 0; p < this.logN; p++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, dstFb);
            gl.viewport(0, 0, N, N);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, src);
            gl.uniform1i(this.fftLocs['u_input']!, 0);
            gl.uniform1i(this.fftLocs['u_pass']!, p);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            if (dstFb === this.fbB) {
                src = this.texB; dstFb = this.fbA; resultTex = this.texB;
            } else {
                src = this.texA; dstFb = this.fbB; resultTex = this.texA;
            }
        }

        gl.uniform1i(this.fftLocs['u_direction']!, 1);
        src = resultTex;
        dstFb = (resultTex === this.texB) ? this.fbA : this.fbB;
        for (let p = 0; p < this.logN; p++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, dstFb);
            gl.viewport(0, 0, N, N);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, src);
            gl.uniform1i(this.fftLocs['u_input']!, 0);
            gl.uniform1i(this.fftLocs['u_pass']!, p);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            if (dstFb === this.fbB) {
                src = this.texB; dstFb = this.fbA; resultTex = this.texB;
            } else {
                src = this.texA; dstFb = this.fbB; resultTex = this.texA;
            }
        }

        // 5. DC normalization
        const fftResultFb = (resultTex === this.texA) ? this.fbA : this.fbB;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fftResultFb);
        gl.readPixels(N / 2, N / 2, 1, 1, gl.RGBA, gl.FLOAT, this.dcReadBuf);
        const normMax = Math.sqrt(
            this.dcReadBuf[0] * this.dcReadBuf[0] + this.dcReadBuf[1] * this.dcReadBuf[1],
        );

        // 6. Display → canvas
        if (this.canvas.width !== N || this.canvas.height !== N) {
            this.canvas.width = N;
            this.canvas.height = N;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, N, N);
        gl.useProgram(this.displayProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, resultTex);
        gl.uniform1i(this.displayLocs['u_fft']!, 0);
        gl.uniform1i(this.displayLocs['u_displayMode']!, DISPLAY_ID[displayMode]);
        gl.uniform1i(this.displayLocs['u_colormap']!, COLORMAP_ID[colormap]);
        gl.uniform1f(this.displayLocs['u_gamma']!, gamma);
        gl.uniform1f(this.displayLocs['u_normMax']!, normMax);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /** Render just the wallpaper-expanded pattern (grayscale) to canvas at N×N. */
    renderWallpaperPatternOnly(
        N: number,
        cellW: number, cellH: number, shear: number,
        opsData: Float32Array, opCount: number,
    ): void {
        const { gl } = this;
        this.ensureSize(N);
        this.renderWallpaperToPattern(N, cellW, cellH, shear, opsData, opCount);

        if (this.canvas.width !== N || this.canvas.height !== N) {
            this.canvas.width = N;
            this.canvas.height = N;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, N, N);
        gl.useProgram(this.blitProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texPattern);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    getCanvas(): HTMLCanvasElement { return this.canvas; }

    dispose(): void {
        if (this.texRaw) this.gl.deleteTexture(this.texRaw);
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }

    // ── Internal: render wallpaper-expanded raw buffer to texPattern ───────────

    private renderWallpaperToPattern(
        N: number,
        cellW: number, cellH: number, shear: number,
        opsData: Float32Array, opCount: number,
    ): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbPattern);
        gl.viewport(0, 0, N, N);
        gl.useProgram(this.wallpaperProg);

        const loc = this.wallpaperLocs;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texRaw);
        gl.uniform1i(loc['u_rawTex']!, 0);
        gl.uniform1f(loc['u_cellW']!, cellW);
        gl.uniform1f(loc['u_cellH']!, cellH);
        gl.uniform1f(loc['u_shear']!, shear);
        gl.uniform1i(loc['u_opCount']!, opCount);
        gl.uniform1f(loc['u_N']!, N);

        // Upload ops as vec4 pairs: [a,b,tx,0], [c,d,ty,0]
        for (let i = 0; i < opCount; i++) {
            const off = i * 6;
            const loc0 = loc[`u_ops[${i * 2}]`];
            const loc1 = loc[`u_ops[${i * 2 + 1}]`];
            if (loc0) gl.uniform4f(loc0, opsData[off], opsData[off + 1], opsData[off + 2], 0);
            if (loc1) gl.uniform4f(loc1, opsData[off + 3], opsData[off + 4], opsData[off + 5], 0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // ── Internal: render pattern SDF to texPattern ────────────────────────────

    private renderPattern(type: PatternType, params: PatternParams): void {
        const { gl, N } = this;
        const half = N / 2;
        const loc = this.patternLocs;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbPattern);
        gl.viewport(0, 0, N, N);
        gl.useProgram(this.patternProg);

        gl.uniform1f(loc['u_half']!, half);
        gl.uniform1i(loc['u_type']!, TYPE_ID[type]);
        gl.uniform2f(loc['u_rectSize']!, params.rectWidth * half, params.rectHeight * half);
        gl.uniform1f(loc['u_slitW']!, params.slitWidth * half);
        gl.uniform1f(loc['u_slitSep']!, params.slitSeparation * half);
        gl.uniform1f(loc['u_slitH']!, 0.4 * half);
        gl.uniform1f(loc['u_circleR']!, params.circleRadius * half);

        const angleRad = params.gratingAngle * Math.PI / 180;
        gl.uniform1f(loc['u_gratFreq']!, params.gratingFrequency);
        gl.uniform1f(loc['u_gratCos']!, Math.cos(angleRad));
        gl.uniform1f(loc['u_gratSin']!, Math.sin(angleRad));

        const sx = params.sigmaX * half, sy = params.sigmaY * half;
        gl.uniform2f(loc['u_sigma2']!, 2 * sx * sx, 2 * sy * sy);

        const count = Math.max(1, Math.round(params.pointCount));
        const ptSpacing = params.pointSpacing * half;
        gl.uniform1i(loc['u_ptCount']!, count);
        gl.uniform1f(loc['u_ptSpacing']!, ptSpacing);
        gl.uniform1f(loc['u_ptStartX']!, -((count - 1) * ptSpacing) / 2);

        const rw = params.rhombusWidth * half, rh = params.rhombusHeight * half;
        gl.uniform1f(loc['u_rhombW']!, rw);
        gl.uniform1f(loc['u_rhombH']!, rh);
        gl.uniform1f(loc['u_rhombGrad']!, Math.sqrt(1 / (rw * rw) + 1 / (rh * rh)));

        gl.uniform1i(loc['u_packShape']!, SHAPE_ID[params.packShape]);
        gl.uniform1i(loc['u_packPacking']!, PACKING_ID[params.packPacking]);
        gl.uniform1f(loc['u_packElem']!, params.packElementSize * half);
        gl.uniform1f(loc['u_packSpace']!, params.packSpacing * half);
        gl.uniform1f(loc['u_packEnvR']!, params.packEnvelopeRadius * half);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compileProgram(
    gl: WebGL2RenderingContext,
    vertSrc: string,
    fragSrc: string,
): WebGLProgram | null {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.warn('FourierGPU vert:', gl.getShaderInfoLog(vs));
        return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.warn('FourierGPU frag:', gl.getShaderInfoLog(fs));
        return null;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    // Bind a_pos to location 0 for all programs
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn('FourierGPU link:', gl.getProgramInfoLog(prog));
        return null;
    }
    return prog;
}

function getUniforms(
    gl: WebGL2RenderingContext,
    prog: WebGLProgram,
    names: string[],
): Record<string, WebGLUniformLocation | null> {
    const locs: Record<string, WebGLUniformLocation | null> = {};
    for (const name of names) {
        locs[name] = gl.getUniformLocation(prog, name);
    }
    return locs;
}
