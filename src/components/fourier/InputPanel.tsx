import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { ControlTheme } from '../shared/controls';
import type { InputMode } from './types';
import type { TilingOptions } from './symmetry';
import {
    generateSymmetricPattern,
    getEquivalentPositions,
    canvasToRaw,
    computeCellDims,
    RAW_SIZE,
} from './symmetry';

export interface InputPanelProps {
    width: number;
    height: number;
    mode: InputMode;
    data: Float32Array | null;
    N: number;
    onInteractiveData: (data: Float32Array) => void;
    wallpaperGroup: string;
    tiles: number;
    symmetryEnabled: boolean;
    brushRadius: number;
    cellAngle: number;
    cellRatio: number;
    theme: ControlTheme;
    /** When provided (GPU mode), called with rawBuffer on mouseUp instead of full CPU regeneration. */
    onRawBufferUpdate?: (raw: Float32Array) => void;
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
    void main() {
        float val = texture2D(u_data, v_texCoord).r;
        gl_FragColor = vec4(val, val, val, 1.0);
    }
`;

interface GLState {
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    texture: WebGLTexture;
}

export const InputPanel: React.FC<InputPanelProps> = React.memo(({
    width,
    height,
    mode,
    data,
    N,
    onInteractiveData,
    wallpaperGroup,
    tiles,
    symmetryEnabled,
    brushRadius,
    cellAngle,
    cellRatio,
    theme,
    onRawBufferUpdate,
}) => {
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    const gridCanvasRef = useRef<HTMLCanvasElement>(null);
    const glStateRef = useRef<GLState | null>(null);
    const rawBufferRef = useRef<Float32Array>(new Float32Array(RAW_SIZE * RAW_SIZE));
    const isDrawingRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const tilingOpts = useMemo<TilingOptions>(() => ({
        applySymmetry: symmetryEnabled,
        angle: cellAngle,
        ratio: cellRatio,
    }), [symmetryEnabled, cellAngle, cellRatio]);

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

        gl.getExtension('OES_texture_float');

        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        glStateRef.current = { gl, program, texture };

        return () => {
            gl.deleteProgram(program);
            gl.deleteTexture(texture);
            glStateRef.current = null;
        };
    }, []);

    // Display data prop via WebGL (pattern mode and upload mode)
    useEffect(() => {
        if (mode === 'draw' || !data) return;

        const state = glStateRef.current;
        const canvas = glCanvasRef.current;
        if (!state || !canvas) return;

        const { gl, texture, program } = state;

        const rgba = new Float32Array(N * N * 4);
        for (let i = 0; i < N * N; i++) {
            rgba[i * 4] = data[i];
            rgba[i * 4 + 1] = data[i];
            rgba[i * 4 + 2] = data[i];
            rgba[i * 4 + 3] = 1;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.FLOAT, rgba);

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }, [data, mode, N, width, height]);

    // Regenerate draw display when params change
    useEffect(() => {
        if (mode !== 'draw') return;
        // Always regenerate Canvas2D so the input display shows the expanded pattern
        regenerateAndEmit();
        // In GPU mode, also signal raw buffer for GPU FFT pipeline
        if (onRawBufferUpdate) {
            onRawBufferUpdate(rawBufferRef.current);
        }
    }, [mode, wallpaperGroup, tiles, symmetryEnabled, cellAngle, cellRatio, N, onRawBufferUpdate]);

    /** Full regeneration from rawBuffer → Canvas2D + parent callback. */
    const regenerateAndEmit = useCallback(() => {
        const raw = rawBufferRef.current;
        let hasContent = false;
        for (let i = 0; i < raw.length; i++) {
            if (raw[i] > 0) { hasContent = true; break; }
        }

        const fullPattern = hasContent
            ? generateSymmetricPattern(raw, N, wallpaperGroup, tiles, tilingOpts)
            : new Float32Array(N * N);

        renderToDrawCanvas(fullPattern);

        if (hasContent) {
            onInteractiveData(fullPattern);
        }
    }, [N, wallpaperGroup, tiles, tilingOpts, onInteractiveData]);

    /** Render an NxN buffer to the draw canvas. */
    const renderToDrawCanvas = useCallback((buffer: Float32Array) => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;

        if (canvas.width !== N || canvas.height !== N) {
            canvas.width = N;
            canvas.height = N;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.createImageData(N, N);
        for (let i = 0; i < N * N; i++) {
            const v = Math.round(buffer[i] * 255);
            imageData.data[i * 4] = v;
            imageData.data[i * 4 + 1] = v;
            imageData.data[i * 4 + 2] = v;
            imageData.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
    }, [N]);

    // ── Cell grid overlay ─────────────────────────────────────────

    useEffect(() => {
        if (mode !== 'draw') return;
        const canvas = gridCanvasRef.current;
        if (!canvas) return;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);

        const dims = computeCellDims(N, tiles, cellAngle, cellRatio);
        const sx = width / N;
        const sy = height / N;

        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(120, 180, 255, 0.45)';
        ctx.lineWidth = 2;

        // Horizontal lines (constant fy = integer)
        const vCount = Math.round(N / dims.cellH);
        for (let j = 1; j < vCount; j++) {
            const y = j * dims.cellH * sy;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Slanted/vertical lines (constant fx = integer)
        // fx = n → px = n*cellW + fy*shear = n*cellW + (py/cellH)*shear
        // At py=0: px = n*cellW, at py=N: px = n*cellW + N*shear/cellH
        const totalShift = N * dims.shear / dims.cellH;
        const nMin = Math.floor(Math.min(0, totalShift) / dims.cellW) - 1;
        const nMax = Math.ceil(Math.max(N, N + totalShift) / dims.cellW) + 1;
        for (let n = nMin; n <= nMax; n++) {
            const x0 = n * dims.cellW * sx;
            const x1 = (n * dims.cellW + totalShift) * sx;
            ctx.beginPath();
            ctx.moveTo(x0, 0);
            ctx.lineTo(x1, height);
            ctx.stroke();
        }
    }, [mode, tiles, cellAngle, cellRatio, N, width, height]);

    // ── Draw mode mouse handlers ──────────────────────────────────

    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): [number, number] | null => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * N);
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * N);
        if (x < 0 || x >= N || y < 0 || y >= N) return null;
        return [x, y];
    }, [N]);

    /** Stamp gaussian brush at one canvas pixel. */
    const stampBrush = useCallback((cx: number, cy: number) => {
        const raw = rawBufferRef.current;
        const dims = computeCellDims(N, tiles, cellAngle, cellRatio);
        const canvas = drawCanvasRef.current;
        const ctx = canvas?.getContext('2d');

        const R = brushRadius;
        const sigma = R / 2;
        const sigma2 = 2 * sigma * sigma;

        // Write gaussian to raw buffer
        const [rx, ry] = canvasToRaw(cx, cy, wallpaperGroup, N, tiles, tilingOpts);
        for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
                const d2 = dx * dx + dy * dy;
                if (d2 > R * R) continue;
                const bx = rx + dx;
                const by = ry + dy;
                if (bx >= 0 && bx < RAW_SIZE && by >= 0 && by < RAW_SIZE) {
                    const intensity = Math.exp(-d2 / sigma2);
                    const idx = by * RAW_SIZE + bx;
                    raw[idx] = Math.min(1, raw[idx] + intensity);
                }
            }
        }

        // Immediate visual feedback
        if (!ctx) return;
        const canvasR = Math.max(1, Math.round(R * dims.cellW / RAW_SIZE));
        const positions = getEquivalentPositions(cx, cy, N, wallpaperGroup, tiles, tilingOpts);

        for (const [px, py] of positions) {
            const grad = ctx.createRadialGradient(px, py, 0, px, py, canvasR);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(px - canvasR, py - canvasR, canvasR * 2, canvasR * 2);
        }
    }, [N, wallpaperGroup, tiles, tilingOpts, brushRadius, cellAngle, cellRatio]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== 'draw') return;
        isDrawingRef.current = true;
        const coords = getCanvasCoords(e);
        if (coords) stampBrush(coords[0], coords[1]);
    }, [mode, getCanvasCoords, stampBrush]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current || mode !== 'draw') return;
        const coords = getCanvasCoords(e);
        if (coords) stampBrush(coords[0], coords[1]);
    }, [mode, getCanvasCoords, stampBrush]);

    const handleMouseUp = useCallback(() => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        // Always regenerate Canvas2D to show the full expanded pattern
        regenerateAndEmit();
        // In GPU mode, also signal raw buffer for GPU FFT pipeline
        if (onRawBufferUpdate) {
            onRawBufferUpdate(rawBufferRef.current);
        }
    }, [regenerateAndEmit, onRawBufferUpdate]);

    // ── Upload mode ───────────────────────────────────────────────

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = N;
            canvas.height = N;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, N, N);
            const imageData = ctx.getImageData(0, 0, N, N);

            const grayData = new Float32Array(N * N);
            for (let i = 0; i < N * N; i++) {
                const r = imageData.data[i * 4];
                const g = imageData.data[i * 4 + 1];
                const b = imageData.data[i * 4 + 2];
                grayData[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            }

            onInteractiveData(grayData);
            URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
    }, [N, onInteractiveData]);

    const handleClear = useCallback(() => {
        rawBufferRef.current.fill(0);
        renderToDrawCanvas(new Float32Array(N * N));
        onInteractiveData(new Float32Array(N * N));
        if (onRawBufferUpdate) {
            onRawBufferUpdate(rawBufferRef.current);
        }
    }, [N, renderToDrawCanvas, onInteractiveData, onRawBufferUpdate]);

    const triggerUpload = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    return (
        <div
            style={{
                position: 'relative',
                width,
                height,
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
                backgroundColor: '#000',
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
                    display: mode === 'draw' ? 'none' : 'block',
                }}
            />
            <canvas
                ref={drawCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width,
                    height,
                    display: mode === 'draw' ? 'block' : 'none',
                    cursor: mode === 'draw' ? 'crosshair' : 'default',
                    imageRendering: 'pixelated',
                }}
            />
            <canvas
                ref={gridCanvasRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width,
                    height,
                    display: mode === 'draw' ? 'block' : 'none',
                    pointerEvents: 'none',
                }}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
            />
            {mode === 'draw' && (
                <button
                    onClick={handleClear}
                    style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        padding: '2px 8px',
                        fontSize: '0.7rem',
                        border: `1px solid ${theme.border}`,
                        borderRadius: '3px',
                        backgroundColor: theme.surface || theme.inputBg,
                        color: theme.text,
                        cursor: 'pointer',
                        zIndex: 2,
                    }}
                >
                    Clear
                </button>
            )}
            {mode === 'upload' && !data && (
                <button
                    onClick={triggerUpload}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        backgroundColor: theme.surface || theme.inputBg,
                        color: theme.text,
                        cursor: 'pointer',
                    }}
                >
                    Choose Image...
                </button>
            )}
        </div>
    );
});

InputPanel.displayName = 'InputPanel';
