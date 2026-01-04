export interface CPUFlags {
  zero: boolean;
  negative: boolean;
  carry: boolean;
}

export type CycleStage = 'idle' | 'fetch' | 'decode' | 'execute' | 'writeback';

export interface MicroOp {
  stage: CycleStage;
  description: string;
  source?: string;
  destination?: string;
  value?: number;
  operation?: string;
}

export interface CPUState {
  registers: number[];
  memory: number[];
  pc: number;
  sp: number;
  flags: CPUFlags;
  halted: boolean;
  cycles: number;
  currentStage: CycleStage;
  instructionRegister: string;
  microOps: MicroOp[];
}

export interface AssembledProgram {
  instructions: string[];
  labels: Record<string, number>;
}

export type CPUEventType = 'step' | 'halt' | 'reset' | 'error' | 'micro';

export interface CPUEvent {
  type: CPUEventType;
  state: CPUState;
  instruction?: string;
  changedRegisters?: number[];
  error?: string;
  microOp?: MicroOp;
}

export type CPUEventListener = (event: CPUEvent) => void;

export const REGISTER_COUNT = 8;
export const MEMORY_SIZE = 256;
export const STACK_START = 0xFF;
