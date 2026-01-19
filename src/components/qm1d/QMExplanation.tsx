import React from 'react';
import MathFormula from '../MathFormula';
import { getPotentialDisplayName, type PotentialType } from './physics';

export interface QMExplanationProps {
    potentialType: PotentialType;
    activeStates: number[];
}

export const QMExplanation: React.FC<QMExplanationProps> = ({
    potentialType,
    activeStates,
}) => {
    const potentialName = getPotentialDisplayName(potentialType);

    return (
        <div
            style={{
                backgroundColor: '#eff6ff',
                padding: '1.25rem',
                borderRadius: '8px',
                marginTop: '1rem',
            }}
        >
            <h3
                style={{
                    margin: '0 0 0.75rem 0',
                    fontSize: '1.1rem',
                    color: '#1e40af',
                }}
            >
                {potentialName}
            </h3>

            {potentialType === 'harmonic' && (
                <>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        The quantum harmonic oscillator models a particle in a parabolic potential
                        well, like a mass on a spring. It's one of the most important quantum
                        systems because many potentials can be approximated as harmonic near their
                        minimum.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        Energy levels are evenly spaced:{' '}
                        <MathFormula math="E_n = (n + \frac{1}{2})\hbar\omega" inline />
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        The wavefunctions involve Hermite polynomials multiplied by a Gaussian
                        envelope, ensuring they decay smoothly at large distances.
                    </p>
                </>
            )}

            {potentialType === 'infinite_well' && (
                <>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        The particle in a box (infinite square well) confines a particle to a
                        region with infinitely high barriers at the boundaries. It's the simplest
                        model for understanding quantum confinement.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        Energy levels grow quadratically:{' '}
                        <MathFormula math="E_n = \frac{n^2 \pi^2 \hbar^2}{2mL^2}" inline />
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        The wavefunctions are sinusoidal with nodes that correspond to the quantum
                        number. The number of nodes increases with energy.
                    </p>
                </>
            )}

            <div
                style={{
                    backgroundColor: '#dbeafe',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    marginTop: '0.75rem',
                }}
            >
                <strong style={{ color: '#1e40af' }}>Time Evolution:</strong>
                <p style={{ margin: '0.5rem 0 0 0', lineHeight: 1.6 }}>
                    Each state evolves as{' '}
                    <MathFormula math="\psi_n(x,t) = \psi_n(x) e^{-iE_n t/\hbar}" inline />.
                    The phasor diagram shows the phase of each state rotating at its energy-dependent rate.
                    Time is measured in ground-state periods (T₀).
                </p>
            </div>

            {activeStates.length > 1 && (
                <div
                    style={{
                        backgroundColor: '#fef3c7',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        marginTop: '0.75rem',
                    }}
                >
                    <strong style={{ color: '#92400e' }}>Superposition:</strong>
                    <p style={{ margin: '0.5rem 0 0 0', lineHeight: 1.6 }}>
                        Multiple states are superimposed with equal weights. The probability
                        density oscillates as states interfere constructively and destructively.
                        Watch the phasors to see how different rotation rates create the beating pattern.
                    </p>
                </div>
            )}

            <div
                style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '4px',
                    border: '1px solid #bbf7d0',
                }}
            >
                <strong style={{ color: '#166534' }}>Tip:</strong> Click on the phasor squares
                below the main plot to toggle quantum states on and off. Try activating multiple
                states to see interference effects!
            </div>
        </div>
    );
};

export default QMExplanation;
