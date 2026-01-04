export type GPUOperation =
  | 'VADD'    // Vector Add
  | 'VSUB'    // Vector Subtract
  | 'VMUL'    // Vector Multiply
  | 'VDIV'    // Vector Divide
  | 'VSCALE'  // Scale vector by scalar
  | 'VDOT'    // Dot product
  | 'VSUM'    // Sum all elements
  | 'VMAX'    // Find maximum
  | 'VMIN'    // Find minimum
  | 'VABS'    // Absolute value of each element
  | 'VSQRT'   // Square root of each element
  | 'VCOPY';  // Copy vector

export interface GPUCore {
  id: number;
  busy: boolean;
  currentOp: string;
  inputA: number;
  inputB: number;
  output: number;
}

export interface GPUState {
  vram: number[];           // GPU memory (Video RAM)
  cores: GPUCore[];         // Parallel processing cores
  busy: boolean;            // Is GPU currently executing
  currentOp: GPUOperation | null;
  cyclesRemaining: number;  // Cycles until operation completes
  srcAddr: number;          // Source address in VRAM
  dstAddr: number;          // Destination address in VRAM
  length: number;           // Vector length for current op
  scalar: number;           // Scalar value for VSCALE
  result: number;           // Result for reduction operations (VSUM, VDOT, etc)
}

export interface GPUMicroOp {
  description: string;
  coreId?: number;
  operation?: string;
  value?: number;
  source?: string;
  destination?: string;
}

export type GPUEventType = 'start' | 'progress' | 'complete' | 'transfer' | 'reset';

export interface GPUEvent {
  type: GPUEventType;
  state: GPUState;
  microOp?: GPUMicroOp;
  coresActive?: number[];
}

export type GPUEventListener = (event: GPUEvent) => void;

export const GPU_CORE_COUNT = 8;
export const VRAM_SIZE = 128;
