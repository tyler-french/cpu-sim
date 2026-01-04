import { CPUState, CycleStage, MicroOp, REGISTER_COUNT } from '../cpu/types';
import { GPUState, GPUMicroOp, GPU_CORE_COUNT } from '../gpu/types';

export function createApp(): HTMLElement {
  const app = document.createElement('div');
  app.className = 'app';
  app.innerHTML = `
    <header class="header">
      <h1>CPU Simulator</h1>
      <p>Write assembly code and watch it execute step by step</p>
    </header>

    <main class="main-grid">
      <div class="left-column">
        <section class="panel editor-panel">
          <div class="panel-header">
            <span>Assembly Editor</span>
            <div class="header-controls">
              <select id="exampleSelect" class="example-dropdown">
                <option value="">Load Example...</option>
              </select>
              <span class="line-count" id="lineCount">0 lines</span>
            </div>
          </div>
          <div class="editor-container" id="editorContainer"></div>
          <div class="controls">
            <button class="btn btn-primary" id="assembleBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              Assemble
            </button>
            <button class="btn btn-success" id="runBtn" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run
            </button>
            <button class="btn btn-warning" id="stepBtn" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
              Step
            </button>
            <button class="btn btn-micro" id="microStepBtn" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <line x1="15" y1="12" x2="20" y2="12"/>
              </svg>
              Micro
            </button>
            <button class="btn btn-danger" id="stopBtn" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              Stop
            </button>
            <button class="btn btn-secondary" id="resetBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2.5 2v6h6"/>
                <path d="M2.5 8a10 10 0 1 1 2.5 8"/>
              </svg>
              Reset
            </button>
            <div class="speed-control">
              <label>Speed:</label>
              <input type="range" id="speedSlider" min="1" max="200" value="100">
              <span id="speedValue">500ms</span>
            </div>
          </div>
        </section>

        <!-- CPU Architecture Visualization -->
        <section class="panel cpu-arch-panel">
          <div class="panel-header">
            <span>CPU Architecture</span>
            <span class="cycle-indicator" id="cycleIndicator">IDLE</span>
          </div>
          <div class="panel-content">
            <div class="cpu-architecture">
              <!-- Pipeline Stages -->
              <div class="pipeline-stages">
                <div class="pipeline-stage" id="stage-fetch" data-stage="fetch">
                  <div class="stage-label">FETCH</div>
                  <div class="stage-description">Get instruction from memory</div>
                </div>
                <div class="pipeline-arrow">→</div>
                <div class="pipeline-stage" id="stage-decode" data-stage="decode">
                  <div class="stage-label">DECODE</div>
                  <div class="stage-description">Parse instruction</div>
                </div>
                <div class="pipeline-arrow">→</div>
                <div class="pipeline-stage" id="stage-execute" data-stage="execute">
                  <div class="stage-label">EXECUTE</div>
                  <div class="stage-description">Perform operation</div>
                </div>
                <div class="pipeline-arrow">→</div>
                <div class="pipeline-stage" id="stage-writeback" data-stage="writeback">
                  <div class="stage-label">WRITEBACK</div>
                  <div class="stage-description">Store results</div>
                </div>
              </div>

              <!-- CPU Internals -->
              <div class="cpu-internals">
                <div class="cpu-component control-unit">
                  <div class="component-header">Control Unit</div>
                  <div class="component-content">
                    <div class="cu-field">
                      <span class="field-label">IR:</span>
                      <span class="field-value" id="irValue">-</span>
                    </div>
                    <div class="cu-field">
                      <span class="field-label">Opcode:</span>
                      <span class="field-value" id="opcodeValue">-</span>
                    </div>
                  </div>
                </div>

                <div class="data-bus bus-to-alu" id="busToAlu">
                  <div class="bus-data" id="busToAluData"></div>
                </div>

                <div class="cpu-component alu">
                  <div class="component-header">ALU</div>
                  <div class="component-content">
                    <div class="alu-inputs">
                      <div class="alu-input">
                        <span class="input-label">A:</span>
                        <span class="input-value" id="aluA">-</span>
                      </div>
                      <div class="alu-op" id="aluOp">-</div>
                      <div class="alu-input">
                        <span class="input-label">B:</span>
                        <span class="input-value" id="aluB">-</span>
                      </div>
                    </div>
                    <div class="alu-output">
                      <span class="output-label">Result:</span>
                      <span class="output-value" id="aluResult">-</span>
                    </div>
                  </div>
                </div>

                <div class="data-bus bus-from-alu" id="busFromAlu">
                  <div class="bus-data" id="busFromAluData"></div>
                </div>

                <div class="cpu-component memory-interface">
                  <div class="component-header">Memory Interface</div>
                  <div class="component-content">
                    <div class="mem-field">
                      <span class="field-label">MAR:</span>
                      <span class="field-value" id="marValue">-</span>
                    </div>
                    <div class="mem-field">
                      <span class="field-label">MDR:</span>
                      <span class="field-value" id="mdrValue">-</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Current Micro-Operation -->
              <div class="micro-op-display">
                <div class="micro-op-header">Current Micro-Operation</div>
                <div class="micro-op-content" id="microOpContent">
                  <div class="micro-op-idle">Waiting for execution...</div>
                </div>
              </div>

              <!-- Data Flow Log -->
              <div class="data-flow-log">
                <div class="flow-log-header">Data Flow</div>
                <div class="flow-log-content" id="flowLogContent"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- GPU Visualization -->
        <section class="panel gpu-panel">
          <div class="panel-header">
            <span>GPU - Parallel Processing Unit</span>
            <span class="gpu-status" id="gpuStatus">IDLE</span>
          </div>
          <div class="panel-content">
            <div class="gpu-architecture">
              <!-- GPU Cores Grid -->
              <div class="gpu-cores-section">
                <div class="gpu-section-header">Processing Cores (${GPU_CORE_COUNT} parallel units)</div>
                <div class="gpu-cores-grid" id="gpuCores">
                  ${Array.from({ length: GPU_CORE_COUNT }, (_, i) => `
                    <div class="gpu-core" id="gpuCore${i}" data-core="${i}">
                      <div class="core-header">Core ${i}</div>
                      <div class="core-content">
                        <div class="core-io">
                          <span class="core-input" id="coreIn${i}">-</span>
                          <span class="core-op" id="coreOp${i}">-</span>
                          <span class="core-output" id="coreOut${i}">-</span>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- GPU-CPU Data Bus -->
              <div class="gpu-bus-section">
                <div class="gpu-bus" id="gpuBus">
                  <div class="bus-label">CPU ↔ GPU Data Bus</div>
                  <div class="bus-activity" id="gpuBusActivity"></div>
                </div>
              </div>

              <!-- VRAM Section -->
              <div class="vram-section">
                <div class="gpu-section-header">
                  <span>VRAM (Video Memory)</span>
                  <span class="vram-range">0x00 - 0x1F</span>
                </div>
                <div class="vram-grid" id="vramView"></div>
              </div>

              <!-- GPU Operation Status -->
              <div class="gpu-op-status">
                <div class="gpu-op-header">Current Operation</div>
                <div class="gpu-op-content" id="gpuOpContent">
                  <div class="gpu-op-idle">No GPU operation running</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel console-panel">
          <div class="panel-header">Console Output</div>
          <div class="panel-content">
            <div class="console" id="console"></div>
          </div>
        </section>

      </div>

      <aside class="sidebar">
        <section class="panel cpu-panel">
          <div class="panel-header">Registers</div>
          <div class="panel-content">
            <div class="current-instruction-wrapper">
              <div class="current-instruction-label">Current Instruction</div>
              <div class="current-instruction" id="currentInstruction">-</div>
            </div>

            <div class="registers-grid" id="registers"></div>

            <div class="special-registers">
              <div class="special-register">
                <span class="special-register-name">Program Counter (PC)</span>
                <span class="special-register-value" id="pcValue">0x0000</span>
              </div>
              <div class="special-register">
                <span class="special-register-name">Stack Pointer (SP)</span>
                <span class="special-register-value" id="spValue">0x00FF</span>
              </div>
              <div class="special-register">
                <span class="special-register-name">Cycle Count</span>
                <span class="special-register-value" id="cycleCount">0</span>
              </div>
            </div>

            <div class="flags-container">
              <div class="flag">
                <div class="flag-indicator" id="flagZ"></div>
                <span class="flag-name">Zero (Z)</span>
              </div>
              <div class="flag">
                <div class="flag-indicator" id="flagN"></div>
                <span class="flag-name">Negative (N)</span>
              </div>
              <div class="flag">
                <div class="flag-indicator" id="flagC"></div>
                <span class="flag-name">Carry (C)</span>
              </div>
            </div>
          </div>
        </section>

        <section class="panel memory-panel">
          <div class="panel-header">
            <span>Memory</span>
            <span class="memory-range">0x00 - 0x3F</span>
          </div>
          <div class="panel-content">
            <div class="memory-grid" id="memoryView"></div>
          </div>
        </section>

        <section class="panel reference-panel">
          <div class="panel-header">
            <span>Instruction Reference</span>
          </div>
          <div class="panel-content">
            <div class="instruction-ref" id="instructionRef"></div>
          </div>
        </section>
      </aside>
    </main>

    <footer class="status-bar">
      <div class="status-item">
        <div class="status-dot" id="statusDot"></div>
        <span id="statusText">Ready</span>
      </div>
      <div class="status-item">
        <span>Instructions: <strong id="instructionCount">0</strong></span>
      </div>
    </footer>
  `;

  return app;
}

export function initRegistersDisplay(container: HTMLElement): void {
  let html = '';
  for (let i = 0; i < REGISTER_COUNT; i++) {
    html += `
      <div class="register" data-reg="${i}">
        <span class="register-name">R${i}</span>
        <span class="register-value">0x0000</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

export function initMemoryDisplay(container: HTMLElement): void {
  let html = '';
  for (let i = 0; i < 64; i++) {
    html += `<div class="memory-cell" data-addr="${i}">00</div>`;
  }
  container.innerHTML = html;
}

export function initInstructionReference(container: HTMLElement): void {
  const instructions = [
    ['MOV Rd, val', 'Load value into register'],
    ['ADD Rd, val', 'Add value to register'],
    ['SUB Rd, val', 'Subtract from register'],
    ['MUL Rd, val', 'Multiply register'],
    ['DIV Rd, val', 'Divide register'],
    ['INC Rd', 'Increment register'],
    ['DEC Rd', 'Decrement register'],
    ['CMP Ra, Rb', 'Compare (sets flags)'],
    ['JMP label', 'Unconditional jump'],
    ['JZ/JNZ', 'Jump if zero/not zero'],
    ['JG/JL', 'Jump if greater/less'],
    ['LOAD Rd, addr', 'Load from memory'],
    ['STORE addr, Rs', 'Store to memory'],
    ['PUSH/POP', 'Stack operations'],
    ['CALL/RET', 'Subroutine ops'],
    ['HALT', 'Stop execution'],
    ['--- GPU ---', ''],
    ['GLOAD v,c,n', 'CPU→VRAM transfer'],
    ['GSTORE c,v,n', 'VRAM→CPU transfer'],
    ['GEXEC op,...', 'Run GPU operation'],
    ['GWAIT', 'Wait for GPU'],
    ['GRESULT Rd', 'Get GPU result'],
  ];

  container.innerHTML = instructions
    .map(
      ([name, desc]) => `
      <div class="instruction-item">
        <span class="instruction-name">${name}</span>
        <span class="instruction-desc">${desc}</span>
      </div>
    `
    )
    .join('');
}

export function updateRegistersDisplay(
  container: HTMLElement,
  state: CPUState,
  changedRegisters: number[] = []
): void {
  const registerEls = container.querySelectorAll('.register');
  registerEls.forEach((el, i) => {
    const valueEl = el.querySelector('.register-value');
    if (valueEl) {
      const value = state.registers[i] ?? 0;
      valueEl.textContent = '0x' + value.toString(16).toUpperCase().padStart(4, '0');
    }

    if (changedRegisters.includes(i)) {
      el.classList.add('changed');
      setTimeout(() => el.classList.remove('changed'), 300);
    }
  });
}

export function updateMemoryDisplay(container: HTMLElement, state: CPUState): void {
  const cells = container.querySelectorAll('.memory-cell');
  cells.forEach((cell, i) => {
    const value = state.memory[i] ?? 0;
    cell.textContent = value.toString(16).toUpperCase().padStart(2, '0');
    cell.classList.toggle('nonzero', value !== 0);
  });
}

export function updateFlagsDisplay(state: CPUState): void {
  document.getElementById('flagZ')?.classList.toggle('active', state.flags.zero);
  document.getElementById('flagN')?.classList.toggle('active', state.flags.negative);
  document.getElementById('flagC')?.classList.toggle('active', state.flags.carry);
}

export function updateSpecialRegisters(state: CPUState): void {
  const pcEl = document.getElementById('pcValue');
  const spEl = document.getElementById('spValue');
  const cycleEl = document.getElementById('cycleCount');

  if (pcEl) pcEl.textContent = '0x' + state.pc.toString(16).toUpperCase().padStart(4, '0');
  if (spEl) spEl.textContent = '0x' + state.sp.toString(16).toUpperCase().padStart(4, '0');
  if (cycleEl) cycleEl.textContent = state.cycles.toString();
}

export function updatePipelineStage(stage: CycleStage): void {
  // Clear all active stages
  document.querySelectorAll('.pipeline-stage').forEach((el) => {
    el.classList.remove('active');
  });

  // Highlight current stage
  if (stage !== 'idle') {
    const stageEl = document.getElementById(`stage-${stage}`);
    if (stageEl) {
      stageEl.classList.add('active');
    }
  }

  // Update cycle indicator
  const indicator = document.getElementById('cycleIndicator');
  if (indicator) {
    indicator.textContent = stage.toUpperCase();
    indicator.className = `cycle-indicator ${stage}`;
  }
}

export function updateMicroOpDisplay(microOp: MicroOp | null, state: CPUState): void {
  const content = document.getElementById('microOpContent');
  const irValue = document.getElementById('irValue');
  const opcodeValue = document.getElementById('opcodeValue');

  if (irValue) irValue.textContent = state.instructionRegister || '-';

  if (!microOp) {
    if (content) {
      content.innerHTML = '<div class="micro-op-idle">Waiting for execution...</div>';
    }
    if (opcodeValue) opcodeValue.textContent = '-';
    return;
  }

  if (opcodeValue && microOp.operation) {
    opcodeValue.textContent = microOp.operation;
  }

  if (content) {
    content.innerHTML = `
      <div class="micro-op-active">
        <div class="micro-op-stage ${microOp.stage}">${microOp.stage.toUpperCase()}</div>
        <div class="micro-op-desc">${microOp.description}</div>
        ${microOp.source ? `<div class="micro-op-flow"><span class="flow-from">${microOp.source}</span> → <span class="flow-to">${microOp.destination || 'CPU'}</span></div>` : ''}
        ${microOp.value !== undefined ? `<div class="micro-op-value">Value: <strong>${formatValue(microOp.value)}</strong></div>` : ''}
      </div>
    `;
  }

  // Update ALU display
  if (microOp.destination === 'ALU.A' || microOp.destination === 'ALU') {
    const aluA = document.getElementById('aluA');
    if (aluA && microOp.value !== undefined) {
      aluA.textContent = formatValue(microOp.value);
      aluA.classList.add('flash');
      setTimeout(() => aluA.classList.remove('flash'), 300);
    }
  }
  if (microOp.destination === 'ALU.B') {
    const aluB = document.getElementById('aluB');
    if (aluB && microOp.value !== undefined) {
      aluB.textContent = formatValue(microOp.value);
      aluB.classList.add('flash');
      setTimeout(() => aluB.classList.remove('flash'), 300);
    }
  }
  if (microOp.operation && microOp.source === 'ALU') {
    const aluOp = document.getElementById('aluOp');
    const aluResult = document.getElementById('aluResult');
    if (aluOp) aluOp.textContent = getOpSymbol(microOp.operation);
    if (aluResult && microOp.value !== undefined) {
      aluResult.textContent = formatValue(microOp.value);
      aluResult.classList.add('flash');
      setTimeout(() => aluResult.classList.remove('flash'), 300);
    }
  }

  // Update memory interface
  if (microOp.destination === 'MAR') {
    const marValue = document.getElementById('marValue');
    if (marValue && microOp.value !== undefined) {
      marValue.textContent = '0x' + microOp.value.toString(16).toUpperCase().padStart(2, '0');
      marValue.classList.add('flash');
      setTimeout(() => marValue.classList.remove('flash'), 300);
    }
  }
  if (microOp.destination === 'MDR' || microOp.source === 'MDR') {
    const mdrValue = document.getElementById('mdrValue');
    if (mdrValue && microOp.value !== undefined) {
      mdrValue.textContent = formatValue(microOp.value);
      mdrValue.classList.add('flash');
      setTimeout(() => mdrValue.classList.remove('flash'), 300);
    }
  }

  // Animate data bus
  if (microOp.destination?.includes('ALU') || microOp.destination === 'ALU') {
    animateBus('busToAlu', microOp.value);
  }
  if (microOp.source === 'ALU' && microOp.destination && !microOp.destination.includes('ALU')) {
    animateBus('busFromAlu', microOp.value);
  }
}

export function addFlowLogEntry(microOp: MicroOp): void {
  const logContent = document.getElementById('flowLogContent');
  if (!logContent) return;

  const entry = document.createElement('div');
  entry.className = `flow-entry ${microOp.stage}`;
  entry.innerHTML = `
    <span class="flow-stage">${microOp.stage.charAt(0).toUpperCase()}</span>
    <span class="flow-desc">${microOp.description}</span>
  `;

  logContent.insertBefore(entry, logContent.firstChild);

  // Keep only last 8 entries
  while (logContent.children.length > 8) {
    logContent.removeChild(logContent.lastChild!);
  }
}

export function clearFlowLog(): void {
  const logContent = document.getElementById('flowLogContent');
  if (logContent) {
    logContent.innerHTML = '';
  }
}

export function resetCpuArchDisplay(): void {
  updatePipelineStage('idle');
  updateMicroOpDisplay(null, {
    registers: [],
    memory: [],
    pc: 0,
    sp: 0xff,
    flags: { zero: false, negative: false, carry: false },
    halted: false,
    cycles: 0,
    currentStage: 'idle',
    instructionRegister: '',
    microOps: [],
  });

  // Reset ALU
  const aluA = document.getElementById('aluA');
  const aluB = document.getElementById('aluB');
  const aluOp = document.getElementById('aluOp');
  const aluResult = document.getElementById('aluResult');
  if (aluA) aluA.textContent = '-';
  if (aluB) aluB.textContent = '-';
  if (aluOp) aluOp.textContent = '-';
  if (aluResult) aluResult.textContent = '-';

  // Reset memory interface
  const marValue = document.getElementById('marValue');
  const mdrValue = document.getElementById('mdrValue');
  if (marValue) marValue.textContent = '-';
  if (mdrValue) mdrValue.textContent = '-';

  clearFlowLog();
}

function formatValue(value: number): string {
  if (value < 256) {
    return `${value} (0x${value.toString(16).toUpperCase().padStart(2, '0')})`;
  }
  return `${value} (0x${value.toString(16).toUpperCase().padStart(4, '0')})`;
}

function getOpSymbol(op: string): string {
  const symbols: Record<string, string> = {
    ADD: '+',
    SUB: '-',
    MUL: '×',
    DIV: '÷',
    MOD: '%',
    AND: '&',
    OR: '|',
    XOR: '^',
    NOT: '~',
    SHL: '<<',
    SHR: '>>',
    CMP: '?',
    INC: '+1',
    DEC: '-1',
  };
  return symbols[op] || op;
}

function animateBus(busId: string, value: number | undefined): void {
  const bus = document.getElementById(busId);
  const busData = document.getElementById(busId + 'Data');
  if (bus && busData) {
    bus.classList.add('active');
    if (value !== undefined) {
      busData.textContent = value.toString();
    }
    setTimeout(() => {
      bus.classList.remove('active');
      busData.textContent = '';
    }, 400);
  }
}

export function log(container: HTMLElement, message: string, type: 'info' | 'error' | 'success' = 'info'): void {
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.textContent = message;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

export function clearConsole(container: HTMLElement): void {
  container.innerHTML = '';
}

export function setStatus(status: 'ready' | 'running' | 'paused' | 'halted'): void {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  if (dot) {
    dot.className = 'status-dot ' + status;
  }

  const statusTexts: Record<string, string> = {
    ready: 'Ready',
    running: 'Running',
    paused: 'Paused',
    halted: 'Halted',
  };

  if (text) {
    text.textContent = statusTexts[status] ?? 'Ready';
  }
}

// ========================================
// GPU Display Functions
// ========================================

export function initVRAMDisplay(container: HTMLElement): void {
  let html = '';
  for (let i = 0; i < 32; i++) {
    html += `<div class="vram-cell" data-addr="${i}">00</div>`;
  }
  container.innerHTML = html;
}

export function updateGPUDisplay(state: GPUState): void {
  // Update GPU status
  const gpuStatus = document.getElementById('gpuStatus');
  if (gpuStatus) {
    gpuStatus.textContent = state.busy ? state.currentOp || 'BUSY' : 'IDLE';
    gpuStatus.className = `gpu-status ${state.busy ? 'active' : ''}`;
  }

  // Update cores
  for (let i = 0; i < GPU_CORE_COUNT; i++) {
    const core = state.cores[i];
    if (!core) continue;

    const coreEl = document.getElementById(`gpuCore${i}`);
    const inputEl = document.getElementById(`coreIn${i}`);
    const opEl = document.getElementById(`coreOp${i}`);
    const outputEl = document.getElementById(`coreOut${i}`);

    if (coreEl) {
      coreEl.classList.toggle('active', core.busy);
    }
    if (inputEl) {
      inputEl.textContent = core.busy ? core.inputA.toString() : '-';
    }
    if (opEl) {
      opEl.textContent = core.busy ? getGpuOpSymbol(core.currentOp) : '-';
    }
    if (outputEl) {
      outputEl.textContent = core.busy ? core.output.toString() : '-';
    }
  }

  // Update VRAM display
  const vramView = document.getElementById('vramView');
  if (vramView) {
    const cells = vramView.querySelectorAll('.vram-cell');
    cells.forEach((cell, i) => {
      const value = state.vram[i] ?? 0;
      cell.textContent = value.toString(16).toUpperCase().padStart(2, '0');
      cell.classList.toggle('nonzero', value !== 0);
    });
  }

  // Update operation status
  const opContent = document.getElementById('gpuOpContent');
  if (opContent) {
    if (state.busy && state.currentOp) {
      opContent.innerHTML = `
        <div class="gpu-op-active">
          <div class="gpu-op-name">${state.currentOp}</div>
          <div class="gpu-op-details">
            <span>Source: VRAM[${state.srcAddr}]</span>
            <span>Dest: VRAM[${state.dstAddr}]</span>
            <span>Length: ${state.length}</span>
          </div>
          <div class="gpu-op-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${100 - (state.cyclesRemaining / Math.ceil(state.length / GPU_CORE_COUNT)) * 100}%"></div>
            </div>
            <span>${state.cyclesRemaining} cycles left</span>
          </div>
        </div>
      `;
    } else {
      opContent.innerHTML = '<div class="gpu-op-idle">No GPU operation running</div>';
    }
  }
}

export function animateGPUTransfer(microOp: GPUMicroOp): void {
  const bus = document.getElementById('gpuBus');
  const activity = document.getElementById('gpuBusActivity');

  if (bus && activity) {
    bus.classList.add('active');
    activity.textContent = microOp.description;

    setTimeout(() => {
      bus.classList.remove('active');
      activity.textContent = '';
    }, 600);
  }
}

export function resetGPUDisplay(): void {
  // Reset status
  const gpuStatus = document.getElementById('gpuStatus');
  if (gpuStatus) {
    gpuStatus.textContent = 'IDLE';
    gpuStatus.className = 'gpu-status';
  }

  // Reset cores
  for (let i = 0; i < GPU_CORE_COUNT; i++) {
    const coreEl = document.getElementById(`gpuCore${i}`);
    const inputEl = document.getElementById(`coreIn${i}`);
    const opEl = document.getElementById(`coreOp${i}`);
    const outputEl = document.getElementById(`coreOut${i}`);

    if (coreEl) coreEl.classList.remove('active');
    if (inputEl) inputEl.textContent = '-';
    if (opEl) opEl.textContent = '-';
    if (outputEl) outputEl.textContent = '-';
  }

  // Reset VRAM
  const vramView = document.getElementById('vramView');
  if (vramView) {
    const cells = vramView.querySelectorAll('.vram-cell');
    cells.forEach((cell) => {
      cell.textContent = '00';
      cell.classList.remove('nonzero');
    });
  }

  // Reset operation status
  const opContent = document.getElementById('gpuOpContent');
  if (opContent) {
    opContent.innerHTML = '<div class="gpu-op-idle">No GPU operation running</div>';
  }
}

function getGpuOpSymbol(op: string): string {
  const symbols: Record<string, string> = {
    VADD: '+',
    VSUB: '-',
    VMUL: '×',
    VDIV: '÷',
    VSCALE: '×S',
    VDOT: '·',
    VSUM: 'Σ',
    VMAX: 'max',
    VMIN: 'min',
    VABS: '|x|',
    VSQRT: '√',
    VCOPY: '→',
  };
  return symbols[op] || op;
}
