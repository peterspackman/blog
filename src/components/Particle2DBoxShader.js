// QuantumShader.js
export const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
    gl_Position = vec4(position, 1.0);
  }
`;

export const fragmentShader = `
  uniform float uTime;
  uniform int uActiveStatesCount;
  uniform vec2 uActiveStates[10]; // Array of nx, ny pairs (max 10 states)
  uniform int uDisplayMode; // 0: probability, 1: real, 2: imaginary
  uniform int uColorMapType; // 0: blue-white-orange, 1: blue-white-red, 2: rainbow
  uniform bool uShowGridLines;
  
  varying vec2 vUv;
  
  // Calculate wave function at a point
  vec3 calcWaveFunction(vec2 position, float nx, float ny, float t) {
    // Spatial part: (2/L) * sin(nxπx/L) * sin(nyπy/L)
    // Using normalized units where L = 1
    float psiSpace = 2.0 * sin(nx * 3.14159265 * position.x) * sin(ny * 3.14159265 * position.y);
    
    // Energy: (π²ℏ²)/(2mL²) * (nx² + ny²)
    // Using normalized units where (π²ℏ²)/(2mL²) = 1
    float energy = nx * nx + ny * ny;
    
    // Time evolution: exp(-iEt/ℏ)
    float phase = -energy * t;
    
    return vec3(
      psiSpace * cos(phase),  // Real part
      psiSpace * sin(phase),  // Imaginary part
      psiSpace * psiSpace     // Probability density
    );
  }
  
  // Calculate superposition of states
  vec3 calcSuperposition(vec2 position, float t) {
    float realSum = 0.0;
    float imagSum = 0.0;
    
    // Normalization factor
    float norm = 1.0 / sqrt(float(uActiveStatesCount));
    
    for(int i = 0; i < 10; i++) {
      if(i >= uActiveStatesCount) break;
      
      vec2 state = uActiveStates[i];
      vec3 waveFunc = calcWaveFunction(position, state.x, state.y, t);
      
      realSum += waveFunc.x * norm;
      imagSum += waveFunc.y * norm;
    }
    
    return vec3(
      realSum,
      imagSum,
      realSum * realSum + imagSum * imagSum  // Probability = |ψ|²
    );
  }
  
  // Get color from the selected color map
  vec3 getColor(float value) {
    // Blue-white-orange
    if(uColorMapType == 0) {
      if(value < 0.25) {
        return mix(vec3(0.0, 0.2, 0.6), vec3(0.4, 0.6, 1.0), value * 4.0);
      } else if(value < 0.5) {
        return mix(vec3(0.4, 0.6, 1.0), vec3(1.0, 1.0, 1.0), (value - 0.25) * 4.0);
      } else if(value < 0.75) {
        return mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.7, 0.4), (value - 0.5) * 4.0);
      } else {
        return mix(vec3(1.0, 0.7, 0.4), vec3(0.7, 0.2, 0.0), (value - 0.75) * 4.0);
      }
    } 
    // Blue-white-red
    else if(uColorMapType == 1) {
      if(value < 0.25) {
        return mix(vec3(0.0, 0.0, 0.7), vec3(0.4, 0.5, 1.0), value * 4.0);
      } else if(value < 0.5) {
        return mix(vec3(0.4, 0.5, 1.0), vec3(1.0, 1.0, 1.0), (value - 0.25) * 4.0);
      } else if(value < 0.75) {
        return mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.4, 0.4), (value - 0.5) * 4.0);
      } else {
        return mix(vec3(1.0, 0.4, 0.4), vec3(0.6, 0.0, 0.0), (value - 0.75) * 4.0);
      }
    }
    // Rainbow
    else {
      if(value < 0.125) {
        return mix(vec3(0.3, 0.0, 0.5), vec3(0.0, 0.0, 1.0), value * 8.0);
      } else if(value < 0.25) {
        return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 0.7, 1.0), (value - 0.125) * 8.0);
      } else if(value < 0.375) {
        return mix(vec3(0.0, 0.7, 1.0), vec3(0.0, 0.8, 0.5), (value - 0.25) * 8.0);
      } else if(value < 0.5) {
        return mix(vec3(0.0, 0.8, 0.5), vec3(0.0, 0.9, 0.0), (value - 0.375) * 8.0);
      } else if(value < 0.625) {
        return mix(vec3(0.0, 0.9, 0.0), vec3(0.7, 0.9, 0.0), (value - 0.5) * 8.0);
      } else if(value < 0.75) {
        return mix(vec3(0.7, 0.9, 0.0), vec3(1.0, 0.7, 0.0), (value - 0.625) * 8.0);
      } else if(value < 0.875) {
        return mix(vec3(1.0, 0.7, 0.0), vec3(1.0, 0.5, 0.0), (value - 0.75) * 8.0);
      } else {
        return mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.0, 0.0), (value - 0.875) * 8.0);
      }
    }
  }
  
  // Draw grid lines
  float drawGrid(vec2 position) {
    float lineWidth = 0.005;
    float gridSize = 0.1; // 10x10 grid
    
    // Check if the position is close to a grid line
    vec2 gridPos = mod(position, gridSize);
    float distToGridX = min(gridPos.x, gridSize - gridPos.x);
    float distToGridY = min(gridPos.y, gridSize - gridPos.y);
    
    // Draw the grid line if close enough
    if (distToGridX < lineWidth || distToGridY < lineWidth) {
      return 1.0;
    }
    
    return 0.0;
  }
  
  void main() {
    // Calculate the wave function
    vec3 wave = calcSuperposition(vUv, uTime);
    
    // Determine color based on display mode
    vec3 color;
    if(uDisplayMode == 0) {
      // Probability Density
      color = getColor(wave.z);
    } else if(uDisplayMode == 1) {
      // Real Part
      color = getColor(wave.x * 0.5 + 0.5); // Map [-1, 1] to [0, 1]
    } else if(uDisplayMode == 2) {
      // Imaginary Part
      color = getColor(wave.y * 0.5 + 0.5); // Map [-1, 1] to [0, 1]
    }
    
    // Apply grid lines if enabled
    if(uShowGridLines) {
      float grid = drawGrid(vUv);
      color = mix(color, vec3(1.0, 1.0, 1.0), grid * 0.3);
    }
    
    // Output final color
    gl_FragColor = vec4(color, 1.0);
  }
`;
