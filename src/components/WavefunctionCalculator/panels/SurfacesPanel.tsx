import React, { useMemo, useState } from 'react';
import type { SurfaceKind } from '@peterspackman/ce-chem/compute/surface-types.js';
import { getSurfacePropertyLabel } from '@peterspackman/ce-chem/compute/surface-types.js';
import { SegmentedControl, Select, SliderWithInput, ToggleSwitch, VizButton } from '../../shared/controls';
import { propertyColouring, useCe } from '../runtime';
import { SIGNED_FIELD_KINDS, molecularSurfaceKinds, numberParam } from '../surfaceKinds';
import { colourableProperties, type SurfaceLayer } from '../useSurfaces';
import styles from '../WavefunctionCalculator.module.css';

interface SurfacesPanelProps {
    layers: SurfaceLayer[];
    onAdd: (kind: SurfaceKind, isovalue: number, separation: number) => void;
    onUpdate: (id: number, change: Partial<SurfaceLayer>) => void;
    onRemove: (id: number) => void;
}

export function SurfacesPanel({ layers, onAdd, onUpdate, onRemove }: SurfacesPanelProps) {
    const kinds = useMemo(() => molecularSurfaceKinds(), []);
    const [kind, setKind] = useState<SurfaceKind>(kinds.find((k) => k.value === 'electron_density')?.value ?? kinds[0]?.value);
    const descriptor = kinds.find((k) => k.value === kind) ?? kinds[0];
    const isoParam = descriptor ? numberParam(descriptor, 'isovalue') : undefined;
    const sepParam = descriptor ? numberParam(descriptor, 'separation') : undefined;
    const [isovalues, setIsovalues] = useState<Partial<Record<SurfaceKind, number>>>({});
    const [separation, setSeparation] = useState(sepParam?.default ?? 0.2);
    if (!descriptor || !isoParam) return <p className={styles.hint}>No surface kinds are available.</p>;
    const isovalue = isovalues[kind] ?? isoParam.default;

    return (
        <div className={styles.inspectorBody}>
            <div className={styles.addSurface}>
                <Select
                    label="Surface"
                    value={kind}
                    onChange={(v) => setKind(v)}
                    options={kinds.map((k) => ({ value: k.value, label: k.label }))}
                />
                <p className={styles.hint}>{descriptor.description}</p>
                <SliderWithInput
                    label="Isovalue"
                    value={isovalue}
                    onChange={(v) => setIsovalues((prev) => ({ ...prev, [kind]: v }))}
                    min={isoParam.min ?? 0}
                    max={isoParam.max ?? 1}
                    step={isoParam.step ?? 0.001}
                    decimals={4}
                />
                {sepParam?.presets && (
                    <SegmentedControl<number>
                        value={separation}
                        onChange={setSeparation}
                        options={sepParam.presets.map((p) => ({ value: p.value, label: p.label, title: `${p.value} Å grid` }))}
                        aria-label="Resolution"
                    />
                )}
                <VizButton variant="primary" size="sm" onClick={() => onAdd(kind, isovalue, separation)}>
                    Compute surface
                </VizButton>
            </div>

            {layers.length === 0 ? (
                <p className={styles.hint}>Surfaces you compute appear here, each coloured by a property you choose.</p>
            ) : (
                <ul className={styles.layerList}>
                    {layers.map((layer) => (
                        <li key={layer.id} className={styles.layer}>
                            <LayerCard layer={layer} onUpdate={onUpdate} onRemove={onRemove} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function LayerCard({ layer, onUpdate, onRemove }: { layer: SurfaceLayer; onUpdate: SurfacesPanelProps['onUpdate']; onRemove: SurfacesPanelProps['onRemove'] }) {
    const properties = colourableProperties(layer.mesh);
    const signed = SIGNED_FIELD_KINDS[layer.kind];
    const descriptor = useMemo(() => molecularSurfaceKinds().find((k) => k.value === layer.kind), [layer.kind]);
    const isoParam = descriptor ? numberParam(descriptor, 'isovalue') : undefined;
    return (
        <>
            <div className={styles.layerHeader}>
                <span>
                    <strong>{layer.label}</strong> <span className={styles.secondaryInline}>at {layer.isovalue}</span>
                </span>
                <button type="button" className={styles.linkButton} onClick={() => onRemove(layer.id)}>
                    {layer.status === 'computing' ? 'Cancel' : 'Remove'}
                </button>
            </div>
            {layer.status === 'computing' && <p className={styles.hint}>Computing…</p>}
            {layer.status === 'failed' && <p className={styles.error}>{layer.error}</p>}
            {layer.status === 'ready' && layer.volume && (
                <>
                    <SliderWithInput
                        label="Isovalue (±)"
                        value={layer.isovalue}
                        onChange={(v) => onUpdate(layer.id, { isovalue: v })}
                        min={isoParam?.min ?? 0.0001}
                        max={isoParam?.max ?? 0.1}
                        step={isoParam?.step ?? 0.0001}
                        decimals={4}
                    />
                    {signed && (
                        <p className={styles.hint}>
                            <span className={styles.signKey} style={{ background: signed.invertColours ? 'var(--viz-negative)' : 'var(--viz-positive)' }} /> +{' '}
                            {signed.positive}{'  '}
                            <span className={styles.signKey} style={{ background: signed.invertColours ? 'var(--viz-positive)' : 'var(--viz-negative)' }} /> −{' '}
                            {signed.negative}
                        </p>
                    )}
                    <SliderWithInput label="Opacity" value={layer.opacity} onChange={(v) => onUpdate(layer.id, { opacity: v })} min={0.1} max={1} step={0.05} />
                    <ToggleSwitch label="Visible" checked={layer.visible} onChange={(v) => onUpdate(layer.id, { visible: v })} />
                </>
            )}
            {layer.status === 'ready' && layer.mesh && (
                <>
                    <Select
                        label="Colour by"
                        value={layer.property}
                        onChange={(v) => onUpdate(layer.id, { property: v })}
                        options={[{ value: '', label: 'Nothing (plain)' }, ...properties.map((p) => ({ value: p, label: getSurfacePropertyLabel(p) }))]}
                    />
                    {layer.property && layer.mesh.properties[layer.property] && (
                        <Legend values={layer.mesh.properties[layer.property]} property={layer.property} />
                    )}
                    <SliderWithInput label="Opacity" value={layer.opacity} onChange={(v) => onUpdate(layer.id, { opacity: v })} min={0.1} max={1} step={0.05} />
                    <ToggleSwitch label="Visible" checked={layer.visible} onChange={(v) => onUpdate(layer.id, { visible: v })} />
                </>
            )}
        </>
    );
}

/** The colour scale the viewer uses for this property, with its end values. */
function Legend({ values, property }: { values: Float32Array; property: string }) {
    const ce = useCe();
    if (!ce) return null;
    const { colormap, range } = propertyColouring(ce, values, property);
    const fmt = (x: number) => (Math.abs(x) >= 100 || (Math.abs(x) < 0.01 && x !== 0) ? x.toExponential(1) : x.toFixed(3));
    return (
        <div className={styles.legend}>
            <div className={styles.legendBar} style={{ background: ce.viewer.colormapCssGradient(colormap) }} />
            <div className={styles.legendLabels}>
                <span>{fmt(range.min)}</span>
                <span>{fmt(range.max)}</span>
            </div>
        </div>
    );
}
