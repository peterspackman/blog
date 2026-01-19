/**
 * GLSL shaders for volume ray marching of 3D particle in a box
 *
 * The fragment shader ray-marches through a unit cube, calculating
 * the probability density |ψ|² at each step and accumulating color/opacity.
 */

export const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

void main() {
    vLocalPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform float uTau;
uniform int uNumStates;
uniform vec3 uStates[10];
uniform float uDensityScale;
uniform float uOpacityPower;
uniform float uThreshold;
uniform int uColorMap;
uniform int uRenderStyle;  // 0 = colorful, 1 = absorption (dark on white)
uniform vec3 uCameraPosition;

varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

const float PI = 3.14159265359;
const int NUM_STEPS = 80;

// Viridis colormap approximation
vec3 viridis(float t) {
    const vec3 c0 = vec3(0.2777, 0.0054, 0.3340);
    const vec3 c1 = vec3(0.1050, 0.6386, 0.5250);
    const vec3 c2 = vec3(0.4628, 0.7665, 0.4228);
    const vec3 c3 = vec3(0.8467, 0.9324, 0.4000);
    const vec3 c4 = vec3(0.9930, 0.9060, 0.1439);

    t = clamp(t, 0.0, 1.0);
    if (t < 0.25) {
        return mix(c0, c1, t * 4.0);
    } else if (t < 0.5) {
        return mix(c1, c2, (t - 0.25) * 4.0);
    } else if (t < 0.75) {
        return mix(c2, c3, (t - 0.5) * 4.0);
    } else {
        return mix(c3, c4, (t - 0.75) * 4.0);
    }
}

// Plasma colormap approximation
vec3 plasma(float t) {
    const vec3 c0 = vec3(0.050, 0.030, 0.528);
    const vec3 c1 = vec3(0.494, 0.012, 0.658);
    const vec3 c2 = vec3(0.798, 0.280, 0.470);
    const vec3 c3 = vec3(0.973, 0.580, 0.254);
    const vec3 c4 = vec3(0.940, 0.975, 0.131);

    t = clamp(t, 0.0, 1.0);
    if (t < 0.25) {
        return mix(c0, c1, t * 4.0);
    } else if (t < 0.5) {
        return mix(c1, c2, (t - 0.25) * 4.0);
    } else if (t < 0.75) {
        return mix(c2, c3, (t - 0.5) * 4.0);
    } else {
        return mix(c3, c4, (t - 0.75) * 4.0);
    }
}

// Cool-warm colormap
vec3 coolwarm(float t) {
    const vec3 cool = vec3(0.230, 0.299, 0.754);
    const vec3 neutral = vec3(0.865, 0.865, 0.865);
    const vec3 warm = vec3(0.706, 0.016, 0.150);

    t = clamp(t, 0.0, 1.0);
    if (t < 0.5) {
        return mix(cool, neutral, t * 2.0);
    } else {
        return mix(neutral, warm, (t - 0.5) * 2.0);
    }
}

vec3 colorMap(float t) {
    if (uColorMap == 0) {
        return viridis(t);
    } else if (uColorMap == 1) {
        return plasma(t);
    } else {
        return coolwarm(t);
    }
}

// Calculate probability density at point p in [0,1]³
float probabilityDensity(vec3 p) {
    // Skip if outside the box
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0) {
        return 0.0;
    }

    float realSum = 0.0;
    float imagSum = 0.0;
    float norm = 1.0 / sqrt(float(uNumStates));

    for (int i = 0; i < 10; i++) {
        if (i >= uNumStates) break;

        vec3 state = uStates[i];
        float psi = sin(state.x * PI * p.x)
                  * sin(state.y * PI * p.y)
                  * sin(state.z * PI * p.z);

        float energy = dot(state, state);
        float phase = -energy * uTau;

        realSum += psi * cos(phase) * norm;
        imagSum += psi * sin(phase) * norm;
    }

    return realSum * realSum + imagSum * imagSum;
}

// Ray-box intersection for unit cube centered at origin
// Returns (tNear, tFar) or (-1, -1) if no intersection
vec2 intersectBox(vec3 rayOrigin, vec3 rayDir) {
    vec3 boxMin = vec3(-0.5);
    vec3 boxMax = vec3(0.5);

    vec3 invDir = 1.0 / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * invDir;
    vec3 t1 = (boxMax - rayOrigin) * invDir;

    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    float tNear = max(max(tmin.x, tmin.y), tmin.z);
    float tFar = min(min(tmax.x, tmax.y), tmax.z);

    if (tNear > tFar || tFar < 0.0) {
        return vec2(-1.0);
    }

    return vec2(max(tNear, 0.0), tFar);
}

void main() {
    // Ray from camera through this fragment
    vec3 rayOrigin = uCameraPosition;
    vec3 rayDir = normalize(vWorldPosition - uCameraPosition);

    // Find entry/exit points of the unit cube
    vec2 tMinMax = intersectBox(rayOrigin, rayDir);

    if (tMinMax.x < 0.0) {
        gl_FragColor = vec4(0.0);
        return;
    }

    // Ray march through the volume
    float tStart = tMinMax.x;
    float tEnd = tMinMax.y;
    float stepSize = (tEnd - tStart) / float(NUM_STEPS);

    // Initialize color based on render style
    vec4 accumulatedColor;
    if (uRenderStyle == 1) {
        // Absorption mode: start with white
        accumulatedColor = vec4(1.0, 1.0, 1.0, 0.0);
    } else {
        // Emission mode: start with transparent black
        accumulatedColor = vec4(0.0);
    }

    for (int i = 0; i < NUM_STEPS; i++) {
        float t = tStart + float(i) * stepSize;
        vec3 worldPos = rayOrigin + rayDir * t;

        // Convert to [0,1] coordinates (box is centered at origin, size 1)
        vec3 uvw = worldPos + 0.5;

        float density = probabilityDensity(uvw);

        // Apply threshold - skip very low density regions
        if (density < uThreshold) {
            continue;
        }

        // Apply transfer function with power curve for sharpness control
        // opacityPower < 1 = fuzzier (more spread out), > 1 = sharper edges
        float safeThreshold = min(uThreshold, 0.99);
        float normalizedDensity = clamp((density - safeThreshold) / (1.0 - safeThreshold), 0.0, 1.0);
        float adjustedDensity = pow(normalizedDensity, max(uOpacityPower, 0.1));
        float alpha = adjustedDensity * stepSize * uDensityScale;

        if (uRenderStyle == 1) {
            // Absorption mode: darken from white background
            // Higher density = more darkening (like ink or smoke)
            float absorption = adjustedDensity * stepSize * uDensityScale * 0.5;
            accumulatedColor.rgb -= (1.0 - accumulatedColor.a) * vec3(absorption);
            accumulatedColor.a += (1.0 - accumulatedColor.a) * alpha * 0.3;
        } else {
            // Colorful emission mode (default)
            vec3 sampleColor = colorMap(sqrt(normalizedDensity) * 1.2);
            accumulatedColor.rgb += (1.0 - accumulatedColor.a) * sampleColor * alpha;
            accumulatedColor.a += (1.0 - accumulatedColor.a) * alpha;
        }

        // Early exit when nearly opaque
        if (accumulatedColor.a > 0.98) break;
    }

    gl_FragColor = accumulatedColor;
}
`;
