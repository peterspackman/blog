import React, { useRef } from 'react';
import * as echarts from 'echarts';
import { TensorMatrixChart } from './TensorMatrixChart';
import styles from './ElasticTensor.module.css';

const DualMatrixChart: React.FC<{
  stiffnessMatrix: number[][];
  complianceMatrix: number[][];
  referenceStiffness?: number[][];
  referenceCompliance?: number[][];
  comparisonMode?: boolean;
  showDifference?: boolean;
  testTensorName?: string;
  referenceTensorName?: string;
}> = ({ stiffnessMatrix, complianceMatrix, referenceStiffness, referenceCompliance, comparisonMode = false, showDifference = false, testTensorName = 'Test Tensor', referenceTensorName = 'Reference Tensor' }) => {

  const copyMatrixToClipboard = (matrix: number[][], matrixName: string) => {
    let text = `${matrixName}\n`;
    text += matrix.map(row =>
      row.map(val => val.toFixed(3).padStart(10)).join('')
    ).join('\n');
    navigator.clipboard.writeText(text);
  };

  const copyComparisonToClipboard = (testMatrix: number[][], refMatrix: number[][], matrixType: string) => {
    let text = `${matrixType} Comparison\n`;
    text += `${testTensorName} vs ${referenceTensorName}\n\n`;
    
    text += `${testTensorName}:\n`;
    text += testMatrix.map(row =>
      row.map(val => val.toFixed(3).padStart(10)).join('')
    ).join('\n');
    
    text += `\n\n${referenceTensorName}:\n`;
    text += refMatrix.map(row =>
      row.map(val => val.toFixed(3).padStart(10)).join('')
    ).join('\n');
    
    text += `\n\nDifferences (${testTensorName} - ${referenceTensorName}):\n`;
    text += testMatrix.map((row, i) =>
      row.map((val, j) => {
        const diff = val - refMatrix[i][j];
        return (diff >= 0 ? '+' : '') + diff.toFixed(3).padStart(10);
      }).join('')
    ).join('\n');
    
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem',
      width: '100%',
      minHeight: '450px',
      height: 'auto'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.5rem',
          flex: 'none'
        }}>
          <h4 style={{
            color: 'var(--ifm-color-emphasis-800)',
            fontSize: '1rem',
            fontWeight: '600',
            margin: 0
          }}>
            Stiffness Matrix (C) - GPa
          </h4>
          <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
            {comparisonMode && referenceStiffness ? (
              <button
                onClick={() => copyComparisonToClipboard(stiffnessMatrix, referenceStiffness, 'Stiffness Matrix (C) - GPa')}
                className={styles.copyButton}
                title="Copy stiffness matrix comparison to clipboard"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </button>
            ) : (
              <button
                onClick={() => copyMatrixToClipboard(stiffnessMatrix, `Stiffness Matrix (C) - GPa - ${testTensorName}`)}
                className={styles.copyButton}
                title="Copy stiffness matrix to clipboard"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            )}
            <button
              onClick={() => {
                const container = document.querySelector('.stiffness-matrix-chart') as HTMLDivElement;
                if (container) {
                  const chartInstance = echarts.getInstanceByDom(container);
                  if (chartInstance) {
                    const url = chartInstance.getDataURL({
                      type: 'png',
                      pixelRatio: 2,
                      backgroundColor: '#ffffff'
                    });
                    const link = document.createElement('a');
                    link.download = `Stiffness_Matrix_${testTensorName.replace(/\s+/g, '_')}.png`;
                    link.href = url;
                    link.click();
                  }
                }
              }}
              className={styles.copyButton}
              title="Save stiffness matrix as PNG"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17,21 17,13 7,13 7,21" />
                <polyline points="7,3 7,8 15,8" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ flex: '1', minHeight: '400px' }}>
          <div className="stiffness-matrix-chart">
            <TensorMatrixChart
              data={stiffnessMatrix}
              referenceData={referenceStiffness}
              comparisonMode={comparisonMode}
              showDifference={showDifference}
              testTensorName={testTensorName}
              referenceTensorName={referenceTensorName}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.5rem',
          flex: 'none'
        }}>
          <h4 style={{
            color: 'var(--ifm-color-emphasis-800)',
            fontSize: '1rem',
            fontWeight: '600',
            margin: 0
          }}>
            Compliance Matrix (S) - GPa⁻¹
          </h4>
          <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
            {comparisonMode && referenceCompliance ? (
              <button
                onClick={() => copyComparisonToClipboard(complianceMatrix, referenceCompliance, 'Compliance Matrix (S) - GPa⁻¹')}
                className={styles.copyButton}
                title="Copy compliance matrix comparison to clipboard"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </button>
            ) : (
              <button
                onClick={() => copyMatrixToClipboard(complianceMatrix, `Compliance Matrix (S) - GPa⁻¹ - ${testTensorName}`)}
                className={styles.copyButton}
                title="Copy compliance matrix to clipboard"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            )}
            <button
              onClick={() => {
                const container = document.querySelector('.compliance-matrix-chart') as HTMLDivElement;
                if (container) {
                  const chartInstance = echarts.getInstanceByDom(container);
                  if (chartInstance) {
                    const url = chartInstance.getDataURL({
                      type: 'png',
                      pixelRatio: 2,
                      backgroundColor: '#ffffff'
                    });
                    const link = document.createElement('a');
                    link.download = `Compliance_Matrix_${testTensorName.replace(/\s+/g, '_')}.png`;
                    link.href = url;
                    link.click();
                  }
                }
              }}
              className={styles.copyButton}
              title="Save compliance matrix as PNG"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17,21 17,13 7,13 7,21" />
                <polyline points="7,3 7,8 15,8" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ flex: '1', minHeight: '400px' }}>
          <div className="compliance-matrix-chart">
            <TensorMatrixChart
              data={complianceMatrix}
              referenceData={referenceCompliance}
              comparisonMode={comparisonMode}
              showDifference={showDifference}
              testTensorName={testTensorName}
              referenceTensorName={referenceTensorName}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export { DualMatrixChart };
export default DualMatrixChart;
