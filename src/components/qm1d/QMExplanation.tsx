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
                        The quantum harmonic oscillator models a particle in a parabolic
                        potential well, like a mass on a spring. It is the most important
                        quantum system in chemistry because the bottom of almost any bound
                        potential is locally parabolic, so it describes small-amplitude
                        vibrations of molecules in their equilibrium geometry.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        Energy levels are evenly spaced:{' '}
                        <MathFormula math="E_n = (n + \tfrac{1}{2})\hbar\omega" inline />.
                        The wavefunctions are Hermite polynomials multiplied by a Gaussian
                        envelope, so they decay smoothly into the classically-forbidden
                        region beyond the turning points.
                    </p>
                </>
            )}

            {potentialType === 'infinite_well' && (
                <>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        The particle in a box confines a particle to a region with
                        infinitely high walls. It is the simplest model of quantum
                        confinement and shows how quantization and zero-point energy
                        arise purely from boundary conditions.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        Energy levels grow quadratically:{' '}
                        <MathFormula math="E_n = \dfrac{n^2 \pi^2 \hbar^2}{2 m L^2}" inline />.
                        Each state has <em>n</em> half-wavelengths across the box and
                        <em> n − 1</em> interior nodes.
                    </p>
                </>
            )}

            {potentialType === 'double_well' && (
                <>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        A symmetric double well{' '}
                        <MathFormula
                            math="V(x) = V_0\left(\dfrac{x^2}{a^2} - 1\right)^2"
                            inline
                        />{' '}
                        has two degenerate classical minima at{' '}
                        <MathFormula math="x = \pm a" inline /> separated by a barrier of
                        height <MathFormula math="V_0" inline /> at the origin. It is the
                        textbook setting for <strong>quantum tunneling</strong>.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        The two lowest states are a nearly-degenerate pair: the symmetric
                        ground state <MathFormula math="\psi_0" inline /> and the
                        antisymmetric first-excited state{' '}
                        <MathFormula math="\psi_1" inline />. A localized state in the
                        left or right well is well approximated by the combinations{' '}
                        <MathFormula
                            math="|L\rangle \approx (\psi_0 + \psi_1)/\sqrt{2}"
                            inline
                        />{' '}
                        and{' '}
                        <MathFormula
                            math="|R\rangle \approx (\psi_0 - \psi_1)/\sqrt{2}"
                            inline
                        />. Because <MathFormula math="|L\rangle" inline /> is a
                        superposition of two states with slightly different energies, it
                        oscillates into <MathFormula math="|R\rangle" inline /> and back
                        with the tunneling period{' '}
                        <MathFormula
                            math="T_\text{tunnel} = 2\pi\hbar/(E_1 - E_0)"
                            inline
                        />.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        The splitting <MathFormula math="E_1 - E_0" inline /> is
                        exponentially small in the barrier — try turning the barrier
                        slider up and down. This is solved by finite differences: with
                        no closed-form eigenfunctions available we discretize{' '}
                        <MathFormula
                            math="\hat{H} = -\tfrac{1}{2}\partial_x^2 + V(x)"
                            inline
                        />{' '}
                        and diagonalize the resulting tridiagonal matrix numerically.
                    </p>
                </>
            )}

            {potentialType === 'lattice' && (
                <>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        A chain of <em>N</em> identical Gaussian wells is the simplest
                        1D model of going from <strong>molecular orbitals</strong> to{' '}
                        <strong>bands</strong>. Each well on its own has one or more
                        bound states — the &quot;atomic&quot; orbitals. Bring them
                        close together and the states couple through the overlap
                        between wells, splitting into <em>N</em> linear combinations.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        Drag the <strong>number of wells</strong> slider from 1
                        upward:
                    </p>
                    <ul style={{ margin: '0 0 0.75rem 1.25rem', lineHeight: 1.6 }}>
                        <li>
                            <strong>N = 1</strong>: a single Gaussian well with its
                            discrete atomic-like levels.
                        </li>
                        <li>
                            <strong>N = 2</strong>: each level splits into a
                            bonding/antibonding pair (the H₂-style picture). The
                            lower state is node-free across the pair, the upper has
                            one node between the wells.
                        </li>
                        <li>
                            <strong>N = 3, 4, …</strong>: each atomic level spreads
                            into a cluster of <em>N</em> closely-spaced states.
                            Within a cluster the number of nodes between wells
                            increases from 0 (bottom of band) to <em>N</em>−1 (top).
                        </li>
                        <li>
                            <strong>Large N</strong>: the clusters become{' '}
                            <em>bands</em>. The energy spacing inside a band{' '}
                            <MathFormula math="\sim 1/N" inline />, while the gap
                            between bands is set by the well depth and spacing —
                            the beginning of band structure in a solid.
                        </li>
                    </ul>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        Try also changing the <strong>spacing</strong>: close wells
                        overlap strongly and give wide bands; distant wells barely
                        couple and the bands collapse back to the isolated-atom
                        limit. The wavefunctions are computed by diagonalizing{' '}
                        <MathFormula
                            math="\hat{H} = -\tfrac{1}{2}\partial_x^2 + V(x)"
                            inline
                        />{' '}
                        for this particular potential — there is no closed form.
                    </p>
                </>
            )}

            {potentialType === 'morse' && (
                <>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        The Morse potential{' '}
                        <MathFormula
                            math="V(x) = D_e\left(1 - e^{-\alpha x}\right)^2"
                            inline
                        />{' '}
                        is the standard simple model of a chemical bond. It has a hard
                        repulsive wall at small <em>x</em>, a minimum at{' '}
                        <em>x = 0</em>, and a finite dissociation limit{' '}
                        <MathFormula math="V \to D_e" inline /> as{' '}
                        <em>x → ∞</em>.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        Unlike the harmonic oscillator, Morse is <strong>anharmonic</strong>:
                        vibrational levels get closer together as{' '}
                        <MathFormula math="n" inline /> increases, following{' '}
                        <MathFormula
                            math="E_n = \hbar\omega(n + \tfrac{1}{2}) - \hbar\omega x_e (n + \tfrac{1}{2})^2"
                            inline
                        />
                        , and only a finite number of bound states exist below the
                        dissociation limit. Expanding near the minimum gives the
                        harmonic approximation; deviations at higher{' '}
                        <em>n</em> are what experimental vibrational overtones probe.
                    </p>
                    <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.6 }}>
                        Excited wavefunctions are asymmetric — they extend much further
                        on the dissociative (long-bond) side than into the steep
                        repulsive wall, which is why bond vibration stretches more than
                        it compresses.
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
                    Each stationary state picks up a phase{' '}
                    <MathFormula
                        math="\psi_n(x,t) = \psi_n(x)\,e^{-i E_n t/\hbar}"
                        inline
                    />, so the phasor associated with state <em>n</em> rotates at rate{' '}
                    <MathFormula math="E_n/\hbar" inline />. Time here is measured in
                    ground-state periods <MathFormula math="T_0" inline />.
                </p>
            </div>

            {potentialType === 'double_well' && (
                <div
                    style={{
                        backgroundColor: '#fef3c7',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        marginTop: '0.75rem',
                    }}
                >
                    <strong style={{ color: '#92400e' }}>
                        Try this — see tunneling directly:
                    </strong>
                    <p style={{ margin: '0.5rem 0 0 0', lineHeight: 1.6 }}>
                        Activate <em>both</em> n=0 and n=1 (click their phasor squares).
                        The probability density{' '}
                        <MathFormula math="|\psi|^2" inline /> will slosh back and forth
                        between the two wells at the tunneling frequency. Now raise the
                        barrier height and watch the oscillation slow down dramatically —
                        the particle becomes localized on the timescale of the
                        simulation.
                    </p>
                </div>
            )}

            {potentialType === 'lattice' && (
                <div
                    style={{
                        backgroundColor: '#fef3c7',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        marginTop: '0.75rem',
                    }}
                >
                    <strong style={{ color: '#92400e' }}>
                        Try this — watch a band form:
                    </strong>
                    <p style={{ margin: '0.5rem 0 0 0', lineHeight: 1.6 }}>
                        Sweep the <em>number of wells</em> slider from 1 to the
                        maximum and watch the dashed energy-level lines fan out: each
                        isolated atomic level splits into <em>N</em> closely-spaced
                        levels with (typically) a clear gap to the next band. Then
                        toggle on <em>Individual states</em> in the Display section
                        to see how the lowest state of each band has no nodes
                        between wells while the highest alternates sign at every
                        well — the 1D analogue of the Γ and X points of a Bloch band.
                    </p>
                </div>
            )}

            {activeStates.length > 1 && potentialType !== 'double_well' && (
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
                        Multiple states are superimposed with equal weights. The
                        probability density beats as states with different energies
                        interfere constructively and destructively — the phasors show
                        the different rotation rates that produce the pattern.
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
                <strong style={{ color: '#166534' }}>Tip:</strong> Click phasor squares
                to toggle states on and off, and change the potential to compare
                qualitatively different spectra (evenly spaced, quadratic, nearly
                degenerate, dissociating).
            </div>
        </div>
    );
};

export default QMExplanation;
