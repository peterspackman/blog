import React, { useMemo, useState } from 'react';
import Admonition from '@theme/Admonition';
import {
    useContainerSize,
    useVizTheme,
    VizExplanation,
    VizPanel,
    VizPanelSection,
    VizPanelSplit,
    VizPlotHeader,
    VizSectionHeader,
    VizWorkbench,
} from '../shared/viz';
import { ControlGroup, ControlHint, SegmentedControl, SliderWithInput, ToggleSwitch } from '../shared/controls';
import MathFormula from '../MathFormula';
import { BraggGeometry, BraggIntensity, BraggWaves, type BraggParams } from './BraggViews';
import { braggAngles, intensity, pathDifference, phaseStep } from './physics';

const BraggLaw: React.FC<{ title: string }> = ({ title }) => {
    const theme = useVizTheme();
    const [lambda, setLambda] = useState(1.54);
    const [d, setD] = useState(3.0);
    const [theta, setTheta] = useState(20);
    const [planes, setPlanes] = useState(4);
    const [animate, setAnimate] = useState(true);
    const params: BraggParams = useMemo(() => ({ lambda, d, theta, planes }), [lambda, d, theta, planes]);

    const delta = pathDifference(d, theta);
    const I = intensity(planes, phaseStep(d, theta, lambda));
    const orders = braggAngles(d, lambda);
    const nearest = orders.find((o) => Math.abs(o.theta - theta) < 0.05);
    const status = nearest ? `n = ${nearest.order}: in phase` : `${(delta / lambda).toFixed(2)} λ path difference`;

    const [geomRef, geomSize] = useContainerSize();
    const [plotRef, plotSize] = useContainerSize();
    const half = geomSize.width;
    const halfHeight = Math.max(220, Math.min(Math.round(half * 0.72), 380));

    const sidebar = (
        <VizPanel stack>
            <ControlGroup label="Beam and crystal">
                <SliderWithInput label="Wavelength λ" value={lambda} onChange={setLambda} min={0.5} max={3} step={0.01} decimals={2} unit="Å" />
                <SliderWithInput label="Plane spacing d" value={d} onChange={setD} min={1} max={6} step={0.05} decimals={2} unit="Å" />
                <SliderWithInput label="Angle θ" value={theta} onChange={setTheta} min={1} max={89} step={0.1} decimals={1} unit="°" />
                <SliderWithInput
                    label="Number of planes"
                    value={planes}
                    onChange={(v) => setPlanes(Math.round(v))}
                    min={2} max={12} step={1} decimals={0}
                />
            </ControlGroup>
            <ControlGroup label="Jump to a Bragg angle">
                {orders.length > 0 ? (
                    <SegmentedControl<number>
                        aria-label="Bragg order"
                        columns={2}
                        value={nearest?.order ?? 0}
                        onChange={(n) => setTheta(Math.round(orders[n - 1].theta * 100) / 100)}
                        options={orders.slice(0, 8).map((o) => ({ value: o.order, label: `n=${o.order} · ${o.theta.toFixed(1)}°` }))}
                    />
                ) : (
                    <ControlHint>No reflection is possible: λ is longer than 2d.</ControlHint>
                )}
            </ControlGroup>
            <ToggleSwitch label="Animate waves" checked={animate} onChange={setAnimate} />
        </VizPanel>
    );

    return (
        <>
            <VizWorkbench sidebar={sidebar}>
                <VizPanel flush>
                    <VizPanelSection style={{ paddingBottom: 0 }}>
                        <VizPlotHeader title={title} readout={`${status} · I = ${(I * 100).toFixed(0)}% of maximum`} />
                    </VizPanelSection>
                    <VizPanelSplit equal>
                        <VizPanelSection>
                            <VizSectionHeader title="Scattering geometry" />
                            <div ref={geomRef}>
                                {half > 0 && <BraggGeometry width={half} height={halfHeight} params={params} theme={theme} />}
                            </div>
                        </VizPanelSection>
                        <VizPanelSection>
                            <VizSectionHeader title="Reflected waves" />
                            {half > 0 && <BraggWaves width={half} height={halfHeight} params={params} theme={theme} animate={animate} />}
                        </VizPanelSection>
                    </VizPanelSplit>
                    <VizPanelSection>
                        <VizSectionHeader title="Intensity against angle" detail="click to set θ" />
                        <div ref={plotRef}>
                            {plotSize.width > 0 && (
                                <BraggIntensity width={plotSize.width} height={170} params={params} theme={theme} onSelectTheta={setTheta} />
                            )}
                        </div>
                    </VizPanelSection>
                </VizPanel>
            </VizWorkbench>

            <VizExplanation
                aside={
                    <>
                        <Admonition type="tip" title="Try this">
                            Add planes and watch the peaks in the intensity plot narrow: with more planes, a smaller
                            mismatch in angle is enough for the waves to cancel.
                        </Admonition>
                        <Admonition type="note" title="Why only some angles?">
                            Each deeper plane adds a path 2d sin θ. Unless that is a whole number of wavelengths the
                            reflections drift out of step and, summed over many planes, cancel.
                        </Admonition>
                    </>
                }
            >
                <h2>Bragg's law</h2>
                <p>
                    X-rays reflect weakly from each plane of atoms in a crystal. The beam reflected from one plane
                    down travels an extra distance 2d sin θ, so all the reflections add up in phase only when{' '}
                    <MathFormula math="n\lambda = 2d\sin\theta" inline />.
                </p>
                <p>
                    The intensity plot shows the interference of N planes,{' '}
                    <MathFormula math="I(\theta) \propto \frac{\sin^2(N\varphi/2)}{\sin^2(\varphi/2)}" inline /> with{' '}
                    <MathFormula math="\varphi = 2\pi \cdot 2d\sin\theta/\lambda" inline />. A real crystal has
                    millions of planes, which is why diffraction peaks are so sharp.
                </p>
            </VizExplanation>
        </>
    );
};

export default BraggLaw;
