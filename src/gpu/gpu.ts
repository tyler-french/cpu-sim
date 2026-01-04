import {
  GPUState,
  GPUCore,
  GPUOperation,
  GPUEvent,
  GPUEventListener,
  GPUMicroOp,
  GPU_CORE_COUNT,
  VRAM_SIZE,
} from './types';

export class GPU {
  private vram: number[] = [];
  private cores: GPUCore[] = [];
  private busy = false;
  private currentOp: GPUOperation | null = null;
  private cyclesRemaining = 0;
  private srcAddr = 0;
  private dstAddr = 0;
  private length = 0;
  private scalar = 0;
  private result = 0;
  private listeners: GPUEventListener[] = [];
  private currentCoreIndex = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.vram = new Array(VRAM_SIZE).fill(0);
    this.cores = [];
    for (let i = 0; i < GPU_CORE_COUNT; i++) {
      this.cores.push({
        id: i,
        busy: false,
        currentOp: '',
        inputA: 0,
        inputB: 0,
        output: 0,
      });
    }
    this.busy = false;
    this.currentOp = null;
    this.cyclesRemaining = 0;
    this.srcAddr = 0;
    this.dstAddr = 0;
    this.length = 0;
    this.scalar = 0;
    this.result = 0;
    this.currentCoreIndex = 0;
    this.emit({ type: 'reset', state: this.getState() });
  }

  getState(): GPUState {
    return {
      vram: [...this.vram],
      cores: this.cores.map((c) => ({ ...c })),
      busy: this.busy,
      currentOp: this.currentOp,
      cyclesRemaining: this.cyclesRemaining,
      srcAddr: this.srcAddr,
      dstAddr: this.dstAddr,
      length: this.length,
      scalar: this.scalar,
      result: this.result,
    };
  }

  isBusy(): boolean {
    return this.busy;
  }

  getResult(): number {
    return this.result;
  }

  subscribe(listener: GPUEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: GPUEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  // Transfer data from CPU memory to VRAM
  loadToVRAM(cpuMemory: number[], cpuAddr: number, vramAddr: number, length: number): GPUMicroOp {
    for (let i = 0; i < length; i++) {
      const srcIdx = (cpuAddr + i) & 0xff;
      const dstIdx = (vramAddr + i) % VRAM_SIZE;
      this.vram[dstIdx] = cpuMemory[srcIdx] ?? 0;
    }

    const microOp: GPUMicroOp = {
      description: `Transfer ${length} values: CPU[${cpuAddr}] → VRAM[${vramAddr}]`,
      source: `CPU Memory[${cpuAddr}]`,
      destination: `VRAM[${vramAddr}]`,
    };

    this.emit({ type: 'transfer', state: this.getState(), microOp });
    return microOp;
  }

  // Transfer data from VRAM to CPU memory
  storeFromVRAM(cpuMemory: number[], vramAddr: number, cpuAddr: number, length: number): GPUMicroOp {
    for (let i = 0; i < length; i++) {
      const srcIdx = (vramAddr + i) % VRAM_SIZE;
      const dstIdx = (cpuAddr + i) & 0xff;
      cpuMemory[dstIdx] = this.vram[srcIdx] ?? 0;
    }

    const microOp: GPUMicroOp = {
      description: `Transfer ${length} values: VRAM[${vramAddr}] → CPU[${cpuAddr}]`,
      source: `VRAM[${vramAddr}]`,
      destination: `CPU Memory[${cpuAddr}]`,
    };

    this.emit({ type: 'transfer', state: this.getState(), microOp });
    return microOp;
  }

  // Start a GPU operation
  startOperation(
    op: GPUOperation,
    srcAddr: number,
    dstAddr: number,
    length: number,
    scalar: number = 0
  ): GPUMicroOp {
    this.busy = true;
    this.currentOp = op;
    this.srcAddr = srcAddr;
    this.dstAddr = dstAddr;
    this.length = Math.min(length, VRAM_SIZE);
    this.scalar = scalar;
    this.result = 0;
    this.currentCoreIndex = 0;

    // Calculate cycles needed (parallel processing - divide work among cores)
    this.cyclesRemaining = Math.ceil(this.length / GPU_CORE_COUNT);

    // Reset all cores
    this.cores.forEach((core) => {
      core.busy = false;
      core.currentOp = '';
      core.inputA = 0;
      core.inputB = 0;
      core.output = 0;
    });

    const microOp: GPUMicroOp = {
      description: `GPU: Start ${op} on ${length} elements`,
      operation: op,
    };

    this.emit({ type: 'start', state: this.getState(), microOp });
    return microOp;
  }

  // Execute one GPU cycle (processes multiple elements in parallel)
  cycle(): GPUMicroOp | null {
    if (!this.busy || !this.currentOp) {
      return null;
    }

    const activeCores: number[] = [];
    const op = this.currentOp;

    // Each cycle, all cores process one element each (in parallel)
    for (let coreId = 0; coreId < GPU_CORE_COUNT; coreId++) {
      const elementIndex = this.currentCoreIndex + coreId;
      if (elementIndex >= this.length) break;

      const core = this.cores[coreId]!;
      core.busy = true;
      core.currentOp = op;
      activeCores.push(coreId);

      const srcIdx = (this.srcAddr + elementIndex) % VRAM_SIZE;
      const dstIdx = (this.dstAddr + elementIndex) % VRAM_SIZE;

      core.inputA = this.vram[srcIdx] ?? 0;

      // For operations that need a second input
      if (['VADD', 'VSUB', 'VMUL', 'VDIV', 'VDOT'].includes(op)) {
        core.inputB = this.vram[dstIdx] ?? 0;
      } else if (op === 'VSCALE') {
        core.inputB = this.scalar;
      } else {
        core.inputB = 0;
      }

      // Perform the operation
      switch (op) {
        case 'VADD':
          core.output = (core.inputA + core.inputB) & 0xffff;
          this.vram[dstIdx] = core.output;
          break;
        case 'VSUB':
          core.output = (core.inputA - core.inputB) & 0xffff;
          this.vram[dstIdx] = core.output;
          break;
        case 'VMUL':
          core.output = (core.inputA * core.inputB) & 0xffff;
          this.vram[dstIdx] = core.output;
          break;
        case 'VDIV':
          core.output = core.inputB !== 0 ? Math.floor(core.inputA / core.inputB) : 0;
          this.vram[dstIdx] = core.output;
          break;
        case 'VSCALE':
          core.output = (core.inputA * this.scalar) & 0xffff;
          this.vram[dstIdx] = core.output;
          break;
        case 'VDOT':
          core.output = (core.inputA * core.inputB) & 0xffff;
          this.result = (this.result + core.output) & 0xffff;
          break;
        case 'VSUM':
          core.output = core.inputA;
          this.result = (this.result + core.output) & 0xffff;
          break;
        case 'VMAX':
          core.output = core.inputA;
          if (elementIndex === 0 || core.inputA > this.result) {
            this.result = core.inputA;
          }
          break;
        case 'VMIN':
          core.output = core.inputA;
          if (elementIndex === 0 || core.inputA < this.result) {
            this.result = core.inputA;
          }
          break;
        case 'VABS':
          core.output = core.inputA > 0x7fff ? (0x10000 - core.inputA) & 0xffff : core.inputA;
          this.vram[dstIdx] = core.output;
          break;
        case 'VSQRT':
          core.output = Math.floor(Math.sqrt(core.inputA));
          this.vram[dstIdx] = core.output;
          break;
        case 'VCOPY':
          core.output = core.inputA;
          this.vram[dstIdx] = core.output;
          break;
      }
    }

    this.currentCoreIndex += GPU_CORE_COUNT;
    this.cyclesRemaining--;

    const microOp: GPUMicroOp = {
      description: `GPU Cycle: ${activeCores.length} cores processing ${op}`,
      operation: op,
    };

    this.emit({
      type: 'progress',
      state: this.getState(),
      microOp,
      coresActive: activeCores,
    });

    // Check if operation is complete
    if (this.cyclesRemaining <= 0 || this.currentCoreIndex >= this.length) {
      this.busy = false;

      // Clear core busy states
      this.cores.forEach((core) => {
        core.busy = false;
      });

      const completeOp: GPUMicroOp = {
        description: `GPU: ${op} complete${['VSUM', 'VDOT', 'VMAX', 'VMIN'].includes(op) ? ` (result: ${this.result})` : ''}`,
        operation: op,
        value: this.result,
      };

      this.emit({ type: 'complete', state: this.getState(), microOp: completeOp });
      return completeOp;
    }

    return microOp;
  }

  // Write directly to VRAM (for initialization)
  writeVRAM(addr: number, value: number): void {
    this.vram[addr % VRAM_SIZE] = value & 0xffff;
  }

  // Read from VRAM
  readVRAM(addr: number): number {
    return this.vram[addr % VRAM_SIZE] ?? 0;
  }
}
