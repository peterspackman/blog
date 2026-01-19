/**
 * Shared TypeScript interfaces for the LAMMPS Interface components
 */

export interface OutputLine {
  text: string;
  isError: boolean;
}

export interface VfsFile {
  name: string;
  size: number;
  isDirectory: boolean;
  path: string;
}

export interface TrajectoryInfo {
  filename: string;
  size: number;
  path: string;
  format: 'xyz' | 'dcd' | 'lammpstrj';
}

export interface WorkerState {
  worker: Worker | null;
  isReady: boolean;
  isRunning: boolean;
  status: string;
  output: OutputLine[];
  vfsFiles: VfsFile[];
}

export interface WorkerActions {
  appendOutput: (text: string, isError?: boolean) => void;
  clearOutput: () => void;
  uploadFile: (name: string, content: ArrayBuffer) => void;
  deleteFile: (filename: string) => void;
  runSimulation: (inputFile: string, inputContent?: string) => void;
  cancelSimulation: () => void;
  listFiles: () => void;
  getFile: (filename: string) => void;
  pollTrajectory: () => void;
}

export type TabId = 'input' | 'output' | 'viewer';

export interface ControlTheme {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  inputBg: string;
  danger: string;
  success: string;
}

export const DEFAULT_SCRIPT = `# LAMMPS input script - LJ fluid (Argon) simulation
# ============================================
# Simulation parameters - adjust these
variable        dump_freq equal 10      # Trajectory output frequency
variable        thermo_freq equal 100   # Thermodynamic output frequency
variable        run_steps equal 1000    # Total simulation steps

# System setup
units           lj
dimension       3
atom_style      atomic
boundary        p p p

# Create FCC lattice of atoms
lattice         fcc 0.8442
region          box block 0 4 0 4 0 4
create_box      1 box
create_atoms    1 box
mass            1 1.0

# Initialize velocities (T = 1.44 in LJ units)
velocity        all create 1.44 87287 loop geom

# LJ potential with cutoff at 2.5 sigma
pair_style      lj/cut 2.5
pair_coeff      1 1 1.0 1.0 2.5

# Neighbor list settings
neighbor        0.3 bin
neigh_modify    delay 0 every 20 check no

# NVE integration (constant energy)
fix             1 all nve

# Output settings
thermo          \${thermo_freq}

# Trajectory output with element symbol for visualization
dump            traj all xyz \${dump_freq} trajectory.xyz
dump_modify     traj element Ar sort id

# Run simulation
run             \${run_steps}

# Cleanup
undump          traj`;
