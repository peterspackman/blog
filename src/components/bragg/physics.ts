/** Bragg scattering from N equally spaced planes. Lengths in Å, angles in degrees. */

export const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Extra path travelled by the wave reflected from the next plane down: 2d sin θ. */
export const pathDifference = (d: number, thetaDeg: number) => 2 * d * Math.sin(toRad(thetaDeg));

/** Phase difference between neighbouring planes, in radians. */
export const phaseStep = (d: number, thetaDeg: number, lambda: number) =>
    (2 * Math.PI * pathDifference(d, thetaDeg)) / lambda;

/**
 * Interference function for N planes, normalised to 1 at a Bragg peak:
 * |Σ e^{inφ}|² / N² = sin²(Nφ/2) / (N² sin²(φ/2)).
 */
export function intensity(n: number, phi: number): number {
    const s = Math.sin(phi / 2);
    if (Math.abs(s) < 1e-9) return 1;
    const r = Math.sin((n * phi) / 2) / (n * s);
    return r * r;
}

/** Bragg angles θ (degrees, 0–90) for orders n = 1, 2, … with nλ ≤ 2d. */
export function braggAngles(d: number, lambda: number): { order: number; theta: number }[] {
    const out: { order: number; theta: number }[] = [];
    for (let n = 1; n * lambda <= 2 * d; n++) out.push({ order: n, theta: (Math.asin((n * lambda) / (2 * d)) * 180) / Math.PI });
    return out;
}
