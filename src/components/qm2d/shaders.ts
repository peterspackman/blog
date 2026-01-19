/**
 * WebGL shaders for 2D quantum particle in a box visualization
 */

export const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
    gl_Position = vec4(position, 1.0);
  }
`;

export const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform int uActiveStatesCount;
  uniform vec2 uActiveStates[10]; // Array of nx, ny pairs (max 10 states)
  uniform int uDisplayMode; // 0: probability, 1: real, 2: imaginary
  uniform int uColorMapType; // 0: viridis, 1: plasma, 2: coolwarm
  uniform bool uShowContours;
  uniform float uAspectRatio; // width / height of the box (Lx / Ly)

  varying vec2 vUv;

  const float PI = 3.14159265359;

  // Calculate wave function at a point for a rectangular box
  // position.x is in [0, 1] representing [0, Lx]
  // position.y is in [0, 1] representing [0, Ly]
  vec3 calcWaveFunction(vec2 position, float nx, float ny, float t, float aspectRatio) {
    // Normalization: sqrt(4 / (Lx * Ly)) = sqrt(4 / aspectRatio) when Ly = 1
    // For normalized box where Lx * Ly = 1: norm = 2
    float norm = 2.0;

    // Spatial part: sin(nx*pi*x/Lx) * sin(ny*pi*y/Ly)
    // With our normalization x goes 0->1 representing 0->Lx, y goes 0->1 representing 0->Ly
    float psiSpace = norm * sin(nx * PI * position.x) * sin(ny * PI * position.y);

    // Energy: (pi^2 * hbar^2 / 2m) * (nx^2/Lx^2 + ny^2/Ly^2)
    // With Lx = aspectRatio, Ly = 1 (keeping Lx * Ly = aspectRatio)
    // E = (nx^2 / aspectRatio^2 + ny^2)
    // For square box (aspectRatio = 1): E = nx^2 + ny^2
    float energy = (nx * nx) / (aspectRatio * aspectRatio) + ny * ny;

    // Time evolution: exp(-iEt/hbar)
    float phase = -energy * t;

    return vec3(
      psiSpace * cos(phase),  // Real part
      psiSpace * sin(phase),  // Imaginary part
      psiSpace * psiSpace     // Probability density (|psi|^2)
    );
  }

  // Calculate superposition of states
  vec3 calcSuperposition(vec2 position, float t, float aspectRatio) {
    float realSum = 0.0;
    float imagSum = 0.0;

    // Normalization factor for superposition
    float norm = 1.0 / sqrt(float(uActiveStatesCount));

    for (int i = 0; i < 10; i++) {
      if (i >= uActiveStatesCount) break;

      vec2 state = uActiveStates[i];
      vec3 waveFunc = calcWaveFunction(position, state.x, state.y, t, aspectRatio);

      realSum += waveFunc.x * norm;
      imagSum += waveFunc.y * norm;
    }

    return vec3(
      realSum,
      imagSum,
      realSum * realSum + imagSum * imagSum  // Probability = |psi|^2
    );
  }

  // Viridis colormap (attempt at analytical approximation)
  vec3 viridis(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.267, 0.004, 0.329);
    vec3 c1 = vec3(0.282, 0.140, 0.457);
    vec3 c2 = vec3(0.254, 0.265, 0.530);
    vec3 c3 = vec3(0.206, 0.371, 0.553);
    vec3 c4 = vec3(0.164, 0.471, 0.557);
    vec3 c5 = vec3(0.128, 0.567, 0.551);
    vec3 c6 = vec3(0.134, 0.658, 0.517);
    vec3 c7 = vec3(0.267, 0.749, 0.441);
    vec3 c8 = vec3(0.478, 0.821, 0.318);
    vec3 c9 = vec3(0.741, 0.873, 0.150);
    vec3 c10 = vec3(0.993, 0.906, 0.144);

    float idx = t * 10.0;
    int i = int(floor(idx));
    float f = fract(idx);

    if (i >= 10) return c10;
    if (i == 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    if (i == 5) return mix(c5, c6, f);
    if (i == 6) return mix(c6, c7, f);
    if (i == 7) return mix(c7, c8, f);
    if (i == 8) return mix(c8, c9, f);
    return mix(c9, c10, f);
  }

  // Plasma colormap
  vec3 plasma(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.051, 0.031, 0.529);
    vec3 c1 = vec3(0.294, 0.012, 0.631);
    vec3 c2 = vec3(0.490, 0.012, 0.659);
    vec3 c3 = vec3(0.659, 0.133, 0.588);
    vec3 c4 = vec3(0.796, 0.275, 0.475);
    vec3 c5 = vec3(0.898, 0.420, 0.365);
    vec3 c6 = vec3(0.973, 0.580, 0.255);
    vec3 c7 = vec3(0.992, 0.765, 0.157);
    vec3 c8 = vec3(0.941, 0.976, 0.129);

    float idx = t * 8.0;
    int i = int(floor(idx));
    float f = fract(idx);

    if (i >= 8) return c8;
    if (i == 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    if (i == 5) return mix(c5, c6, f);
    if (i == 6) return mix(c6, c7, f);
    return mix(c7, c8, f);
  }

  // Cool-warm diverging colormap
  vec3 coolwarm(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.231, 0.298, 0.753);
    vec3 c1 = vec3(0.384, 0.510, 0.918);
    vec3 c2 = vec3(0.553, 0.690, 0.996);
    vec3 c3 = vec3(0.722, 0.816, 0.976);
    vec3 c4 = vec3(0.867, 0.867, 0.867);
    vec3 c5 = vec3(0.961, 0.769, 0.678);
    vec3 c6 = vec3(0.957, 0.604, 0.482);
    vec3 c7 = vec3(0.871, 0.376, 0.302);
    vec3 c8 = vec3(0.706, 0.016, 0.149);

    float idx = t * 8.0;
    int i = int(floor(idx));
    float f = fract(idx);

    if (i >= 8) return c8;
    if (i == 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    if (i == 5) return mix(c5, c6, f);
    if (i == 6) return mix(c6, c7, f);
    return mix(c7, c8, f);
  }

  // Get color from the selected color map
  vec3 getColor(float value) {
    if (uColorMapType == 0) {
      return viridis(value);
    } else if (uColorMapType == 1) {
      return plasma(value);
    } else {
      return coolwarm(value);
    }
  }

  // Draw contour lines based on the wave function value
  float contourLine(float value, float numContours) {
    // Create contour lines at regular intervals
    float scaled = value * numContours;
    float fractional = fract(scaled);

    // Line width (in normalized units, thinner = sharper)
    float lineWidth = 0.08;

    // Create smooth lines at integer values
    float dist = min(fractional, 1.0 - fractional);
    return 1.0 - smoothstep(0.0, lineWidth, dist);
  }

  void main() {
    // Calculate the wave function with aspect ratio
    vec3 wave = calcSuperposition(vUv, uTime, uAspectRatio);

    // Determine color based on display mode
    vec3 color;
    float contourValue;

    if (uDisplayMode == 0) {
      // Probability Density - use sqrt for better visual range
      float prob = sqrt(wave.z);
      color = getColor(prob);
      contourValue = prob;
    } else if (uDisplayMode == 1) {
      // Real Part - map [-1, 1] to [0, 1]
      float realMapped = wave.x * 0.5 + 0.5;
      color = getColor(realMapped);
      contourValue = realMapped;
    } else {
      // Imaginary Part
      float imagMapped = wave.y * 0.5 + 0.5;
      color = getColor(imagMapped);
      contourValue = imagMapped;
    }

    // Apply contour lines if enabled
    if (uShowContours) {
      float numContours = 8.0;
      float contour = contourLine(contourValue, numContours);

      // Use dark lines for probability, white for real/imag
      vec3 lineColor = (uDisplayMode == 0) ? vec3(0.0) : vec3(1.0);
      color = mix(color, lineColor, contour * 0.5);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;
