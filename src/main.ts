import './style.css';
import { CPU } from './cpu/cpu';
import { GPU } from './gpu/gpu';
import { Assembler } from './assembler/assembler';
import { createEditor, setEditorContent, highlightLine } from './editor/setup';
import { examples } from './examples/programs';
import {
  createApp,
  initRegistersDisplay,
  initMemoryDisplay,
  initInstructionReference,
  initVRAMDisplay,
  updateRegistersDisplay,
  updateMemoryDisplay,
  updateFlagsDisplay,
  updateSpecialRegisters,
  updatePipelineStage,
  updateMicroOpDisplay,
  addFlowLogEntry,
  resetCpuArchDisplay,
  updateGPUDisplay,
  updateGPUMicroOpDisplay,
  addGPUFlowLogEntry,
  animateGPUTransfer,
  resetGPUDisplay,
  log,
  clearConsole,
  setStatus,
} from './ui/components';
import type { EditorView } from '@codemirror/view';

class Simulator {
  private cpu: CPU;
  private gpu: GPU;
  private assembler: Assembler;
  private editor: EditorView | null = null;
  private runInterval: number | null = null;
  private speed = 500; // Default 500ms for slower visualization
  private sourceMap: number[] = []; // Maps instruction index to source line

  // DOM Elements
  private consoleEl!: HTMLElement;
  private registersEl!: HTMLElement;
  private memoryEl!: HTMLElement;
  private vramEl!: HTMLElement;
  private currentInstructionEl!: HTMLElement;
  private instructionCountEl!: HTMLElement;

  // Buttons
  private assembleBtn!: HTMLButtonElement;
  private runBtn!: HTMLButtonElement;
  private runMicroBtn!: HTMLButtonElement;
  private stepBtn!: HTMLButtonElement;
  private microStepBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private speedSlider!: HTMLInputElement;
  private speedValue!: HTMLElement;

  constructor() {
    this.cpu = new CPU();
    this.gpu = new GPU();
    this.cpu.setGPU(this.gpu);
    this.assembler = new Assembler();
    this.init();
  }

  private init(): void {
    // Create and mount app
    const app = createApp();
    document.getElementById('app')!.appendChild(app);

    // Cache DOM elements
    this.cacheElements();

    // Initialize displays
    initRegistersDisplay(this.registersEl);
    initMemoryDisplay(this.memoryEl);
    initVRAMDisplay(this.vramEl);
    initInstructionReference(document.getElementById('instructionRef')!);
    this.initExamplesDropdown();

    // Initialize editor
    const editorContainer = document.getElementById('editorContainer')!;
    this.editor = createEditor(editorContainer, examples[0]?.code ?? '', (code) => {
      this.updateLineCount(code);
    });

    // Set up event listeners
    this.setupEventListeners();

    // Subscribe to CPU events
    this.cpu.subscribe((event) => {
      switch (event.type) {
        case 'micro':
          if (event.microOp) {
            updatePipelineStage(event.microOp.stage);
            updateMicroOpDisplay(event.microOp, event.state);
            addFlowLogEntry(event.microOp);
            // Highlight line on fetch stage
            if (event.microOp.stage === 'fetch') {
              this.highlightCurrentLine();
            }
          }
          break;
        case 'step':
          updateRegistersDisplay(this.registersEl, event.state, event.changedRegisters);
          updateMemoryDisplay(this.memoryEl, event.state);
          updateFlagsDisplay(event.state);
          updateSpecialRegisters(event.state);
          this.updateCurrentInstruction();
          this.highlightCurrentLine();
          updatePipelineStage('idle');
          break;
        case 'halt':
          this.stop();
          log(this.consoleEl, 'Program halted', 'info');
          setStatus('halted');
          if (this.editor) highlightLine(this.editor, null);
          break;
        case 'error':
          this.stop();
          log(this.consoleEl, `Error: ${event.error}`, 'error');
          setStatus('halted');
          if (this.editor) highlightLine(this.editor, null);
          break;
        case 'reset':
          updateRegistersDisplay(this.registersEl, event.state);
          updateMemoryDisplay(this.memoryEl, event.state);
          updateFlagsDisplay(event.state);
          updateSpecialRegisters(event.state);
          this.currentInstructionEl.textContent = '-';
          resetCpuArchDisplay();
          if (this.editor) highlightLine(this.editor, null);
          break;
      }
    });

    // Subscribe to GPU events
    this.gpu.subscribe((event) => {
      updateGPUDisplay(event.state);

      if (event.microOp) {
        updateGPUMicroOpDisplay(event.microOp, event.state);
        addGPUFlowLogEntry(event.microOp);

        if (event.type === 'transfer') {
          animateGPUTransfer(event.microOp);
        }
      }

      if (event.type === 'complete' && event.microOp) {
        log(this.consoleEl, `GPU: ${event.microOp.description}`, 'success');
      }
    });

    // Initial UI state
    this.updateLineCount(examples[0]?.code ?? '');
    this.updateSpeedDisplay();
    log(this.consoleEl, 'Welcome to CPU & GPU Simulator!', 'info');
    log(this.consoleEl, 'Hover over buttons for descriptions.', 'info');
    setStatus('ready');
    this.updateUI();
  }

  private cacheElements(): void {
    this.consoleEl = document.getElementById('console')!;
    this.registersEl = document.getElementById('registers')!;
    this.memoryEl = document.getElementById('memoryView')!;
    this.vramEl = document.getElementById('vramView')!;
    this.currentInstructionEl = document.getElementById('currentInstruction')!;
    this.instructionCountEl = document.getElementById('instructionCount')!;

    this.assembleBtn = document.getElementById('assembleBtn') as HTMLButtonElement;
    this.runBtn = document.getElementById('runBtn') as HTMLButtonElement;
    this.runMicroBtn = document.getElementById('runMicroBtn') as HTMLButtonElement;
    this.stepBtn = document.getElementById('stepBtn') as HTMLButtonElement;
    this.microStepBtn = document.getElementById('microStepBtn') as HTMLButtonElement;
    this.stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    this.speedSlider = document.getElementById('speedSlider') as HTMLInputElement;
    this.speedValue = document.getElementById('speedValue')!;
  }

  private setupEventListeners(): void {
    this.assembleBtn.addEventListener('click', () => this.assemble());
    this.runBtn.addEventListener('click', () => this.run(false));
    this.runMicroBtn.addEventListener('click', () => this.run(true));
    this.stepBtn.addEventListener('click', () => this.step());
    this.microStepBtn.addEventListener('click', () => this.microStep());
    this.stopBtn.addEventListener('click', () => this.stop());
    this.resetBtn.addEventListener('click', () => this.reset());

    this.speedSlider.addEventListener('input', () => {
      this.updateSpeedDisplay();
    });

    // Editor expand/collapse toggle
    const expandBtn = document.getElementById('expandEditor');
    const editorContainer = document.getElementById('editorContainer');
    const editorOverlay = document.getElementById('editorOverlay');
    const editorCloseBtn = document.getElementById('editorCloseBtn');

    const toggleExpand = () => {
      if (editorContainer && editorOverlay && expandBtn) {
        const isExpanded = editorContainer.classList.toggle('expanded');
        editorOverlay.classList.toggle('active', isExpanded);
        expandBtn.textContent = isExpanded ? '✕' : '⤢';
        expandBtn.title = isExpanded ? 'Close expanded editor' : 'Expand editor fullscreen';
        expandBtn.setAttribute('aria-expanded', isExpanded.toString());
        expandBtn.setAttribute('aria-label', isExpanded ? 'Close expanded editor' : 'Expand editor fullscreen');
      }
    };

    if (expandBtn) {
      expandBtn.addEventListener('click', toggleExpand);
    }

    // Close button
    if (editorCloseBtn) {
      editorCloseBtn.addEventListener('click', toggleExpand);
    }

    // Click overlay to close
    if (editorOverlay) {
      editorOverlay.addEventListener('click', toggleExpand);
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && editorContainer?.classList.contains('expanded')) {
        toggleExpand();
      }
    });
  }

  private updateSpeedDisplay(): void {
    // Logarithmic scale: left=10s, middle=100ms, right=10ms
    // Slider: 0-200, where 100 is middle
    const sliderVal = parseInt(this.speedSlider.value, 10);

    // Use logarithmic interpolation
    // At 0: 10000ms, at 100: 100ms, at 200: 10ms
    // log10(10000) = 4, log10(100) = 2, log10(10) = 1
    const logMin = 1;   // log10(10)
    const logMax = 4;   // log10(10000)
    const logMid = 2;   // log10(100)

    let logSpeed: number;
    if (sliderVal <= 100) {
      // Left half: 10s to 100ms (log 4 to log 2)
      logSpeed = logMax - (sliderVal / 100) * (logMax - logMid);
    } else {
      // Right half: 100ms to 10ms (log 2 to log 1)
      logSpeed = logMid - ((sliderVal - 100) / 100) * (logMid - logMin);
    }

    this.speed = Math.round(Math.pow(10, logSpeed));

    // Format display
    if (this.speed >= 1000) {
      this.speedValue.textContent = `${(this.speed / 1000).toFixed(1)}s`;
    } else {
      this.speedValue.textContent = `${this.speed}ms`;
    }
  }

  private initExamplesDropdown(): void {
    const select = document.getElementById('exampleSelect') as HTMLSelectElement;

    // Group examples: CPU examples first, then GPU examples
    const cpuExamples = examples.filter(ex => !ex.id.startsWith('gpu'));
    const gpuExamples = examples.filter(ex => ex.id.startsWith('gpu'));

    let html = '<option value="">Load Example...</option>';

    html += '<optgroup label="CPU Examples">';
    cpuExamples.forEach(ex => {
      html += `<option value="${ex.id}">${ex.title}</option>`;
    });
    html += '</optgroup>';

    html += '<optgroup label="GPU Examples">';
    gpuExamples.forEach(ex => {
      html += `<option value="${ex.id}">${ex.title}</option>`;
    });
    html += '</optgroup>';

    select.innerHTML = html;

    select.addEventListener('change', () => {
      const exampleId = select.value;
      if (!exampleId) return;

      const example = examples.find((ex) => ex.id === exampleId);
      if (example && this.editor) {
        setEditorContent(this.editor, example.code);
        this.updateLineCount(example.code);
        this.reset();
        log(this.consoleEl, `Loaded: ${example.title}`, 'info');
        select.value = ''; // Reset dropdown
      }
    });
  }

  private updateLineCount(code: string): void {
    const lines = code.split('\n').length;
    const lineCountEl = document.getElementById('lineCount');
    if (lineCountEl) {
      lineCountEl.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
    }
  }

  private updateCurrentInstruction(): void {
    const program = this.cpu.getProgram();
    const state = this.cpu.getState();

    if (program.length > 0 && state.pc < program.length) {
      this.currentInstructionEl.textContent = `[${state.pc}] ${program[state.pc]}`;
    } else {
      this.currentInstructionEl.textContent = '-';
    }
  }

  private highlightCurrentLine(): void {
    if (!this.editor) return;
    const state = this.cpu.getState();
    const sourceLine = this.sourceMap[state.pc];
    if (sourceLine !== undefined) {
      highlightLine(this.editor, sourceLine);
    } else {
      highlightLine(this.editor, null);
    }
  }

  private assemble(): void {
    if (!this.editor) return;

    clearConsole(this.consoleEl);
    this.reset();

    const code = this.editor.state.doc.toString();
    const result = this.assembler.assemble(code);

    if (!result.success) {
      result.errors.forEach((err) => {
        log(this.consoleEl, `Line ${err.line}: ${err.message}`, 'error');
      });
      return;
    }

    if (!result.program || result.program.instructions.length === 0) {
      log(this.consoleEl, 'No code to assemble', 'error');
      return;
    }

    this.cpu.loadProgram(result.program);
    this.sourceMap = result.program.sourceMap;
    log(this.consoleEl, `Assembled ${result.program.instructions.length} instruction(s)`, 'success');
    this.instructionCountEl.textContent = result.program.instructions.length.toString();

    this.runBtn.disabled = false;
    this.runMicroBtn.disabled = false;
    this.stepBtn.disabled = false;
    this.microStepBtn.disabled = false;
    setStatus('ready');
    this.updateCurrentInstruction();
    this.highlightCurrentLine();
  }

  private run(microMode: boolean): void {
    if (this.cpu.isHalted()) return;

    setStatus('running');
    this.runBtn.disabled = true;
    this.runMicroBtn.disabled = true;
    this.stepBtn.disabled = true;
    this.microStepBtn.disabled = true;
    this.stopBtn.disabled = false;

    if (microMode) {
      // Micro mode: step through each micro-operation (CPU and GPU)
      this.runInterval = window.setInterval(() => {
        // First, check if GPU has pending work
        if (this.gpu.hasPendingWork()) {
          this.gpu.microStep();
        } else {
          const microOp = this.cpu.microStep();
          if (!microOp && this.cpu.isHalted()) {
            this.stop();
          }
        }
      }, this.speed);
    } else {
      // Normal mode: execute full instructions
      this.runInterval = window.setInterval(() => {
        if (!this.cpu.step()) {
          this.stop();
        }
      }, this.speed);
    }
  }

  private step(): void {
    if (this.cpu.isHalted()) return;
    // Complete any pending GPU work first
    if (this.gpu.hasPendingWork()) {
      this.gpu.fullCycle();
    }
    this.cpu.step();
  }

  private microStep(): void {
    if (this.cpu.isHalted()) return;
    // If GPU has pending work, step through GPU first
    if (this.gpu.hasPendingWork()) {
      this.gpu.microStep();
    } else {
      this.cpu.microStep();
    }
  }

  private stop(): void {
    if (this.runInterval !== null) {
      clearInterval(this.runInterval);
      this.runInterval = null;
    }

    const halted = this.cpu.isHalted();
    this.runBtn.disabled = halted;
    this.runMicroBtn.disabled = halted;
    this.stepBtn.disabled = halted;
    this.microStepBtn.disabled = halted;
    this.stopBtn.disabled = true;

    if (!halted) {
      setStatus('paused');
    }
  }

  private reset(): void {
    this.stop();
    this.cpu.reset();
    this.gpu.reset();
    resetGPUDisplay();
    this.sourceMap = [];
    this.runBtn.disabled = true;
    this.runMicroBtn.disabled = true;
    this.stepBtn.disabled = true;
    this.microStepBtn.disabled = true;
    this.stopBtn.disabled = true;
    this.instructionCountEl.textContent = '0';
    setStatus('ready');
  }

  private updateUI(): void {
    const state = this.cpu.getState();
    updateRegistersDisplay(this.registersEl, state);
    updateMemoryDisplay(this.memoryEl, state);
    updateFlagsDisplay(state);
    updateSpecialRegisters(state);
  }
}

// Initialize simulator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Simulator();
});
