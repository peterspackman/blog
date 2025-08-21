import React, { useState, useRef } from 'react';
import Layout from '@theme/Layout';
import styles from './utilities.module.css';
import TrajectoryViewer from '@site/src/components/TrajectoryViewer';

function XYZTrajectoryViewer() {
  const [trajectoryText, setTrajectoryText] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Example multi-frame XYZ data - water molecule optimization with energy information
  const exampleTrajectory = `3
Step 0 Energy=-75.576566960
O     0.000000     0.000000     0.000000
H     0.900000     0.000000     0.000000
H    -0.300000     0.850000     0.000000
3
Step 1 Energy=-75.584772914
O    -0.007706    -0.010230     0.000000
H     0.934579    -0.016478     0.000000
H    -0.326873     0.876708     0.000000
3
Step 2 Energy=-75.585838726
O    -0.014077    -0.019071     0.000000
H     0.946513    -0.018211     0.000000
H    -0.332435     0.887282     0.000000
3
Step 3 Energy=-75.585944869
O    -0.017729    -0.024187     0.000000
H     0.948447    -0.015719     0.000000
H    -0.330718     0.889906     0.000000
3
Step 4 Energy=-75.585957726
O    -0.019253    -0.026339     0.000000
H     0.947775    -0.013628     0.000000
H    -0.328522     0.889966     0.000000
3
Step 5 Energy=-75.585959662
O    -0.019726    -0.027015     0.000000
H     0.947039    -0.012603     0.000000
H    -0.327313     0.889618     0.000000
3
Step 6 Energy=-75.585959757
O    -0.019728    -0.027022     0.000000
H     0.946851    -0.012467     0.000000
H    -0.327123     0.889489     0.000000`;

  const validateTrajectoryData = (text: string) => {
    if (!text.trim()) {
      setError('Please enter XYZ trajectory data');
      return false;
    }
    
    try {
      const lines = text.trim().split('\n');
      let frameCount = 0;
      let i = 0;
      
      while (i < lines.length) {
        const numAtoms = parseInt(lines[i]);
        if (isNaN(numAtoms)) {
          i++;
          continue;
        }
        
        if (i + numAtoms + 1 >= lines.length) {
          setError(`Incomplete frame ${frameCount + 1}: expected ${numAtoms} atoms but reached end of file`);
          return false;
        }
        
        frameCount++;
        i += numAtoms + 2;
      }
      
      if (frameCount === 0) {
        setError('No valid XYZ frames found');
        return false;
      }
      
      setError('');
      return true;
    } catch (err) {
      setError(`Error parsing trajectory data: ${err.message}`);
      return false;
    }
  };

  const handleFileLoad = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setTrajectoryText(content);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileLoad(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      handleFileLoad(file);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Layout title="XYZ Trajectory Viewer" description="Visualize molecular trajectories">
      <main className={styles.utilityPage}>
        <div className={styles.container}>
          <h1>XYZ Trajectory Viewer</h1>
          <p>Visualize molecular trajectories and dynamics from multi-frame XYZ data using NGL's trajectory capabilities.</p>
          
          
          {/* Main Content Area */}
          <div className={styles.mainLayout}>
            {/* Left Column - Data Input */}
            <div className={styles.leftColumn}>
              <div 
                className={`${styles.inputSection} ${isDragOver ? styles.dragOver : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <h3>XYZ Trajectory Input</h3>
                
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xyz,.txt"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                
                <div className={styles.fileControls}>
                  <button 
                    onClick={openFileDialog}
                    className="button button--primary button--sm"
                  >
                    Open File
                  </button>
                  <span className={styles.dragHint}>or drag & drop XYZ file here</span>
                </div>
                
                <textarea
                  value={trajectoryText}
                  onChange={(e) => setTrajectoryText(e.target.value)}
                  placeholder="Paste multi-frame XYZ data here or drag & drop a file..."
                  className={styles.trajectoryInput}
                />
                <div className={styles.inputControls}>
                  <button 
                    onClick={() => setTrajectoryText(exampleTrajectory)} 
                    className="button button--primary button--sm"
                  >
                    Load Example
                  </button>
                  <button 
                    onClick={() => setTrajectoryText('')} 
                    className="button button--outline button--sm"
                  >
                    Clear
                  </button>
                </div>
                
                {error && (
                  <div className={styles.errorMessage}>
                    {error}
                  </div>
                )}
                
                <div className={styles.formatHelp}>
                  <h4>Format Guide</h4>
                  <pre className={styles.formatExample}>
{`3
Frame 1
O  0.000  0.000  0.000
H  0.757  0.586  0.000
H -0.757  0.586  0.000
3
Frame 2
O  0.000  0.000  0.010
...`}
                  </pre>
                  <p className={styles.formatNote}>
                    Each frame: atom count → comment → coordinates
                  </p>
                </div>
              </div>
            </div>
            
            {/* Right Column - Trajectory Viewer */}
            <div className={styles.rightColumn}>
              {trajectoryText.trim() && !error ? (
                <TrajectoryViewer 
                  trajectoryData={trajectoryText}
                  moleculeName="XYZ Trajectory"
                  autoPlay={false}
                />
              ) : (
                <div className={styles.placeholderViewer}>
                  <div className={styles.placeholderContent}>
                    <h3>Trajectory Viewer</h3>
                    <p>Load XYZ trajectory data to visualize molecular dynamics</p>
                    <button 
                      onClick={() => setTrajectoryText(exampleTrajectory)}
                      className="button button--primary"
                    >
                      Try Example
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}

export default XYZTrajectoryViewer;