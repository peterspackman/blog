import React, { useEffect, useState, useRef } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import MathFormula from './MathFormula';

interface HarmonicCoeff {
  l: number;
  m: number;
  coeff: number;
  phase: number;
}

interface CartesianOrbital {
  l: number;
  name: string;
  label: string;
  coeff: number;
}

const SphericalHarmonicsViewer = () => {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [l, setL] = useState(2);
  const [m, setM] = useState(0);
  const [scale, setScale] = useState(1);
  const [showWireframe, setShowWireframe] = useState(false);
  const [colorMap, setColorMap] = useState("blue_white_orange");
  const [showLinearCombination, setShowLinearCombination] = useState(false);
  const [useCartesian, setUseCartesian] = useState(false);
  const [harmonicCoeffs, setHarmonicCoeffs] = useState<HarmonicCoeff[]>([
    { l: 2, m: 0, coeff: 1.0, phase: 0 }
  ]);
  const [cartesianOrbitals, setCartesianOrbitals] = useState<CartesianOrbital[]>([
    { l: 2, name: 'zz', label: 'z²', coeff: 1.0 }
  ]);

  // Mathematical helper functions
  const factorialCache = new Map();
  const factorial = (n) => {
    if (n <= 1) return 1;
    if (factorialCache.has(n)) return factorialCache.get(n);
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    factorialCache.set(n, result);
    return result;
  };

  const doubleFactorial = (n) => {
    if (n <= 0) return 1;
    let result = 1;
    for (let i = n; i > 0; i -= 2) {
      result *= i;
    }
    return result;
  };

  // Proper Associated Legendre Polynomial implementation
  const legendreP = (l, m, x) => {
    // Handle edge cases
    if (Math.abs(m) > l) return 0;
    if (l === 0 && m === 0) return 1;
    
    const absM = Math.abs(m);
    
    // Start with P_m^m(x)
    let pmm = 1;
    if (absM > 0) {
      const somx2 = Math.sqrt((1 - x) * (1 + x)); // sqrt(1 - x^2)
      let fact = 1;
      for (let i = 1; i <= absM; i++) {
        pmm *= -fact * somx2;
        fact += 2;
      }
    }
    
    if (l === absM) {
      // Apply Condon-Shortley phase and sign convention for negative m
      return m >= 0 ? pmm : Math.pow(-1, absM) * pmm;
    }
    
    // Calculate P_{m+1}^m(x)
    const pmmp1 = x * (2 * absM + 1) * pmm;
    
    if (l === absM + 1) {
      return m >= 0 ? pmmp1 : Math.pow(-1, absM) * pmmp1;
    }
    
    // Use recurrence relation for l > m + 1
    let pll = 0;
    let pll1 = pmmp1;
    let pll2 = pmm;
    
    for (let ll = absM + 2; ll <= l; ll++) {
      pll = ((2 * ll - 1) * x * pll1 - (ll + absM - 1) * pll2) / (ll - absM);
      pll2 = pll1;
      pll1 = pll;
    }
    
    // Apply sign convention for negative m
    return m >= 0 ? pll : Math.pow(-1, absM) * pll;
  };

  // Real Spherical Harmonic Implementation (proper normalization)
  const sphericalHarmonic = (l, m, theta, phi) => {
    const x = Math.cos(theta);
    const absM = Math.abs(m);

    // Normalization factor for real spherical harmonics
    const norm = Math.sqrt((2 * l + 1) * factorial(l - absM) / 
                          (4 * Math.PI * factorial(l + absM)));

    const legendre = legendreP(l, m, x);

    // Real spherical harmonics convention
    if (m > 0) {
      // Y_l^m = sqrt(2) * N * P_l^m * cos(m*phi)
      return Math.sqrt(2) * norm * legendre * Math.cos(m * phi);
    } else if (m < 0) {
      // Y_l^{-|m|} = sqrt(2) * N * P_l^{|m|} * sin(|m|*phi)
      return Math.sqrt(2) * norm * legendre * Math.sin(absM * phi);
    } else {
      // Y_l^0 = N * P_l^0
      return norm * legendre;
    }
  };

  // Real Solid Harmonics (Cartesian) Implementation with proper normalization
  const realSolidHarmonic = (orbitalName: string, x: number, y: number, z: number) => {
    // Real solid harmonics as normalized monomial polynomials in x, y, z
    // Normalization ensures ∫|R_l^m|² dV = 1 over unit sphere
    
    switch (orbitalName) {
      // s orbitals (l=0): 1 function
      case '1': return Math.sqrt(1 / (4 * Math.PI)); // normalized constant
      
      // p orbitals (l=1): 3 functions
      case 'x': return Math.sqrt(3 / (4 * Math.PI)) * x;
      case 'y': return Math.sqrt(3 / (4 * Math.PI)) * y;
      case 'z': return Math.sqrt(3 / (4 * Math.PI)) * z;
      
      // d orbitals (l=2): 6 functions  
      case 'xx': return Math.sqrt(5 / (4 * Math.PI)) * x * x;
      case 'yy': return Math.sqrt(5 / (4 * Math.PI)) * y * y;
      case 'zz': return Math.sqrt(5 / (4 * Math.PI)) * z * z;
      case 'xy': return Math.sqrt(15 / (4 * Math.PI)) * x * y;
      case 'xz': return Math.sqrt(15 / (4 * Math.PI)) * x * z;
      case 'yz': return Math.sqrt(15 / (4 * Math.PI)) * y * z;
      
      // f orbitals (l=3): 10 functions
      case 'xxx': return Math.sqrt(7 / (4 * Math.PI)) * x * x * x;
      case 'yyy': return Math.sqrt(7 / (4 * Math.PI)) * y * y * y;
      case 'zzz': return Math.sqrt(7 / (4 * Math.PI)) * z * z * z;
      case 'xxy': return Math.sqrt(105 / (4 * Math.PI)) * x * x * y;
      case 'xxz': return Math.sqrt(105 / (4 * Math.PI)) * x * x * z;
      case 'xyy': return Math.sqrt(105 / (4 * Math.PI)) * x * y * y;
      case 'xzz': return Math.sqrt(105 / (4 * Math.PI)) * x * z * z;
      case 'yyz': return Math.sqrt(105 / (4 * Math.PI)) * y * y * z;
      case 'yzz': return Math.sqrt(105 / (4 * Math.PI)) * y * z * z;
      case 'xyz': return Math.sqrt(105 / (4 * Math.PI)) * x * y * z;
      
      // g orbitals (l=4): 15 functions
      case 'xxxx': return Math.sqrt(9 / (4 * Math.PI)) * x * x * x * x;
      case 'yyyy': return Math.sqrt(9 / (4 * Math.PI)) * y * y * y * y;
      case 'zzzz': return Math.sqrt(9 / (4 * Math.PI)) * z * z * z * z;
      case 'xxxy': return Math.sqrt(315 / (4 * Math.PI)) * x * x * x * y;
      case 'xxxz': return Math.sqrt(315 / (4 * Math.PI)) * x * x * x * z;
      case 'xyyy': return Math.sqrt(315 / (4 * Math.PI)) * x * y * y * y;
      case 'xzzz': return Math.sqrt(315 / (4 * Math.PI)) * x * z * z * z;
      case 'yyyz': return Math.sqrt(315 / (4 * Math.PI)) * y * y * y * z;
      case 'yzzz': return Math.sqrt(315 / (4 * Math.PI)) * y * z * z * z;
      case 'xxyy': return Math.sqrt(945 / (4 * Math.PI)) * x * x * y * y;
      case 'xxzz': return Math.sqrt(945 / (4 * Math.PI)) * x * x * z * z;
      case 'yyzz': return Math.sqrt(945 / (4 * Math.PI)) * y * y * z * z;
      case 'xxyz': return Math.sqrt(945 / (4 * Math.PI)) * x * x * y * z;
      case 'xyyz': return Math.sqrt(945 / (4 * Math.PI)) * x * y * y * z;
      case 'xyzz': return Math.sqrt(945 / (4 * Math.PI)) * x * y * z * z;
      
      default: return 0;
    }
  };

  // Get available orbitals for a given l value with correct counts
  const getAvailableOrbitals = (l: number) => {
    switch (l) {
      case 0: return [ // 1 s function
        { name: '1', label: '1' }
      ];
      case 1: return [ // 3 p functions
        { name: 'x', label: 'x' },
        { name: 'y', label: 'y' },
        { name: 'z', label: 'z' }
      ];
      case 2: return [ // 6 d functions
        { name: 'xx', label: 'x²' },
        { name: 'yy', label: 'y²' },
        { name: 'zz', label: 'z²' },
        { name: 'xy', label: 'xy' },
        { name: 'xz', label: 'xz' },
        { name: 'yz', label: 'yz' }
      ];
      case 3: return [ // 10 f functions
        { name: 'xxx', label: 'x³' },
        { name: 'yyy', label: 'y³' },
        { name: 'zzz', label: 'z³' },
        { name: 'xxy', label: 'x²y' },
        { name: 'xxz', label: 'x²z' },
        { name: 'xyy', label: 'xy²' },
        { name: 'xzz', label: 'xz²' },
        { name: 'yyz', label: 'y²z' },
        { name: 'yzz', label: 'yz²' },
        { name: 'xyz', label: 'xyz' }
      ];
      case 4: return [ // 15 g functions
        { name: 'xxxx', label: 'x⁴' },
        { name: 'yyyy', label: 'y⁴' },
        { name: 'zzzz', label: 'z⁴' },
        { name: 'xxxy', label: 'x³y' },
        { name: 'xxxz', label: 'x³z' },
        { name: 'xyyy', label: 'xy³' },
        { name: 'xzzz', label: 'xz³' },
        { name: 'yyyz', label: 'y³z' },
        { name: 'yzzz', label: 'yz³' },
        { name: 'xxyy', label: 'x²y²' },
        { name: 'xxzz', label: 'x²z²' },
        { name: 'yyzz', label: 'y²z²' },
        { name: 'xxyz', label: 'x²yz' },
        { name: 'xyyz', label: 'xy²z' },
        { name: 'xyzz', label: 'xyz²' }
      ];
      default: return [];
    }
  };

  // Linear combination of harmonics (spherical or Cartesian)
  const linearCombination = (theta, phi) => {
    let realPart = 0;
    let imagPart = 0;
    
    if (useCartesian) {
      // For Cartesian mode, use cartesianOrbitals array
      cartesianOrbitals.forEach(({ name, coeff }) => {
        if (coeff !== 0) {
          // Convert spherical coordinates to Cartesian first
          const r = 1; // Use unit sphere for calculating the polynomial
          const x = r * Math.sin(theta) * Math.cos(phi);
          const y = r * Math.sin(theta) * Math.sin(phi);
          const z = r * Math.cos(theta);
          const value = realSolidHarmonic(name, x, y, z);
          realPart += coeff * value;
        }
      });
    } else {
      // For spherical mode, use harmonicCoeffs array
      harmonicCoeffs.forEach(({ l, m, coeff, phase }) => {
        if (coeff !== 0) {
          const value = sphericalHarmonic(l, m, theta, phi);
          realPart += coeff * Math.cos(phase) * value;
          imagPart += coeff * Math.sin(phase) * value;
        }
      });
    }
    
    return { real: realPart, imag: imagPart, magnitude: Math.sqrt(realPart * realPart + imagPart * imagPart) };
  };

  // Get colormap array based on selection
  const getColorMap = () => {
    switch (colorMap) {
      case "blue_white_orange":
        return ['#0033cc', '#3366ff', '#66ccff', '#ffffff', '#ffcc66', '#ff9933', '#ff6600'];
      case "viridis":
        return ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'];
      case "plasma":
        return ['#0d0887', '#5302a3', '#8b0aa5', '#b83289', '#db5c68', '#f48849', '#fec488', '#f0f921'];
      case "cool_warm":
        return ['#3b4cc0', '#5977e3', '#7aa3f0', '#9dd0f0', '#c9e7f0', '#f0e2c9', '#f0b49d', '#e3777a', '#cc3b4c'];
      case "rainbow":
        return ['#9400d3', '#0000ff', '#00ff00', '#ffff00', '#ff7f00', '#ff0000'];
      default:
        return ['#0033cc', '#3366ff', '#66ccff', '#ffffff', '#ffcc66', '#ff9933', '#ff6600'];
    }
  };

  // Function to update the chart
  const updateChart = () => {
    if (!chartInstanceRef.current) return;

    // Set the maximum axis range based on current scale
    const axisMax = Math.max(1, scale);

    const option = {
      tooltip: {},
      toolbox: {
        feature: {
          restore: {},
          saveAsImage: {}
        }
      },
      visualMap: {
        show: true,
        dimension: 2, // Use z-coordinate for coloring (like the working version)
        min: -scale,
        max: scale,
        inRange: {
          color: getColorMap()
        },
        text: ['Max', 'Min'],
        textStyle: {
          color: '#333'
        },
        orient: 'vertical',
        left: 'right',
        top: 'center'
      },
      xAxis3D: {
        min: -axisMax,
        max: axisMax,
        name: 'X',
        axisLine: {
          show: true,
          lineStyle: {
            color: '#666'
          }
        },
        axisTick: {
          show: true
        },
        axisLabel: {
          show: true,
          color: '#666'
        },
        splitLine: {
          show: false
        }
      },
      yAxis3D: {
        min: -axisMax,
        max: axisMax,
        name: 'Y',
        axisLine: {
          show: true,
          lineStyle: {
            color: '#666'
          }
        },
        axisTick: {
          show: true
        },
        axisLabel: {
          show: true,
          color: '#666'
        },
        splitLine: {
          show: false
        }
      },
      zAxis3D: {
        min: -axisMax,
        max: axisMax,
        name: 'Z',
        axisLine: {
          show: true,
          lineStyle: {
            color: '#666'
          }
        },
        axisTick: {
          show: true
        },
        axisLabel: {
          show: true,
          color: '#666'
        },
        splitLine: {
          show: false
        }
      },
      grid3D: {
        show: false,
        viewControl: {
          autoRotate: true,
          autoRotateSpeed: 10,
          rotateSensitivity: 2,
          zoomSensitivity: 2,
          panSensitivity: 2,
          distance: 150,
          minDistance: 50,
          maxDistance: 400,
          orthographicSize: 100,
          maxOrthographicSize: 400,
          minOrthographicSize: 20
        },
        postEffect: {
          enable: true,
          SSAO: {
            enable: true,
            radius: 4
          }
        },
        light: {
          main: {
            intensity: 1.5,
            shadow: false
          },
          ambient: {
            intensity: 0.6
          }
        }
      },
      series: [
        {
          type: 'surface',
          parametric: true,
          wireframe: {
            show: showWireframe
          },
          shading: 'realistic',
          realisticMaterial: {
            roughness: 0.4,
            metalness: 0
          },
          // Ensure closed surface and higher quality
          animationDurationUpdate: 500,
          progressiveThreshold: 5000,
          progressive: 1000,
          parametricEquation: {
            u: {
              min: 0,
              max: Math.PI,
              step: Math.PI / 60
            },
            v: {
              min: 0,
              max: 2 * Math.PI,
              step: 2 * Math.PI / 120
            },
            x: (u, v) => {
              let value;
              if (showLinearCombination) {
                const result = linearCombination(u, v);
                value = result.magnitude;
              } else {
                if (useCartesian) {
                  // For Cartesian mode, use the first orbital in the list
                  const x = Math.sin(u) * Math.cos(v);
                  const y = Math.sin(u) * Math.sin(v);
                  const z = Math.cos(u);
                  const orbitalName = cartesianOrbitals[0]?.name || 'zz';
                  value = realSolidHarmonic(orbitalName, x, y, z);
                } else {
                  value = sphericalHarmonic(l, m, u, v);
                }
              }
              
              // Calculate radius from harmonic amplitude
              const r = Math.abs(value) * scale;
              
              // Convert to Cartesian coordinates
              return r * Math.sin(u) * Math.cos(v);
            },
            y: (u, v) => {
              let value;
              if (showLinearCombination) {
                const result = linearCombination(u, v);
                value = result.magnitude;
              } else {
                if (useCartesian) {
                  // For Cartesian mode, use the first orbital in the list
                  const x = Math.sin(u) * Math.cos(v);
                  const y = Math.sin(u) * Math.sin(v);
                  const z = Math.cos(u);
                  const orbitalName = cartesianOrbitals[0]?.name || 'zz';
                  value = realSolidHarmonic(orbitalName, x, y, z);
                } else {
                  value = sphericalHarmonic(l, m, u, v);
                }
              }
              
              // Calculate radius from harmonic amplitude
              const r = Math.abs(value) * scale;
              
              // Convert to Cartesian coordinates
              return r * Math.sin(u) * Math.sin(v);
            },
            z: (u, v) => {
              let value;
              if (showLinearCombination) {
                const result = linearCombination(u, v);
                value = result.magnitude;
              } else {
                if (useCartesian) {
                  // For Cartesian mode, use the first orbital in the list
                  const x = Math.sin(u) * Math.cos(v);
                  const y = Math.sin(u) * Math.sin(v);
                  const z = Math.cos(u);
                  const orbitalName = cartesianOrbitals[0]?.name || 'zz';
                  value = realSolidHarmonic(orbitalName, x, y, z);
                } else {
                  value = sphericalHarmonic(l, m, u, v);
                }
              }
              
              // Calculate radius from harmonic amplitude
              const r = Math.abs(value) * scale;
              
              // Convert to Cartesian coordinates
              return r * Math.cos(u);
            },
            // For ECharts GL to use radius for coloring, we need to return it
            // The color is determined by the distance from origin by default
            // So the built-in coloring should work correctly now
          }
        }
      ]
    };

    chartInstanceRef.current.setOption(option);
  };

  // Initialize chart
  useEffect(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
    }

    if (chartContainerRef.current) {
      chartInstanceRef.current = echarts.init(chartContainerRef.current);
      updateChart();

      // Responsive resize
      const handleResize = () => {
        chartInstanceRef.current.resize();
      };

      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartInstanceRef.current) {
          chartInstanceRef.current.dispose();
        }
      };
    }
  }, []);

  // Update chart when parameters change
  useEffect(() => {
    updateChart();
  }, [l, m, scale, showWireframe, colorMap, showLinearCombination, harmonicCoeffs, useCartesian, cartesianOrbitals]);

  // Handle parameter changes
  const handleLChange = (event) => {
    const newL = parseInt(event.target.value);
    setL(newL);
    // Ensure m is within valid range for selected l
    if (Math.abs(m) > newL) {
      setM(0);
    }
  };

  const handleMChange = (event) => {
    const newM = parseInt(event.target.value);
    if (Math.abs(newM) <= l) {
      setM(newM);
    }
  };

  // Generate options for m dropdown
  const generateMOptions = () => {
    const options = [];
    for (let i = -l; i <= l; i++) {
      options.push(
        <option key={i} value={i}>
          {i}
        </option>
      );
    }
    return options;
  };

  // Update harmonic coefficient
  const updateHarmonicCoeff = (index, field, value) => {
    const newCoeffs = [...harmonicCoeffs];
    newCoeffs[index] = { ...newCoeffs[index], [field]: parseFloat(value) };
    setHarmonicCoeffs(newCoeffs);
  };

  // Add new harmonic term
  const addHarmonicTerm = () => {
    setHarmonicCoeffs([...harmonicCoeffs, { l: 1, m: 0, coeff: 0.5, phase: 0 }]);
  };

  // Add new Cartesian orbital term
  const addCartesianTerm = () => {
    setCartesianOrbitals([...cartesianOrbitals, { l: 1, name: 'x', label: 'x', coeff: 0.5 }]);
  };

  // Update Cartesian orbital
  const updateCartesianOrbital = (index: number, field: string, value: string) => {
    const newOrbitals = [...cartesianOrbitals];
    if (field === 'l') {
      const newL = parseInt(value);
      const availableOrbitals = getAvailableOrbitals(newL);
      if (availableOrbitals.length > 0) {
        newOrbitals[index] = {
          ...newOrbitals[index],
          l: newL,
          name: availableOrbitals[0].name,
          label: availableOrbitals[0].label
        };
      }
    } else if (field === 'name') {
      const availableOrbitals = getAvailableOrbitals(newOrbitals[index].l);
      const selectedOrbital = availableOrbitals.find(orb => orb.name === value);
      if (selectedOrbital) {
        newOrbitals[index] = {
          ...newOrbitals[index],
          name: selectedOrbital.name,
          label: selectedOrbital.label
        };
      }
    } else if (field === 'coeff') {
      newOrbitals[index] = { ...newOrbitals[index], coeff: parseFloat(value) };
    }
    setCartesianOrbitals(newOrbitals);
  };

  // Remove Cartesian orbital term
  const removeCartesianTerm = (index: number) => {
    if (cartesianOrbitals.length > 1) {
      setCartesianOrbitals(cartesianOrbitals.filter((_, i) => i !== index));
    }
  };

  // Preset linear combinations for spherical harmonics
  const setPreset = (preset: string) => {
    setShowLinearCombination(true);
    switch (preset) {
      case 'px':
        setHarmonicCoeffs([
          { l: 1, m: -1, coeff: 1.0, phase: 0 },
          { l: 1, m: 1, coeff: -1.0, phase: 0 }
        ]);
        break;
      case 'py':
        setHarmonicCoeffs([
          { l: 1, m: -1, coeff: 1.0, phase: 0 },
          { l: 1, m: 1, coeff: 1.0, phase: 0 }
        ]);
        break;
      case 'pz':
        setHarmonicCoeffs([
          { l: 1, m: 0, coeff: 1.0, phase: 0 }
        ]);
        break;
      case 'dz2':
        setHarmonicCoeffs([
          { l: 2, m: 0, coeff: 1.0, phase: 0 }
        ]);
        break;
      case 'dx2y2':
        setHarmonicCoeffs([
          { l: 2, m: -2, coeff: 1.0, phase: 0 },
          { l: 2, m: 2, coeff: 1.0, phase: 0 }
        ]);
        break;
      case 'dxy':
        setHarmonicCoeffs([
          { l: 2, m: -2, coeff: 1.0, phase: 0 },
          { l: 2, m: 2, coeff: -1.0, phase: 0 }
        ]);
        break;
    }
  };

  // Preset linear combinations for Cartesian orbitals
  const setCartesianPreset = (preset: string) => {
    setShowLinearCombination(true);
    switch (preset) {
      case 'px':
        setCartesianOrbitals([
          { l: 1, name: 'x', label: 'x', coeff: 1.0 }
        ]);
        break;
      case 'py':
        setCartesianOrbitals([
          { l: 1, name: 'y', label: 'y', coeff: 1.0 }
        ]);
        break;
      case 'pz':
        setCartesianOrbitals([
          { l: 1, name: 'z', label: 'z', coeff: 1.0 }
        ]);
        break;
      case 'dz2':
        setCartesianOrbitals([
          { l: 2, name: 'zz', label: 'z²', coeff: 1.0 }
        ]);
        break;
      case 'dx2y2':
        setCartesianOrbitals([
          { l: 2, name: 'xx', label: 'x²', coeff: 1.0 },
          { l: 2, name: 'yy', label: 'y²', coeff: -1.0 }
        ]);
        break;
      case 'dxy':
        setCartesianOrbitals([
          { l: 2, name: 'xy', label: 'xy', coeff: 1.0 }
        ]);
        break;
    }
  };

  // Remove harmonic term
  const removeHarmonicTerm = (index) => {
    if (harmonicCoeffs.length > 1) {
      setHarmonicCoeffs(harmonicCoeffs.filter((_, i) => i !== index));
    }
  };

  // Get current title with proper notation
  const getTitle = () => {
    if (useCartesian) {
      if (showLinearCombination) {
        const nonZeroTerms = cartesianOrbitals.filter(orbital => Math.abs(orbital.coeff) > 0.01);
        if (nonZeroTerms.length === 0) return "\\text{Select coefficients to create linear combination}";
        
        // Build the linear combination expression
        let expression = "";
        nonZeroTerms.forEach((term, index) => {
          const coeff = term.coeff;
          const absCoeff = Math.abs(coeff);
          const sign = coeff >= 0 ? "+" : "-";
          
          // Add sign (except for first term if positive)
          if (index > 0 || coeff < 0) {
            expression += sign;
          }
          
          // Add coefficient if it's not 1 or -1, or if it's the only term
          if (absCoeff !== 1 || nonZeroTerms.length === 1) {
            expression += absCoeff.toFixed(1);
          }
          
          // Add the orbital name
          expression += `\\text{${term.label}}`;
        });
        
        return expression;
      } else {
        // Single orbital mode - show as R_l^{orbital}
        const orbital = cartesianOrbitals[0];
        return orbital ? `R_{${orbital.l}}^{\\text{${orbital.label}}}` : "R_2^{z²}";
      }
    } else {
      // Spherical harmonics mode
      const prefix = "Y"; // Y for spherical harmonics
      
      if (showLinearCombination) {
        const nonZeroTerms = harmonicCoeffs.filter(coeff => Math.abs(coeff.coeff) > 0.01);
        if (nonZeroTerms.length === 0) return "\\text{Select coefficients to create linear combination}";
        
        // Build the linear combination expression
        let expression = "";
        nonZeroTerms.forEach((term, index) => {
          const coeff = term.coeff;
          const absCoeff = Math.abs(coeff);
          const sign = coeff >= 0 ? "+" : "-";
          
          // Add sign (except for first term if positive)
          if (index > 0 || coeff < 0) {
            expression += sign;
          }
          
          // Add coefficient if it's not 1 or -1, or if it's the only term
          if (absCoeff !== 1 || nonZeroTerms.length === 1) {
            expression += absCoeff.toFixed(1);
          }
          
          // Add the harmonic term
          expression += `${prefix}_{${term.l}}^{${term.m >= 0 ? term.m : `{${term.m}}`}}`;
        });
        
        return expression;
      }
      return `${prefix}_{${l}}^{${m >= 0 ? m : `{${m}}`}}`;
    }
  };

  // Inline styles matching MolecularDynamics component
  const controlStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    marginBottom: '0.75rem'
  };

  const labelStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    fontWeight: '500' as const
  };

  const valueStyle = {
    fontFamily: 'monospace',
    backgroundColor: '#e9ecef',
    padding: '0.125rem 0.25rem',
    borderRadius: '3px',
    fontSize: '0.875rem',
    minWidth: '3rem',
    textAlign: 'center' as const
  };

  const sliderStyle = {
    appearance: 'none' as const,
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: '#d1d5db',
    outline: 'none'
  };

  const sectionStyle = {
    marginBottom: '1.5rem'
  };

  const sectionTitleStyle = {
    fontSize: '0.875rem',
    fontWeight: '600' as const,
    margin: '0 0 1rem 0',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: '#374151'
  };

  return (
    <div style={{ 
      width: '100vw', 
      minHeight: '100vh', 
      display: 'grid',
      gridTemplateColumns: '75% 25%',
      gap: '1rem',
      padding: '1rem',
      boxSizing: 'border-box'
    }}
    className="spherical-harmonics-container"
    >
      {/* Left side: Visualization */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: '600' }}>
            Spherical Harmonics Visualization
          </h2>
          <div style={{ 
            margin: '0 0 1rem 0', 
            fontSize: '1.25rem', 
            fontWeight: '500',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>Current function:</span>
            <MathFormula math={getTitle()} />
          </div>
          <div
            ref={chartContainerRef}
            style={{
              width: '100%',
              height: '600px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: '#ffffff'
            }}
          />
        </div>
        
        {/* Explanation moved below visualization */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 1rem 0' }}>About Spherical and Solid Harmonics</h3>
          <p style={{ color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
            Spherical harmonics <MathFormula math="Y_l^m(\theta, \phi)" inline={true} /> are special functions defined on the surface of a sphere. 
            Real solid harmonics <MathFormula math="R_l^m(x,y,z)" inline={true} /> are polynomial functions in Cartesian coordinates. 
            Both are important in quantum mechanics for describing atomic orbitals.
          </p>
          
          <p style={{ color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
            These functions are characterized by two quantum numbers:
          </p>
          
          <ul style={{ margin: '0 0 1rem 1.5rem', color: '#374151', lineHeight: '1.6' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Angular momentum quantum number (l):</strong> Determines the overall shape and number of nodal planes
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Magnetic quantum number (m):</strong> Controls the orientation and number of nodal cones, where <MathFormula math="|m| \leq l" inline={true} />
            </li>
          </ul>

          {showLinearCombination && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#dbeafe',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#1e40af'
            }}>
              <strong>Linear Combination Mode:</strong> In this mode, you can create superpositions of different spherical harmonics. 
              This is particularly useful for understanding atomic orbitals, which are often linear combinations of pure spherical harmonics.
              For example, the familiar p<sub>x</sub>, p<sub>y</sub>, and p<sub>z</sub> orbitals are combinations of Y₁⁻¹, Y₁⁰, and Y₁¹.
            </div>
          )}

          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#dbeafe',
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: '#1e40af'
          }}>
            <strong>Spherical vs Cartesian:</strong> Spherical harmonics are expressed in spherical coordinates (θ,φ), 
            while real solid harmonics are polynomials in Cartesian coordinates (x,y,z). Cartesian forms are often 
            more intuitive for visualizing atomic orbitals like p<sub>x</sub>, p<sub>y</sub>, d<sub>xy</sub>, etc.
          </div>

          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#dbeafe',
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: '#1e40af'
          }}>
            <strong>Visualization:</strong> The surface shape represents the amplitude showing the probability density distribution. 
            Colors indicate the distance from the origin (orbital amplitude). Try different color maps to enhance visualization.
          </div>
        </div>
      </div>
      
      {/* Right side: Controls */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #e9ecef',
        height: 'fit-content'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
          Visualization Controls
        </h3>
        
        {/* Quantum Numbers / Orbital Selection */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>{useCartesian ? 'Orbital Selection' : 'Quantum Numbers'}</h4>
          
          {useCartesian ? (
            // Cartesian orbital selection
            <>
              <div style={controlStyle}>
                <div style={labelStyle}>
                  <span>Angular Momentum (l):</span>
                  <span style={valueStyle}>{cartesianOrbitals[0]?.l || 2}</span>
                </div>
                <select
                  value={cartesianOrbitals[0]?.l || 2}
                  onChange={(e) => {
                    const newL = parseInt(e.target.value);
                    const availableOrbitals = getAvailableOrbitals(newL);
                    if (availableOrbitals.length > 0) {
                      setCartesianOrbitals([{
                        l: newL,
                        name: availableOrbitals[0].name,
                        label: availableOrbitals[0].label,
                        coeff: 1.0
                      }]);
                    }
                  }}
                  style={{
                    padding: '0.375rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    fontSize: '0.875rem',
                    width: '100%'
                  }}
                >
                  {[0, 1, 2, 3, 4].map(value => (
                    <option key={value} value={value}>
                      {value} ({['s', 'p', 'd', 'f', 'g'][value]})
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={controlStyle}>
                <div style={labelStyle}>
                  <span>Orbital Type:</span>
                  <span style={valueStyle}>{cartesianOrbitals[0]?.label || 'z²'}</span>
                </div>
                <select
                  value={cartesianOrbitals[0]?.name || 'zz'}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const availableOrbitals = getAvailableOrbitals(cartesianOrbitals[0]?.l || 2);
                    const selectedOrbital = availableOrbitals.find(orb => orb.name === selectedName);
                    if (selectedOrbital) {
                      setCartesianOrbitals([{
                        l: cartesianOrbitals[0]?.l || 2,
                        name: selectedOrbital.name,
                        label: selectedOrbital.label,
                        coeff: 1.0
                      }]);
                    }
                  }}
                  style={{
                    padding: '0.375rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    fontSize: '0.875rem',
                    width: '100%'
                  }}
                >
                  {getAvailableOrbitals(cartesianOrbitals[0]?.l || 2).map(orbital => (
                    <option key={orbital.name} value={orbital.name}>
                      {orbital.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            // Spherical harmonic quantum numbers
            <>
              <div style={controlStyle}>
                <div style={labelStyle}>
                  <span>Angular Momentum (l):</span>
                  <span style={valueStyle}>{l}</span>
                </div>
                <select
                  value={l}
                  onChange={handleLChange}
                  style={{
                    padding: '0.375rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    fontSize: '0.875rem',
                    width: '100%'
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div style={controlStyle}>
                <div style={labelStyle}>
                  <span>Magnetic Number (m):</span>
                  <span style={valueStyle}>{m}</span>
                </div>
                <select
                  value={m}
                  onChange={handleMChange}
                  style={{
                    padding: '0.375rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    fontSize: '0.875rem',
                    width: '100%'
                  }}
                >
                  {generateMOptions()}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Visualization Settings */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Visualization Settings</h4>

          <div style={controlStyle}>
            <div style={labelStyle}>
              <span>Color Map:</span>
            </div>
            <select
              value={colorMap}
              onChange={(e) => setColorMap(e.target.value)}
              style={{
                padding: '0.375rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                fontSize: '0.875rem',
                width: '100%'
              }}
            >
              <option value="blue_white_orange">Blue-White-Orange</option>
              <option value="viridis">Viridis</option>
              <option value="plasma">Plasma</option>
              <option value="cool_warm">Cool-Warm</option>
              <option value="rainbow">Rainbow</option>
            </select>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            <input
              type="checkbox"
              id="wireframe"
              checked={showWireframe}
              onChange={() => setShowWireframe(!showWireframe)}
            />
            <label htmlFor="wireframe" style={{ fontSize: '0.875rem', color: '#374151' }}>
              Show wireframe
            </label>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            <input
              type="checkbox"
              id="linearCombination"
              checked={showLinearCombination}
              onChange={() => setShowLinearCombination(!showLinearCombination)}
            />
            <label htmlFor="linearCombination" style={{ fontSize: '0.875rem', color: '#374151' }}>
              Linear Combination Mode
            </label>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            <input
              type="checkbox"
              id="cartesian"
              checked={useCartesian}
              onChange={() => setUseCartesian(!useCartesian)}
            />
            <label htmlFor="cartesian" style={{ fontSize: '0.875rem', color: '#374151' }}>
              Use Cartesian (Real Solid Harmonics)
            </label>
          </div>
        </div>

        {/* Linear Combination Controls */}
        {showLinearCombination && (
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Linear Combination Terms</h4>
            
            {/* Orbital Presets */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: '600' }}>
                Common Orbital Shapes:
              </div>
              {useCartesian ? (
                // Cartesian presets
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    <button onClick={() => setCartesianPreset('px')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>p<sub>x</sub></button>
                    <button onClick={() => setCartesianPreset('py')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>p<sub>y</sub></button>
                    <button onClick={() => setCartesianPreset('pz')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>p<sub>z</sub></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem' }}>
                    <button onClick={() => setCartesianPreset('dz2')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>d<sub>z²</sub></button>
                    <button onClick={() => setCartesianPreset('dx2y2')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>d<sub>x²-y²</sub></button>
                    <button onClick={() => setCartesianPreset('dxy')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>d<sub>xy</sub></button>
                  </div>
                </>
              ) : (
                // Spherical presets
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    <button onClick={() => setPreset('px')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>p<sub>x</sub></button>
                    <button onClick={() => setPreset('py')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>p<sub>y</sub></button>
                    <button onClick={() => setPreset('pz')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>p<sub>z</sub></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem' }}>
                    <button onClick={() => setPreset('dz2')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>d<sub>z²</sub></button>
                    <button onClick={() => setPreset('dx2y2')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>d<sub>x²-y²</sub></button>
                    <button onClick={() => setPreset('dxy')} style={{ padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb', cursor: 'pointer' }}>d<sub>xy</sub></button>
                  </div>
                </>
              )}
            </div>
            
            {useCartesian ? (
              // Cartesian orbital terms
              cartesianOrbitals.map((orbital, index) => (
                <div key={index} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem',
                  backgroundColor: '#ffffff'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '0.875rem'
                  }}>
                    <span>Term {index + 1}</span>
                    {cartesianOrbitals.length > 1 && (
                      <button 
                        onClick={() => removeCartesianTerm(index)}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '14px',
                          lineHeight: '1'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>l:</label>
                      <select 
                        value={orbital.l} 
                        onChange={(e) => updateCartesianOrbital(index, 'l', e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          width: '100%'
                        }}
                      >
                        {[0, 1, 2, 3, 4].map(value => (
                          <option key={value} value={value}>{value} ({['s', 'p', 'd', 'f', 'g'][value]})</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Orbital:</label>
                      <select 
                        value={orbital.name} 
                        onChange={(e) => updateCartesianOrbital(index, 'name', e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          width: '100%'
                        }}
                      >
                        {getAvailableOrbitals(orbital.l).map(orb => (
                          <option key={orb.name} value={orb.name}>{orb.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div style={controlStyle}>
                    <div style={labelStyle}>
                      <span>Coefficient:</span>
                      <span style={valueStyle}>{orbital.coeff.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={orbital.coeff}
                      onChange={(e) => updateCartesianOrbital(index, 'coeff', e.target.value)}
                      style={sliderStyle}
                    />
                  </div>
                </div>
              ))
            ) : (
              // Spherical harmonic terms
              harmonicCoeffs.map((coeff, index) => (
                <div key={index} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem',
                  backgroundColor: '#ffffff'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '0.875rem'
                  }}>
                    <span>Term {index + 1}</span>
                    {harmonicCoeffs.length > 1 && (
                      <button 
                        onClick={() => removeHarmonicTerm(index)}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '14px',
                          lineHeight: '1'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>l:</label>
                      <select 
                        value={coeff.l} 
                        onChange={(e) => updateHarmonicCoeff(index, 'l', e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          width: '100%'
                        }}
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(value => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>m:</label>
                      <select 
                        value={coeff.m} 
                        onChange={(e) => updateHarmonicCoeff(index, 'm', e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          width: '100%'
                        }}
                      >
                        {Array.from({length: 2 * coeff.l + 1}, (_, i) => i - coeff.l).map(value => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div style={controlStyle}>
                    <div style={labelStyle}>
                      <span>Coefficient:</span>
                      <span style={valueStyle}>{coeff.coeff.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={coeff.coeff}
                      onChange={(e) => updateHarmonicCoeff(index, 'coeff', e.target.value)}
                      style={sliderStyle}
                    />
                  </div>
                  
                  <div style={controlStyle}>
                    <div style={labelStyle}>
                      <span>Phase:</span>
                      <span style={valueStyle}>{(coeff.phase / Math.PI).toFixed(1)}π</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={2 * Math.PI}
                      step="0.1"
                      value={coeff.phase}
                      onChange={(e) => updateHarmonicCoeff(index, 'phase', e.target.value)}
                      style={sliderStyle}
                    />
                  </div>
                </div>
              ))
            )}
            
            <button 
              onClick={useCartesian ? addCartesianTerm : addHarmonicTerm}
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                fontWeight: '500',
                cursor: 'pointer',
                width: '100%',
                fontSize: '0.875rem'
              }}
            >
              Add Term
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SphericalHarmonicsViewer;