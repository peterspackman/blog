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

import { YLM_GLSL, RAW_CART_GLSL, SHADER_L_MAX } from './codegen';

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

export const fragmentShader = /* glsl */ `
precision highp float;

${YLM_GLSL}

${RAW_CART_GLSL}

${RADIAL_GLSL}

// Radial-mode single orbital (radial mode is always single-term for clarity).
uniform int uRadN;
uniform int uRadL;

// Packed term arrays. Each entry i represents one summand:
//   kind[i] = 0  ⟹  Σ coeff · R_{n,l}(r) · Y_{l,m}(r̂)     (spherical)
//   kind[i] = 1  ⟹  Σ coeff · R_{n,a+b+c}(r) · x^a y^b z^c (cartesian; cart.
//                    normalisation pre-baked into coeff on the JS side)
//
// For angular display mode, R is replaced by exp(-r/λ). For radial mode,
// terms are ignored — we use (uRadN, uRadL) directly.
uniform int uNumTerms;
uniform int uTermKind[${MAX_ORBITAL_TERMS}];
uniform int uTermN[${MAX_ORBITAL_TERMS}];
uniform int uTermP1[${MAX_ORBITAL_TERMS}]; // spherical: l, cartesian: a
uniform int uTermP2[${MAX_ORBITAL_TERMS}]; // spherical: m, cartesian: b
uniform int uTermP3[${MAX_ORBITAL_TERMS}]; // cartesian: c
uniform float uTermCoeff[${MAX_ORBITAL_TERMS}];

uniform float uIsoValue;
uniform int uRenderMode;      // 0=iso, 1=density, 2=slice
uniform int uDisplayMode;     // 0=angular, 1=radial R_{nl}, 2=full ψ
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

const int STEPS_ISO = 64;
const int STEPS_DENSITY = 48;
const float INV_SQRT_4PI_C = 0.28209479177387814;  // Y_{0,0}

// Small unrolled integer-exponent power for the cartesian monomials. Max
// exponent supported is L_MAX = 4 (same as the codegen'd Ylm).
float pw(float v, int n) {
    if (n == 0) return 1.0;
    if (n == 1) return v;
    if (n == 2) return v * v;
    if (n == 3) return v * v * v;
    return v * v * v * v;
}

// Sample the field the user currently wants to see.
//   0 = angular: Σ coeff · (Y or N·x^a y^b z^c) · exp(-r/λ)
//   1 = radial:  R_{uRadN, uRadL}(r) · Y_{0,0}
//   2 = full ψ:  Σ coeff · R_{n, l or a+b+c}(r) · (Y or N·x^a y^b z^c)
float sampleField(vec3 pos) {
    float r2 = dot(pos, pos);
    if (r2 < 1e-8) {
        if (uDisplayMode == 1) return radialR(uRadN, uRadL, 0.0, uZ) * INV_SQRT_4PI_C;
        return 0.0;
    }
    float r = sqrt(r2);
    vec3 nHat = pos / r;

    if (uDisplayMode == 1) {
        return radialR(uRadN, uRadL, r, uZ) * INV_SQRT_4PI_C;
    }

    float envelope = (uDisplayMode == 0) ? exp(-r / max(uEnvelopeScale, 0.01)) : 0.0;

    float sum = 0.0;
    for (int i = 0; i < ${MAX_ORBITAL_TERMS}; i++) {
        if (i >= uNumTerms) break;

        int kind = uTermKind[i];
        int n = uTermN[i];
        int p1 = uTermP1[i];
        int p2 = uTermP2[i];
        int p3 = uTermP3[i];
        float coeff = uTermCoeff[i];

        float ang;
        int lEq;
        if (kind == 0) {
            ang = Ylm(p1, p2, nHat.x, nHat.y, nHat.z);
            lEq = p1;
        } else {
            ang = pw(nHat.x, p1) * pw(nHat.y, p2) * pw(nHat.z, p3);
            lEq = p1 + p2 + p3;
        }

        float radFactor;
        if (uDisplayMode == 0) {
            radFactor = envelope;
        } else {
            radFactor = radialR(n, lEq, r, uZ);
        }

        sum += coeff * ang * radFactor;
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
vec3 shadeLobe(vec3 hitPos, vec3 rayDir, bool positive) {
    float eps = 0.03;
    vec3 grad = vec3(
        sampleField(hitPos + vec3(eps, 0, 0)) - sampleField(hitPos - vec3(eps, 0, 0)),
        sampleField(hitPos + vec3(0, eps, 0)) - sampleField(hitPos - vec3(0, eps, 0)),
        sampleField(hitPos + vec3(0, 0, eps)) - sampleField(hitPos - vec3(0, 0, eps))
    );
    float gLen = length(grad);
    vec3 N = gLen > 1e-6 ? grad / gLen : vec3(0.0, 1.0, 0.0);
    if (dot(N, rayDir) > 0.0) N = -N;

    vec3 base = positive ? uColorPositive : uColorNegative;

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

void main() {
    vec3 rayOrigin = uCameraPos;
    vec3 rayDir = normalize(vWorldPosition - uCameraPos);

    vec2 tBounds = intersectSphere(rayOrigin, rayDir, uBoundingRadius);
    if (tBounds.y < 0.0) discard;
    float tNear = max(tBounds.x, 0.0);
    float tFar = tBounds.y;

    // Cutaway: trim the ray's bounding interval against a clip plane. Only
    // applied in iso/density modes; slice mode already has its own plane.
    if (uClipEnabled == 1 && (uRenderMode == 0 || uRenderMode == 1)) {
        vec3 clipN;
        if (uSliceAxis == 0) clipN = vec3(1.0, 0.0, 0.0);
        else if (uSliceAxis == 1) clipN = vec3(0.0, 1.0, 0.0);
        else clipN = vec3(0.0, 0.0, 1.0);

        float denom = dot(rayDir, clipN);
        float startSide = dot(rayOrigin, clipN) - uSlicePosition;
        // Convention: "kept" half-space is where dot(p, n) > uSlicePosition.
        if (abs(denom) < 1e-6) {
            // Ray parallel to plane; visible only if we start on the kept side.
            if (startSide < 0.0) discard;
        } else {
            float tPlane = (uSlicePosition - dot(rayOrigin, clipN)) / denom;
            if (startSide > 0.0) {
                // Start kept, exit at the plane if the ray goes through.
                if (denom < 0.0) tFar = min(tFar, tPlane);
            } else {
                // Start hidden, enter kept at the plane.
                if (denom > 0.0) tNear = max(tNear, tPlane);
                else discard;
            }
            if (tFar <= tNear) discard;
        }
    }

    // ------------------------------------------------------------------
    // ISOSURFACE
    // ------------------------------------------------------------------
    if (uRenderMode == 0) {
        float iso = uIsoValue;
        float dt = (tFar - tNear) / float(STEPS_ISO);
        float t = tNear;
        float prev = sampleField(rayOrigin + rayDir * t);

        for (int i = 1; i < STEPS_ISO; i++) {
            t += dt;
            vec3 p = rayOrigin + rayDir * t;
            float val = sampleField(p);

            bool crossPlus = (prev - iso) * (val - iso) < 0.0;
            bool crossMinus = (prev + iso) * (val + iso) < 0.0;

            if (crossPlus || crossMinus) {
                float target = crossPlus ? iso : -iso;
                float tA = t - dt, tB = t;
                float vA = prev, vB = val;
                for (int j = 0; j < 5; j++) {
                    float tMid = 0.5 * (tA + tB);
                    float vMid = sampleField(rayOrigin + rayDir * tMid);
                    if ((vA - target) * (vMid - target) < 0.0) {
                        tB = tMid; vB = vMid;
                    } else {
                        tA = tMid; vA = vMid;
                    }
                }
                vec3 hitPos = rayOrigin + rayDir * tA;
                bool positive = target > 0.0;
                gl_FragColor = vec4(shadeLobe(hitPos, rayDir, positive), 1.0);
                return;
            }
            prev = val;
        }
        discard;
    }

    // ------------------------------------------------------------------
    // DENSITY  (|ψ|² ray march with sign colouring, auto-scaled)
    // ------------------------------------------------------------------
    if (uRenderMode == 1) {
        vec4 acc = vec4(0.0);
        float dt = (tFar - tNear) / float(STEPS_DENSITY);
        // Normalised amplitude: val/max ∈ [-1,1], density ∈ [0,1].
        for (int i = 0; i < STEPS_DENSITY; i++) {
            float t = tNear + (float(i) + 0.5) * dt;
            vec3 p = rayOrigin + rayDir * t;
            float val = sampleField(p) * uNormScale;
            float density = val * val;
            if (density < 1e-5) continue;

            // Per-unit-length opacity; dt cancels the "thicker bounding box
            // means more opacity" artefact.
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

    // ------------------------------------------------------------------
    // SLICE
    // ------------------------------------------------------------------
    if (uRenderMode == 2) {
        vec3 n;
        if (uSliceAxis == 0) n = vec3(1.0, 0.0, 0.0);
        else if (uSliceAxis == 1) n = vec3(0.0, 1.0, 0.0);
        else n = vec3(0.0, 0.0, 1.0);

        float tP = intersectPlane(rayOrigin, rayDir, n, uSlicePosition);
        if (tP < tNear || tP > tFar) discard;

        vec3 p = rayOrigin + rayDir * tP;
        float val = sampleField(p) * uNormScale; // normalised to [-1, 1]

        // Signed colourmap: background at 0, saturate to the lobe colours at ±1.
        // A mild power curve sharpens small features without killing peaks.
        float mag = clamp(pow(abs(val), 0.6), 0.0, 1.0);
        vec3 target = (val >= 0.0) ? uColorPositive : uColorNegative;
        vec3 color = mix(uBackground, target, mag);
        gl_FragColor = vec4(color, 1.0);
        return;
    }

    discard;
}
`;
