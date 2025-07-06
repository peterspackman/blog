import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as NGL from 'ngl';

interface WaterMolecule {
  O: [number, number, number];
  H1: [number, number, number];
  H2: [number, number, number];
}

const WaterDimerEnergy: React.FC = () => {
  // Parameters from TIP3P-CHARMM water model - charge neutrality enforced
  const [qH, setQH] = useState(0.417);   // Hydrogen charge (e) - TIP3P-CHARMM
  const qO = -2 * qH; // Oxygen charge (automatically set for neutrality)
  const [epsilonO, setEpsilonO] = useState(0.636); // LJ epsilon for O (kJ/mol) - TIP3P-CHARMM (0.1521 kcal/mol)
  const [sigmaO, setSigmaO] = useState(3.1507);    // LJ sigma for O (Angstrom) - TIP3P-CHARMM
  const [epsilonH, setEpsilonH] = useState(0.0157); // LJ epsilon for H (kJ/mol) - typical value
  const [sigmaH, setSigmaH] = useState(2.649);     // LJ sigma for H (Angstrom) - typical value
  const [separation, setSeparation] = useState(1.0); // Start with scale factor 1.0 (water_100.xyz)
  
  // 3D viewer state
  const viewerRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<any>(null);
  const [currentStructure, setCurrentStructure] = useState<any>(null);

  // Constants
  const k_e = 1389.35; // Coulomb constant in kJ*Angstrom/mol/e^2
  
  // Water geometry from actual water_dimer.xyz file
  const water1: WaterMolecule = {
    O: [0, 0, 0],
    H1: [-0.757, 0.586, 0],
    H2: [0.757, 0.586, 0],
  };

  // Map scale factors to available files
  const availableGeometries = [
    { scale: 0.90, file: 'water_090.xyz' },
    { scale: 0.95, file: 'water_095.xyz' },
    { scale: 1.00, file: 'water_100.xyz' },
    { scale: 1.05, file: 'water_105.xyz' },
    { scale: 1.10, file: 'water_110.xyz' },
    { scale: 1.25, file: 'water_125.xyz' },
    { scale: 1.50, file: 'water_150.xyz' },
    { scale: 2.00, file: 'water_200.xyz' },
  ];

  // MP2/cc-pVTZ CP reference data (converted from kcal/mol to kJ/mol)
  const referenceData = [
    { scale: 0.90, energy: -4.57 * 4.184 }, // -19.12 kJ/mol
    { scale: 0.95, energy: -4.88 * 4.184 }, // -20.42 kJ/mol
    { scale: 1.00, energy: -4.89 * 4.184 }, // -20.46 kJ/mol
    { scale: 1.05, energy: -4.72 * 4.184 }, // -19.75 kJ/mol
    { scale: 1.10, energy: -4.45 * 4.184 }, // -18.62 kJ/mol
    { scale: 1.25, energy: -3.46 * 4.184 }, // -14.48 kJ/mol
    { scale: 1.50, energy: -2.11 * 4.184 }, // -8.83 kJ/mol
    { scale: 2.00, energy: -0.87 * 4.184 }, // -3.64 kJ/mol
  ];

  // Store loaded geometries
  const [loadedGeometries, setLoadedGeometries] = useState<Map<string, Array<{pos: number[], type: string}>>>(new Map());
  
  // Load all geometries once at startup
  useEffect(() => {
    const loadAllGeometries = async () => {
      const geometriesMap = new Map();
      
      for (const geom of availableGeometries) {
        try {
          const response = await fetch(`/xyz/${geom.file}`);
          const xyzContent = await response.text();
          const lines = xyzContent.trim().split('\n');
          const atomCount = parseInt(lines[0]);
          
          const atoms = [];
          for (let i = 0; i < atomCount; i++) {
            const line = lines[i + 2].trim();
            const parts = line.split(/\s+/);
            const element = parts[0];
            const pos = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
            atoms.push({ pos, type: element });
          }
          
          geometriesMap.set(geom.file, atoms);
          console.log(`Loaded geometry ${geom.file} with ${atoms.length} atoms`);
        } catch (error) {
          console.error(`Error loading geometry ${geom.file}:`, error);
        }
      }
      
      setLoadedGeometries(geometriesMap);
    };
    
    loadAllGeometries();
  }, []);
  
  // Calculate energy and breakdown from loaded geometry coordinates
  const calculateEnergyFromGeometry = (atoms: Array<{pos: number[], type: string}>): {total: number, coulomb: number, lj: number} => {
    if (atoms.length !== 6) return {total: 0, coulomb: 0, lj: 0};
    
    // First 3 atoms are water 1, last 3 are water 2
    const water1Atoms = atoms.slice(0, 3).map(atom => ({
      ...atom,
      q: atom.type === 'O' ? qO : qH
    }));
    const water2Atoms = atoms.slice(3, 6).map(atom => ({
      ...atom,
      q: atom.type === 'O' ? qO : qH
    }));
    
    let coulombTotal = 0;
    let ljTotal = 0;
    
    for (const atom1 of water1Atoms) {
      for (const atom2 of water2Atoms) {
        const dx = atom2.pos[0] - atom1.pos[0];
        const dy = atom2.pos[1] - atom1.pos[1];
        const dz = atom2.pos[2] - atom1.pos[2];
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Coulombic interaction
        const coulomb = k_e * atom1.q * atom2.q / r;
        coulombTotal += coulomb;
        
        // Lennard-Jones interactions
        let epsilon, sigma;
        if (atom1.type === 'O' && atom2.type === 'O') {
          epsilon = epsilonO;
          sigma = sigmaO;
        } else if (atom1.type === 'H' && atom2.type === 'H') {
          epsilon = epsilonH;
          sigma = sigmaH;
        } else {
          epsilon = Math.sqrt(epsilonO * epsilonH);
          sigma = (sigmaO + sigmaH) / 2;
        }
        
        if (epsilon > 0) {
          const sr6 = Math.pow(sigma / r, 6);
          const lj = 4 * epsilon * (sr6 * sr6 - sr6);
          ljTotal += lj;
        }
      }
    }
    
    return {
      total: coulombTotal + ljTotal,
      coulomb: coulombTotal,
      lj: ljTotal
    };
  };
  
  // Generate discrete data points from loaded geometries
  const discretePoints = useMemo(() => {
    if (loadedGeometries.size === 0) return [];
    
    const points = [];
    for (const geom of availableGeometries) {
      const atoms = loadedGeometries.get(geom.file);
      if (atoms) {
        const energyBreakdown = calculateEnergyFromGeometry(atoms);
        points.push({
          x: geom.scale,
          y: energyBreakdown.total,
          scale: geom.scale,
          file: geom.file,
          index: points.length,
          coulomb: energyBreakdown.coulomb,
          lj: energyBreakdown.lj
        });
      }
    }
    return points;
  }, [loadedGeometries, qH, epsilonO, sigmaO, epsilonH, sigmaH]);
  
  // Find the closest available geometry for current scale and snap to it
  const getCurrentGeometry = (currentScale: number) => {
    return availableGeometries.reduce((prev, curr) => 
      Math.abs(curr.scale - currentScale) < Math.abs(prev.scale - currentScale) 
        ? curr : prev
    );
  };
  
  // Get the current geometry based on separation
  const currentGeometry = getCurrentGeometry(separation);
  const currentPoint = discretePoints.find(p => p.scale === currentGeometry.scale);
  const currentEnergy = currentPoint ? currentPoint.y : 0;

  // Handle point click
  const handlePointClick = (scale: number) => {
    setSeparation(scale);
  };

  // Initialize NGL Viewer
  useEffect(() => {
    if (!viewerRef.current) return;

    try {
      const stageObj = new NGL.Stage(viewerRef.current, {
        backgroundColor: 'white',
        quality: 'medium',
      });

      const handleResize = () => {
        stageObj.handleResize();
      };

      window.addEventListener('resize', handleResize);
      setStage(stageObj);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (stageObj) stageObj.dispose();
      };
    } catch (error) {
      console.error('Error initializing NGL Stage:', error);
    }
  }, []);

  // Convert XYZ content to PDB format for NGL
  const convertXYZToPDB = (xyzContent: string): string => {
    const lines = xyzContent.trim().split('\n');
    const atomCount = parseInt(lines[0]);
    const title = lines[1] || 'Water dimer';
    
    let pdbContent = '';
    pdbContent += `HEADER    WATER DIMER                             ${new Date().toISOString().slice(0, 10)}\n`;
    pdbContent += `TITLE     ${title}\n`;
    
    for (let i = 0; i < atomCount; i++) {
      const line = lines[i + 2].trim();
      const parts = line.split(/\s+/);
      const element = parts[0];
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      
      const atomNum = (i + 1).toString().padStart(5);
      const atomName = element.padEnd(4);
      const resName = 'WAT'.padEnd(3);
      const chainId = 'A';
      const resNum = (Math.floor(i / 3) + 1).toString().padStart(4);
      
      pdbContent += `ATOM  ${atomNum} ${atomName} ${resName} ${chainId}${resNum}    `;
      pdbContent += `${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}`;
      pdbContent += `  1.00 20.00           ${element.padStart(2)}\n`;
    }
    
    pdbContent += 'END\n';
    return pdbContent;
  };

  // Update 3D structure when separation changes
  useEffect(() => {
    if (!stage) return;
    
    // Clear previous structure
    if (currentStructure) {
      stage.removeComponent(currentStructure);
      setCurrentStructure(null);
    }
    
    // Load structure from static files
    const loadStructure = async () => {
      try {
        const geometryFile = currentGeometry.file;
        const url = `/xyz/${geometryFile}`;
        console.log('Loading XYZ file:', url);
        
        // Fetch the XYZ file content
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        const xyzContent = await response.text();
        
        // Convert XYZ to PDB format
        const pdbContent = convertXYZToPDB(xyzContent);
        
        // Create a File object with PDB content
        const blob = new Blob([pdbContent], { type: 'text/plain' });
        const file = new File([blob], 'water_dimer.pdb', { type: 'text/plain' });
        
        const structureComponent = await stage.loadFile(file, {
          defaultRepresentation: false
        });
        
        // Add ball+stick representation
        structureComponent.addRepresentation('ball+stick', {
          colorScheme: 'element',
          radius: 0.6,
          bondScale: 0.4,
          multipleBond: false,
          bondSpacing: 0.75
        });
        
        // Add labels for oxygen atoms
        structureComponent.addRepresentation('label', {
          sele: '@O',
          color: 'red',
          labelType: 'atomname',
          labelSize: 1.5,
          fontWeight: 'bold'
        });
        
        // Try to add distance measurement between oxygens
        try {
          structureComponent.addRepresentation('distance', {
            atomPair: [[0], [3]], // First and fourth atoms (oxygens)
            color: 'black',
            labelSize: 1.5,
            labelColor: 'black',
            fontWeight: 'bold'
          });
        } catch (distanceError) {
          console.log('Distance measurement not available:', distanceError);
        }
        
        setCurrentStructure(structureComponent);
        
        // Auto view with closer zoom
        stage.autoView();
        
        // Set closer camera position after autoView
        setTimeout(() => {
          const viewer = stage.viewer;
          const camera = viewer.camera;
          camera.position.z = camera.position.z * 0.6; // Move camera closer
          viewer.requestRender();
        }, 100);
      } catch (error) {
        console.error('Error loading XYZ structure:', error);
      }
    };
    
    loadStructure();
  }, [stage, currentGeometry.file]);

  return (
    <div className="margin-vert--lg">
      <h3>Interactive Water Dimer Energy Calculator</h3>
      
      {/* Main Plot Area with 3D Viewer in Top Right Corner */}
      <div style={{ position: 'relative', width: '100%', height: '500px', marginBottom: '20px' }}>
        {/* Central Plot */}
        <div style={{
          width: '100%',
          height: '100%',
          border: '2px solid #ddd',
          borderRadius: '8px',
          backgroundColor: 'white',
          padding: '20px'
        }}>
          {/* SVG Plot Implementation */}
          <svg width="100%" height="100%" viewBox="0 0 800 460">
            {/* Plot area */}
            <g transform="translate(80, 40)">
              {/* Axes */}
              <line x1={0} y1={0} x2={0} y2={360} stroke="currentColor" strokeWidth={2} />
              <line x1={0} y1={360} x2={640} y2={360} stroke="currentColor" strokeWidth={2} />
              
              {/* Y axis labels */}
              {[-50, -25, 0, 25, 50].map(value => {
                const y = 360 - ((value + 50) / 100) * 360;
                return (
                  <g key={value}>
                    <line x1={-5} y1={y} x2={0} y2={y} stroke="currentColor" />
                    <text x={-10} y={y + 5} textAnchor="end" fontSize={14} fill="currentColor">
                      {value}
                    </text>
                  </g>
                );
              })}
              
              {/* X axis labels */}
              {[0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0].map(value => {
                const x = ((value - 0.8) / 1.2) * 640;
                return (
                  <g key={value}>
                    <line x1={x} y1={360} x2={x} y2={365} stroke="currentColor" />
                    <text x={x} y={380} textAnchor="middle" fontSize={14} fill="currentColor">
                      {value.toFixed(1)}
                    </text>
                  </g>
                );
              })}
              
              {/* Axis labels */}
              <text x={320} y={410} textAnchor="middle" fontSize={16} fill="currentColor">
                Scale Factor
              </text>
              <text x={-50} y={180} textAnchor="middle" fontSize={16} fill="currentColor" transform={`rotate(-90, -50, 180)`}>
                Energy (kJ/mol)
              </text>
              
              {/* Zero line at actual zero */}
              <line 
                x1={0} 
                y1={180} 
                x2={640} 
                y2={180} 
                stroke="currentColor" 
                strokeWidth={1} 
                strokeDasharray="5,5" 
                opacity={0.5}
              />
              
              {/* Smooth curve interpolation */}
              {discretePoints.length > 1 && (
                <path 
                  d={discretePoints.map((point, i) => {
                    const x = ((point.x - 0.8) / 1.2) * 640;
                    const y = 360 - ((point.y + 50) / 100) * 360;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none" 
                  stroke="var(--ifm-color-primary)" 
                  strokeWidth={2} 
                  opacity={0.7}
                />
              )}
              
              {/* Reference data points (MP2/cc-pVTZ CP) */}
              {referenceData.map((refPoint, i) => {
                // Only show reference points that have corresponding calculated points
                const hasCalculatedPoint = discretePoints.some(p => Math.abs(p.x - refPoint.scale) < 0.01);
                if (!hasCalculatedPoint) return null;
                
                const x = ((refPoint.scale - 0.8) / 1.2) * 640;
                const y = 360 - ((refPoint.energy + 50) / 100) * 360;
                
                return (
                  <g key={`ref-${i}`}>
                    <rect 
                      x={x - 4} 
                      y={y - 4} 
                      width={8} 
                      height={8} 
                      fill="black"
                      stroke="black"
                      strokeWidth={1}
                      opacity={0.8}
                    />
                  </g>
                );
              })}
              
              {/* Calculated data points */}
              {discretePoints.map((point, i) => {
                const x = ((point.x - 0.8) / 1.2) * 640;
                const y = 360 - ((point.y + 50) / 100) * 360;
                const isSelected = Math.abs(point.x - currentGeometry.scale) < 0.01;
                
                return (
                  <g key={i}>
                    <circle 
                      cx={x} 
                      cy={y} 
                      r={isSelected ? 10 : 8} 
                      fill={isSelected ? "rgba(25, 118, 210, 0.8)" : "rgba(173, 216, 230, 0.6)"}
                      stroke={isSelected ? "var(--ifm-color-primary-dark)" : "var(--ifm-color-primary)"}
                      strokeWidth={isSelected ? 3 : 2}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handlePointClick(point.x)}
                    />
                    
                    {/* Scale label */}
                    <text 
                      x={x} 
                      y={y - 15} 
                      textAnchor="middle" 
                      fontSize={10} 
                      fill="currentColor"
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handlePointClick(point.x)}
                    >
                      {point.x.toFixed(2)}
                    </text>
                    
                    {/* Energy label for selected point */}
                    {isSelected && (
                      <text 
                        x={x} 
                        y={y + 25} 
                        textAnchor="middle" 
                        fontSize={10} 
                        fill="var(--ifm-color-primary-dark)"
                        fontWeight="bold"
                      >
                        {point.y.toFixed(1)} kJ/mol
                      </text>
                    )}
                  </g>
                );
              })}
              
              {/* Legend */}
              <g transform="translate(500, 50)">
                <rect x="0" y="0" width="120" height="60" fill="white" stroke="currentColor" strokeWidth="1" opacity="0.9" rx="4"/>
                <text x="60" y="15" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">
                  Data Sources
                </text>
                
                {/* Reference */}
                <rect x="11" y="26" width="8" height="8" fill="black" stroke="black" strokeWidth="1" opacity="0.8"/>
                <text x="25" y="35" fontSize="10" fill="currentColor">Reference (QM)</text>
                
                {/* TIP3P Calculated */}
                <circle cx="15" cy="45" r="8" fill="rgba(173, 216, 230, 0.6)" stroke="var(--ifm-color-primary)" strokeWidth="2"/>
                <text x="25" y="50" fontSize="10" fill="currentColor">TIP3P Model</text>
              </g>
            </g>
          </svg>
        </div>
        
        {/* 3D Viewer in Top Right Corner */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '300px',
          height: '200px',
          border: '2px solid #333',
          borderRadius: '8px',
          backgroundColor: 'white',
          zIndex: 10
        }}>
          <div
            ref={viewerRef}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '6px',
              backgroundColor: '#f8f9fa'
            }}
          />
        </div>
      </div>
      
      {/* Compact Controls and Info Row */}
      <div className="row">
        {/* Parameters */}
        <div className="col col--6">
          <div className="card" style={{ fontSize: '0.9em' }}>
            <div className="card__header" style={{ padding: '8px 16px' }}>
              <h6 style={{ margin: 0 }}>Parameters</h6>
            </div>
            <div className="card__body" style={{ padding: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.8em' }}>
                {/* Charges Column */}
                <div>
                  <h6 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>Charges</h6>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.8em', display: 'block' }}>
                      q(H): <strong>{qH.toFixed(3)}</strong> e
                    </label>
                    <input
                      type="range"
                      min="0.35"
                      max="0.5"
                      step="0.01"
                      value={qH}
                      onChange={(e) => setQH(parseFloat(e.target.value))}
                      style={{ width: '100%', height: '18px' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.7em', color: '#666' }}>q(O) = {qO.toFixed(3)} e</div>
                </div>
                
                {/* O-O Parameters */}
                <div>
                  <h6 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>O-O Parameters</h6>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.8em', display: 'block' }}>
                      ε: <strong>{epsilonO.toFixed(3)}</strong> kJ/mol
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="0.8"
                      step="0.01"
                      value={epsilonO}
                      onChange={(e) => setEpsilonO(parseFloat(e.target.value))}
                      style={{ width: '100%', height: '18px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8em', display: 'block' }}>
                      σ: <strong>{sigmaO.toFixed(3)}</strong> Å
                    </label>
                    <input
                      type="range"
                      min="3.0"
                      max="3.4"
                      step="0.01"
                      value={sigmaO}
                      onChange={(e) => setSigmaO(parseFloat(e.target.value))}
                      style={{ width: '100%', height: '18px' }}
                    />
                  </div>
                </div>
                
                {/* H-H Parameters */}
                <div>
                  <h6 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>H-H Parameters</h6>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.8em', display: 'block' }}>
                      ε: <strong>{epsilonH.toFixed(4)}</strong> kJ/mol
                    </label>
                    <input
                      type="range"
                      min="0.001"
                      max="0.05"
                      step="0.001"
                      value={epsilonH}
                      onChange={(e) => setEpsilonH(parseFloat(e.target.value))}
                      style={{ width: '100%', height: '18px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8em', display: 'block' }}>
                      σ: <strong>{sigmaH.toFixed(3)}</strong> Å
                    </label>
                    <input
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.01"
                      value={sigmaH}
                      onChange={(e) => setSigmaH(parseFloat(e.target.value))}
                      style={{ width: '100%', height: '18px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Energy Components */}
        <div className="col col--6">
          <div className="card" style={{ fontSize: '0.9em' }}>
            <div className="card__header" style={{ padding: '8px 16px' }}>
              <h6 style={{ margin: 0 }}>Energy Components (@{currentGeometry.scale.toFixed(2)})</h6>
            </div>
            <div className="card__body" style={{ padding: '12px' }}>
              {currentPoint ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      padding: '8px 4px', 
                      backgroundColor: '#e3f2fd', 
                      borderRadius: '4px',
                      margin: '0 2px'
                    }}>
                      <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: '#1976d2' }}>
                        {currentPoint.coulomb.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.7em', color: '#1976d2' }}>Coulombic</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      padding: '8px 4px', 
                      backgroundColor: '#f3e5f5', 
                      borderRadius: '4px',
                      margin: '0 2px'
                    }}>
                      <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: '#7b1fa2' }}>
                        {currentPoint.lj.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.7em', color: '#7b1fa2' }}>LJ</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      padding: '8px 4px', 
                      backgroundColor: '#e8f5e8', 
                      borderRadius: '4px',
                      margin: '0 2px'
                    }}>
                      <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: '#388e3c' }}>
                        {currentPoint.y.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.7em', color: '#388e3c' }}>Total</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#666' }}>Loading...</div>
              )}
              <div style={{ fontSize: '0.7em', color: '#666', marginTop: '8px', textAlign: 'center' }}>
                All values in kJ/mol
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaterDimerEnergy;