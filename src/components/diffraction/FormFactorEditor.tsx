import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { ControlTheme } from '../shared/controls';

// Default Cromer-Mann coefficients for initialization
const CROMER_MANN_COEFFS: Record<string, number[]> = {
    H: [0.489918, 20.6593, 0.262003, 7.74039, 0.196767, 49.5519, 0.049879, 2.20159, 0.001305],
    C: [2.31, 20.8439, 1.02, 10.2075, 1.5886, 0.5687, 0.865, 51.6512, 0.2156],
    N: [12.2126, 0.0057, 3.1322, 9.8933, 2.0125, 28.9975, 1.1663, 0.5826, -11.529],
    O: [3.0485, 13.2771, 2.2868, 5.7011, 1.5463, 0.3239, 0.867, 32.9089, 0.2508],
    Na: [4.7626, 3.285, 3.1736, 8.8422, 1.2674, 0.3136, 1.1128, 129.424, 0.676],
    Cl: [11.4604, 0.0104, 7.1964, 1.1662, 6.2556, 18.5194, 1.6455, 47.7784, -9.5574],
    Si: [6.2915, 2.4386, 3.0353, 32.3337, 1.9891, 0.6785, 1.541, 81.6937, 1.1407],
    Fe: [11.7695, 4.7611, 7.3573, 0.3072, 3.5222, 15.3535, 2.3045, 76.8805, 1.0369],
    Ca: [8.6266, 10.4421, 7.3873, 0.6599, 1.5899, 85.7484, 1.0211, 178.437, 1.3751],
    K: [8.2186, 12.7949, 7.4398, 0.7748, 1.0519, 213.187, 0.8659, 41.6841, 1.4228],
    Ti: [9.7595, 7.8508, 7.3558, 0.5, 1.6991, 35.6338, 1.9021, 116.105, 1.2807],
    Cs: [20.3892, 3.569, 19.1062, 0.3107, 10.662, 24.3879, 1.4953, 213.904, 3.3352],
    Ba: [20.1807, 3.21, 19.1136, 0.2855, 10.9054, 20.0558, 0.7763, 51.746, 3.029],
    I: [20.1472, 4.347, 18.9949, 0.3814, 7.5138, 27.766, 2.2735, 66.8776, 4.0712],
};

// Element colors
const ELEMENT_COLORS: Record<string, string> = {
    H: '#888888', C: '#909090', N: '#3050f8', O: '#ff0d0d',
    Na: '#ab5cf2', Cl: '#1ff01f', Si: '#f0c8a0', Fe: '#e06633',
    Ca: '#3dff00', K: '#8f40d4', Ti: '#bfc2c7', Cs: '#57178f',
    Ba: '#00c900', I: '#940094',
};

// Control point for the spline
interface ControlPoint {
    s: number;  // sin(θ)/λ value (x-axis)
    f: number;  // form factor value (y-axis)
}

// Form factor data for an element
export interface ElementFormFactor {
    element: string;
    points: ControlPoint[];
}

interface FormFactorEditorProps {
    width: number;
    height: number;
    elements: string[];
    theme: ControlTheme;
    formFactors: Record<string, ControlPoint[]>;
    onFormFactorsChange: (formFactors: Record<string, ControlPoint[]>) => void;
}

// Calculate form factor from Cromer-Mann coefficients
function cromerMannFormFactor(coeffs: number[], s: number): number {
    const s2 = s * s;
    let f = coeffs[8];
    for (let i = 0; i < 4; i++) {
        f += coeffs[2 * i] * Math.exp(-coeffs[2 * i + 1] * s2);
    }
    return f;
}

// Generate initial control points from Cromer-Mann
function generateInitialPoints(element: string, numPoints: number = 8): ControlPoint[] {
    const coeffs = CROMER_MANN_COEFFS[element] || CROMER_MANN_COEFFS.C;
    const sMax = 1.5;
    const points: ControlPoint[] = [];

    for (let i = 0; i < numPoints; i++) {
        const s = (i / (numPoints - 1)) * sMax;
        const f = cromerMannFormFactor(coeffs, s);
        points.push({ s, f });
    }

    return points;
}

// Linear interpolation of form factor from control points
export function interpolateFormFactor(points: ControlPoint[], s: number): number {
    if (points.length === 0) return 0;
    if (s <= points[0].s) return points[0].f;
    if (s >= points[points.length - 1].s) return points[points.length - 1].f;

    // Find surrounding points
    for (let i = 0; i < points.length - 1; i++) {
        if (s >= points[i].s && s <= points[i + 1].s) {
            const t = (s - points[i].s) / (points[i + 1].s - points[i].s);
            return points[i].f + t * (points[i + 1].f - points[i].f);
        }
    }

    return points[points.length - 1].f;
}

// Catmull-Rom spline interpolation for smoother curves
export function interpolateFormFactorSmooth(points: ControlPoint[], s: number): number {
    if (points.length < 2) return points[0]?.f ?? 0;
    if (s <= points[0].s) return points[0].f;
    if (s >= points[points.length - 1].s) return points[points.length - 1].f;

    // Find the segment
    let i = 0;
    for (; i < points.length - 1; i++) {
        if (s <= points[i + 1].s) break;
    }

    // Get 4 points for Catmull-Rom (with clamping at edges)
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const t = (s - p1.s) / (p2.s - p1.s);
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom basis functions
    const f = 0.5 * (
        (2 * p1.f) +
        (-p0.f + p2.f) * t +
        (2 * p0.f - 5 * p1.f + 4 * p2.f - p3.f) * t2 +
        (-p0.f + 3 * p1.f - 3 * p2.f + p3.f) * t3
    );

    return Math.max(0, f); // Form factors should be non-negative
}

export const FormFactorEditor: React.FC<FormFactorEditorProps> = ({
    width,
    height,
    elements,
    theme,
    formFactors,
    onFormFactorsChange,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedElement, setSelectedElement] = useState<string>(elements[0] || 'C');
    const [draggingPoint, setDraggingPoint] = useState<number | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

    // Get unique elements
    const uniqueElements = useMemo(() => [...new Set(elements)], [elements]);

    // Ensure selected element is valid
    useEffect(() => {
        if (!uniqueElements.includes(selectedElement) && uniqueElements.length > 0) {
            setSelectedElement(uniqueElements[0]);
        }
    }, [uniqueElements, selectedElement]);

    // Get current points for selected element
    const currentPoints = formFactors[selectedElement] || [];

    // Plot dimensions
    const padding = { top: 30, right: 15, bottom: 35, left: 45 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Scale functions
    const sMax = 1.5;
    const fMax = useMemo(() => {
        let max = 10;
        for (const pts of Object.values(formFactors)) {
            for (const p of pts) {
                max = Math.max(max, p.f);
            }
        }
        return Math.ceil(max / 5) * 5;
    }, [formFactors]);

    const sToX = useCallback((s: number) => padding.left + (s / sMax) * plotWidth, [plotWidth]);
    const fToY = useCallback((f: number) => padding.top + plotHeight - (f / fMax) * plotHeight, [plotHeight, fMax]);
    const xToS = useCallback((x: number) => ((x - padding.left) / plotWidth) * sMax, [plotWidth]);
    const yToF = useCallback((y: number) => ((padding.top + plotHeight - y) / plotHeight) * fMax, [plotHeight, fMax]);

    // Reset to Cromer-Mann
    const handleReset = useCallback(() => {
        const newPoints = generateInitialPoints(selectedElement);
        onFormFactorsChange({
            ...formFactors,
            [selectedElement]: newPoints,
        });
    }, [selectedElement, formFactors, onFormFactorsChange]);

    // Mouse handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on a point
        for (let i = 0; i < currentPoints.length; i++) {
            const px = sToX(currentPoints[i].s);
            const py = fToY(currentPoints[i].f);
            const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
            if (dist < 10) {
                setDraggingPoint(i);
                return;
            }
        }
    }, [currentPoints, sToX, fToY]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (draggingPoint !== null) {
            // Update point position (only y, keep s fixed)
            const newF = Math.max(0, Math.min(fMax, yToF(y)));
            const newPoints = [...currentPoints];
            newPoints[draggingPoint] = { ...newPoints[draggingPoint], f: newF };
            onFormFactorsChange({
                ...formFactors,
                [selectedElement]: newPoints,
            });
        } else {
            // Check for hover
            let hovered = null;
            for (let i = 0; i < currentPoints.length; i++) {
                const px = sToX(currentPoints[i].s);
                const py = fToY(currentPoints[i].f);
                const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
                if (dist < 10) {
                    hovered = i;
                    break;
                }
            }
            setHoveredPoint(hovered);
        }
    }, [draggingPoint, currentPoints, sToX, fToY, yToF, fMax, formFactors, selectedElement, onFormFactorsChange]);

    const handleMouseUp = useCallback(() => {
        setDraggingPoint(null);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setDraggingPoint(null);
        setHoveredPoint(null);
    }, []);

    // Draw the editor
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.fillStyle = theme.surface || theme.background;
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 0.5;

        // Vertical grid
        for (let s = 0; s <= sMax; s += 0.5) {
            const x = sToX(s);
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + plotHeight);
            ctx.stroke();
        }

        // Horizontal grid
        const fStep = fMax > 20 ? 10 : 5;
        for (let f = 0; f <= fMax; f += fStep) {
            const y = fToY(f);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotWidth, y);
            ctx.stroke();
        }

        // Draw axes
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + plotHeight);
        ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
        ctx.stroke();

        // Axis labels
        ctx.fillStyle = theme.textMuted;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';

        for (let s = 0; s <= sMax; s += 0.5) {
            ctx.fillText(s.toFixed(1), sToX(s), height - 8);
        }
        ctx.fillText('sin(θ)/λ (Å⁻¹)', padding.left + plotWidth / 2, height - 2);

        ctx.textAlign = 'right';
        for (let f = 0; f <= fMax; f += fStep) {
            ctx.fillText(f.toString(), padding.left - 5, fToY(f) + 3);
        }

        ctx.save();
        ctx.translate(12, padding.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('f (electrons)', 0, 0);
        ctx.restore();

        // Draw interpolated curve for selected element
        if (currentPoints.length > 0) {
            ctx.strokeStyle = ELEMENT_COLORS[selectedElement] || theme.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i <= 100; i++) {
                const s = (i / 100) * sMax;
                const f = interpolateFormFactorSmooth(currentPoints, s);
                const x = sToX(s);
                const y = fToY(f);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Draw control points
            for (let i = 0; i < currentPoints.length; i++) {
                const x = sToX(currentPoints[i].s);
                const y = fToY(currentPoints[i].f);

                ctx.beginPath();
                ctx.arc(x, y, hoveredPoint === i || draggingPoint === i ? 7 : 5, 0, Math.PI * 2);
                ctx.fillStyle = draggingPoint === i ? '#ff6b6b' :
                               hoveredPoint === i ? '#ffd93d' :
                               (ELEMENT_COLORS[selectedElement] || theme.accent);
                ctx.fill();
                ctx.strokeStyle = theme.text;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Title
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Form Factor Editor: ${selectedElement}`, padding.left, 14);

        // Instructions
        ctx.font = '9px sans-serif';
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'right';
        ctx.fillText('Drag points to edit', width - 10, 14);

    }, [width, height, currentPoints, selectedElement, theme, sToX, fToY, fMax, hoveredPoint, draggingPoint]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Element selector */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {uniqueElements.map(el => (
                    <button
                        key={el}
                        onClick={() => setSelectedElement(el)}
                        style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.7rem',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '4px',
                            backgroundColor: selectedElement === el
                                ? (ELEMENT_COLORS[el] || theme.accent)
                                : theme.inputBg,
                            color: selectedElement === el ? '#fff' : theme.text,
                            cursor: 'pointer',
                            fontWeight: selectedElement === el ? 'bold' : 'normal',
                        }}
                    >
                        {el}
                    </button>
                ))}
                <button
                    onClick={handleReset}
                    style={{
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        backgroundColor: theme.inputBg,
                        color: theme.text,
                        cursor: 'pointer',
                        marginLeft: 'auto',
                    }}
                >
                    Reset
                </button>
            </div>

            {/* Canvas */}
            <div
                style={{
                    borderRadius: '4px',
                    border: `1px solid ${theme.border}`,
                    overflow: 'hidden',
                    cursor: hoveredPoint !== null ? 'grab' : 'default',
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{ width, height, display: 'block' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                />
            </div>
        </div>
    );
};

export default FormFactorEditor;
