import React, { useRef, useEffect, useState } from 'react';
import styles from './QMVisualization.module.css';
import MathFormula from './MathFormula';

const WaveInterferenceVisualization = () => {
    const canvasRef = useRef(null);
    const [wavelength, setWavelength] = useState(1.5); // X-ray wavelength in Angstroms
    const [latticeSpacing, setLatticeSpacing] = useState(3.0); // d-spacing in Angstroms
    const [incidentAngle, setIncidentAngle] = useState(15); // Theta in degrees
    const [numberOfWaves, setNumberOfWaves] = useState(3); // Number of wave sources

    // Calculate if Bragg's condition is met
    const pathDifference = 2 * latticeSpacing * Math.sin(incidentAngle * Math.PI / 180);
    const braggOrder = Math.round(pathDifference / wavelength);
    const isBraggMet = Math.abs(pathDifference - braggOrder * wavelength) < 0.05;

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Animation frame reference
        let animationFrameId;
        let time = 0;

        const render = () => {
            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Title and information
            ctx.fillStyle = '#000000';

            // Display current parameters
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Wavelength (λ): ${wavelength} Å`, 20, 60);
            ctx.fillText(`Lattice Spacing (d): ${latticeSpacing} Å`, 20, 80);
            ctx.fillText(`Incident Angle (θ): ${incidentAngle}°`, 20, 100);
            ctx.fillText(`Path Difference: ${pathDifference.toFixed(2)} Å`, 20, 120);

            // Status of Bragg's condition
            ctx.fillStyle = isBraggMet ? '#28a745' : '#dc3545';
            ctx.fillText(
                isBraggMet ?
                    `Bragg's condition met: ${braggOrder}λ = 2d·sin(θ)` :
                    `Bragg's condition not met`,
                20,
                140
            );

            // Draw crystal representation on the left side
            const crystalStartX = 20;
            const crystalWidth = 200;
            const crystalTopY = 200;
            // Adjust spacing based on number of waves to fit in the available space
            const crystalLayerSpacing = Math.max(10, 180 / (numberOfWaves + 1));

            // Draw crystal layers
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000000';

            // Calculate phase difference between waves
            // Phase difference = 2π × path difference / wavelength
            const phaseDifference = (2 * Math.PI * pathDifference) / wavelength;

            // Draw crystal planes and indicate reflection points
            for (let i = 0; i < numberOfWaves; i++) {
                const layerY = crystalTopY + i * crystalLayerSpacing;
                const reflectionPointX = crystalStartX + crystalWidth / 2;

                // Crystal plane
                ctx.beginPath();
                ctx.moveTo(crystalStartX, layerY);
                ctx.lineTo(crystalStartX + crystalWidth, layerY);
                ctx.stroke();

                // Calculate angle in radians
                const theta = incidentAngle * Math.PI / 180;

                // Draw incident ray
                const rayLength = 80;
                const incidentStartX = reflectionPointX - rayLength * Math.cos(theta);
                const incidentStartY = layerY - rayLength * Math.sin(theta);

                ctx.beginPath();
                ctx.strokeStyle = '#0066cc';
                ctx.setLineDash([]);
                ctx.moveTo(incidentStartX, incidentStartY);
                ctx.lineTo(reflectionPointX, layerY);
                ctx.stroke();

                // Draw arrow for incident ray
                const arrowLength = 8;
                const arrowAngle = Math.atan2(layerY - incidentStartY, reflectionPointX - incidentStartX);
                ctx.beginPath();
                ctx.fillStyle = '#0066cc';
                ctx.moveTo(
                    reflectionPointX - arrowLength * Math.cos(arrowAngle - Math.PI / 6),
                    layerY - arrowLength * Math.sin(arrowAngle - Math.PI / 6)
                );
                ctx.lineTo(reflectionPointX, layerY);
                ctx.lineTo(
                    reflectionPointX - arrowLength * Math.cos(arrowAngle + Math.PI / 6),
                    layerY - arrowLength * Math.sin(arrowAngle + Math.PI / 6)
                );
                ctx.fill();

                // Draw reflected ray
                const reflectedEndX = reflectionPointX + rayLength * Math.cos(theta);
                const reflectedEndY = layerY - rayLength * Math.sin(theta);

                ctx.beginPath();
                ctx.strokeStyle = '#cc3300';
                ctx.moveTo(reflectionPointX, layerY);
                ctx.lineTo(reflectedEndX, reflectedEndY);
                ctx.stroke();

                // Draw arrow for reflected ray
                const reflectedArrowAngle = Math.atan2(reflectedEndY - layerY, reflectedEndX - reflectionPointX);
                ctx.beginPath();
                ctx.fillStyle = '#cc3300';
                ctx.moveTo(
                    reflectedEndX - arrowLength * Math.cos(reflectedArrowAngle - Math.PI / 6),
                    reflectedEndY - arrowLength * Math.sin(reflectedArrowAngle - Math.PI / 6)
                );
                ctx.lineTo(reflectedEndX, reflectedEndY);
                ctx.lineTo(
                    reflectedEndX - arrowLength * Math.cos(reflectedArrowAngle + Math.PI / 6),
                    reflectedEndY - arrowLength * Math.sin(reflectedArrowAngle + Math.PI / 6)
                );
                ctx.fill();

                // Draw angle markers
                const angleRadius = 15;

                // Show angle value on first layer only
                if (i === 0) {
                    ctx.fillStyle = '#555';
                    ctx.font = '12px Arial';
                    ctx.fillText(`θ`, reflectionPointX - angleRadius - 5, layerY - 5);
                    ctx.fillText(`θ`, reflectionPointX + angleRadius - 5, layerY - 5);
                }

                // Mark reflection point
                ctx.beginPath();
                ctx.arc(reflectionPointX, layerY, 4, 0, Math.PI * 2);
                ctx.fillStyle = i === 0 ? '#0066cc' : `rgba(0, 102, 204, ${0.8 - i * 0.05})`;
                ctx.fill();
            }

            // Draw d-spacing markers
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.moveTo(crystalStartX + crystalWidth + 10, crystalTopY);
            ctx.lineTo(crystalStartX + crystalWidth + 10, crystalTopY + crystalLayerSpacing);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#000';
            ctx.font = '16px Arial';
            ctx.fillText(`${latticeSpacing} Å`, crystalStartX + crystalWidth + 15, crystalTopY + crystalLayerSpacing / 2 + 5);

            // Wave visualization area
            const waveAreaStartX = 300;
            const waveAreaWidth = width - waveAreaStartX - 20;
            const waveAreaHeight = 300;
            const waveAreaTopY = 50;

            // Draw border around wave area
            ctx.strokeStyle = '#ccc';
            ctx.strokeRect(waveAreaStartX, waveAreaTopY, waveAreaWidth, waveAreaHeight);

            // Draw central axis
            const centerY = waveAreaTopY + waveAreaHeight / 2;
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = '#aaa';
            ctx.moveTo(waveAreaStartX, centerY);
            ctx.lineTo(waveAreaStartX + waveAreaWidth, centerY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Add propagation direction arrow
            ctx.beginPath();
            ctx.fillStyle = '#aaa';
            ctx.moveTo(waveAreaStartX + waveAreaWidth - 15, centerY - 5);
            ctx.lineTo(waveAreaStartX + waveAreaWidth - 5, centerY);
            ctx.lineTo(waveAreaStartX + waveAreaWidth - 15, centerY + 5);
            ctx.fill();

            // Wave parameters
            const waveSpeed = 0.5; // Speed of propagation
            const maxAmplitude = 30; // Maximum height of waves
            const waveFrequency = 0.1; // Spatial frequency of waves

            // Draw individual waves from each crystal plane
            for (let i = 0; i < numberOfWaves; i++) {
                const color = i === 0 ? '#0066cc' : `rgba(0, 102, 204, ${0.7 - i * 0.15})`;
                const phaseOffset = i * phaseDifference;

                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;

                for (let x = 0; x < waveAreaWidth; x++) {
                    const xPos = waveAreaStartX + x;

                    // Wave equation with phase offset
                    // Using Gaussian envelope to make it look like a wavepacket
                    const envelope = Math.exp(-0.0001 * (x - waveAreaWidth / 2) ** 2);
                    const wave = Math.sin(waveFrequency * x + time * waveSpeed + phaseOffset);
                    const y = wave * maxAmplitude * envelope;

                    if (x === 0) {
                        ctx.moveTo(xPos, centerY - y);
                    } else {
                        ctx.lineTo(xPos, centerY - y);
                    }
                }

                ctx.stroke();
            }

            // Draw the combined wave (sum of all individual waves)
            ctx.beginPath();
            ctx.strokeStyle = '#dc3545'; // Red for combined wave
            ctx.lineWidth = 3;

            for (let x = 0; x < waveAreaWidth; x++) {
                const xPos = waveAreaStartX + x;

                // Sum all the individual waves
                let sumY = 0;
                for (let i = 0; i < numberOfWaves; i++) {
                    const phaseOffset = i * phaseDifference;
                    const envelope = Math.exp(-0.0001 * (x - waveAreaWidth / 2) ** 2);
                    const wave = Math.sin(waveFrequency * x + time * waveSpeed + phaseOffset);
                    sumY += wave * envelope;
                }

                // Scale the combined amplitude
                const y = sumY * maxAmplitude / Math.sqrt(numberOfWaves);

                if (x === 0) {
                    ctx.moveTo(xPos, centerY - y);
                } else {
                    ctx.lineTo(xPos, centerY - y);
                }
            }

            ctx.stroke();

            // Add legend
            ctx.fillStyle = '#0066cc';
            ctx.fillText('Individual waves', waveAreaStartX + 20, waveAreaTopY + waveAreaHeight - 25);

            ctx.fillStyle = '#dc3545';
            ctx.fillText('Combined wave', waveAreaStartX + 20, waveAreaTopY + waveAreaHeight - 10);

            // Update time for next frame
            time += 0.05;
            animationFrameId = window.requestAnimationFrame(render);
        };

        render();

        // Cleanup
        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [wavelength, latticeSpacing, incidentAngle, numberOfWaves, isBraggMet, pathDifference, braggOrder]);

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>
                Bragg Interference
            </h2>
            {/* Canvas and Legend container with flex */}
            <div className={styles.flexContainer}>
                <div className={styles.visualizationRow}>

                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={450}
                        className={styles.canvas}
                    />
                </div>
            </div>
            <div>

                <div className={styles.controlsSection}>
                    <div className={styles.controlsContainer}>
                        <div className={styles.controlsRow}>
                            <div className={styles.rangeContainer}>
                                <label className={styles.rangeLabel}>
                                    Wavelength (λ): {wavelength} Å
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="3"
                                    step="0.01"
                                    value={wavelength}
                                    onChange={(e) => setWavelength(parseFloat(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>
                        </div>

                        <div className={styles.controlsRow}>
                            <div className={styles.rangeContainer}>
                                <label className={styles.rangeLabel}>
                                    Lattice Spacing (d): {latticeSpacing} Å
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    step="0.01"
                                    value={latticeSpacing}
                                    onChange={(e) => setLatticeSpacing(parseFloat(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>
                        </div>
                        <div className={styles.controlsRow}>
                            <div className={styles.rangeContainer}>
                                <label className={styles.rangeLabel}>
                                    Incident Angle (θ): {incidentAngle}°
                                </label>
                                <input
                                    type="range"
                                    min="5"
                                    max="60"
                                    step="0.5"
                                    value={incidentAngle}
                                    onChange={(e) => setIncidentAngle(parseFloat(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>
                        </div>

                        <div className={styles.controlsRow}>
                            <div className={styles.rangeContainer}>
                                <label className={styles.rangeLabel}>
                                    Number of Crystal Planes: {numberOfWaves}
                                </label>
                                <input
                                    type="range"
                                    min="2"
                                    max="20"
                                    step="1"
                                    value={numberOfWaves}
                                    onChange={(e) => setNumberOfWaves(parseInt(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.explanation}>
                    <p className={styles.explanationText}>
                        <MathFormula math="n\lambda = 2d \sin(\theta)" inline={false} />
                    </p>

                    <p className={styles.explanationText}>
                        This visualization shows how X-rays reflecting from different crystal planes interfere with each other. When Bragg's condition is satisfied, the waves combine constructively, resulting in strong diffraction. Otherwise, they interfere destructively, resulting in weak or no diffraction.</p>
                    <p className={styles.explanationText}>Observations:</p>
                    <ul>
                        <li>Try adjusting the incident angle slowly to see how the combined wave's amplitude changes</li>
                        <li>Notice how increasing the number of crystal planes makes the diffraction peaks sharper</li>
                        <li>When Bragg's condition is satisfied, all waves are in phase and reinforce each other</li>
                        <li>When Bragg's condition is not met, the waves partially or completely cancel out</li>
                    </ul>
                </div>
            </div>
        </div >
    );
};

export default WaveInterferenceVisualization;
