/**
 * Quality tiering for the orbital viewer.
 *
 * The viewer's GPU cost is dominated by ray-march step count × per-step
 * sampleField cost × pixel count. The knobs here trade visual fidelity for
 * frame rate along each of those axes:
 *   - stepsIso / stepsDensity     — fewer steps → blockier iso, noisier density
 *   - bisectionIters              — fewer iters → jagged iso boundary
 *   - dragDpr / restDpr           — lower → fewer pixels to shade
 *   - lightingComplex             — false → cheap single-light shading
 *
 * "Auto" runs `detectTier` at mount time and picks a profile from a small set
 * of heuristics. Heuristics are rough but cheap and non-intrusive. A manual
 * override always wins over auto.
 */

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityProfile {
    tier: QualityTier;
    stepsIso: number;
    stepsDensity: number;
    bisectionIters: number;
    /** Pixel ratio while OrbitControls is being dragged (AdaptiveDpr). */
    dragDpr: number;
    /** Pixel ratio at rest. High tier goes >1 on retina displays. */
    restDpr: number;
    /** Full 3-light camera-relative rig w/ specular & fresnel when true.
     *  When false, shadeLobe collapses to a single directional diffuse term. */
    lightingComplex: boolean;
}

/** One-line summary used in the UI hint. */
export function describeProfile(p: QualityProfile): string {
    return `${p.stepsIso}/${p.stepsDensity} steps · DPR ${p.dragDpr}→${p.restDpr.toFixed(2)}${p.lightingComplex ? '' : ' · flat shading'}`;
}

export function getProfile(tier: QualityTier): QualityProfile {
    const devDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    switch (tier) {
        case 'low':
            return {
                tier,
                stepsIso: 24,
                stepsDensity: 20,
                bisectionIters: 3,
                dragDpr: 0.4,
                restDpr: 0.75,
                lightingComplex: false,
            };
        case 'high':
            return {
                tier,
                stepsIso: 64,
                stepsDensity: 48,
                bisectionIters: 6,
                dragDpr: 0.75,
                restDpr: Math.min(devDpr, 2),
                lightingComplex: true,
            };
        case 'medium':
        default:
            return {
                tier: 'medium',
                stepsIso: 40,
                stepsDensity: 32,
                bisectionIters: 5,
                dragDpr: 0.5,
                restDpr: 1,
                lightingComplex: true,
            };
    }
}

/**
 * Heuristic tier detection. Creates a throwaway canvas to sniff the WebGL
 * renderer string (some browsers mask this for fingerprint protection — we
 * fall back to CPU / memory heuristics).
 *
 * Decision logic, in priority order:
 *   1. Software renderers (SwiftShader, llvmpipe, Microsoft Basic) → low
 *   2. Known-strong GPU string + ≥ 6 cores → high
 *   3. ≤ 2 cores or ≤ 2GB deviceMemory → low
 *   4. ≥ 8 cores and ≥ 8GB deviceMemory → high
 *   5. Default → medium
 */
export function detectTier(): QualityTier {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') {
        return 'medium';
    }

    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;

    let rendererStr = '';
    try {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl2') ||
            canvas.getContext('webgl')) as WebGLRenderingContext | null;
        if (gl) {
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) {
                rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
            }
        }
    } catch {
        // Ignore — WebGL may be unavailable (server, blocked, etc.).
    }

    // Software/fallback rasterizers — these are the page's worst case.
    if (/SwiftShader|llvmpipe|Microsoft Basic|ANGLE.*Software|software/i.test(rendererStr)) {
        return 'low';
    }

    // Known-fast discrete / Apple-silicon GPUs.
    const strongGpu = /RTX|GTX 1[06789]|GTX [23]\d{3}|Radeon Pro|Radeon RX|Arc A\d|Apple M[1-9]/i.test(rendererStr);
    if (strongGpu && cores >= 6) return 'high';

    if (cores <= 2 || mem <= 2) return 'low';
    if (cores >= 8 && mem >= 8) return 'high';
    return 'medium';
}
