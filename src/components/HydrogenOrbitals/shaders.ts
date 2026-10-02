/**
 * GLSL source fragments for hydrogen orbital rendering.
 *
 * These are direct transcriptions of the TypeScript physics primitives in
 * physics.ts. Keep them in lockstep — if one changes, update the other.
 * Stage 2 assembles these into the full fragment shader used by the
 * ray-march mesh.
 *
 * Conventions (identical to physics.ts):
 *   - Real spherical harmonics (chemistry).
 *   - m > 0 → cosine component; m < 0 → sine; m = 0 → real.
 *   - Radial R_{nl}(r) in atomic units (a₀ = 1), closed form for n ≤ 4.
 */

import { SHADER_L_MAX } from './codegen';
import { ANG_SLOTS, MAX_TERMS as PACK_MAX_TERMS } from './packing';

const MAX_L = SHADER_L_MAX;
const SOLID_ARRAY_SIZE = (MAX_L + 1) * (MAX_L + 1); // 25
/** Maximum number of orbital terms supported by future multi-term shaders. */
export const MAX_ORBITAL_TERMS = 8;
export const SHADER_MAX_L = MAX_L;

/** Bounding radius (atomic units) used for the Stage 2 angular viewer. */
export const BOUNDING_RADIUS = 6;

/**
 * Layout helper for documentation — matches solidIndex() in physics.ts.
 *   Y_{l,0}      → l²
 *   Y_{l,+|m|}   → l² + 2|m| − 1
 *   Y_{l,−|m|}   → l² + 2|m|
 */
export const SOLID_INDEX_GLSL = /* glsl */ `
int solidIndex(int l, int m) {
    if (m == 0) return l * l;
    if (m > 0) return l * l + 2 * m - 1;
    return l * l - 2 * m;
}
`;

/**
 * Cartesian solid-harmonics recurrence up to l = MAX_L (hard-coded to 4).
 * Fills a flat float[25] with r^l · C_{l,m}(θ,φ) (Racah form, uniform
 * per-l normalization applied separately).
 *
 * Port of solidHarmonicsRecurrence() in physics.ts.
 */
export const SOLID_HARMONICS_GLSL = /* glsl */ `
// Fill R[0..24] with the Cartesian solid-harmonic recurrence output.
// L_MAX is fixed at 4 (25 entries) to keep the loop bounds constant.
const int L_MAX = 4;
const int SOLID_SIZE = ${SOLID_ARRAY_SIZE};

void computeSolidHarmonics(vec3 pos, out float R[SOLID_SIZE]) {
    float x = pos.x;
    float y = pos.y;
    float z = pos.z;
    float r2 = dot(pos, pos);

    // Zero everything (compilers complain otherwise).
    for (int i = 0; i < SOLID_SIZE; i++) R[i] = 0.0;

    R[0] = 1.0;
    R[1] = z;
    R[2] = x;
    R[3] = y;

    // Unrolled recurrence for k = 1..L_MAX-1.
    for (int k = 1; k < L_MAX; k++) {
        int n = k + 1;
        int levelN = n * n;
        int levelK = k * k;
        int levelP = (k - 1) * (k - 1);
        float a2kp1 = float(2 * k + 1);
        float fk = float(k);
        float fn = float(n);

        // R_{n,0} from R_{k,0} and R_{k-1,0}
        R[levelN] = (a2kp1 * R[levelK] * z - fk * r2 * R[levelP]) / (fk + 1.0);

        // R_{n,±m} for m = 1..k-1 (both c and s components)
        for (int m = 1; m < L_MAX; m++) {
            if (m >= k) break;
            float fm = float(m);
            float denom = sqrt((fn + fm) * (fn - fm));
            float coupling = sqrt((fk + fm) * (fk - fm));
            int iN_c = levelN + 2 * m - 1;
            int iN_s = levelN + 2 * m;
            int iK_c = levelK + 2 * m - 1;
            int iK_s = levelK + 2 * m;
            int iP_c = levelP + 2 * m - 1;
            int iP_s = levelP + 2 * m;
            R[iN_c] = (a2kp1 * R[iK_c] * z - coupling * r2 * R[iP_c]) / denom;
            R[iN_s] = (a2kp1 * R[iK_s] * z - coupling * r2 * R[iP_s]) / denom;
        }

        // R_{n,±k}: top of k level, no (k-1) coupling
        float fTop = sqrt(fn + fk);
        R[levelN + 2 * k - 1] = fTop * R[levelK + 2 * k - 1] * z;
        R[levelN + 2 * k] = fTop * R[levelK + 2 * k] * z;

        // R_{n,±n}: new top, built from (x ± iy) × R_{k,±k}
        float s = sqrt(fn + fk) / sqrt(2.0 * fn);
        int iK_c = levelK + 2 * k - 1;
        int iK_s = levelK + 2 * k;
        R[levelN + 2 * n - 1] = s * (x * R[iK_c] - y * R[iK_s]);
        R[levelN + 2 * n]     = s * (x * R[iK_s] + y * R[iK_c]);
    }
}

// Per-l normalization sqrt((2l+1)/(4π)) as a lookup (l = 0..4).
const float INV_SQRT_4PI = 0.28209479177387814;  // 1 / sqrt(4π)
float sphericalNorm(int l) {
    return INV_SQRT_4PI * sqrt(float(2 * l + 1));
}

// Real spherical harmonic Y_{l,m} evaluated at unit vector nHat. Pass in
// the precomputed recurrence array R (computed at position, not unit vector)
// together with the scalar 1/r^l to divide out.
float realSphericalHarmonic(int l, int m, float invRL, float R[SOLID_SIZE]) {
    int idx;
    if (m == 0) idx = l * l;
    else if (m > 0) idx = l * l + 2 * m - 1;
    else idx = l * l - 2 * m;
    return R[idx] * invRL * sphericalNorm(l);
}
`;

/**
 * Hydrogen radial wavefunctions R_{nl}(r) for n = 1..4 (atomic units, Z arg).
 * Case analysis mirrors radialR() in physics.ts.
 */
export const RADIAL_GLSL = /* glsl */ `
// Closed-form R_{nl}(r) for n = 1..4. Returns 0 for invalid (n, l).
float radialR(int n, int l, float r, float Z) {
    if (l < 0 || l >= n || r < 0.0) return 0.0;
    float Zr = Z * r;
    float Z32 = Z * sqrt(Z);

    if (n == 1) {
        return 2.0 * Z32 * exp(-Zr);
    }
    if (n == 2) {
        float e = exp(-Zr * 0.5);
        if (l == 0) return (1.0 / (2.0 * sqrt(2.0))) * Z32 * (2.0 - Zr) * e;
        if (l == 1) return (1.0 / (2.0 * sqrt(6.0))) * Z32 * Zr * e;
        return 0.0;
    }
    if (n == 3) {
        float e = exp(-Zr / 3.0);
        float Zr2 = Zr * Zr;
        if (l == 0) return (2.0 / (81.0 * sqrt(3.0))) * Z32 * (27.0 - 18.0 * Zr + 2.0 * Zr2) * e;
        if (l == 1) return (4.0 / (81.0 * sqrt(6.0))) * Z32 * Zr * (6.0 - Zr) * e;
        if (l == 2) return (4.0 / (81.0 * sqrt(30.0))) * Z32 * Zr2 * e;
        return 0.0;
    }
    if (n == 4) {
        float e = exp(-Zr * 0.25);
        float Zr2 = Zr * Zr;
        float Zr3 = Zr2 * Zr;
        if (l == 0) return (1.0 / 768.0) * Z32 * (192.0 - 144.0 * Zr + 24.0 * Zr2 - Zr3) * e;
        if (l == 1) return (1.0 / (256.0 * sqrt(15.0))) * Z32 * Zr * (80.0 - 20.0 * Zr + Zr2) * e;
        if (l == 2) return (1.0 / (768.0 * sqrt(5.0))) * Z32 * Zr2 * (12.0 - Zr) * e;
        if (l == 3) return (1.0 / (768.0 * sqrt(35.0))) * Z32 * Zr3 * e;
        return 0.0;
    }
    return 0.0;
}
`;

/**
 * Assemble all helpers into a single GLSL string for inclusion in fragment
 * shaders. Stage 2's ray-march shader prepends this to its own main() logic.
 */
export const ORBITAL_PHYSICS_GLSL = `
${SOLID_HARMONICS_GLSL}
${RADIAL_GLSL}

const int MAX_TERMS = ${MAX_ORBITAL_TERMS};
`;

/**
 * Full fragment shader for the Stage 2 angular viewer.
 *
 * Modes:
 *   0 — isosurface: signed, two-colour (+lobe / −lobe), bisection-refined,
 *       shaded by finite-difference gradient.
 *   1 — density:    ray-marched |Y|² accumulation with positive/negative
 *       sign colouring.
 *   2 — slice:      ray–plane intersection, signed colourmap.
 */
export const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;
void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

/**
 * Fragment shader: one program for every mode, term count and quality tier.
 *
 * Everything that used to be a #define (term count, display/render mode,
 * step counts, lighting) is a uniform, and every loop is bounded by a
 * uniform. GLSL ES 3.00 (which three uses for ShaderMaterial) allows that,
 * and it stops drivers from unrolling the ray march: with constant bounds
 * ANGLE/D3D and Mesa inline sampleField() at every unrolled step (x64 steps
 * x 8 terms x 25 Ylm cases), which took seconds to compile, reported
 * "optimization did not converge", and could reset the GPU. Uniform
 * branches are coherent across a draw, so the runtime cost is negligible,
 * and changing mode or terms no longer recompiles anything.
 *
 * The field is data-driven too: angular parts are generic homogeneous
 * polynomials and radial parts generic R_nl polynomials, with coefficients
 * from packOrbital(). The previous generated Ylm()/radialR() functions (one
 * branch and return per case) took the D3D compiler minutes to optimise.
 *
 * sampleField() is called from as few sites as possible (march, bisection,
 * gradient, slice) because each call site inlines the whole term loop.
 */
export const fragmentShader = /* glsl */ `
precision highp float;
precision highp int;

const int MAX_TERMS = ${PACK_MAX_TERMS};
const int ANG_SLOTS = ${ANG_SLOTS};

// 0 = isosurface, 1 = density, 2 = slice
uniform int uRenderMode;
// 1 in angular display mode: F(r) is a generic envelope instead of R_nl(r)
uniform int uUseEnvelope;
uniform int uNumTerms;
uniform int uStepsIso;
uniform int uStepsDensity;
uniform int uBisectionIters;
uniform int uLightingComplex;

// Wavefunction, packed by packOrbital() in packing.ts:
//   ψ = Σ_i A_i(r̂) · F_i(r),  A_i = Σ_k uAng[i*ANG_SLOTS + k] · x^a y^b z^c (a+b+c = uDegree[i])
uniform int uDegree[MAX_TERMS];
uniform float uAng[MAX_TERMS * ANG_SLOTS];
uniform vec4 uRadPoly[MAX_TERMS];  // R = (Zr)^p · (c0 + c1 Zr + c2 Zr² + c3 Zr³) · exp(-Zr/n)
uniform int uRadPower[MAX_TERMS];
uniform float uRadInvN[MAX_TERMS];

uniform float uIsoValue;
uniform int uSliceAxis;       // 0 = x-normal, 1 = y-normal, 2 = z-normal
uniform float uSlicePosition;
uniform int uClipEnabled;     // 0/1: cutaway against the slice plane in iso/density modes
uniform float uEnvelopeScale; // falloff length for the angular-only envelope
uniform float uZ;             // nuclear charge
uniform float uNormScale;     // 1 / maxAbs(field), auto-scales slice/density
uniform vec3 uColorPositive;
uniform vec3 uColorNegative;
uniform vec3 uBackground;
uniform vec3 uCameraPos;
uniform float uBoundingRadius;

varying vec3 vWorldPosition;

// v^n for small non-negative integer n.
float ipow(float v, int n) {
    float result = 1.0;
    for (int i = 0; i < n; i++) result *= v;
    return result;
}

// Sample ψ at pos. Mirrors evalPacked() in packing.ts.
float sampleField(vec3 pos) {
    float r = length(pos);
    if (r < 1e-4) return 0.0;
    vec3 u = pos / r;
    float Zr = uZ * r;
    float envelope = exp(-r / max(uEnvelopeScale, 0.01));

    float sum = 0.0;
    for (int i = 0; i < uNumTerms; i++) {
        int l = uDegree[i];
        int k = i * ANG_SLOTS;
        float ang = 0.0;
        for (int a = l; a >= 0; a--) {
            float xa = ipow(u.x, a);
            for (int b = l - a; b >= 0; b--) {
                ang += uAng[k] * xa * ipow(u.y, b) * ipow(u.z, l - a - b);
                k++;
            }
        }
        float radial = envelope;
        if (uUseEnvelope == 0) {
            vec4 c = uRadPoly[i];
            radial = ipow(Zr, uRadPower[i]) * (c.x + Zr * (c.y + Zr * (c.z + Zr * c.w))) * exp(-Zr * uRadInvN[i]);
        }
        sum += ang * radial;
    }
    return sum;
}

// Ray–sphere intersection; returns (tNear, tFar) or (-1, -1) for a miss.
vec2 intersectSphere(vec3 orig, vec3 dir, float radius) {
    float b = dot(orig, dir);
    float c = dot(orig, orig) - radius * radius;
    float disc = b * b - c;
    if (disc < 0.0) return vec2(-1.0);
    float s = sqrt(disc);
    return vec2(-b - s, -b + s);
}

// Ray–plane intersection; returns t or -1 on miss.
float intersectPlane(vec3 orig, vec3 dir, vec3 n, float offset) {
    float d = dot(dir, n);
    if (abs(d) < 1e-6) return -1.0;
    return (offset - dot(orig, n)) / d;
}

/**
 * Three-point camera-relative lighting rig.
 *   Key:    upper-right from the viewer, warm-white, diffuse + specular
 *   Fill:   lower-left, cooler, softer diffuse (kills pitch-black shadow)
 *   Back:   behind the object (rim), grazing-angle accent
 * Plus a fresnel edge glow in the lobe colour.
 *
 * Diffuse uses half-Lambert ((N·L)/2 + 1/2)² so every orientation has some
 * illumination — no fully-occluded dark side when you rotate the orbital.
 */
// baseVal = sampleField(hitPos), usually the last bisection value — reused to
// turn central differences into forward differences (3 samples, one call site).
vec3 shadeLobe(vec3 hitPos, vec3 rayDir, bool positive, float baseVal) {
    float eps = 0.03;
    vec3 grad = vec3(0.0);
    // Bound is 3, but expressed via a uniform so the compiler can't unroll
    // it into three inlined copies of sampleField().
    int axes = 3 + min(uNumTerms, 0);
    for (int k = 0; k < axes; k++) {
        vec3 off = vec3(k == 0 ? eps : 0.0, k == 1 ? eps : 0.0, k == 2 ? eps : 0.0);
        grad[k] = sampleField(hitPos + off) - baseVal;
    }
    float gLen = length(grad);
    vec3 N = gLen > 1e-6 ? grad / gLen : vec3(0.0, 1.0, 0.0);
    if (dot(N, rayDir) > 0.0) N = -N;

    vec3 base = positive ? uColorPositive : uColorNegative;

    if (uLightingComplex == 0) {
        // Cheap diffuse — single directional light in camera space.
        vec3 L = normalize(-rayDir + vec3(0.0, 0.7, 0.3));
        float diff = max(dot(N, L), 0.0);
        return base * (0.25 + 0.75 * diff);
    }

    // Build a camera-relative basis (R, U, V). Blend the "world up" reference
    // smoothly between y-axis and z-axis as the viewer approaches a pole —
    // a hard switch at |V.y| ≈ 1 causes R to flip direction, which looks like
    // a seam/ring on spherically symmetric surfaces.
    vec3 V = -rayDir;
    float pole = smoothstep(0.88, 0.99, abs(V.y));
    vec3 worldUp = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, 1.0), pole));
    vec3 R = normalize(cross(V, worldUp));
    vec3 U = normalize(cross(R, V));

    // Studio-style rig: bright key upper-right, strong soft fill lower-left,
    // subtle back rim. Extra "skylight" from +Y mimics bounce off a white
    // cyclorama — keeps the shadow side vibrant rather than muddy.
    vec3 Lkey  = normalize(V + U * 0.85 + R * 0.55);
    vec3 Lfill = normalize(V - U * 0.10 - R * 0.90);
    vec3 Lback = normalize(-V + U * 0.25);

    float lk   = max(dot(N, Lkey), 0.0);                        // Lambert key
    float lf   = max((dot(N, Lfill) + 0.40) / 1.40, 0.0);       // wrap fill (bounce-y)
    float hb   = max(dot(N, Lback), 0.0);
    // Skylight in camera space (U points "up" relative to the viewer) so
    // looking down a world axis doesn't reveal an odd highlight band.
    float hemi = dot(N, U) * 0.5 + 0.5;

    // Fresnel & specular.
    float cosNV = max(dot(N, V), 0.0);
    float fres  = pow(1.0 - cosNV, 3.5);
    vec3 H = normalize(Lkey + V);
    float nh = max(dot(N, H), 0.0);
    float specBroad = pow(nh, 22.0);
    float specTight = pow(nh, 80.0);

    // Slightly tinted specular — 80% white, 20% base — gives highlights a
    // subtle "paint under clearcoat" feel rather than cold chrome.
    vec3 specTint = mix(vec3(1.0), base, 0.18);

    // Diffuse — bright and vibrant.
    vec3 color = base * (
        0.18                     // ambient floor
        + 0.55 * lk              // key (strong directional gradient)
        + 0.38 * lf              // fill (wrap = big softbox feel)
        + 0.18 * hemi            // skylight / ground-bounce
    );

    color += base * hb * 0.12;                    // coloured back-rim
    color += base * fres * 0.18;                  // coloured edge glow
    color += specTint * specBroad * 0.16;         // soft broad highlight
    color += specTint * specTight * 0.38;         // pop clearcoat highlight
    return color;
}

vec3 axisNormal(int axis) {
    return axis == 0 ? vec3(1.0, 0.0, 0.0) : (axis == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
}

void main() {
    vec3 rayOrigin = uCameraPos;
    vec3 rayDir = normalize(vWorldPosition - uCameraPos);

    vec2 tBounds = intersectSphere(rayOrigin, rayDir, uBoundingRadius);
    if (tBounds.y < 0.0) discard;
    float tNear = max(tBounds.x, 0.0);
    float tFar = tBounds.y;

    // -------- SLICE --------
    if (uRenderMode == 2) {
        vec3 n = axisNormal(uSliceAxis);
        float tP = intersectPlane(rayOrigin, rayDir, n, uSlicePosition);
        if (tP < tNear || tP > tFar) discard;

        float val = sampleField(rayOrigin + rayDir * tP) * uNormScale;
        float mag = clamp(pow(abs(val), 0.6), 0.0, 1.0);
        vec3 target = (val >= 0.0) ? uColorPositive : uColorNegative;
        gl_FragColor = vec4(mix(uBackground, target, mag), 1.0);
        return;
    }

    if (uUseEnvelope == 1) {
        // Angular mode: the envelope exp(-r/λ) is essentially zero past r ≈ 4.5λ,
        // so clip the march to a tighter sphere when that is inside the bounds.
        float envRadius = 4.5 * max(uEnvelopeScale, 0.01);
        if (envRadius < uBoundingRadius) {
            vec2 tInner = intersectSphere(rayOrigin, rayDir, envRadius);
            if (tInner.y < 0.0) discard;
            tNear = max(tNear, tInner.x);
            tFar = min(tFar, tInner.y);
            if (tFar <= tNear) discard;
        }
    }

    // Cutaway: trim the ray's interval against the slice plane.
    if (uClipEnabled == 1) {
        vec3 clipN = axisNormal(uSliceAxis);

        float denom = dot(rayDir, clipN);
        float startSide = dot(rayOrigin, clipN) - uSlicePosition;
        // Convention: "kept" half-space is where dot(p, n) > uSlicePosition.
        if (abs(denom) < 1e-6) {
            if (startSide < 0.0) discard;
        } else {
            float tPlane = (uSlicePosition - dot(rayOrigin, clipN)) / denom;
            if (startSide > 0.0) {
                if (denom < 0.0) tFar = min(tFar, tPlane);
            } else {
                if (denom > 0.0) tNear = max(tNear, tPlane);
                else discard;
            }
            if (tFar <= tNear) discard;
        }
    }

    // -------- DENSITY (|ψ|² ray march with sign colouring, auto-scaled) --------
    if (uRenderMode == 1) {
        vec4 acc = vec4(0.0);
        float dt = (tFar - tNear) / float(uStepsDensity);
        for (int i = 0; i < uStepsDensity; i++) {
            float t = tNear + (float(i) + 0.5) * dt;
            float val = sampleField(rayOrigin + rayDir * t) * uNormScale;
            float density = val * val;
            if (density < 1e-5) continue;

            float alpha = clamp(density * dt / max(uBoundingRadius, 1.0) * 40.0, 0.0, 1.0);
            vec3 color = (val > 0.0) ? uColorPositive : uColorNegative;
            color *= pow(density, 0.35) * 1.6;

            acc.rgb += (1.0 - acc.a) * color * alpha;
            acc.a += (1.0 - acc.a) * alpha;
            if (acc.a > 0.98) break;
        }
        if (acc.a < 0.005) discard;
        gl_FragColor = vec4(acc.rgb, acc.a);
        return;
    }

    // -------- ISOSURFACE --------
    // March to the first bracketed crossing of ±iso, then refine once.
    float iso = uIsoValue;
    float dt = (tFar - tNear) / float(uStepsIso);
    bool hit = false;
    float target = iso;
    float prev = 0.0;
    float tA = tNear, tB = tNear, vA = 0.0;
    for (int i = 0; i <= uStepsIso; i++) {
        float t = tNear + float(i) * dt;
        float val = sampleField(rayOrigin + rayDir * t);
        if (i > 0) {
            bool crossPlus = (prev - iso) * (val - iso) < 0.0;
            bool crossMinus = (prev + iso) * (val + iso) < 0.0;
            if (crossPlus || crossMinus) {
                target = crossPlus ? iso : -iso;
                tA = t - dt; tB = t;
                vA = prev;
                hit = true;
                break;
            }
        }
        prev = val;
    }
    if (!hit) discard;

    for (int j = 0; j < uBisectionIters; j++) {
        float tMid = 0.5 * (tA + tB);
        float vMid = sampleField(rayOrigin + rayDir * tMid);
        if ((vA - target) * (vMid - target) < 0.0) {
            tB = tMid;
        } else {
            tA = tMid; vA = vMid;
        }
    }
    gl_FragColor = vec4(shadeLobe(rayOrigin + rayDir * tA, rayDir, target > 0.0, vA), 1.0);
}
`;

/** Clamp quality knobs to the ranges the shader is tuned for. */
export function clampQuality(q: { stepsIso: number; stepsDensity: number; bisectionIters: number }) {
    return {
        stepsIso: Math.max(8, Math.min(128, Math.floor(q.stepsIso))),
        stepsDensity: Math.max(8, Math.min(96, Math.floor(q.stepsDensity))),
        bisectionIters: Math.max(1, Math.min(8, Math.floor(q.bisectionIters))),
    };
}
