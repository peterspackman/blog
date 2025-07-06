import React, { useMemo } from 'react';
import { useUnitCell } from './UnitCellContext';
import MathFormula from '../MathFormula';

const UnitCellMatrixDisplay: React.FC = () => {
  const { state } = useUnitCell();
  const renderCount = React.useRef(0);
  renderCount.current++;
  console.log(`UnitCellMatrixDisplay render #${renderCount.current}`);

  // Calculate vectors directly, depending ONLY on parameter values
  const vectors = useMemo(() => {
    const { a, b, c, alpha, beta, gamma } = state.params;
    console.log('Calculating vectors from params:', { a, b, c, alpha, beta, gamma });
    
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const alphaRad = toRadians(alpha);
    const betaRad = toRadians(beta);
    const gammaRad = toRadians(gamma);

    const cosAlpha = Math.cos(alphaRad);
    const cosBeta = Math.cos(betaRad);
    const cosGamma = Math.cos(gammaRad);
    const sinGamma = Math.sin(gammaRad);

    // Vector a along x-axis
    const vectorA = { x: a, y: 0, z: 0 };

    // Vector b in xy-plane  
    const vectorB = {
      x: b * cosGamma,
      y: b * sinGamma,
      z: 0
    };

    // Vector c calculation
    const cx = c * cosBeta;
    const cy = c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
    const czSquared = 1 - cosBeta * cosBeta - Math.pow((cosAlpha - cosBeta * cosGamma) / sinGamma, 2);
    const cz = c * Math.sqrt(Math.max(0, czSquared));

    const vectorC = { x: cx, y: cy, z: cz };

    // Calculate volume using scalar triple product: a · (b × c)
    const volume = Math.abs(
      vectorA.x * (vectorB.y * vectorC.z - vectorB.z * vectorC.y) +
      vectorA.y * (vectorB.z * vectorC.x - vectorB.x * vectorC.z) +
      vectorA.z * (vectorB.x * vectorC.y - vectorB.y * vectorC.x)
    );

    console.log('Calculated vectors:', {
      A: [vectorA.x.toFixed(6), vectorA.y.toFixed(6), vectorA.z.toFixed(6)],
      B: [vectorB.x.toFixed(6), vectorB.y.toFixed(6), vectorB.z.toFixed(6)],
      C: [vectorC.x.toFixed(6), vectorC.y.toFixed(6), vectorC.z.toFixed(6)]
    });

    return { vectorA, vectorB, vectorC, volume };
  }, [state.params.a, state.params.b, state.params.c, state.params.alpha, state.params.beta, state.params.gamma]);

  // Memoize math strings to prevent unnecessary re-renders
  const mathStrings = useMemo(() => {
    const { vectorA, vectorB, vectorC } = vectors;
    
    return {
      vectorAMath: String.raw`\color{#e74c3c}{\mathbf{a}} = \begin{pmatrix} ${vectorA.x.toFixed(3)} \\ ${vectorA.y.toFixed(3)} \\ ${vectorA.z.toFixed(3)} \end{pmatrix}`,
      vectorBMath: String.raw`\color{#2980b9}{\mathbf{b}} = \begin{pmatrix} ${vectorB.x.toFixed(3)} \\ ${vectorB.y.toFixed(3)} \\ ${vectorB.z.toFixed(3)} \end{pmatrix}`,
      vectorCMath: String.raw`\color{#f39c12}{\mathbf{c}} = \begin{pmatrix} ${vectorC.x.toFixed(3)} \\ ${vectorC.y.toFixed(3)} \\ ${vectorC.z.toFixed(3)} \end{pmatrix}`,
      matrixMath: String.raw`\mathbf{M} = [\mathbf{a}, \mathbf{b}, \mathbf{c}] = \begin{pmatrix} ${vectorA.x.toFixed(3)} & ${vectorB.x.toFixed(3)} & ${vectorC.x.toFixed(3)} \\ ${vectorA.y.toFixed(3)} & ${vectorB.y.toFixed(3)} & ${vectorC.y.toFixed(3)} \\ ${vectorA.z.toFixed(3)} & ${vectorB.z.toFixed(3)} & ${vectorC.z.toFixed(3)} \end{pmatrix}`
    };
  }, [vectors.vectorA.x, vectors.vectorA.y, vectors.vectorA.z, vectors.vectorB.x, vectors.vectorB.y, vectors.vectorB.z, vectors.vectorC.x, vectors.vectorC.y, vectors.vectorC.z]);

  if (!state.displayOptions.showMatrixInfo) {
    return null;
  }

  const { vectorA, vectorB, vectorC, volume } = vectors;

  return (
    <div style={{ 
      marginTop: '1rem',
      padding: '1.2rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Vector representations */}
        <div>
          <div style={{ 
            fontSize: '0.8rem', 
            fontWeight: '500', 
            color: '#666',
            marginBottom: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Lattice Vectors
          </div>
          
          <div style={{ marginBottom: '0.6rem' }}>
            <MathFormula 
              math={mathStrings.vectorAMath}
              inline={false}
            />
          </div>
          
          <div style={{ marginBottom: '0.6rem' }}>
            <MathFormula 
              math={mathStrings.vectorBMath}
              inline={false}
            />
          </div>
          
          <div style={{ marginBottom: '0.8rem' }}>
            <MathFormula 
              math={mathStrings.vectorCMath}
              inline={false}
            />
          </div>
        </div>
        
        {/* Matrix representation */}
        <div>
          <div style={{ 
            fontSize: '0.8rem', 
            fontWeight: '500', 
            color: '#666',
            marginBottom: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Lattice Matrix
          </div>
          
          <div style={{ 
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid #ddd',
            textAlign: 'center'
          }}>
            <MathFormula 
              math={mathStrings.matrixMath}
              inline={false}
            />
          </div>
          
          <div style={{ 
            fontSize: '0.75rem',
            color: '#888',
            marginTop: '0.5rem',
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            Matrix columns are lattice vectors
          </div>
        </div>
      </div>
      
      {/* Additional Information */}
      <div style={{ 
        marginTop: '1.2rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e0e0e0',
        fontSize: '0.75rem',
        color: '#666',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem'
      }}>
        <div>
          <strong>Lattice Parameters:</strong><br />
          a = {state.params.a.toFixed(3)}, b = {state.params.b.toFixed(3)}, c = {state.params.c.toFixed(3)}<br />
          α = {state.params.alpha.toFixed(1)}°, β = {state.params.beta.toFixed(1)}°, γ = {state.params.gamma.toFixed(1)}°
        </div>
        <div>
          <strong>System:</strong> {state.latticeSystem.charAt(0).toUpperCase() + state.latticeSystem.slice(1)}<br />
          <strong>Centering:</strong> {state.centeringType}<br />
          <strong>Cell Volume:</strong> {volume.toFixed(3)} Å³
        </div>
      </div>
      
    </div>
  );
};

export default UnitCellMatrixDisplay;