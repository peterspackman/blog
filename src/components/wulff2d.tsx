import React, { useState, useRef, useEffect } from 'react';
import styles from './WulffConstruction.module.css';

interface WulffConstructionProps {
    className?: string;
}

const WulffConstruction: React.FC<WulffConstructionProps> = ({ className }) => {
    const [showConstruction, setShowConstruction] = useState(true);
    const [highlightedDirection, setHighlightedDirection] = useState(null);
    const [draggedDirection, setDraggedDirection] = useState(null);

    // Define crystal directions with adjustable surface energies
    const [directions, setDirections] = useState([
        { name: '[10]', angle: 0, color: '#ff0000', gamma: 1.2 },
        { name: '[11]', angle: 45, color: '#00aa00', gamma: 1.0 },
        { name: '[01]', angle: 90, color: '#aa00aa', gamma: 1.3 },
        { name: '[1̄1]', angle: 135, color: '#ff8800', gamma: 1.1 },
        { name: '[1̄0]', angle: 180, color: '#0088ff', gamma: 1.2 },
        { name: '[1̄1̄]', angle: 225, color: '#888800', gamma: 1.1 },
        { name: '[01̄]', angle: 270, color: '#008888', gamma: 1.3 },
        { name: '[11̄]', angle: 315, color: '#880088', gamma: 1.0 }
    ]);

    const svgRef = useRef(null);

    // Calculate γ-plot points
    const calculateGammaPoint = (direction) => {
        const rad = (direction.angle * Math.PI) / 180;
        const r = direction.gamma * 80; // Scale factor for display
        return {
            x: r * Math.cos(rad),
            y: -r * Math.sin(rad) // Negative because SVG y-axis is inverted
        };
    };

    // Robust half-plane intersection algorithm
    const intersectHalfPlanes = (halfPlanes) => {
        const n = halfPlanes.length;
        if (n === 0) return [];

        // Sort half-planes by angle
        const sorted = halfPlanes.slice().sort((a, b) => Math.atan2(a.b, a.a) - Math.atan2(b.b, b.a));

        // Use a deque for the dual of the convex hull algorithm
        const deque = [];

        // Helper function to find line intersection
        const lineIntersection = (h1, h2) => {
            const det = h1.a * h2.b - h2.a * h1.b;
            if (Math.abs(det) < 1e-10) return null;

            return {
                x: (h1.c * h2.b - h2.c * h1.b) / det,
                y: (h1.a * h2.c - h2.a * h1.c) / det
            };
        };

        // Helper to check if point satisfies half-plane constraint
        const satisfiesConstraint = (point, halfPlane) => {
            return halfPlane.a * point.x + halfPlane.b * point.y <= halfPlane.c + 1e-10;
        };

        // Process each half-plane
        for (let i = 0; i < n; i++) {
            const h = sorted[i];

            // Remove half-planes from the back that are made redundant
            while (deque.length >= 2) {
                const h1 = deque[deque.length - 2];
                const h2 = deque[deque.length - 1];
                const p = lineIntersection(h1, h2);

                if (!p || !satisfiesConstraint(p, h)) {
                    deque.pop();
                } else {
                    break;
                }
            }

            // Remove half-planes from the front that are made redundant
            while (deque.length >= 2) {
                const h1 = deque[0];
                const h2 = deque[1];
                const p = lineIntersection(h1, h2);

                if (!p || !satisfiesConstraint(p, h)) {
                    deque.shift();
                } else {
                    break;
                }
            }

            deque.push(h);
        }

        // Final cleanup: check the intersection of last and first
        while (deque.length >= 3) {
            const h1 = deque[deque.length - 2];
            const h2 = deque[deque.length - 1];
            const h3 = deque[0];
            const p = lineIntersection(h2, h3);

            if (!p || !satisfiesConstraint(p, h1)) {
                deque.pop();
            } else {
                break;
            }
        }

        while (deque.length >= 3) {
            const h1 = deque[deque.length - 1];
            const h2 = deque[0];
            const h3 = deque[1];
            const p = lineIntersection(h2, h3);

            if (!p || !satisfiesConstraint(p, h1)) {
                deque.shift();
            } else {
                break;
            }
        }

        // Build vertices from remaining half-planes
        const vertices = [];
        if (deque.length >= 3) {
            for (let i = 0; i < deque.length; i++) {
                const h1 = deque[i];
                const h2 = deque[(i + 1) % deque.length];
                const p = lineIntersection(h1, h2);

                if (p) {
                    vertices.push({
                        x: p.x,
                        y: p.y,
                        h1: h1,
                        h2: h2
                    });
                }
            }
        }

        return vertices;
    };

    // Calculate the Wulff shape vertices
    const calculateWulffShape = () => {
        // Create half-planes from directions
        const halfPlanes = directions.map(dir => {
            const rad = (dir.angle * Math.PI) / 180;
            const distance = dir.gamma * 60; // Scale factor for final shape

            // Normal vector pointing outward (in normal coordinates, not SVG)
            const nx = Math.cos(rad);
            const ny = Math.sin(rad);

            return {
                a: nx,
                b: -ny, // Negative for SVG coordinate system
                c: distance,
                direction: dir
            };
        });

        const vertices = intersectHalfPlanes(halfPlanes);

        // If we get a degenerate shape, create a minimal triangle
        if (vertices.length < 3) {
            const minDir = directions.reduce((min, dir) =>
                dir.gamma < min.gamma ? dir : min
            );

            const rad = (minDir.angle * Math.PI) / 180;
            const dist = minDir.gamma * 60;
            const centerX = dist * Math.cos(rad);
            const centerY = -dist * Math.sin(rad);

            return [
                { x: centerX - 10, y: centerY - 10 },
                { x: centerX + 10, y: centerY - 10 },
                { x: centerX, y: centerY + 10 }
            ];
        }

        return vertices;
    };

    // Calculate construction line for visualization
    const calculateConstructionLine = (direction) => {
        const rad = (direction.angle * Math.PI) / 180;
        const distance = direction.gamma * 60; // Scale factor

        // Point on the line
        const centerX = distance * Math.cos(rad);
        const centerY = -distance * Math.sin(rad);

        // Perpendicular direction for the line
        const perpRad = rad + Math.PI / 2;
        const lineLength = 200;

        return {
            x1: centerX + lineLength * Math.cos(perpRad),
            y1: centerY - lineLength * Math.sin(perpRad),
            x2: centerX - lineLength * Math.cos(perpRad),
            y2: centerY + lineLength * Math.sin(perpRad),
            centerX,
            centerY
        };
    };

    // Handle mouse events for dragging
    const handleMouseDown = (idx) => {
        setDraggedDirection(idx);
    };

    const handleMouseMove = (e) => {
        if (draggedDirection === null || !svgRef.current) return;

        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        // Convert to polar coordinates
        const distance = Math.sqrt(x * x + y * y);
        const newGamma = distance / 80; // Scale factor

        // Limit gamma values
        const clampedGamma = Math.max(0.3, Math.min(2.0, newGamma));

        // Update the direction's gamma value
        const newDirections = [...directions];
        newDirections[draggedDirection].gamma = clampedGamma;
        setDirections(newDirections);
    };

    const handleMouseUp = () => {
        setDraggedDirection(null);
    };

    // Add global mouse event listeners
    useEffect(() => {
        if (draggedDirection !== null) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [draggedDirection]);

    const wulffVertices = calculateWulffShape();

    // Determine which facets are visible
    const visibleFacets = new Map();
    for (let i = 0; i < wulffVertices.length; i++) {
        const v1 = wulffVertices[i];
        const v2 = wulffVertices[(i + 1) % wulffVertices.length];

        // Find which direction this facet corresponds to
        if (v1.h1 && v2.h1) {
            // Check if they share a half-plane
            let sharedPlane = null;
            if (v1.h1 === v2.h1 || v1.h1 === v2.h2) {
                sharedPlane = v1.h1;
            } else if (v1.h2 === v2.h1 || v1.h2 === v2.h2) {
                sharedPlane = v1.h2;
            }

            if (sharedPlane && sharedPlane.direction) {
                const dir = sharedPlane.direction;
                if (!visibleFacets.has(dir)) {
                    visibleFacets.set(dir, []);
                }
                visibleFacets.get(dir).push({ v1, v2, midX: (v1.x + v2.x) / 2, midY: (v1.y + v2.y) / 2 });
            }
        }
    }

    return (
        <div className={`container margin-vert--lg ${className || ''}`}>
            <div className="row">
                {/* γ-plot */}
                <div className="col col--6 text--center">
                    <h3 className="margin-bottom--sm">γ-plot (Surface Energy)</h3>
                    <p className="margin-bottom--sm">Drag points to adjust surface energies</p>
                    <svg
                        ref={svgRef}
                        width="300"
                        height="300"
                        viewBox="-150 -150 300 300"
                        className={styles.svgContainer}
                        style={{ cursor: draggedDirection !== null ? 'grabbing' : 'default' }}
                    >
                        {/* Grid */}
                        <line x1="-150" y1="0" x2="150" y2="0" stroke="#ccc" strokeWidth="1" />
                        <line x1="0" y1="-150" x2="0" y2="150" stroke="#ccc" strokeWidth="1" />

                        {/* Circles for gamma values */}
                        <circle cx="0" cy="0" r="40" fill="none" stroke="#eee" strokeWidth="1" strokeDasharray="2,2" />
                        <circle cx="0" cy="0" r="80" fill="none" stroke="#eee" strokeWidth="1" strokeDasharray="2,2" />
                        <circle cx="0" cy="0" r="120" fill="none" stroke="#eee" strokeWidth="1" strokeDasharray="2,2" />
                        <text x="0" y="-45" textAnchor="middle" fontSize="10" fill="#999">γ = 0.5</text>
                        <text x="0" y="-85" textAnchor="middle" fontSize="10" fill="#999">γ = 1.0</text>
                        <text x="0" y="-125" textAnchor="middle" fontSize="10" fill="#999">γ = 1.5</text>

                        {/* Direction points and labels */}
                        {directions.map((dir, idx) => {
                            const point = calculateGammaPoint(dir);
                            const isHighlighted = highlightedDirection === idx;
                            const isDragged = draggedDirection === idx;

                            return (
                                <g key={idx}>
                                    {/* Line from origin */}
                                    <line
                                        x1="0"
                                        y1="0"
                                        x2={point.x}
                                        y2={point.y}
                                        stroke={dir.color}
                                        strokeWidth={isHighlighted || isDragged ? 3 : 1}
                                        opacity={isHighlighted || isDragged ? 1 : 0.5}
                                    />

                                    {/* Point */}
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r={isDragged ? 10 : (isHighlighted ? 8 : 6)}
                                        fill={dir.color}
                                        className={styles.draggablePoint}
                                        onMouseEnter={() => setHighlightedDirection(idx)}
                                        onMouseLeave={() => setHighlightedDirection(null)}
                                        onMouseDown={() => handleMouseDown(idx)}
                                    />

                                    {/* Label */}
                                    <text
                                        x={point.x * 1.3}
                                        y={point.y * 1.3}
                                        textAnchor="middle"
                                        fontSize="14"
                                        fill={dir.color}
                                        fontWeight={isHighlighted || isDragged ? 'bold' : 'normal'}
                                    >
                                        {dir.name}
                                    </text>

                                    {/* Gamma value */}
                                    {(isHighlighted || isDragged) && (
                                        <text
                                            x={point.x * 1.3}
                                            y={point.y * 1.3 + 15}
                                            textAnchor="middle"
                                            fontSize="12"
                                            fill={dir.color}
                                        >
                                            γ = {dir.gamma.toFixed(2)}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Equilibrium shape */}
                <div className="col col--6 text--center">
                    <h3 className="margin-bottom--sm">Equilibrium Crystal Shape</h3>
                    <p className="margin-bottom--sm">Intersection of half-planes</p>
                    <svg width="300" height="300" viewBox="-150 -150 300 300" className={styles.svgContainer}>
                        {/* Grid */}
                        <line x1="-150" y1="0" x2="150" y2="0" stroke="#ccc" strokeWidth="1" strokeDasharray="5,5" />
                        <line x1="0" y1="-150" x2="0" y2="150" stroke="#ccc" strokeWidth="1" strokeDasharray="5,5" />

                        {/* Construction lines */}
                        {showConstruction && directions.map((dir, idx) => {
                            const line = calculateConstructionLine(dir);
                            const isHighlighted = highlightedDirection === idx;
                            const isVisible = visibleFacets.has(dir);

                            return (
                                <g key={idx}>
                                    {/* Perpendicular line */}
                                    <line
                                        x1={line.x1}
                                        y1={line.y1}
                                        x2={line.x2}
                                        y2={line.y2}
                                        stroke={dir.color}
                                        strokeWidth={isHighlighted ? 3 : (isVisible ? 2 : 1)}
                                        strokeDasharray={isHighlighted ? "none" : "4,4"}
                                        opacity={isHighlighted ? 0.9 : (isVisible ? 0.7 : 0.3)}
                                    />

                                    {/* Normal from origin to plane */}
                                    {(isHighlighted || isVisible) && (
                                        <line
                                            x1="0"
                                            y1="0"
                                            x2={line.centerX}
                                            y2={line.centerY}
                                            stroke={dir.color}
                                            strokeWidth="1"
                                            strokeDasharray="2,2"
                                            opacity={isHighlighted ? 1 : 0.5}
                                        />
                                    )}
                                </g>
                            );
                        })}

                        {/* Wulff shape */}
                        {wulffVertices.length >= 3 && (
                            <polygon
                                points={wulffVertices.map(v => `${v.x},${v.y}`).join(' ')}
                                fill="#e6f2ff"
                                stroke="#0066cc"
                                strokeWidth="3"
                            />
                        )}

                        {/* Vertex markers */}
                        {wulffVertices.length >= 3 && wulffVertices.map((v, idx) => (
                            <circle
                                key={idx}
                                cx={v.x}
                                cy={v.y}
                                r="3"
                                fill="#0066cc"
                            />
                        ))}

                        {/* Facet labels */}
                        {Array.from(visibleFacets.entries()).map(([dir, segments]) => {
                            if (segments.length === 0) return null;

                            // Calculate average position for label
                            let avgX = 0, avgY = 0;
                            segments.forEach(seg => {
                                avgX += seg.midX;
                                avgY += seg.midY;
                            });
                            avgX /= segments.length;
                            avgY /= segments.length;

                            // Check if facet is too small
                            let totalLength = 0;
                            segments.forEach(seg => {
                                const dx = seg.v2.x - seg.v1.x;
                                const dy = seg.v2.y - seg.v1.y;
                                totalLength += Math.sqrt(dx * dx + dy * dy);
                            });

                            if (totalLength < 10) return null;

                            // Place label outside the shape
                            const distFromOrigin = Math.sqrt(avgX * avgX + avgY * avgY);
                            const labelDistance = 1.3;
                            const labelX = avgX * labelDistance;
                            const labelY = avgY * labelDistance;

                            return (
                                <text
                                    key={`facet-${dir.name}`}
                                    x={labelX}
                                    y={labelY}
                                    textAnchor="middle"
                                    fontSize="14"
                                    fill={dir.color}
                                    fontWeight={highlightedDirection === directions.indexOf(dir) ? 'bold' : 'normal'}
                                >
                                    ({dir.name.replace('[', '').replace(']', '')})
                                </text>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* Controls */}
            <div className="margin-top--md text--center">
                <div className="margin-bottom--sm">
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={showConstruction}
                            onChange={(e) => setShowConstruction(e.target.checked)}
                            className="margin-right--sm"
                        />
                        <span>Show construction lines</span>
                    </label>
                </div>

                {/* Reset button */}
                <button
                    onClick={() => setDirections([
                        { name: '[10]', angle: 0, color: '#ff0000', gamma: 1.2 },
                        { name: '[11]', angle: 45, color: '#00aa00', gamma: 1.0 },
                        { name: '[01]', angle: 90, color: '#aa00aa', gamma: 1.3 },
                        { name: '[1̄1]', angle: 135, color: '#ff8800', gamma: 1.1 },
                        { name: '[1̄0]', angle: 180, color: '#0088ff', gamma: 1.2 },
                        { name: '[1̄1̄]', angle: 225, color: '#888800', gamma: 1.1 },
                        { name: '[01̄]', angle: 270, color: '#008888', gamma: 1.3 },
                        { name: '[11̄]', angle: 315, color: '#880088', gamma: 1.0 }
                    ])}
                    className="button button--primary"
                >
                    Reset to Default
                </button>
            </div>

            {/* Explanation */}
            <div className="margin-top--md">
                <div className="alert alert--info">
                    <p>Drag the points in the γ-plot to adjust surface energies!</p>
                    <p><strong>The Wulff construction:</strong></p>
                    <ul>
                        <li>Each surface energy γ defines a half-plane at distance γ from origin</li>
                        <li>The equilibrium shape is the intersection of all half-planes</li>
                        <li>Lower energy surfaces (closer to origin) create larger facets</li>
                        <li>High energy surfaces may not appear if neighbors have lower energy</li>
                        <li>The shape is always convex and minimizes total surface energy</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default WulffConstruction;
