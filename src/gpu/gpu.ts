import {
  GPUState,
  GPUCore,
  GPUOperation,
  GPUEvent,
  GPUEventListener,
  GPUMicroOp,
  GPUMicroStage,
  GPU_CORE_COUNT,
  VRAM_SIZE,
} from './types';

export class GPU {
  private vram: number[] = [];
  private cores: GPUCore[] = [];
  private busy = false;
  private currentOp: GPUOperation | null = null;
  private currentStage: GPUMicroStage = 'idle';
  private currentBatch = 0;
  private totalBatches = 0;
  private srcAddr = 0;
  private dstAddr = 0;
  private length = 0;
  private scalar = 0;
  private result = 0;
  private listeners: GPUEventListener[] = [];
  private pendingOp: {
    op: GPUOperation;
    srcAddr: number;
    dstAddr: number;
    length: number;
    scalar: number;
  } | null = null;

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
    this.currentStage = 'idle';
    this.currentBatch = 0;
    this.totalBatches = 0;
    this.srcAddr = 0;
    this.dstAddr = 0;
    this.length = 0;
    this.scalar = 0;
    this.result = 0;
    this.pendingOp = null;
    this.emit({ type: 'reset', state: this.getState() });
  }

  getState(): GPUState {
    return {
      vram: [...this.vram],
      cores: this.cores.map((c) => ({ ...c })),
      busy: this.busy,
      currentOp: this.currentOp,
      currentStage: this.currentStage,
      cyclesRemaining: this.totalBatches - this.currentBatch,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
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
      stage: 'execute',
      description: `DMA Transfer: ${length} bytes CPU[${cpuAddr}] → VRAM[${vramAddr}]`,
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
      stage: 'execute',
      description: `DMA Transfer: ${length} bytes VRAM[${vramAddr}] → CPU[${cpuAddr}]`,
      source: `VRAM[${vramAddr}]`,
      destination: `CPU Memory[${cpuAddr}]`,
    };

    this.emit({ type: 'transfer', state: this.getState(), microOp });
    return microOp;
  }

  // Queue a GPU operation (will be processed via microStep)
  startOperation(
    op: GPUOperation,
    srcAddr: number,
    dstAddr: number,
    length: number,
    scalar: number = 0
  ): void {
    this.pendingOp = { op, srcAddr, dstAddr, length, scalar };
    this.busy = true;
    this.currentStage = 'idle';
  }

  // Check if there's a pending operation or active operation
  hasPendingWork(): boolean {
    return this.pendingOp !== null || (this.busy && this.currentStage !== 'idle');
  }

  // Execute one GPU micro-step
  microStep(): GPUMicroOp | null {
    // If there's a pending operation, start with decode
    if (this.pendingOp) {
      return this.doDecode();
    }

    // If not busy, nothing to do
    if (!this.busy || this.currentStage === 'idle') {
      return null;
    }

    // Advance through stages
    switch (this.currentStage) {
      case 'decode':
        return this.doFetch();
      case 'fetch':
        return this.doExecute();
      case 'execute':
        return this.doWriteback();
      case 'writeback':
        // Check if more batches needed
        if (this.currentBatch < this.totalBatches) {
          return this.doFetch(); // Start next batch
        } else {
          return this.doComplete();
        }
      default:
        return null;
    }
  }

  private doDecode(): GPUMicroOp {
    const pending = this.pendingOp!;
    this.pendingOp = null;

    this.currentOp = pending.op;
    this.srcAddr = pending.srcAddr;
    this.dstAddr = pending.dstAddr;
    this.length = Math.min(pending.length, VRAM_SIZE);
    this.scalar = pending.scalar;
    this.result = 0;
    this.currentBatch = 0;
    this.totalBatches = Math.ceil(this.length / GPU_CORE_COUNT);
    this.currentStage = 'decode';

    // Reset all cores
    this.cores.forEach((core) => {
      core.busy = false;
      core.currentOp = this.currentOp || '';
      core.inputA = 0;
      core.inputB = 0;
      core.output = 0;
    });

    const microOp: GPUMicroOp = {
      stage: 'decode',
      description: `Decode ${this.currentOp}: ${this.length} elements in ${this.totalBatches} batch${this.totalBatches > 1 ? 'es' : ''}`,
      operation: this.currentOp,
    };

    this.emit({ type: 'micro', state: this.getState(), microOp });
    return microOp;
  }

  private doFetch(): GPUMicroOp {
    this.currentStage = 'fetch';
    const op = this.currentOp!;
    const activeCores: number[] = [];
    const dataLoaded: number[] = [];

    // Load data into cores for this batch
    for (let coreId = 0; coreId < GPU_CORE_COUNT; coreId++) {
      const elementIndex = this.currentBatch * GPU_CORE_COUNT + coreId;
      if (elementIndex >= this.length) break;

      const core = this.cores[coreId]!;
      core.busy = true;
      core.currentOp = op;
      activeCores.push(coreId);

      const srcIdx = (this.srcAddr + elementIndex) % VRAM_SIZE;
      const dstIdx = (this.dstAddr + elementIndex) % VRAM_SIZE;

      core.inputA = this.vram[srcIdx] ?? 0;
      dataLoaded.push(core.inputA);

      // Load second operand for operations that need it
      if (['VADD', 'VSUB', 'VMUL', 'VDIV', 'VDOT'].includes(op)) {
        core.inputB = this.vram[dstIdx] ?? 0;
      } else if (op === 'VSCALE') {
        core.inputB = this.scalar;
      } else {
        core.inputB = 0;
      }

      core.output = 0; // Clear output
    }

    const microOp: GPUMicroOp = {
      stage: 'fetch',
      description: `Fetch batch ${this.currentBatch + 1}/${this.totalBatches}: Load ${activeCores.length} values from VRAM[${this.srcAddr}+]`,
      operation: op,
      coresActive: activeCores,
      dataLoaded,
    };

    this.emit({ type: 'micro', state: this.getState(), microOp, coresActive: activeCores });
    return microOp;
  }

  private doExecute(): GPUMicroOp {
    this.currentStage = 'execute';
    const op = this.currentOp!;
    const activeCores: number[] = [];

    // Execute on all active cores
    for (let coreId = 0; coreId < GPU_CORE_COUNT; coreId++) {
      const core = this.cores[coreId]!;
      if (!core.busy) continue;

      activeCores.push(coreId);

      // Perform the operation
      switch (op) {
        case 'VADD':
          core.output = (core.inputA + core.inputB) & 0xffff;
          break;
        case 'VSUB':
          core.output = (core.inputA - core.inputB) & 0xffff;
          break;
        case 'VMUL':
          core.output = (core.inputA * core.inputB) & 0xffff;
          break;
        case 'VDIV':
          core.output = core.inputB !== 0 ? Math.floor(core.inputA / core.inputB) : 0;
          break;
        case 'VSCALE':
          core.output = (core.inputA * this.scalar) & 0xffff;
          break;
        case 'VDOT':
          core.output = (core.inputA * core.inputB) & 0xffff;
          break;
        case 'VSUM':
          core.output = core.inputA;
          break;
        case 'VMAX':
          core.output = core.inputA;
          break;
        case 'VMIN':
          core.output = core.inputA;
          break;
        case 'VABS':
          core.output = core.inputA > 0x7fff ? (0x10000 - core.inputA) & 0xffff : core.inputA;
          break;
        case 'VSQRT':
          core.output = Math.floor(Math.sqrt(core.inputA));
          break;
        case 'VCOPY':
          core.output = core.inputA;
          break;
      }
    }

    const microOp: GPUMicroOp = {
      stage: 'execute',
      description: `Execute ${op}: ${activeCores.length} cores computing in parallel`,
      operation: op,
      coresActive: activeCores,
    };

    this.emit({ type: 'micro', state: this.getState(), microOp, coresActive: activeCores });
    return microOp;
  }

  private doWriteback(): GPUMicroOp {
    this.currentStage = 'writeback';
    const op = this.currentOp!;
    const activeCores: number[] = [];
    const dataWritten: number[] = [];
    const isReduction = ['VDOT', 'VSUM', 'VMAX', 'VMIN'].includes(op);

    for (let coreId = 0; coreId < GPU_CORE_COUNT; coreId++) {
      const elementIndex = this.currentBatch * GPU_CORE_COUNT + coreId;
      if (elementIndex >= this.length) break;

      const core = this.cores[coreId]!;
      if (!core.busy) continue;

      activeCores.push(coreId);
      const dstIdx = (this.dstAddr + elementIndex) % VRAM_SIZE;

      if (isReduction) {
        // Reduction operations accumulate to result
        switch (op) {
          case 'VDOT':
          case 'VSUM':
            this.result = (this.result + core.output) & 0xffff;
            break;
          case 'VMAX':
            if (elementIndex === 0 || core.output > this.result) {
              this.result = core.output;
            }
            break;
          case 'VMIN':
            if (elementIndex === 0 || core.output < this.result) {
              this.result = core.output;
            }
            break;
        }
        dataWritten.push(core.output);
      } else {
        // Regular operations write to VRAM
        this.vram[dstIdx] = core.output;
        dataWritten.push(core.output);
      }

      core.busy = false;
    }

    this.currentBatch++;

    const description = isReduction
      ? `Reduce: Accumulate ${activeCores.length} results (partial: ${this.result})`
      : `Writeback: Store ${activeCores.length} values to VRAM[${this.dstAddr}+]`;

    const microOp: GPUMicroOp = {
      stage: 'writeback',
      description,
      operation: op,
      coresActive: activeCores,
      dataWritten,
      value: isReduction ? this.result : undefined,
    };

    this.emit({ type: 'micro', state: this.getState(), microOp, coresActive: activeCores });
    return microOp;
  }

  private doComplete(): GPUMicroOp {
    this.busy = false;
    this.currentStage = 'idle';
    const op = this.currentOp!;
    const isReduction = ['VDOT', 'VSUM', 'VMAX', 'VMIN'].includes(op);

    // Clear all cores
    this.cores.forEach((core) => {
      core.busy = false;
      core.currentOp = '';
    });

    const microOp: GPUMicroOp = {
      stage: 'idle',
      description: `Complete: ${op}${isReduction ? ` = ${this.result}` : ` (${this.length} elements)`}`,
      operation: op,
      value: isReduction ? this.result : undefined,
    };

    this.emit({ type: 'complete', state: this.getState(), microOp });
    return microOp;
  }

  // Execute a full operation (for non-micro mode)
  fullCycle(): GPUMicroOp | null {
    if (!this.hasPendingWork()) return null;

    let lastOp: GPUMicroOp | null = null;
    while (this.hasPendingWork()) {
      lastOp = this.microStep();
    }
    return lastOp;
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
