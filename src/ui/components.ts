import { CPUState, CycleStage, MicroOp, REGISTER_COUNT } from '../cpu/types';
import { GPUState, GPUMicroOp, GPUMicroStage, GPU_CORE_COUNT } from '../gpu/types';

export function createApp(): HTMLElement {
  const app = document.createElement('div');
  app.className = 'app';
  app.setAttribute('role', 'application');
  app.setAttribute('aria-label', 'CPU and GPU Simulator');
  app.innerHTML = `
    <a href="#editorContainer" class="skip-link">Skip to editor</a>
    <header class="header" role="banner">
      <h1>CPU & GPU Simulator</h1>
      <p>Write assembly code and watch it execute step by step <a href="about.html" class="about-link" aria-label="Learn more about the simulator">Learn more</a></p>
    </header>

    <main class="main-grid" role="main">
      <div class="left-column">
        <section class="panel editor-panel" aria-labelledby="editorHeading">
          <div class="panel-header">
            <span id="editorHeading">Assembly Editor</span>
            <div class="header-controls">
              <select id="exampleSelect" class="example-dropdown" aria-label="Load example program">
                <option value="">Load Example...</option>
              </select>
              <span class="line-count" id="lineCount" aria-live="polite">0 lines</span>
              <button class="expand-btn" id="expandEditor" title="Toggle editor size" aria-label="Expand editor fullscreen" aria-expanded="false">⤢</button>
            </div>
          </div>
          <div class="editor-container" id="editorContainer" role="textbox" aria-label="Assembly code editor" aria-multiline="true">
            <button class="editor-close-btn" id="editorCloseBtn" title="Close" aria-label="Close expanded editor">✕</button>
          </div>
          <div class="editor-overlay" id="editorOverlay" aria-hidden="true"></div>
          <div class="controls" role="toolbar" aria-label="Simulator controls">
            <button class="btn btn-primary" id="assembleBtn" title="Parse assembly code and prepare for execution" aria-label="Assemble code">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              Assemble
            </button>
            <button class="btn btn-success" id="runBtn" disabled title="Run continuously, executing full instructions" aria-label="Run program">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run
            </button>
            <button class="btn btn-micro" id="runMicroBtn" disabled title="Run continuously, showing each micro-phase (fetch/decode/execute/writeback)" aria-label="Run with micro-step visualization">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run Micro
            </button>
            <button class="btn btn-warning" id="stepBtn" disabled title="Execute one full instruction" aria-label="Execute single instruction">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
              Step
            </button>
            <button class="btn btn-cyan" id="microStepBtn" disabled title="Execute one micro-phase at a time" aria-label="Execute single micro-operation">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <line x1="15" y1="12" x2="20" y2="12"/>
              </svg>
              Micro Step
            </button>
            <button class="btn btn-danger" id="stopBtn" disabled title="Pause execution" aria-label="Stop execution">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              Stop
            </button>
            <button class="btn btn-secondary" id="resetBtn" title="Reset CPU, GPU, and all registers to initial state" aria-label="Reset simulator">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M2.5 2v6h6"/>
                <path d="M2.5 8a10 10 0 1 1 2.5 8"/>
              </svg>
              Reset
            </button>
            <div class="speed-control" role="group" aria-labelledby="speedLabel">
              <label id="speedLabel" for="speedSlider">Speed:</label>
              <input type="range" id="speedSlider" min="0" max="200" value="100" aria-label="Execution speed" aria-valuemin="0" aria-valuemax="200" aria-valuenow="100">
              <span id="speedValue" aria-live="polite">100ms</span>
            </div>
          </div>
        </section>

        <!-- CPU Architecture Visualization -->
        <section class="panel cpu-arch-panel" aria-labelledby="cpuArchHeading">
          <div class="panel-header">
            <span id="cpuArchHeading">CPU Architecture</span>
            <span class="cycle-indicator" id="cycleIndicator" role="status" aria-live="polite" aria-label="Current pipeline stage">IDLE</span>
          </div>
          <div class="panel-content">
            <div class="cpu-architecture" role="img" aria-label="CPU architecture visualization showing pipeline stages and components">
              <!-- Pipeline Stages -->
              <div class="pipeline-stages" role="list" aria-label="CPU pipeline stages">
                <div class="pipeline-stage" id="stage-fetch" data-stage="fetch" role="listitem" aria-label="Fetch stage: Get instruction from memory">
                  <div class="stage-label">FETCH</div>
                  <div class="stage-description">Get instruction from memory</div>
                </div>
                <div class="pipeline-arrow" aria-hidden="true">→</div>
                <div class="pipeline-stage" id="stage-decode" data-stage="decode" role="listitem" aria-label="Decode stage: Parse instruction">
                  <div class="stage-label">DECODE</div>
                  <div class="stage-description">Parse instruction</div>
                </div>
                <div class="pipeline-arrow" aria-hidden="true">→</div>
                <div class="pipeline-stage" id="stage-execute" data-stage="execute" role="listitem" aria-label="Execute stage: Perform operation">
                  <div class="stage-label">EXECUTE</div>
                  <div class="stage-description">Perform operation</div>
                </div>
                <div class="pipeline-arrow" aria-hidden="true">→</div>
                <div class="pipeline-stage" id="stage-writeback" data-stage="writeback" role="listitem" aria-label="Writeback stage: Store results">
                  <div class="stage-label">WRITEBACK</div>
                  <div class="stage-description">Store results</div>
                </div>
              </div>

              <!-- CPU Internals -->
              <div class="cpu-internals" role="group" aria-label="CPU internal components">
                <div class="cpu-component control-unit" role="region" aria-label="Control Unit">
                  <div class="component-header">Control Unit</div>
                  <div class="component-content">
                    <div class="cu-field">
                      <span class="field-label" id="irLabel">IR:</span>
                      <span class="field-value" id="irValue" aria-labelledby="irLabel" aria-live="polite">-</span>
                    </div>
                    <div class="cu-field">
                      <span class="field-label" id="opcodeLabel">Opcode:</span>
                      <span class="field-value" id="opcodeValue" aria-labelledby="opcodeLabel" aria-live="polite">-</span>
                    </div>
                  </div>
                </div>

                <div class="data-bus bus-to-alu" id="busToAlu" aria-hidden="true">
                  <div class="bus-data" id="busToAluData"></div>
                </div>

                <div class="cpu-component alu" role="region" aria-label="Arithmetic Logic Unit">
                  <div class="component-header">ALU</div>
                  <div class="component-content">
                    <div class="alu-inputs">
                      <div class="alu-input">
                        <span class="input-label" id="aluALabel">A:</span>
                        <span class="input-value" id="aluA" aria-labelledby="aluALabel" aria-live="polite">-</span>
                      </div>
                      <div class="alu-op" id="aluOp" aria-label="ALU operation">-</div>
                      <div class="alu-input">
                        <span class="input-label" id="aluBLabel">B:</span>
                        <span class="input-value" id="aluB" aria-labelledby="aluBLabel" aria-live="polite">-</span>
                      </div>
                    </div>
                    <div class="alu-output">
                      <span class="output-label" id="aluResultLabel">Result:</span>
                      <span class="output-value" id="aluResult" aria-labelledby="aluResultLabel" aria-live="polite">-</span>
                    </div>
                  </div>
                </div>

                <div class="data-bus bus-from-alu" id="busFromAlu" aria-hidden="true">
                  <div class="bus-data" id="busFromAluData"></div>
                </div>

                <div class="cpu-component memory-interface" role="region" aria-label="Memory Interface">
                  <div class="component-header">Memory Interface</div>
                  <div class="component-content">
                    <div class="mem-field">
                      <span class="field-label" id="marLabel">MAR:</span>
                      <span class="field-value" id="marValue" aria-labelledby="marLabel" aria-live="polite">-</span>
                    </div>
                    <div class="mem-field">
                      <span class="field-label" id="mdrLabel">MDR:</span>
                      <span class="field-value" id="mdrValue" aria-labelledby="mdrLabel" aria-live="polite">-</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Current Micro-Operation -->
              <div class="micro-op-display" role="region" aria-label="Current micro-operation">
                <div class="micro-op-header" id="microOpHeader">Current Micro-Operation</div>
                <div class="micro-op-content" id="microOpContent" aria-labelledby="microOpHeader" aria-live="polite">
                  <div class="micro-op-idle">Waiting for execution...</div>
                </div>
              </div>

              <!-- Data Flow Log -->
              <div class="data-flow-log" role="log" aria-label="CPU data flow log" aria-live="polite">
                <div class="flow-log-header">Data Flow</div>
                <div class="flow-log-content" id="flowLogContent"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- GPU Architecture Visualization -->
        <section class="panel gpu-panel" aria-labelledby="gpuArchHeading">
          <div class="panel-header">
            <span id="gpuArchHeading">GPU Architecture</span>
            <span class="gpu-status" id="gpuStatus" role="status" aria-live="polite" aria-label="GPU status">IDLE</span>
          </div>
          <div class="panel-content">
            <div class="gpu-architecture" role="img" aria-label="GPU architecture visualization showing pipeline and processing cores">
              <!-- GPU Pipeline Stages -->
              <div class="pipeline-stages gpu-pipeline" role="list" aria-label="GPU pipeline stages">
                <div class="pipeline-stage" id="gpu-stage-decode" data-stage="decode" role="listitem" aria-label="Decode stage: Parse command">
                  <div class="stage-label">DECODE</div>
                  <div class="stage-description">Parse command</div>
                </div>
                <div class="pipeline-arrow" aria-hidden="true">→</div>
                <div class="pipeline-stage" id="gpu-stage-fetch" data-stage="fetch" role="listitem" aria-label="Fetch stage: Load VRAM">
                  <div class="stage-label">FETCH</div>
                  <div class="stage-description">Load VRAM</div>
                </div>
                <div class="pipeline-arrow" aria-hidden="true">→</div>
                <div class="pipeline-stage" id="gpu-stage-execute" data-stage="execute" role="listitem" aria-label="Execute stage: Parallel compute">
                  <div class="stage-label">EXECUTE</div>
                  <div class="stage-description">Parallel compute</div>
                </div>
                <div class="pipeline-arrow" aria-hidden="true">→</div>
                <div class="pipeline-stage" id="gpu-stage-writeback" data-stage="writeback" role="listitem" aria-label="Writeback stage: Store VRAM">
                  <div class="stage-label">WRITEBACK</div>
                  <div class="stage-description">Store VRAM</div>
                </div>
              </div>

              <!-- GPU Micro-Operation Display -->
              <div class="micro-op-display gpu-micro-op" role="region" aria-label="Current GPU micro-operation">
                <div class="micro-op-header" id="gpuMicroOpHeader">Current GPU Micro-Operation</div>
                <div class="micro-op-content" id="gpuMicroOpContent" aria-labelledby="gpuMicroOpHeader" aria-live="polite">
                  <div class="micro-op-idle">Waiting for GPU command...</div>
                </div>
              </div>

              <!-- GPU Cores Grid -->
              <div class="gpu-cores-section" role="region" aria-label="GPU processing cores">
                <div class="gpu-section-header" id="gpuCoresHeader">Processing Cores (${GPU_CORE_COUNT} parallel units)</div>
                <div class="gpu-cores-grid" id="gpuCores" role="list" aria-labelledby="gpuCoresHeader">
                  ${Array.from({ length: GPU_CORE_COUNT }, (_, i) => `
                    <div class="gpu-core" id="gpuCore${i}" data-core="${i}" role="listitem" aria-label="GPU Core ${i}">
                      <div class="core-header">Core ${i}</div>
                      <div class="core-content">
                        <div class="core-io">
                          <span class="core-input" id="coreIn${i}" aria-label="Core ${i} input">-</span>
                          <span class="core-op" id="coreOp${i}" aria-label="Core ${i} operation">-</span>
                          <span class="core-output" id="coreOut${i}" aria-label="Core ${i} output">-</span>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- GPU-CPU Data Bus -->
              <div class="gpu-bus-section" aria-hidden="true">
                <div class="gpu-bus" id="gpuBus">
                  <div class="bus-label">CPU ↔ GPU Data Bus</div>
                  <div class="bus-activity" id="gpuBusActivity"></div>
                </div>
              </div>

              <!-- GPU Data Flow Log -->
              <div class="data-flow-log gpu-flow-log" role="log" aria-label="GPU data flow log" aria-live="polite">
                <div class="flow-log-header">GPU Data Flow</div>
                <div class="flow-log-content" id="gpuFlowLogContent"></div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel console-panel" aria-labelledby="consoleHeading">
          <div class="panel-header" id="consoleHeading">Console Output</div>
          <div class="panel-content">
            <div class="console" id="console" role="log" aria-label="Console output" aria-live="polite"></div>
          </div>
        </section>

      </div>

      <aside class="sidebar" role="complementary" aria-label="CPU state and reference">
        <section class="panel cpu-panel" aria-labelledby="registersHeading">
          <div class="panel-header" id="registersHeading">Registers</div>
          <div class="panel-content">
            <div class="current-instruction-wrapper" role="region" aria-label="Current instruction">
              <div class="current-instruction-label" id="currentInstrLabel">Current Instruction</div>
              <div class="current-instruction" id="currentInstruction" aria-labelledby="currentInstrLabel" aria-live="polite">-</div>
            </div>

            <div class="registers-grid" id="registers" role="list" aria-label="CPU registers"></div>

            <div class="special-registers" role="group" aria-label="Special registers">
              <div class="special-register">
                <span class="special-register-name" id="pcLabel">Program Counter (PC)</span>
                <span class="special-register-value" id="pcValue" aria-labelledby="pcLabel" aria-live="polite">0x0000</span>
              </div>
              <div class="special-register">
                <span class="special-register-name" id="spLabel">Stack Pointer (SP)</span>
                <span class="special-register-value" id="spValue" aria-labelledby="spLabel" aria-live="polite">0x00FF</span>
              </div>
              <div class="special-register">
                <span class="special-register-name" id="cycleLabel">Cycle Count</span>
                <span class="special-register-value" id="cycleCount" aria-labelledby="cycleLabel" aria-live="polite">0</span>
              </div>
            </div>

            <div class="flags-container" role="group" aria-label="CPU flags">
              <div class="flag" role="status">
                <div class="flag-indicator" id="flagZ" role="img" aria-label="Zero flag indicator"></div>
                <span class="flag-name">Zero (Z)</span>
              </div>
              <div class="flag" role="status">
                <div class="flag-indicator" id="flagN" role="img" aria-label="Negative flag indicator"></div>
                <span class="flag-name">Negative (N)</span>
              </div>
              <div class="flag" role="status">
                <div class="flag-indicator" id="flagC" role="img" aria-label="Carry flag indicator"></div>
                <span class="flag-name">Carry (C)</span>
              </div>
            </div>
          </div>
        </section>

        <section class="panel memory-panel" aria-labelledby="memoryHeading">
          <div class="panel-header">
            <span id="memoryHeading">Memory</span>
            <span class="memory-range" aria-label="Memory address range">0x00 - 0x3F</span>
          </div>
          <div class="panel-content">
            <div class="memory-grid" id="memoryView" role="grid" aria-label="CPU memory contents"></div>
          </div>
        </section>

        <section class="panel vram-panel" aria-labelledby="vramHeading">
          <div class="panel-header">
            <span id="vramHeading">VRAM</span>
            <span class="memory-range" aria-label="VRAM address range">0x00 - 0x1F</span>
          </div>
          <div class="panel-content">
            <div class="vram-grid" id="vramView" role="grid" aria-label="GPU video memory contents"></div>
          </div>
        </section>

        <section class="panel reference-panel" aria-labelledby="refHeading">
          <div class="panel-header">
            <span id="refHeading">Instruction Reference</span>
          </div>
          <div class="panel-content">
            <div class="instruction-ref" id="instructionRef" role="list" aria-label="Assembly instruction reference"></div>
          </div>
        </section>
      </aside>
    </main>

    <footer class="status-bar" role="contentinfo">
      <div class="status-item" role="status" aria-live="polite">
        <div class="status-dot" id="statusDot" role="img" aria-hidden="true"></div>
        <span id="statusText" aria-label="Simulator status">Ready</span>
      </div>
      <div class="status-item">
        <span>Instructions: <strong id="instructionCount" aria-label="Number of instructions loaded">0</strong></span>
      </div>
      <div class="status-item copyright">
        <span>&copy; 2026 Tyler French. All rights reserved.</span>
      </div>
    </footer>
  `;

  return app;
}

export function initRegistersDisplay(container: HTMLElement): void {
  let html = '';
  for (let i = 0; i < REGISTER_COUNT; i++) {
    html += `
      <div class="register" data-reg="${i}" role="listitem" aria-label="Register ${i}">
        <span class="register-name" id="regName${i}">R${i}</span>
        <span class="register-value" aria-labelledby="regName${i}">0x0000</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

export function initMemoryDisplay(container: HTMLElement): void {
  let html = '';
  for (let i = 0; i < 64; i++) {
    const addr = '0x' + i.toString(16).toUpperCase().padStart(2, '0');
    html += `<div class="memory-cell" data-addr="${i}" role="gridcell" aria-label="Memory address ${addr}">00</div>`;
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
      <div class="instruction-item" role="listitem" aria-label="${name}: ${desc}">
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
    const addr = '0x' + i.toString(16).toUpperCase().padStart(2, '0');
    html += `<div class="vram-cell" data-addr="${i}" role="gridcell" aria-label="VRAM address ${addr}">00</div>`;
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
}

export function updateGPUPipelineStage(stage: GPUMicroStage): void {
  // Clear all active stages
  document.querySelectorAll('.gpu-pipeline .pipeline-stage').forEach((el) => {
    el.classList.remove('active');
  });

  // Highlight current stage
  if (stage !== 'idle') {
    const stageEl = document.getElementById(`gpu-stage-${stage}`);
    if (stageEl) {
      stageEl.classList.add('active');
    }
  }

  // Update GPU status indicator
  const gpuStatus = document.getElementById('gpuStatus');
  if (gpuStatus && stage !== 'idle') {
    gpuStatus.textContent = stage.toUpperCase();
    gpuStatus.className = `gpu-status active`;
  }
}

export function updateGPUMicroOpDisplay(microOp: GPUMicroOp | null, state: GPUState): void {
  const content = document.getElementById('gpuMicroOpContent');

  if (!microOp || microOp.stage === 'idle') {
    if (content) {
      content.innerHTML = '<div class="micro-op-idle">Waiting for GPU command...</div>';
    }
    updateGPUPipelineStage('idle');
    return;
  }

  updateGPUPipelineStage(microOp.stage);

  if (content) {
    let detailsHtml = '';

    if (microOp.coresActive && microOp.coresActive.length > 0) {
      detailsHtml += `<div class="micro-op-flow"><span class="flow-from">Cores active:</span> <span class="flow-to">${microOp.coresActive.join(', ')}</span></div>`;
    }

    if (microOp.dataLoaded && microOp.dataLoaded.length > 0) {
      detailsHtml += `<div class="micro-op-value">Data loaded: [${microOp.dataLoaded.slice(0, 4).join(', ')}${microOp.dataLoaded.length > 4 ? '...' : ''}]</div>`;
    }

    if (microOp.dataWritten && microOp.dataWritten.length > 0) {
      detailsHtml += `<div class="micro-op-value">Data written: [${microOp.dataWritten.slice(0, 4).join(', ')}${microOp.dataWritten.length > 4 ? '...' : ''}]</div>`;
    }

    if (microOp.value !== undefined) {
      detailsHtml += `<div class="micro-op-value">Result: <strong>${microOp.value}</strong></div>`;
    }

    content.innerHTML = `
      <div class="micro-op-active">
        <div class="micro-op-stage ${microOp.stage}">${microOp.stage.toUpperCase()}</div>
        <div class="micro-op-desc">${microOp.description}</div>
        ${detailsHtml}
      </div>
    `;
  }

  // Show batch progress if applicable
  if (state.totalBatches > 1) {
    const batchInfo = document.createElement('div');
    batchInfo.className = 'micro-op-batch';
    batchInfo.innerHTML = `Batch ${state.currentBatch}/${state.totalBatches}`;
    content?.querySelector('.micro-op-active')?.appendChild(batchInfo);
  }
}

export function addGPUFlowLogEntry(microOp: GPUMicroOp): void {
  const logContent = document.getElementById('gpuFlowLogContent');
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

  // Reset pipeline stages
  updateGPUPipelineStage('idle');

  // Reset micro-op display
  const microOpContent = document.getElementById('gpuMicroOpContent');
  if (microOpContent) {
    microOpContent.innerHTML = '<div class="micro-op-idle">Waiting for GPU command...</div>';
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

  // Reset GPU flow log
  const gpuFlowLog = document.getElementById('gpuFlowLogContent');
  if (gpuFlowLog) {
    gpuFlowLog.innerHTML = '';
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
