import React, { useRef, useEffect } from 'react';
import type { ControlTheme } from '../shared/controls';
import type { ColormapType } from './types';

export interface FourierDisplayProps {
    width: number;
    height: number;
    data: Float32Array | null; // N*N normalized [0,1] values
    N: number;
    colormap: ColormapType;
    gamma: number;
    label: string;
    theme: ControlTheme;
}

const VERTEX_SHADER = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = (a_position + 1.0) / 2.0;
    }
`;

const FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_data;
    uniform int u_colormap; // 0=viridis, 1=inferno, 2=magma
    uniform float u_gamma;

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
        float idx = t * 10.0;
        int i = int(idx);
        float f = fract(idx);
        if (i >= 10) return c10;
        if (i == 0) return mix(c0, c1, f);
        if (i == 1) return mix(c1, c2, f);
        if (i == 2) return mix(c2, c3, f);
        if (i == 3) return mix(c3, c4, f);
        if (i == 4) return mix(c4, c5, f);
        if (i == 5) return mix(c5, c6, f);
        if (i == 6) return mix(c6, c7, f);
        if (i == 7) return mix(c7, c8, f);
        if (i == 8) return mix(c8, c9, f);
        return mix(c9, c10, f);
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
        float idx = t * 10.0;
        int i = int(idx);
        float f = fract(idx);
        if (i >= 10) return c10;
        if (i == 0) return mix(c0, c1, f);
        if (i == 1) return mix(c1, c2, f);
        if (i == 2) return mix(c2, c3, f);
        if (i == 3) return mix(c3, c4, f);
        if (i == 4) return mix(c4, c5, f);
        if (i == 5) return mix(c5, c6, f);
        if (i == 6) return mix(c6, c7, f);
        if (i == 7) return mix(c7, c8, f);
        if (i == 8) return mix(c8, c9, f);
        return mix(c9, c10, f);
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
        float idx = t * 10.0;
        int i = int(idx);
        float f = fract(idx);
        if (i >= 10) return c10;
        if (i == 0) return mix(c0, c1, f);
        if (i == 1) return mix(c1, c2, f);
        if (i == 2) return mix(c2, c3, f);
        if (i == 3) return mix(c3, c4, f);
        if (i == 4) return mix(c4, c5, f);
        if (i == 5) return mix(c5, c6, f);
        if (i == 6) return mix(c6, c7, f);
        if (i == 7) return mix(c7, c8, f);
        if (i == 8) return mix(c8, c9, f);
        return mix(c9, c10, f);
    }

    void main() {
        float val = texture2D(u_data, v_texCoord).r;
        val = pow(val, u_gamma);
        vec3 color;
        if (u_colormap == 0) color = viridis(val);
        else if (u_colormap == 1) color = inferno(val);
        else color = magma(val);
        gl_FragColor = vec4(color, 1.0);
    }
`;

interface GLState {
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    texture: WebGLTexture;
    colormapLoc: WebGLUniformLocation | null;
    gammaLoc: WebGLUniformLocation | null;
}

// Colormap JS functions for the colorbar overlay
const COLORMAP_JS: Record<ColormapType, (t: number) => [number, number, number]> = {
    viridis: (t: number) => {
        t = Math.max(0, Math.min(1, t));
        const colors = [
            [0.267, 0.004, 0.329], [0.282, 0.140, 0.458], [0.254, 0.265, 0.530],
            [0.206, 0.372, 0.553], [0.163, 0.471, 0.558], [0.128, 0.567, 0.551],
            [0.135, 0.659, 0.518], [0.267, 0.749, 0.441], [0.478, 0.821, 0.318],
            [0.741, 0.873, 0.150], [0.993, 0.906, 0.144],
        ];
        const idx = t * 10;
        const i = Math.min(9, Math.floor(idx));
        const f = idx - i;
        const c1 = colors[i], c2 = colors[i + 1];
        return [
            Math.round((c1[0] + (c2[0] - c1[0]) * f) * 255),
            Math.round((c1[1] + (c2[1] - c1[1]) * f) * 255),
            Math.round((c1[2] + (c2[2] - c1[2]) * f) * 255),
        ];
    },
    inferno: (t: number) => {
        t = Math.max(0, Math.min(1, t));
        const colors = [
            [0.001, 0.000, 0.014], [0.122, 0.047, 0.283], [0.323, 0.059, 0.434],
            [0.518, 0.105, 0.404], [0.691, 0.190, 0.306], [0.839, 0.310, 0.174],
            [0.939, 0.465, 0.027], [0.978, 0.634, 0.004], [0.955, 0.808, 0.177],
            [0.932, 0.950, 0.536], [0.988, 1.000, 0.644],
        ];
        const idx = t * 10;
        const i = Math.min(9, Math.floor(idx));
        const f = idx - i;
        const c1 = colors[i], c2 = colors[i + 1];
        return [
            Math.round((c1[0] + (c2[0] - c1[0]) * f) * 255),
            Math.round((c1[1] + (c2[1] - c1[1]) * f) * 255),
            Math.round((c1[2] + (c2[2] - c1[2]) * f) * 255),
        ];
    },
    magma: (t: number) => {
        t = Math.max(0, Math.min(1, t));
        const colors = [
            [0.001, 0.000, 0.014], [0.112, 0.065, 0.276], [0.282, 0.091, 0.471],
            [0.466, 0.098, 0.502], [0.640, 0.132, 0.448], [0.802, 0.210, 0.377],
            [0.926, 0.347, 0.335], [0.981, 0.529, 0.378], [0.995, 0.711, 0.485],
            [0.996, 0.876, 0.664], [0.987, 0.991, 0.750],
        ];
        const idx = t * 10;
        const i = Math.min(9, Math.floor(idx));
        const f = idx - i;
        const c1 = colors[i], c2 = colors[i + 1];
        return [
            Math.round((c1[0] + (c2[0] - c1[0]) * f) * 255),
            Math.round((c1[1] + (c2[1] - c1[1]) * f) * 255),
            Math.round((c1[2] + (c2[2] - c1[2]) * f) * 255),
        ];
    },
};

export const FourierDisplay: React.FC<FourierDisplayProps> = React.memo(({
    width,
    height,
    data,
    N,
    colormap,
    gamma,
    label,
    theme,
}) => {
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const glStateRef = useRef<GLState | null>(null);
    const animFrameRef = useRef<number>(0);

    // Initialize WebGL once
    useEffect(() => {
        const canvas = glCanvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl');
        if (!gl) return;

        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, VERTEX_SHADER);
        gl.compileShader(vs);

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, FRAGMENT_SHADER);
        gl.compileShader(fs);

        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        glStateRef.current = {
            gl,
            program,
            texture,
            colormapLoc: gl.getUniformLocation(program, 'u_colormap'),
            gammaLoc: gl.getUniformLocation(program, 'u_gamma'),
        };

        return () => {
            gl.deleteProgram(program);
            gl.deleteTexture(texture);
            glStateRef.current = null;
        };
    }, []);

    // Upload data texture when data changes
    useEffect(() => {
        const state = glStateRef.current;
        if (!state || !data) return;

        const { gl, texture } = state;
        gl.getExtension('OES_texture_float');

        // Pack into RGBA float texture (value in R channel)
        const rgba = new Float32Array(N * N * 4);
        for (let i = 0; i < N * N; i++) {
            rgba[i * 4] = data[i];
            rgba[i * 4 + 1] = 0;
            rgba[i * 4 + 2] = 0;
            rgba[i * 4 + 3] = 1;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.FLOAT, rgba);
    }, [data, N]);

    // Render when colormap/gamma/size changes
    useEffect(() => {
        const state = glStateRef.current;
        const canvas = glCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!state || !canvas || !overlayCanvas || !data) return;

        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

        animFrameRef.current = requestAnimationFrame(() => {
            const { gl, program, colormapLoc, gammaLoc } = state;

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            const colormapIndex = colormap === 'viridis' ? 0 : colormap === 'inferno' ? 1 : 2;

            gl.viewport(0, 0, width, height);
            gl.useProgram(program);
            gl.uniform1i(colormapLoc, colormapIndex);
            gl.uniform1f(gammaLoc, gamma);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Overlay: colorbar + label
            const ctx = overlayCanvas.getContext('2d');
            if (!ctx) return;

            if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
                overlayCanvas.width = width;
                overlayCanvas.height = height;
            }
            ctx.clearRect(0, 0, width, height);

            const isDark = theme.text.startsWith('#e') || theme.text.startsWith('#f');
            const bgAlpha = isDark ? 'rgba(30,30,30,0.7)' : 'rgba(255,255,255,0.7)';
            const getColor = COLORMAP_JS[colormap];

            // Label top-left
            ctx.font = '10px sans-serif';
            const labelMetrics = ctx.measureText(label);
            ctx.fillStyle = bgAlpha;
            ctx.fillRect(4, 4, labelMetrics.width + 8, 16);
            ctx.fillStyle = theme.text;
            ctx.textAlign = 'left';
            ctx.fillText(label, 8, 16);

            // Colorbar right edge
            const lw = 10;
            const lh = Math.min(height * 0.5, 120);
            const lx = width - lw - 8;
            const ly = (height - lh) / 2;

            ctx.fillStyle = bgAlpha;
            ctx.fillRect(lx - 3, ly - 14, lw + 6, lh + 26);

            for (let i = 0; i < lh; i++) {
                const t = 1 - i / lh;
                const [r, g, b] = getColor(Math.pow(t, gamma));
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(lx, ly + i, lw, 1);
            }
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(lx, ly, lw, lh);

            ctx.fillStyle = theme.text;
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            const barCenterX = lx + lw / 2;
            ctx.fillText('high', barCenterX, ly - 4);
            ctx.fillText('low', barCenterX, ly + lh + 10);
        });

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [data, colormap, gamma, width, height, label, theme]);

    return (
        <div
            style={{
                position: 'relative',
                width,
                height,
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
                backgroundColor: theme.surface || theme.inputBg,
            }}
        >
            <canvas
                ref={glCanvasRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width,
                    height,
                }}
            />
            <canvas
                ref={overlayCanvasRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
});

FourierDisplay.displayName = 'FourierDisplay';
