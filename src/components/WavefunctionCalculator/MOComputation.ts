import * as OCC from '@peterspackman/occjs';

export interface MOComputationOptions {
  orbitalIndex: number;
  gridSteps: number;
  isovalue?: number;
  spin?: 'alpha' | 'beta' | 'both';
}

export interface MOVisualizationData {
  cubeData: string;
  orbitalIndex: number;
  orbitalEnergy: number;
  occupation: number;
  isOccupied: boolean;
}

export class MOComputation {
  private occModule: any = null;
  private wavefunction: any = null;
  private molecule: any = null;

  async initialize() {
    if (!this.occModule) {
      this.occModule = await OCC.loadOCC();
    }
  }

  setWavefunction(wavefunction: any) {
    this.wavefunction = wavefunction;
  }

  setMolecule(molecule: any) {
    this.molecule = molecule;
  }

  async setFromXYZAndResults(xyzData: string, results: any) {
    if (!this.occModule) {
      await this.initialize();
    }

    try {
      // Recreate molecule from XYZ data
      const molecule = await OCC.moleculeFromXYZ(xyzData);
      this.molecule = molecule;

      // If we have the calculation instance from the worker, use it
      if (results.calculationInstance) {
        this.wavefunction = results.calculationInstance.wavefunction;
      } else {
        // Otherwise, we'd need to recreate the calculation
        // For now, throw an error - this will be improved in future versions
        throw new Error('Calculation instance not available from worker');
      }
    } catch (error) {
      console.error('Error setting up MO computation from XYZ and results:', error);
      throw error;
    }
  }

  async computeMOCube(options: MOComputationOptions): Promise<MOVisualizationData> {
    if (!this.occModule) {
      await this.initialize();
    }

    if (!this.wavefunction) {
      throw new Error('No wavefunction available for MO computation');
    }

    try {
      // Use the convenience function to generate MO cube data
      const cubeString = this.occModule.generateMOCube(
        this.wavefunction,
        options.orbitalIndex,
        options.gridSteps,
        options.gridSteps,
        options.gridSteps
      );

      // Get orbital information
      const orbitalEnergies = this.wavefunction.molecularOrbitals?.energies;
      const orbitalEnergy = orbitalEnergies ? orbitalEnergies.get(options.orbitalIndex) : 0;
      
      // Estimate occupation (this should come from the wavefunction in the future)
      const numElectrons = this.molecule?.numElectrons?.() || 0;
      const numOccupiedOrbitals = Math.ceil(numElectrons / 2);
      const occupation = options.orbitalIndex < numOccupiedOrbitals ? 2.0 : 0.0;
      const isOccupied = options.orbitalIndex < numOccupiedOrbitals;

      return {
        cubeData: cubeString,
        orbitalIndex: options.orbitalIndex,
        orbitalEnergy,
        occupation,
        isOccupied
      };
    } catch (error) {
      console.error('Error computing MO cube:', error);
      throw new Error(`Failed to compute MO cube: ${error.message}`);
    }
  }

  async computeElectronDensityCube(gridSteps: number = 50): Promise<string> {
    if (!this.occModule) {
      await this.initialize();
    }

    if (!this.wavefunction) {
      throw new Error('No wavefunction available for electron density computation');
    }

    try {
      return this.occModule.generateElectronDensityCube(
        this.wavefunction,
        gridSteps,
        gridSteps,
        gridSteps
      );
    } catch (error) {
      console.error('Error computing electron density cube:', error);
      throw new Error(`Failed to compute electron density cube: ${error.message}`);
    }
  }

  async computeElectricPotentialCube(gridSteps: number = 50): Promise<string> {
    if (!this.occModule) {
      await this.initialize();
    }

    if (!this.wavefunction) {
      throw new Error('No wavefunction available for ESP computation');
    }

    try {
      // Use the volume calculator for ESP
      const calculator = new this.occModule.VolumeCalculator();
      calculator.setWavefunction(this.wavefunction);

      const params = new this.occModule.VolumeGenerationParameters();
      params.property = this.occModule.VolumePropertyKind.ElectricPotential;
      params.setSteps(gridSteps, gridSteps, gridSteps);

      const volume = calculator.computeVolume(params);
      const cubeString = calculator.volumeAsCubeString(volume);

      // Clean up
      volume.delete();
      params.delete();
      calculator.delete();

      return cubeString;
    } catch (error) {
      console.error('Error computing ESP cube:', error);
      throw new Error(`Failed to compute ESP cube: ${error.message}`);
    }
  }

  getAvailableOrbitals(): Array<{index: number, energy: number, occupation: number, isOccupied: boolean}> {
    if (!this.wavefunction || !this.molecule) {
      return [];
    }

    try {
      const orbitalEnergies = this.wavefunction.molecularOrbitals?.energies;
      if (!orbitalEnergies) {
        return [];
      }

      const numElectrons = this.molecule.numElectrons?.() || 0;
      const numOccupiedOrbitals = Math.ceil(numElectrons / 2);
      const numOrbitals = orbitalEnergies.size();

      const orbitals = [];
      for (let i = 0; i < numOrbitals; i++) {
        const energy = orbitalEnergies.get(i);
        const occupation = i < numOccupiedOrbitals ? 2.0 : 0.0;
        const isOccupied = i < numOccupiedOrbitals;

        orbitals.push({
          index: i,
          energy,
          occupation,
          isOccupied
        });
      }

      return orbitals;
    } catch (error) {
      console.error('Error getting orbital information:', error);
      return [];
    }
  }

  getHOMOIndex(): number {
    if (!this.molecule) {
      return -1;
    }

    try {
      const numElectrons = this.molecule.numElectrons?.() || 0;
      return Math.ceil(numElectrons / 2) - 1; // HOMO is the highest occupied orbital (0-indexed)
    } catch (error) {
      console.error('Error getting HOMO index:', error);
      return -1;
    }
  }

  getLUMOIndex(): number {
    const homoIndex = this.getHOMOIndex();
    return homoIndex >= 0 ? homoIndex + 1 : -1;
  }

  dispose() {
    this.wavefunction = null;
    this.molecule = null;
    // Note: We don't dispose of occModule as it might be shared
  }
}