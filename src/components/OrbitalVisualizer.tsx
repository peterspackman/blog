import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

// This is a browser-only component for Docusaurus
const OrbitalMixer = () => {
  // For Docusaurus, we need to use dynamic imports for browser-only libraries
  const [ready, setReady] = useState(false);
  const [Components, setComponents] = useState(null);

  useEffect(() => {
    // Only import these libraries on the client side
    const loadLibraries = async () => {
      try {
        // Import all required modules
        const THREE = await import('three');
        const ReactThreeFiber = await import('@react-three/fiber');
        const Drei = await import('@react-three/drei');

        // Set the components
        setComponents({
          Canvas: ReactThreeFiber.Canvas,
          OrbitControls: Drei.OrbitControls,
          THREE
        });
        setReady(true);
      } catch (error) {
        console.error("Failed to load Three.js libraries:", error);
      }
    };

    loadLibraries();
  }, []);

  // Show a loading state until libraries are imported
  if (!ready || !Components) {
    return <div>Loading 3D visualization...</div>;
  }

  // Render the actual component once loaded
  return <OrbitalMixerImpl Components={Components} />;
};

// The actual implementation, only rendered on the client side
const OrbitalMixerImpl = ({ Components }) => {
  const { Canvas, OrbitControls, THREE } = Components;
  const [renderMode, setRenderMode] = useState(0);

  // New state to handle multiple orbitals
  const [orbitals, setOrbitals] = useState([
    { n: 2, l: 1, m: 0, weight: 1.0, phase: 0.0, enabled: true }
  ]);
  const [activeOrbitalIndex, setActiveOrbitalIndex] = useState(0);
  const [maxOrbitals] = useState(6); // Maximum number of orbitals

  // Add a new orbital
  const addOrbital = () => {
    if (orbitals.length < maxOrbitals) {
      const newOrbital = { n: 1, l: 0, m: 0, weight: 1.0, phase: 0.0, enabled: true };
      setOrbitals([...orbitals, newOrbital]);
      setActiveOrbitalIndex(orbitals.length); // Set the new orbital as active
    }
  };

  // Remove an orbital
  const removeOrbital = (index) => {
    if (orbitals.length > 1) {
      const newOrbitals = orbitals.filter((_, i) => i !== index);
      setOrbitals(newOrbitals);

      // Adjust activeOrbitalIndex if needed
      if (activeOrbitalIndex >= newOrbitals.length) {
        setActiveOrbitalIndex(newOrbitals.length - 1);
      } else if (activeOrbitalIndex === index) {
        setActiveOrbitalIndex(Math.max(0, index - 1));
      }
    }
  };

  // Update a specific orbital's properties
  const updateOrbital = (index, property, value) => {
    const newOrbitals = [...orbitals];

    // Handle special case for n and l to maintain valid quantum numbers
    if (property === 'n') {
      const newN = parseInt(value);
      newOrbitals[index].n = newN;

      // Ensure l is valid for the new n value
      if (newOrbitals[index].l >= newN) {
        newOrbitals[index].l = newN - 1;

        // Also ensure m is valid for the new l value
        if (Math.abs(newOrbitals[index].m) > newOrbitals[index].l) {
          newOrbitals[index].m = 0;
        }
      }
    } else if (property === 'l') {
      const newL = parseInt(value);
      newOrbitals[index].l = newL;

      // Ensure m is valid for the new l value
      if (Math.abs(newOrbitals[index].m) > newL) {
        newOrbitals[index].m = 0;
      }
    } else if (property === 'm') {
      newOrbitals[index].m = parseInt(value);
    } else if (property === 'weight') {
      newOrbitals[index].weight = parseFloat(value);
    } else if (property === 'phase') {
      newOrbitals[index].phase = parseFloat(value);
    } else if (property === 'enabled') {
      newOrbitals[index].enabled = value;
    }

    setOrbitals(newOrbitals);
  };

  // Toggle an orbital's enabled state
  const toggleOrbital = (index) => {
    const newOrbitals = [...orbitals];
    newOrbitals[index].enabled = !newOrbitals[index].enabled;
    setOrbitals(newOrbitals);
  };

  // Normalize weights to ensure they sum to 1.0
  const normalizeWeights = () => {
    const enabledOrbitals = orbitals.filter(orbital => orbital.enabled);
    if (enabledOrbitals.length === 0) return;

    const totalWeight = enabledOrbitals.reduce((sum, orbital) => sum + orbital.weight, 0);

    if (totalWeight > 0) {
      const newOrbitals = [...orbitals];
      for (let i = 0; i < newOrbitals.length; i++) {
        if (newOrbitals[i].enabled) {
          newOrbitals[i].weight = newOrbitals[i].weight / totalWeight;
        }
      }
      setOrbitals(newOrbitals);
    }
  };

  // Simple shader-based component
  const ShaderScene = () => {
    const { camera, gl, scene, size } = useThree();
    const meshRef = useRef();

    // Create material with a simple shader to visualize a sphere
    const material = useMemo(() => {
      // Prepare orbital data arrays for shader
      const orbitalData = orbitals.map(orbital => ({
        n: orbital.n,
        l: orbital.l,
        m: orbital.m,
        weight: orbital.enabled ? orbital.weight : 0.0,
        phase: orbital.phase
      }));

      return new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          renderMode: { value: renderMode },
          aspectRatio: { value: 1.0 },
          edgeThreshold: { value: 0.01 },
          edgeWidth: { value: 0.00001 },
          cameraPos: { value: new THREE.Vector3() },
          cameraDirection: { value: new THREE.Vector3() },
          cameraUp: { value: new THREE.Vector3() },
          cameraRight: { value: new THREE.Vector3() },

          // Orbital data arrays
          orbital_n: { value: orbitalData.map(o => o.n) },
          orbital_l: { value: orbitalData.map(o => o.l) },
          orbital_m: { value: orbitalData.map(o => o.m) },
          orbital_weight: { value: orbitalData.map(o => o.weight) },
          orbital_phase: { value: orbitalData.map(o => o.phase) },
          orbital_count: { value: orbitals.length }
        },
        vertexShader: `
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0); // No projection needed for a screen-filling quad
          }
        `,
        fragmentShader: `
precision highp float;

uniform float time;
uniform float aspectRatio;
uniform float edgeThreshold;
uniform float edgeWidth;
uniform int renderMode;
uniform vec3 cameraPos;
uniform vec3 cameraDirection;
uniform vec3 cameraUp;
uniform vec3 cameraRight;

// Orbital data arrays - extended to 6 orbitals
uniform int orbital_n[6];
uniform int orbital_l[6];
uniform int orbital_m[6];
uniform float orbital_weight[6];
uniform float orbital_phase[6];
uniform int orbital_count;

varying vec2 vUv;

#define PI 3.14159265359
#define MAX_STEPS 100
#define STEP_SIZE 0.5
#define DENSITY_THRESHOLD 0.00002
#define MAX_DISTANCE 100.0

// Maximum L value we'll support
#define MAX_L 4

// Optimized cartesian calculation of spherical harmonics up to L=4
// Replace the existing SH computation in your shader with this optimized version

// Constants needed for normalization
#define SQRT_PI 1.77245385091
#define SQRT_2 1.41421356237
#define SQRT_3 1.73205080757
#define SQRT_5 2.2360679775
#define SQRT_6 2.44949
#define SQRT_7 2.64575
#define SQRT_10 3.16228
#define SQRT_14 3.74166
#define SQRT_15 3.87298
#define SQRT_35 5.91608

float factorial(float n) {
    // For L≤4, the maximum factorial we need is 8! (for L=4, m=4)
    if (n <= 0.0) return 1.0;
    else if (n == 1.0) return 1.0;
    else if (n == 2.0) return 2.0;
    else if (n == 3.0) return 6.0;
    else if (n == 4.0) return 24.0;
    else if (n == 5.0) return 120.0;
    else if (n == 6.0) return 720.0;
    else if (n == 7.0) return 5040.0;
    else if (n == 8.0) return 40320.0;
    
    // Fallback computation for larger values (should never be needed with MAX_L=4)
    float o = 1.0;
    for (float i = 1.0; i <= n; i++) 
        o *= i;
    return o;
}

// Improved Laguerre function with fixed pointer issue
float laguerre(float x, float k, float a) {
    float L0 = 1.;
    float L1 = 1.+a-x;
    for (float i = 0.; i < k; i++) {
        float t = ((2.*i+1.+a-x)*L1-(i+a)*L0)/(i+1.);
        L0 = L1;
        L1 = t;
    }
    return L1;
}

// Normalization function kept the same for compatibility
float normalization(float n, float l) {
    return sqrt(pow(2./n,3.)/(2.*n)*factorial(n-l-1.)/factorial(n+l));
}

// Computes spherical harmonic Y_l^m in Cartesian form
// Input: normalized direction vector (x,y,z)
// Returns: Complex value representing Y_l^m (real, imag)
vec2 getYlmCartesian(int l, int m, vec3 dir) {
    float x = dir.x;
    float y = dir.y;
    float z = dir.z;
    float x2 = x*x;
    float y2 = y*y;
    float z2 = z*z;
    
    // Precompute common products
    float xy = x*y;
    float xz = x*z;
    float yz = y*z;
    float x2_y2 = x2 + y2;
    
    // L = 0
    if (l == 0 && m == 0) {
        // Y_0^0 = 1/(2*sqrt(pi))
        return vec2(0.28209479177387814, 0.0);
    }
    
    // L = 1
    else if (l == 1) {
        if (m == -1) {
            // Y_1^-1 = sqrt(3/(4pi)) * y
            return vec2(0.4886025119029199 * y, 0.0);
        }
        else if (m == 0) {
            // Y_1^0 = sqrt(3/(4pi)) * z
            return vec2(0.4886025119029199 * z, 0.0);
        }
        else if (m == 1) {
            // Y_1^1 = -sqrt(3/(4pi)) * x
            return vec2(0.4886025119029199 * x, 0.0);
        }
    }
    
    // L = 2
    else if (l == 2) {
        if (m == -2) {
            // Y_2^-2 = 1/2 * sqrt(15/pi) * xy
            return vec2(0.5462742152960395 * xy, 0.0);
        }
        else if (m == -1) {
            // Y_2^-1 = 1/2 * sqrt(15/pi) * yz
            return vec2(0.5462742152960395 * yz, 0.0);
        }
        else if (m == 0) {
            // Y_2^0 = 1/4 * sqrt(5/pi) * (3z^2 - 1)
            return vec2(0.31539156525252005 * (3.0*z2 - 1.0), 0.0);
        }
        else if (m == 1) {
            // Y_2^1 = -1/2 * sqrt(15/pi) * xz
            return vec2(0.5462742152960395 * xz, 0.0);
        }
        else if (m == 2) {
            // Y_2^2 = 1/4 * sqrt(15/pi) * (x^2 - y^2)
            return vec2(0.5462742152960395 * 0.5 * (x2 - y2), 0.0);
        }
    }
    
    // L = 3
    else if (l == 3) {
        if (m == -3) {
            // Y_3^-3 = 1/4 * sqrt(35/(2pi)) * y(3x^2 - y^2)
            return vec2(0.5900435899266435 * y * (3.0*x2 - y2), 0.0);
        }
        else if (m == -2) {
            // Y_3^-2 = 1/2 * sqrt(105/pi) * xyz
            return vec2(1.445305721320277 * xy * z, 0.0);
        }
        else if (m == -1) {
            // Y_3^-1 = 1/4 * sqrt(21/(2pi)) * y(5z^2 - 1)
            return vec2(0.6690465435572892 * y * (5.0*z2 - 1.0), 0.0);
        }
        else if (m == 0) {
            // Y_3^0 = 1/4 * sqrt(7/pi) * z(5z^2 - 3)
            return vec2(0.3731763325901154 * z * (5.0*z2 - 3.0), 0.0);
        }
        else if (m == 1) {
            // Y_3^1 = -1/4 * sqrt(21/(2pi)) * x(5z^2 - 1)
            return vec2(0.6690465435572892 * x * (5.0*z2 - 1.0), 0.0);
        }
        else if (m == 2) {
            // Y_3^2 = 1/4 * sqrt(105/pi) * (x^2 - y^2)z
            return vec2(1.445305721320277 * 0.5 * (x2 - y2) * z, 0.0);
        }
        else if (m == 3) {
            // Y_3^3 = -1/4 * sqrt(35/(2pi)) * x(x^2 - 3y^2)
            return vec2(0.5900435899266435 * x * (x2 - 3.0*y2), 0.0);
        }
    }
    
    // L = 4
    else if (l == 4) {
        if (m == -4) {
            // Y_4^-4 = 3/4 * sqrt(35/pi) * xy(x^2 - y^2)
            float x2_m_y2 = x2 - y2;
            return vec2(0.6258357354491761 * xy * x2_m_y2, 0.0);
        }
        else if (m == -3) {
            // Y_4^-3 = 3/4 * sqrt(35/(2pi)) * yz(3x^2 - y^2)
            return vec2(0.9518580979661384 * yz * (3.0*x2 - y2), 0.0);
        }
        else if (m == -2) {
            // Y_4^-2 = 3/4 * sqrt(5/pi) * xy(7z^2 - 1)
            return vec2(0.5900435899266435 * xy * (7.0*z2 - 1.0), 0.0);
        }
        else if (m == -1) {
            // Y_4^-1 = 3/4 * sqrt(5/(2pi)) * yz(7z^2 - 3)
            return vec2(0.6258357354491761 * yz * (7.0*z2 - 3.0), 0.0);
        }
        else if (m == 0) {
            // Y_4^0 = 3/16 * sqrt(1/pi) * (35z^4 - 30z^2 + 3)
            return vec2(0.10578554691520431 * (35.0*z2*z2 - 30.0*z2 + 3.0), 0.0);
        }
        else if (m == 1) {
            // Y_4^1 = -3/4 * sqrt(5/(2pi)) * xz(7z^2 - 3)
            return vec2(0.6258357354491761 * xz * (7.0*z2 - 3.0), 0.0);
        }
        else if (m == 2) {
            // Y_4^2 = 3/8 * sqrt(5/pi) * (x^2 - y^2)(7z^2 - 1)
            return vec2(0.5900435899266435 * 0.5 * (x2 - y2) * (7.0*z2 - 1.0), 0.0);
        }
        else if (m == 3) {
            // Y_4^3 = -3/4 * sqrt(35/(2pi)) * xz(x^2 - 3y^2)
            return vec2(0.9518580979661384 * xz * (x2 - 3.0*y2), 0.0);
        }
        else if (m == 4) {
            // Y_4^4 = 3/16 * sqrt(35/pi) * (x^4 - 6x^2y^2 + y^4)
            float x4 = x2*x2;
            float y4 = y2*y2;
            return vec2(0.6258357354491761 * (x4 - 6.0*x2*y2 + y4), 0.0);
        }
    }
    
    // Fallback (should never happen if called with valid l, m)
    return vec2(0.0, 0.0);
}

// Apply phase to complex number
vec2 applyPhase(vec2 z, float phase) {
    float cos_phase = cos(phase);
    float sin_phase = sin(phase);
    return vec2(
        z.x * cos_phase - z.y * sin_phase,
        z.x * sin_phase + z.y * cos_phase
    );
}

// Simple radial function for visualization 
float radialFunction(float r, int n, int l) {
    // Scale for visualization
    float scale = 1.0;
    float decay = 10.0;
    
    // Simple radial function with appropriate falloff
    return scale * exp(-decay * r / float(n));
}

// Compute complete atomic orbital wavefunction
vec2 hydrogenOrbitalOptimized(vec3 pos, int n, int l, int m, float phase) {
    // Get length of position vector
    float r = length(pos);
    if (r < 0.001) return vec2(0.0); // Avoid division by zero
    
    // Normalize position to get direction
    vec3 dir = pos / r;
    
    // Compute spherical harmonic using optimized Cartesian formula
    vec2 ylm = getYlmCartesian(l, m, dir);
    
    float p = 2.0*length(pos)/float(n);
    float radial = laguerre(p, float(n-l)-1., 2.*float(l)+1.);
    radial *= exp(-p*.5)*pow(p, float(l));
    vec2 result = ylm * radial * normalization(float(n), float(l));
    // Apply phase and return complete wavefunction
    return applyPhase(result, phase);
}

// Get combined wavefunction at a position (replacing the original function)
vec2 getCombinedWavefunction(vec3 p) {
    vec2 psi = vec2(0.0);
    
    // Compute the wavefunction for each orbital
    for (int i = 0; i < 6; i++) { // Support for 6 orbitals
        if (i >= orbital_count) break;
        
        float weight = orbital_weight[i];
        if (weight > 0.001) {
            vec2 orbitalPsi = hydrogenOrbitalOptimized(p, 
                                                      orbital_n[i], 
                                                      orbital_l[i], 
                                                      orbital_m[i], 
                                                      orbital_phase[i]);
            psi += weight * orbitalPsi;
        }
    }
    
    return psi;
}

// Fast orbital color lookup
vec3 getOrbitalColor(int l) {
    // Colors for different angular momentum values
    if (l == 0) return vec3(0.2, 0.5, 0.9);      // s: blue
    if (l == 1) return vec3(1.0, 0.0, 0.0);      // p: red
    if (l == 2) return vec3(0.0, 1.0, 0.0);      // d: green
    if (l == 3) return vec3(1.0, 0.0, 1.0);      // f: purple
    if (l == 4) return vec3(1.0, 1.0, 0.0);      // g: yellow
    return vec3(0.5, 0.7, 0.7);                  // h+: teal
}

// Get mixed orbital color based on weights
vec3 getMixedOrbitalColor() {
    vec3 mixedColor = vec3(0.0);
    float totalWeight = 0.0;
    
    // Sum all active orbital colors weighted by contribution
    for (int i = 0; i < 6; i++) { // Support for 6 orbitals
        if (i >= orbital_count) break;
        
        float weight = orbital_weight[i];
        if (weight > 0.001) {
            mixedColor += weight * getOrbitalColor(orbital_l[i]);
            totalWeight += weight;
        }
    }
    
    return totalWeight > 0.0 ? mixedColor / totalWeight : vec3(0.5);
}

// Fast HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(vec3(1.0), clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Ray marching with efficient early termination
vec4 raymarch(vec3 ro, vec3 rd) {
    vec4 accum = vec4(0.0);
    
    // Calculate adaptive step size based on camera distance
    float baseStepSize = STEP_SIZE;
    float maxDistance = min(MAX_DISTANCE, 10.0 * length(cameraPos));
    
    // Ray-sphere intersection test for early culling
    float b = dot(ro, rd);
    float c = dot(ro, ro) - maxDistance * maxDistance;
    float discriminant = b * b - c;
    
    if (discriminant < 0.0) return vec4(0.0); // Ray misses bounded sphere
    
    // Start ray at sphere entry if applicable
    float t = -b - sqrt(discriminant);
    if (t > 0.0) ro += rd * t;
    
    // Random offset to prevent banding
    float offset = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 p = ro + rd * baseStepSize * offset;
    
    // Rendering parameters
    const float intensityScale = 12.0;
    const float maxAlpha = 0.35;
    const float densityBoost = 5.0;
    
    // Adaptive ray marching loop
    for (int i = 0; i < MAX_STEPS; i++) {
        // Skip if we're past the maximum distance
        float dist = length(p);
        if (dist > maxDistance) break;
        
        // Adaptive step size - larger steps in low-density regions
        float adaptiveStep = baseStepSize * (1.0 + 0.3 * dist / 5.0);
        
        // Fast density estimation to skip low-density regions
        float densityEstimate = exp(-dist * 0.5);
        if (densityEstimate < 0.01) {
            p += rd * adaptiveStep * 2.0;
            continue;
        }
        
        // Calculate wavefunction
        vec2 psi = getCombinedWavefunction(p);
        
        // Calculate probability density
        float density = dot(psi, psi) * densityBoost;
        
        // Skip low-density regions
        if (density > DENSITY_THRESHOLD) {
            // Extract real and imaginary parts
            float realPart = psi.x;
            float imagPart = psi.y;
            
            // Visualization variables
            vec3 color;
            float intensity;
            
            // Select visualization mode
            if (renderMode == 0) {
                // Probability density
                color = getMixedOrbitalColor();
                intensity = sqrt(density) * intensityScale;
            }
            else if (renderMode == 1) {
                // Real component
                color = realPart > 0.0 ? vec3(0.0, 0.8, 0.3) : vec3(0.9, 0.1, 0.2);
                intensity = abs(realPart) * intensityScale;
            }
            else if (renderMode == 2) {
                // Imaginary component
                color = imagPart > 0.0 ? vec3(0.0, 0.8, 0.3) : vec3(0.9, 0.1, 0.2);
                intensity = abs(imagPart) * intensityScale;
            }
            else if (renderMode == 3) {
                // Phase visualization
                float phase = atan(imagPart, realPart);
                float hue = (phase + PI) / (2.0 * PI);
                color = hsv2rgb(vec3(hue, 0.8, 0.9));
                intensity = sqrt(density) * intensityScale;
            }
            else {
                // Real/Imaginary mix
                float realWeight = abs(realPart) / (abs(realPart) + abs(imagPart) + 0.0001);
                vec3 realColor = realPart > 0.0 ? vec3(0.1, 0.5, 0.8) : vec3(0.7, 0.1, 0.2);
                vec3 imagColor = imagPart > 0.0 ? vec3(0.9, 0.5, 0.1) : vec3(0.2, 0.7, 0.9);
                color = mix(realColor, imagColor, 1.0 - realWeight);
                intensity = density * intensityScale;
            }
            
            // Soft edges
            float boundaryFactor = smoothstep(edgeThreshold, edgeThreshold + edgeWidth, density);
            boundaryFactor = boundaryFactor;
            
            // Alpha and compositing
            float alpha = min(intensity * boundaryFactor, maxAlpha);
            float depthFactor = 1.0 - clamp(length(p - ro) / maxDistance, 0.0, 1.0);
            alpha *= mix(0.85, 1.3, depthFactor);
            
            // Create sample
            vec4 samp = vec4(color * intensity * boundaryFactor, alpha);
            samp.rgb *= samp.a;
            
            // Composite
            accum.rgb += (1.0 - accum.a) * samp.rgb;
            accum.a += (1.0 - accum.a) * samp.a;
            
            // Early termination if nearly opaque
            if (accum.a > 0.98) break;
        }
        
        // Step along ray
        p += rd * adaptiveStep;
    }
    
    // Tone mapping
    accum.rgb = accum.rgb / (0.8 + accum.rgb);
    accum.rgb = pow(accum.rgb, vec3(0.8)) * 1.7;
    
    return accum;
}

void main() {
    // Generate ray
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= aspectRatio;
    
    vec3 rayDirection = normalize(cameraDirection + uv.x * cameraRight + uv.y * cameraUp);
    
    // Perform ray marching
    vec4 result = raymarch(cameraPos, rayDirection);
    
    // Background blend
    vec3 backgroundColor = vec3(1.0);
    vec3 finalColor = mix(backgroundColor, result.rgb, result.a);
    
    // Output
    gl_FragColor = vec4(finalColor, 1.0);
}`,
        side: THREE.DoubleSide
      });
    }, [THREE, renderMode, orbitals]);

    // Function to update all camera-related uniforms
    const updateCameraUniforms = () => {
      if (!material.uniforms) return;

      // Update aspect ratio in case window was resized
      material.uniforms.aspectRatio.value = size.width / size.height;

      // Update camera position
      material.uniforms.cameraPos.value.copy(camera.position);

      // Calculate and update camera vectors
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(camera.quaternion);
      material.uniforms.cameraDirection.value.copy(direction);

      const up = new THREE.Vector3(0, 1, 0);
      up.applyQuaternion(camera.quaternion);
      material.uniforms.cameraUp.value.copy(up);

      const right = new THREE.Vector3(1, 0, 0);
      right.applyQuaternion(camera.quaternion);
      material.uniforms.cameraRight.value.copy(right);
    };

    // Update uniforms when orbital data changes
    useEffect(() => {
      if (!material.uniforms) return;

      // Update orbital data arrays
      const orbitalData = orbitals.map(orbital => ({
        n: orbital.n,
        l: orbital.l,
        m: orbital.m,
        weight: orbital.enabled ? orbital.weight : 0.0,
        phase: orbital.phase
      }));

      material.uniforms.orbital_n.value = orbitalData.map(o => o.n);
      material.uniforms.orbital_l.value = orbitalData.map(o => o.l);
      material.uniforms.orbital_m.value = orbitalData.map(o => o.m);
      material.uniforms.orbital_weight.value = orbitalData.map(o => o.weight);
      material.uniforms.orbital_phase.value = orbitalData.map(o => o.phase);
      material.uniforms.orbital_count.value = orbitals.length;
      material.uniforms.renderMode.value = renderMode;

      updateCameraUniforms();
    }, [material, orbitals, renderMode]);

    // Update camera uniforms and time in the animation loop
    useFrame((state, delta) => {
      if (meshRef.current) {
        // Update time uniform for animations
        material.uniforms.time.value += delta;

        // Update camera uniforms on every frame to respond to OrbitControls
        updateCameraUniforms();
      }
    });

    return (
      <mesh ref={meshRef} frustumCulled={false}>
        <planeGeometry args={[2, 2]} /> {/* Full screen quad */}
        <primitive object={material} attach="material" />
      </mesh>
    );
  };

  // Generate the orbital label (nl notation)
  const getOrbitalLabel = (n, l, m) => {
    const subshells = ['s', 'p', 'd', 'f', 'g', 'h'];
    return `${n}${subshells[l]}${m !== 0 ? ` (m=${m})` : ''}`;
  };

  return (
    <div style={{ position: 'relative', height: '500px' }}>
      <div style={{
        position: 'absolute',
        zIndex: 10,
        padding: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        borderRadius: '5px',
        maxHeight: '500px',
        overflowY: 'auto',
        width: '300px'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Orbital Mixing</h3>
          <div>
            <button
              onClick={addOrbital}
              disabled={orbitals.length >= maxOrbitals}
              style={{
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                marginRight: '10px',
                borderRadius: '3px',
                cursor: orbitals.length >= maxOrbitals ? 'not-allowed' : 'pointer',
                opacity: orbitals.length >= maxOrbitals ? 0.5 : 1
              }}
            >
              Add Orbital
            </button>
            <button
              onClick={normalizeWeights}
              style={{
                background: '#2196F3',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Normalize Weights
            </button>
          </div>
        </div>

        {orbitals.map((orbital, index) => (
          <div
            key={index}
            style={{
              marginBottom: '15px',
              padding: '10px',
              background: index === activeOrbitalIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderRadius: '5px',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <strong style={{ fontSize: '16px' }}>
                {getOrbitalLabel(orbital.n, orbital.l, orbital.m)}
              </strong>
              <div>
                <button
                  onClick={() => setActiveOrbitalIndex(index)}
                  style={{
                    background: 'transparent',
                    color: 'white',
                    border: '1px solid white',
                    padding: '2px 5px',
                    marginRight: '5px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleOrbital(index)}
                  style={{
                    background: orbital.enabled ? '#4CAF50' : '#f44336',
                    color: 'white',
                    border: 'none',
                    padding: '2px 5px',
                    marginRight: '5px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  {orbital.enabled ? 'On' : 'Off'}
                </button>
                {orbitals.length > 1 && (
                  <button
                    onClick={() => removeOrbital(index)}
                    style={{
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {index === activeOrbitalIndex && (
              <div>
                <div>
                  <label>n: </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={orbital.n}
                    onChange={(e) => updateOrbital(index, 'n', e.target.value)}
                  />
                  <span>{orbital.n}</span>
                </div>
                <div>
                  <label>l: </label>
                  <input
                    type="range"
                    min="0"
                    max={orbital.n - 1}
                    value={orbital.l}
                    onChange={(e) => updateOrbital(index, 'l', e.target.value)}
                  />
                  <span>{orbital.l}</span>
                </div>
                <div>
                  <label>m: </label>
                  <input
                    type="range"
                    min={-orbital.l}
                    max={orbital.l}
                    value={orbital.m}
                    onChange={(e) => updateOrbital(index, 'm', e.target.value)}
                  />
                  <span>{orbital.m}</span>
                </div>
                <div>
                  <label>Phase: </label>
                  <input
                    type="range"
                    min="0"
                    max="6.28"
                    step="0.01"
                    value={orbital.phase}
                    onChange={(e) => updateOrbital(index, 'phase', e.target.value)}
                  />
                  <span>{(orbital.phase / Math.PI).toFixed(2)}π</span>
                </div>
              </div>
            )}

            <div>
              <label>Weight: </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={orbital.weight}
                disabled={!orbital.enabled}
                onChange={(e) => updateOrbital(index, 'weight', e.target.value)}
              />
              <span>{orbital.weight.toFixed(2)}</span>
            </div>
          </div>
        ))}

        <div style={{ marginTop: '20px' }}>
          <label>Visualization: </label>
          <select
            value={renderMode}
            onChange={(e) => setRenderMode(parseInt(e.target.value))}
            style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #555', width: '100%', padding: '5px' }}
          >
            <option value="0">Probability Density</option>
            <option value="1">Real Component</option>
            <option value="2">Imaginary Component</option>
            <option value="3">Phase</option>
            <option value="4">Real/Imaginary Mix</option>
          </select>
        </div>
      </div>

      <Canvas
        camera={{
          position: [0, 10, 10],
          zoom: 1.5,
          near: 0.1,
          far: 1000,
          orthographic: true
        }}
        style={{ background: '#111', height: "500px" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <ShaderScene />
        <OrbitControls />
      </Canvas>

      {/* Information panel */}
      <div style={{
        position: 'absolute',
        right: '10px',
        top: '10px',
        padding: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        borderRadius: '5px',
        maxWidth: '250px',
        fontSize: '14px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Orbital Mixer</h3>
        <p>Mix up to 6 atomic orbitals to visualize quantum superpositions.</p>
        <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
          <li>Use <strong>Edit</strong> to modify orbital parameters</li>
          <li>Adjust <strong>Weight</strong> to control contribution</li>
          <li>Toggle orbitals <strong>On/Off</strong> with the button</li>
          <li>Use <strong>Phase</strong> to control quantum phase</li>
          <li>Click <strong>Normalize</strong> to balance weights</li>
        </ul>
        <p>Try mixing s and p orbitals to create hybrid orbitals, or explore complex superpositions!</p>
      </div>
    </div>
  );
};

export default OrbitalMixer;
