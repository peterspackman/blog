import { useRef, useCallback } from 'react';
import { ParticleData } from './ParticleData';
import { VectorField, FieldPreset, FieldShape } from './VectorField';
import { ElectricField, ElectricFieldPreset } from './ElectricField';

interface UsePointerHandlersProps {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    particleData: ParticleData | null;
    vectorFieldRef: React.RefObject<VectorField | null>;
    electricFieldRef: React.RefObject<ElectricField | null>;
    fieldPreset: FieldPreset;
    eFieldPreset: ElectricFieldPreset;
    fieldStrength: number;
    eFieldStrength: number;
    fieldShape: FieldShape;
    brushRadius: number;
    coordinateScale: number;
    visualScale: number;
    baseParticleRadius: number;
    onVectorFieldUpdate: () => void;
}

export function usePointerHandlers({
    canvasRef,
    particleData,
    vectorFieldRef,
    electricFieldRef,
    fieldPreset,
    eFieldPreset,
    fieldStrength,
    eFieldStrength,
    fieldShape,
    brushRadius,
    coordinateScale,
    visualScale,
    baseParticleRadius,
    onVectorFieldUpdate,
}: UsePointerHandlersProps) {
    const drawButtonRef = useRef<number>(0);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const draggingParticleRef = useRef<number | null>(null);
    const isDrawingRef = useRef(false);
    const activeDrawFieldRef = useRef<'potential' | 'electric'>('potential');

    // Helper to paint/erase on the potential field at screen coordinates
    const paintFieldAt = useCallback((screenX: number, screenY: number) => {
        if (!vectorFieldRef.current || fieldPreset !== 'draw') return;

        // Convert screen coords to simulation coords (both have Y=0 at top)
        const simX = screenX / coordinateScale;
        const simY = screenY / coordinateScale;

        // Left click (button 0) = attractive (pulls particles in)
        // Right click (button 2) = repulsive (pushes particles away)
        // Middle click or other = erase
        const button = drawButtonRef.current;

        if (button === 0) {
            // Left click: attractive (negative strength)
            vectorFieldRef.current.paintAt(simX, simY, brushRadius, -fieldStrength, fieldShape);
        } else if (button === 2) {
            // Right click: repulsive (positive strength)
            vectorFieldRef.current.paintAt(simX, simY, brushRadius, fieldStrength, fieldShape);
        } else {
            // Middle click: erase
            vectorFieldRef.current.eraseAt(simX, simY, brushRadius);
        }

        // Update visualization
        onVectorFieldUpdate();
    }, [vectorFieldRef, fieldPreset, coordinateScale, brushRadius, fieldStrength, fieldShape, onVectorFieldUpdate]);

    // Helper to paint E-field based on drag direction
    const paintEFieldAt = useCallback((screenX: number, screenY: number, dirX: number, dirY: number) => {
        if (!electricFieldRef.current || eFieldPreset !== 'draw') return;

        const simX = screenX / coordinateScale;
        const simY = screenY / coordinateScale;

        // Normalize direction and scale by strength
        const mag = Math.sqrt(dirX * dirX + dirY * dirY);
        if (mag > 5) {  // Only paint if drag distance is significant
            const ex = (dirX / mag) * eFieldStrength;
            const ey = (dirY / mag) * eFieldStrength;
            electricFieldRef.current.paintAt(simX, simY, ex, ey, brushRadius * 2);
        }
    }, [electricFieldRef, eFieldPreset, coordinateScale, eFieldStrength, brushRadius]);

    // Unified pointer events for mouse and touch
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!canvasRef.current || !particleData) return;

        // Prevent default to avoid scrolling on touch devices
        e.preventDefault();

        // Capture pointer for reliable drag tracking
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        // Use nativeEvent.offsetX/Y which are already relative to the target element
        const screenX = e.nativeEvent.offsetX;
        const screenY = e.nativeEvent.offsetY;

        // Potential field drawing mode
        if (fieldPreset === 'draw') {
            drawButtonRef.current = e.button;
            isDrawingRef.current = true;
            activeDrawFieldRef.current = 'potential';
            paintFieldAt(screenX, screenY);
            return;
        }

        // E-field drawing mode - track drag start
        if (eFieldPreset === 'draw') {
            isDrawingRef.current = true;
            activeDrawFieldRef.current = 'electric';
            dragStartRef.current = { x: screenX, y: screenY };
            return;
        }

        // Otherwise: try to select a particle
        const positions = particleData.positions;

        for (let i = 0; i < particleData.count; i++) {
            const idx = i * 2;
            const particleScreenX = positions[idx] * coordinateScale;
            const particleScreenY = positions[idx + 1] * coordinateScale;

            const dx = Math.abs(particleScreenX - screenX);
            const dy = Math.abs(particleScreenY - screenY);

            // Larger touch target for mobile
            // Visual radius is baseParticleRadius * visualScale in pixels
            const selectionSize = baseParticleRadius * visualScale * (e.pointerType === 'touch' ? 2.0 : 1.2);

            if (dx <= selectionSize && dy <= selectionSize) {
                draggingParticleRef.current = i;
                break;
            }
        }
    }, [canvasRef, particleData, fieldPreset, eFieldPreset, coordinateScale, visualScale, baseParticleRadius, paintFieldAt]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!canvasRef.current) return;

        // Use nativeEvent.offsetX/Y which are already relative to the target element
        const screenX = e.nativeEvent.offsetX;
        const screenY = e.nativeEvent.offsetY;

        // Potential field drawing mode: continue painting
        if (isDrawingRef.current && activeDrawFieldRef.current === 'potential' && fieldPreset === 'draw') {
            paintFieldAt(screenX, screenY);
            return;
        }

        // E-field drawing mode: paint based on drag direction
        if (isDrawingRef.current && activeDrawFieldRef.current === 'electric' && eFieldPreset === 'draw' && dragStartRef.current) {
            const dirX = screenX - dragStartRef.current.x;
            const dirY = screenY - dragStartRef.current.y;
            paintEFieldAt(dragStartRef.current.x, dragStartRef.current.y, dirX, dirY);
            // Update drag start for continuous painting
            dragStartRef.current = { x: screenX, y: screenY };
            return;
        }

        // Particle dragging
        if (draggingParticleRef.current === null || !particleData) return;

        const simX = screenX / coordinateScale;
        const simY = screenY / coordinateScale;

        const idx = draggingParticleRef.current * 2;
        particleData.positions[idx] = simX;
        particleData.positions[idx + 1] = simY;

        particleData.velocities[idx] = 0;
        particleData.velocities[idx + 1] = 0;
        particleData.accelerations[idx] = 0;
        particleData.accelerations[idx + 1] = 0;
    }, [canvasRef, particleData, fieldPreset, eFieldPreset, coordinateScale, paintFieldAt, paintEFieldAt]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        draggingParticleRef.current = null;
        isDrawingRef.current = false;
        dragStartRef.current = null;
    }, []);

    // Prevent context menu on right-click in draw mode
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        if (fieldPreset === 'draw' || eFieldPreset === 'draw') {
            e.preventDefault();
        }
    }, [fieldPreset, eFieldPreset]);

    return {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleContextMenu,
        draggingParticle: draggingParticleRef.current,
    };
}
