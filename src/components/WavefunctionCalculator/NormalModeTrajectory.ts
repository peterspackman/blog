// Utility class for generating normal mode trajectories
export class NormalModeTrajectory {
  private static readonly DEFAULT_FRAMES = 20;
  private static readonly DEFAULT_AMPLITUDE = 0.3; // Angstroms

  /**
   * Pre-compute all normal mode trajectories for a calculation result
   */
  static precomputeAllTrajectories(
    finalGeometry: string,
    frequencies: number[],
    normalModes: number[][],
    options?: { frames?: number; amplitude?: number }
  ): Map<number, string> {
    const trajectories = new Map<number, string>();
    
    frequencies.forEach((frequency, index) => {
      const normalMode = normalModes[index];
      const trajectory = normalMode && normalMode.length > 0
        ? this.generateTrajectory(finalGeometry, normalMode, frequency, index, options)
        : this.createPlaceholderTrajectory(finalGeometry, frequency, index);
      
      trajectories.set(index, trajectory);
    });
    
    return trajectories;
  }

  /**
   * Generate a single normal mode trajectory
   */
  static generateTrajectory(
    finalGeometry: string,
    normalMode: number[],
    frequency: number,
    modeIndex: number,
    options?: { frames?: number; amplitude?: number }
  ): string {
    const nFrames = options?.frames ?? this.DEFAULT_FRAMES;
    const amplitude = options?.amplitude ?? this.DEFAULT_AMPLITUDE;

    // Parse the final geometry
    const { numAtoms, atoms } = this.parseGeometry(finalGeometry);
    if (!atoms.length) return '';

    // Generate trajectory frames by displacing along the normal mode
    const frames: string[] = [];
    
    for (let frame = 0; frame < nFrames; frame++) {
      const phase = (2 * Math.PI * frame) / nFrames;
      const displacement = amplitude * Math.sin(phase);
      
      const frameData = this.createFrame(atoms, normalMode, displacement, frequency, modeIndex);
      frames.push(frameData);
    }
    
    return frames.join('\n');
  }

  /**
   * Create a placeholder trajectory when normal mode data is unavailable
   */
  static createPlaceholderTrajectory(
    finalGeometry: string,
    frequency: number,
    modeIndex: number
  ): string {
    const lines = finalGeometry.trim().split('\n');
    const numAtoms = parseInt(lines[0]);
    
    const frames: string[] = [];
    for (let i = 0; i < 5; i++) {
      const frameLines = [numAtoms.toString()];
      frameLines.push(`Mode ${modeIndex + 1}: ${Math.abs(frequency).toFixed(2)} cm⁻¹ (normal mode data unavailable)`);
      
      // Copy the original atom lines
      for (let j = 2; j < lines.length; j++) {
        frameLines.push(lines[j]);
      }
      
      frames.push(frameLines.join('\n'));
    }
    
    return frames.join('\n');
  }

  /**
   * Parse XYZ geometry into structured data
   */
  private static parseGeometry(geometry: string): {
    numAtoms: number;
    atoms: Array<{ element: string; x: number; y: number; z: number }>;
  } {
    const lines = geometry.trim().split('\n');
    const numAtoms = parseInt(lines[0]);
    
    if (lines.length < numAtoms + 2) {
      return { numAtoms: 0, atoms: [] };
    }

    const atoms: Array<{ element: string; x: number; y: number; z: number }> = [];
    for (let i = 2; i < 2 + numAtoms; i++) {
      const parts = lines[i].trim().split(/\s+/);
      atoms.push({
        element: parts[0],
        x: parseFloat(parts[1]),
        y: parseFloat(parts[2]),
        z: parseFloat(parts[3])
      });
    }

    return { numAtoms, atoms };
  }

  /**
   * Create a single frame of the trajectory
   */
  private static createFrame(
    atoms: Array<{ element: string; x: number; y: number; z: number }>,
    normalMode: number[],
    displacement: number,
    frequency: number,
    modeIndex: number
  ): string {
    const frameLines = [atoms.length.toString()];
    frameLines.push(`Mode ${modeIndex + 1}: ${Math.abs(frequency).toFixed(2)} cm⁻¹ ${frequency < 0 ? '(imaginary)' : ''}`);
    
    for (let atomIdx = 0; atomIdx < atoms.length; atomIdx++) {
      const atom = atoms[atomIdx];
      // Normal mode vector has 3 components per atom (x, y, z)
      const modeX = normalMode[atomIdx * 3] || 0;
      const modeY = normalMode[atomIdx * 3 + 1] || 0;
      const modeZ = normalMode[atomIdx * 3 + 2] || 0;
      
      const newX = atom.x + displacement * modeX;
      const newY = atom.y + displacement * modeY;
      const newZ = atom.z + displacement * modeZ;
      
      frameLines.push(`${atom.element}  ${newX.toFixed(6)}  ${newY.toFixed(6)}  ${newZ.toFixed(6)}`);
    }
    
    return frameLines.join('\n');
  }
}