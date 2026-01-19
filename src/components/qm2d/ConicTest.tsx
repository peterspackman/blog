import React, { useState, useEffect } from 'react';

export const ConicTest: React.FC = () => {
    const [angle, setAngle] = useState(0);
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        if (!isAnimating) return;

        const interval = setInterval(() => {
            setAngle((prev) => (prev + 2) % 360);
        }, 50);

        return () => clearInterval(interval);
    }, [isAnimating]);

    const color = '#3b82f6'; // blue

    return (
        <div style={{ padding: '2rem', background: '#1a1a1a', borderRadius: '8px', marginBottom: '2rem' }}>
            <h3 style={{ color: 'white', marginBottom: '1rem' }}>Conic Gradient Test</h3>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Test 1: Basic conic gradient */}
                <div>
                    <div
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: '4px',
                            border: '1px solid #444',
                            background: `conic-gradient(from 0deg, ${color} 0deg ${angle}deg, ${color}40 ${angle}deg 360deg)`,
                        }}
                    />
                    <p style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Square fill</p>
                </div>

                {/* Test 2: Circle version */}
                <div>
                    <div
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            border: '1px solid #444',
                            background: `conic-gradient(from -90deg, ${color} 0deg ${angle}deg, ${color}20 ${angle}deg 360deg)`,
                        }}
                    />
                    <p style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Circle (from top)</p>
                </div>

                {/* Test 3: With text overlay */}
                <div>
                    <div
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: '4px',
                            border: '1px solid #444',
                            background: `conic-gradient(from -90deg, ${color} ${angle}deg, ${color}20 ${angle}deg)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 500,
                        }}
                    >
                        1,1
                    </div>
                    <p style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>With text</p>
                </div>

                {/* Test 4: Multiple at different phases */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4].map((n) => {
                        const energy = n * n;
                        const phase = (angle * energy / 2) % 360;
                        const cellColor = `hsl(${200 + n * 30}, 70%, 50%)`;
                        return (
                            <div
                                key={n}
                                style={{
                                    width: 50,
                                    height: 50,
                                    borderRadius: '4px',
                                    border: '1px solid #444',
                                    background: `conic-gradient(from -90deg, ${cellColor} ${phase}deg, ${cellColor}20 ${phase}deg)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '12px',
                                }}
                            >
                                E={energy}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                    onClick={() => setIsAnimating(!isAnimating)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        background: isAnimating ? '#ef4444' : '#22c55e',
                        color: 'white',
                        cursor: 'pointer',
                    }}
                >
                    {isAnimating ? 'Pause' : 'Play'}
                </button>
                <span style={{ color: '#888' }}>Angle: {angle}°</span>
            </div>
        </div>
    );
};

export default ConicTest;
