import React, { useEffect, useState, useRef } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import MathFormula from './MathFormula';
import styles from './QMVisualization.module.css';

const SphericalHarmonicsViewer = () => {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [l, setL] = useState(2);
  const [m, setM] = useState(0);
  const [scale, setScale] = useState(1);
  const [showWireframe, setShowWireframe] = useState(false);
  const [colorMode, setColorMode] = useState("amplitude"); // "amplitude" or "phase"

  // Associated Legendre Polynomial implementation
  const factorialCache = {};
  const factorial = (n) => {
    if (n <= 1) return 1;
    if (factorialCache[n]) return factorialCache[n];
    factorialCache[n] = n * factorial(n - 1);
    return factorialCache[n];
  };

  const doubleFactorial = (n) => {
    if (n <= 0) return 1;
    let result = n;
    for (let i = n - 2; i > 0; i -= 2) {
      result *= i;
    }
    return result;
  };

  const legendreP = (l, m, x) => {
    // P_l^m(x) for associated Legendre polynomial
    // Simple cases
    if (l === 0 && m === 0) return 1;
    if (l === 1 && m === 0) return x;
    if (l === 1 && m === 1) return -Math.sqrt(1 - x * x);
    if (l === 1 && m === -1) return Math.sqrt(1 - x * x) / 2;

    // For m > l, return 0
    if (Math.abs(m) > l) return 0;

    // Calculate using recurrence relation for higher orders
    // This is a simplified implementation
    if (m === 0) {
      // Standard Legendre polynomials
      if (l === 2) return (3 * x * x - 1) / 2;
      if (l === 3) return (5 * x * x * x - 3 * x) / 2;
      if (l === 4) return (35 * Math.pow(x, 4) - 30 * x * x + 3) / 8;
    } else if (m > 0) {
      // Associated Legendre polynomials with positive m
      const pmm = Math.pow(-1, m) * doubleFactorial(2 * m - 1) * Math.pow(1 - x * x, m / 2);
      if (l === m) return pmm;

      const pmm1 = x * (2 * m + 1) * pmm;
      if (l === m + 1) return pmm1;

      // Use recurrence formula for l > m + 1
      let pll = 0;
      let pll1 = pmm1;
      let pll2 = pmm;

      for (let i = m + 2; i <= l; i++) {
        pll = ((2 * i - 1) * x * pll1 - (i + m - 1) * pll2) / (i - m);
        pll2 = pll1;
        pll1 = pll;
      }

      return pll;
    } else {
      // For negative m
      const posM = Math.abs(m);
      const factor = Math.pow(-1, posM) * factorial(l - posM) / factorial(l + posM);
      return factor * legendreP(l, posM, x);
    }

    // Fallback (not complete implementation)
    return Math.pow(x, l);
  };

  // Spherical Harmonic Implementation
  const sphericalHarmonic = (l, m, theta, phi) => {
    const x = Math.cos(theta);

    // Normalization factor
    const norm = Math.sqrt((2 * l + 1) * factorial(l - Math.abs(m)) /
      (4 * Math.PI * factorial(l + Math.abs(m))));

    const legendre = legendreP(l, Math.abs(m), x);

    // Complex exponential part (e^(i*m*phi))
    // For real spherical harmonics:
    if (m > 0) {
      return norm * legendre * Math.cos(m * phi) * Math.sqrt(2);
    } else if (m < 0) {
      return norm * legendre * Math.sin(Math.abs(m) * phi) * Math.sqrt(2);
    } else {
      return norm * legendre;
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
        dimension: 2,
        min: -0.5,
        max: 0.5,
        inRange: {
          color: [
            '#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8',
            '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'
          ]
        }
      },
      xAxis3D: {
        min: -axisMax,
        max: axisMax,
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false
        },
        splitLine: {
          show: false
        }
      },
      yAxis3D: {
        min: -axisMax,
        max: axisMax,
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false
        },
        splitLine: {
          show: false
        }
      },
      zAxis3D: {
        min: -axisMax,
        max: axisMax,
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false
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
          distance: 150
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
            intensity: 2,
            shadow: true
          },
          ambient: {
            intensity: 0.3
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
              step: Math.PI / 100
            },
            v: {
              min: 0,
              max: 2 * Math.PI + 0.01,
              step: Math.PI / 100
            },
            x: function(theta, phi) {
              const value = sphericalHarmonic(l, m, theta, phi);
              const r = colorMode === "amplitude" ? Math.abs(value) * scale : scale;
              return r * Math.sin(theta) * Math.cos(phi);
            },
            y: function(theta, phi) {
              const value = sphericalHarmonic(l, m, theta, phi);
              const r = colorMode === "amplitude" ? Math.abs(value) * scale : scale;
              return r * Math.sin(theta) * Math.sin(phi);
            },
            z: function(theta, phi) {
              const value = sphericalHarmonic(l, m, theta, phi);
              const r = colorMode === "amplitude" ? Math.abs(value) * scale : scale;
              return r * Math.cos(theta);
            }
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
  }, [l, m, scale, showWireframe, colorMode]);

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

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        Spherical harmonic <MathFormula math={`Y_${l}^{{${m}}}`} />
      </h2>

      <div
        ref={chartContainerRef}
        className={styles.canvasContainer}
        style={{ minHeight: '500px' }}
      />
      <div className={styles.flexContainer}>



        <div className={styles.controlGroup}>
          <h3 className={styles.controlGroupTitle}>Visualization Options</h3>

          <div className={styles.controlOption}>
            <label htmlFor="lNumber" className={styles.controlOptionLabel}>
              Angular Momentum (l):
            </label>
            <select
              value={l}
              id="lNumber"
              onChange={handleLChange}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controlOption}>
            <label htmlFor="magneticNumber" className={styles.controlOptionLabel}>
              Magnetic Quantum Number (m):
            </label>
            <select
              value={m}
              id="magneticNumber"
              onChange={handleMChange}
            >
              {generateMOptions()}
            </select>
          </div>

          <div className={styles.controlOption}>
            <label htmlFor="scale" className={styles.controlOptionLabel}>
              Scale:
            </label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={scale}
              id="scale"
              onChange={(e) => setScale(parseFloat(e.target.value))}
            />
            <div className="text-center">{scale.toFixed(1)}</div>
          </div>

          <div className={styles.controlOption}>
            <input
              type="checkbox"
              id="wireframe"
              checked={showWireframe}
              onChange={() => setShowWireframe(!showWireframe)}
            />
            <label htmlFor="wireframe" className={styles.controlOptionLabel}>
              Show wireframe
            </label>

          </div>

          <div className={styles.controlOption}>
            <label htmlFor="colormode" className={styles.controlOptionLabel}>
              Color Mode:
            </label>
            <select
              id="colormode"
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value)}
            >
              <option value="amplitude">Amplitude</option>
              <option value="phase">Phase (Sphere)</option>
            </select>
          </div>
        </div>
      </div>


      <div className={styles.explanationContainer}>
        <h3 className={styles.explanationTitle}>About Spherical Harmonics</h3>
        <p className={styles.explanationText}>
          Spherical harmonics are special functions defined on the surface of a sphere. They are important
          in many theoretical and practical applications, particularly in quantum mechanics where they
          describe the angular part of the wave function for an electron in a central field.
          The function <MathFormula math="Y_l^m(\theta\phi)" inline={true} /> is characterized by two
          integers:
          <ul>
            <li> The angular quantum number <MathFormula math="l" inline={true} /> </li>
            <li> The magnetic quantum number <MathFormula math="m\ (m \le l)" inline={true} /> </li>
          </ul>
        </p>
      </div>
    </div >
  );
};

export default SphericalHarmonicsViewer;
