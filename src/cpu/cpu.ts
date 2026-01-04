import {
  CPUState,
  CPUFlags,
  CPUEvent,
  CPUEventListener,
  AssembledProgram,
  CycleStage,
  MicroOp,
  REGISTER_COUNT,
  MEMORY_SIZE,
  STACK_START,
} from './types';
import { GPU } from '../gpu/gpu';
import type { GPUOperation } from '../gpu/types';

export class CPU {
  private registers: number[] = [];
  private memory: number[] = [];
  private pc = 0;
  private sp = STACK_START;
  private flags: CPUFlags = { zero: false, negative: false, carry: false };
  private halted = false;
  private cycles = 0;
  private program: string[] = [];
  private labels: Record<string, number> = {};
  private previousRegisters: number[] = [];
  private listeners: CPUEventListener[] = [];

  // Pipeline state
  private currentStage: CycleStage = 'idle';
  private instructionRegister = '';
  private microOps: MicroOp[] = [];
  private currentMicroOpIndex = 0;

  // GPU reference
  private gpu: GPU | null = null;

  constructor() {
    this.reset();
  }

  setGPU(gpu: GPU): void {
    this.gpu = gpu;
  }

  getMemory(): number[] {
    return this.memory;
  }

  reset(): void {
    this.registers = new Array(REGISTER_COUNT).fill(0);
    this.memory = new Array(MEMORY_SIZE).fill(0);
    this.pc = 0;
    this.sp = STACK_START;
    this.flags = { zero: false, negative: false, carry: false };
    this.halted = false;
    this.cycles = 0;
    this.program = [];
    this.labels = {};
    this.previousRegisters = [...this.registers];
    this.currentStage = 'idle';
    this.instructionRegister = '';
    this.microOps = [];
    this.currentMicroOpIndex = 0;
    this.emit({ type: 'reset', state: this.getState() });
  }

  loadProgram(assembled: AssembledProgram): void {
    this.reset();
    this.program = assembled.instructions;
    this.labels = assembled.labels;
  }

  getState(): CPUState {
    return {
      registers: [...this.registers],
      memory: [...this.memory],
      pc: this.pc,
      sp: this.sp,
      flags: { ...this.flags },
      halted: this.halted,
      cycles: this.cycles,
      currentStage: this.currentStage,
      instructionRegister: this.instructionRegister,
      microOps: [...this.microOps],
    };
  }

  getProgram(): string[] {
    return [...this.program];
  }

  isHalted(): boolean {
    return this.halted;
  }

  getCurrentStage(): CycleStage {
    return this.currentStage;
  }

  subscribe(listener: CPUEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: CPUEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  private setFlags(value: number): void {
    this.flags.zero = value === 0;
    this.flags.negative = value < 0 || (value & 0x8000) !== 0;
    this.flags.carry = value > 0xffff || value < 0;
  }

  private getRegisterIndex(reg: string): number {
    const match = reg.match(/^R(\d)$/i);
    if (match) {
      const idx = parseInt(match[1]!, 10);
      if (idx >= 0 && idx < REGISTER_COUNT) return idx;
    }
    throw new Error(`Invalid register: ${reg}`);
  }

  private parseValue(val: string): number {
    val = val.trim();

    if (/^R\d$/i.test(val)) {
      return this.registers[this.getRegisterIndex(val)]!;
    }

    if (/^0x[0-9A-Fa-f]+$/.test(val)) {
      return parseInt(val, 16);
    }

    if (/^-?\d+$/.test(val)) {
      return parseInt(val, 10);
    }

    if (Object.prototype.hasOwnProperty.call(this.labels, val)) {
      return this.labels[val]!;
    }

    throw new Error(`Invalid value: ${val}`);
  }

  private isRegister(val: string): boolean {
    return /^R\d$/i.test(val);
  }

  // Generate micro-operations for the current instruction
  private generateMicroOps(instruction: string): MicroOp[] {
    const parts = instruction.split(/[\s,]+/).filter((p) => p);
    const op = parts[0]!.toUpperCase();
    const ops: MicroOp[] = [];

    // FETCH stage
    ops.push({
      stage: 'fetch',
      description: `Fetch instruction from memory[${this.pc}]`,
      source: `Memory[${this.pc}]`,
      destination: 'IR',
    });

    // DECODE stage
    ops.push({
      stage: 'decode',
      description: `Decode: ${op}`,
      operation: op,
    });

    // EXECUTE stage - varies by instruction
    switch (op) {
      case 'MOV': {
        const dest = parts[1]!;
        const src = parts[2]!;
        if (this.isRegister(src)) {
          ops.push({
            stage: 'execute',
            description: `Read ${src}`,
            source: src,
            destination: 'ALU',
            value: this.parseValue(src),
          });
        } else {
          ops.push({
            stage: 'execute',
            description: `Load immediate ${src}`,
            source: 'Immediate',
            destination: 'ALU',
            value: this.parseValue(src),
          });
        }
        ops.push({
          stage: 'writeback',
          description: `Write to ${dest}`,
          source: 'ALU',
          destination: dest,
          value: this.parseValue(src) & 0xffff,
        });
        break;
      }
      case 'ADD':
      case 'SUB':
      case 'MUL':
      case 'DIV':
      case 'MOD':
      case 'AND':
      case 'OR':
      case 'XOR': {
        const dest = parts[1]!;
        const src = parts[2]!;
        const destVal = this.registers[this.getRegisterIndex(dest)]!;
        const srcVal = this.parseValue(src);
        ops.push({
          stage: 'execute',
          description: `Read ${dest} → ALU A`,
          source: dest,
          destination: 'ALU.A',
          value: destVal,
        });
        ops.push({
          stage: 'execute',
          description: this.isRegister(src) ? `Read ${src} → ALU B` : `Load ${src} → ALU B`,
          source: this.isRegister(src) ? src : 'Immediate',
          destination: 'ALU.B',
          value: srcVal,
        });
        const opSymbols: Record<string, string> = {
          ADD: '+', SUB: '-', MUL: '×', DIV: '÷', MOD: '%',
          AND: '&', OR: '|', XOR: '^'
        };
        let result: number;
        switch (op) {
          case 'ADD': result = destVal + srcVal; break;
          case 'SUB': result = destVal - srcVal; break;
          case 'MUL': result = destVal * srcVal; break;
          case 'DIV': result = Math.floor(destVal / srcVal); break;
          case 'MOD': result = destVal % srcVal; break;
          case 'AND': result = destVal & srcVal; break;
          case 'OR': result = destVal | srcVal; break;
          case 'XOR': result = destVal ^ srcVal; break;
          default: result = 0;
        }
        ops.push({
          stage: 'execute',
          description: `ALU: ${destVal} ${opSymbols[op]} ${srcVal} = ${result & 0xffff}`,
          source: 'ALU',
          operation: op,
          value: result & 0xffff,
        });
        ops.push({
          stage: 'writeback',
          description: `Write result to ${dest}`,
          source: 'ALU',
          destination: dest,
          value: result & 0xffff,
        });
        break;
      }
      case 'INC':
      case 'DEC': {
        const dest = parts[1]!;
        const destVal = this.registers[this.getRegisterIndex(dest)]!;
        const result = op === 'INC' ? destVal + 1 : destVal - 1;
        ops.push({
          stage: 'execute',
          description: `Read ${dest} → ALU`,
          source: dest,
          destination: 'ALU',
          value: destVal,
        });
        ops.push({
          stage: 'execute',
          description: `ALU: ${destVal} ${op === 'INC' ? '+' : '-'} 1 = ${result & 0xffff}`,
          source: 'ALU',
          operation: op,
          value: result & 0xffff,
        });
        ops.push({
          stage: 'writeback',
          description: `Write result to ${dest}`,
          source: 'ALU',
          destination: dest,
          value: result & 0xffff,
        });
        break;
      }
      case 'NOT': {
        const dest = parts[1]!;
        const destVal = this.registers[this.getRegisterIndex(dest)]!;
        const result = ~destVal & 0xffff;
        ops.push({
          stage: 'execute',
          description: `Read ${dest} → ALU`,
          source: dest,
          destination: 'ALU',
          value: destVal,
        });
        ops.push({
          stage: 'execute',
          description: `ALU: NOT ${destVal} = ${result}`,
          source: 'ALU',
          operation: 'NOT',
          value: result,
        });
        ops.push({
          stage: 'writeback',
          description: `Write result to ${dest}`,
          source: 'ALU',
          destination: dest,
          value: result,
        });
        break;
      }
      case 'SHL':
      case 'SHR': {
        const dest = parts[1]!;
        const amt = this.parseValue(parts[2]!);
        const destVal = this.registers[this.getRegisterIndex(dest)]!;
        const result = op === 'SHL' ? (destVal << amt) & 0xffff : destVal >>> amt;
        ops.push({
          stage: 'execute',
          description: `Read ${dest} → ALU`,
          source: dest,
          destination: 'ALU',
          value: destVal,
        });
        ops.push({
          stage: 'execute',
          description: `ALU: ${destVal} ${op === 'SHL' ? '<<' : '>>'} ${amt} = ${result}`,
          source: 'ALU',
          operation: op,
          value: result,
        });
        ops.push({
          stage: 'writeback',
          description: `Write result to ${dest}`,
          source: 'ALU',
          destination: dest,
          value: result,
        });
        break;
      }
      case 'CMP': {
        const a = this.parseValue(parts[1]!);
        const b = this.parseValue(parts[2]!);
        ops.push({
          stage: 'execute',
          description: `Load ${parts[1]} → ALU A`,
          source: this.isRegister(parts[1]!) ? parts[1]! : 'Immediate',
          destination: 'ALU.A',
          value: a,
        });
        ops.push({
          stage: 'execute',
          description: `Load ${parts[2]} → ALU B`,
          source: this.isRegister(parts[2]!) ? parts[2]! : 'Immediate',
          destination: 'ALU.B',
          value: b,
        });
        ops.push({
          stage: 'execute',
          description: `ALU: Compare ${a} - ${b} = ${a - b} → Update flags`,
          source: 'ALU',
          operation: 'CMP',
          destination: 'Flags',
        });
        break;
      }
      case 'JMP': {
        const target = this.parseValue(parts[1]!);
        ops.push({
          stage: 'execute',
          description: `Load target address: ${target}`,
          source: 'Immediate',
          destination: 'PC',
          value: target,
        });
        break;
      }
      case 'JZ':
      case 'JE':
      case 'JNZ':
      case 'JNE':
      case 'JG':
      case 'JGE':
      case 'JL':
      case 'JLE': {
        const target = this.parseValue(parts[1]!);
        const conditionMap: Record<string, string> = {
          JZ: 'Zero=1', JE: 'Zero=1',
          JNZ: 'Zero=0', JNE: 'Zero=0',
          JG: 'Zero=0 AND Neg=0',
          JGE: 'Neg=0',
          JL: 'Neg=1',
          JLE: 'Zero=1 OR Neg=1',
        };
        ops.push({
          stage: 'execute',
          description: `Check condition: ${conditionMap[op]}`,
          source: 'Flags',
          operation: op,
        });
        ops.push({
          stage: 'execute',
          description: `Target address: ${target}`,
          destination: 'PC (conditional)',
          value: target,
        });
        break;
      }
      case 'LOAD': {
        const dest = parts[1]!;
        const addr = this.parseValue(parts[2]!);
        const value = this.memory[addr & 0xff]!;
        ops.push({
          stage: 'execute',
          description: `Calculate address: ${addr}`,
          source: 'Immediate',
          destination: 'MAR',
          value: addr,
        });
        ops.push({
          stage: 'execute',
          description: `Read Memory[${addr}] = ${value}`,
          source: `Memory[${addr}]`,
          destination: 'MDR',
          value: value,
        });
        ops.push({
          stage: 'writeback',
          description: `Write to ${dest}`,
          source: 'MDR',
          destination: dest,
          value: value,
        });
        break;
      }
      case 'STORE': {
        const addr = this.parseValue(parts[1]!);
        const value = this.parseValue(parts[2]!);
        ops.push({
          stage: 'execute',
          description: `Calculate address: ${addr}`,
          source: 'Immediate',
          destination: 'MAR',
          value: addr,
        });
        ops.push({
          stage: 'execute',
          description: `Load value: ${value}`,
          source: this.isRegister(parts[2]!) ? parts[2]! : 'Immediate',
          destination: 'MDR',
          value: value,
        });
        ops.push({
          stage: 'writeback',
          description: `Write ${value} → Memory[${addr}]`,
          source: 'MDR',
          destination: `Memory[${addr}]`,
          value: value,
        });
        break;
      }
      case 'PUSH': {
        const value = this.parseValue(parts[1]!);
        ops.push({
          stage: 'execute',
          description: `Read SP = ${this.sp}`,
          source: 'SP',
          destination: 'MAR',
          value: this.sp,
        });
        ops.push({
          stage: 'execute',
          description: `Load value: ${value}`,
          source: this.isRegister(parts[1]!) ? parts[1]! : 'Immediate',
          destination: 'MDR',
          value: value,
        });
        ops.push({
          stage: 'writeback',
          description: `Write ${value} → Memory[${this.sp}]`,
          source: 'MDR',
          destination: `Memory[${this.sp}]`,
          value: value,
        });
        ops.push({
          stage: 'writeback',
          description: `Decrement SP: ${this.sp} → ${(this.sp - 1) & 0xff}`,
          source: 'ALU',
          destination: 'SP',
          value: (this.sp - 1) & 0xff,
        });
        break;
      }
      case 'POP': {
        const dest = parts[1]!;
        const newSp = (this.sp + 1) & 0xff;
        const value = this.memory[newSp]!;
        ops.push({
          stage: 'execute',
          description: `Increment SP: ${this.sp} → ${newSp}`,
          source: 'SP',
          destination: 'SP',
          value: newSp,
        });
        ops.push({
          stage: 'execute',
          description: `Read Memory[${newSp}] = ${value}`,
          source: `Memory[${newSp}]`,
          destination: 'MDR',
          value: value,
        });
        ops.push({
          stage: 'writeback',
          description: `Write to ${dest}`,
          source: 'MDR',
          destination: dest,
          value: value,
        });
        break;
      }
      case 'CALL': {
        const target = this.parseValue(parts[1]!);
        ops.push({
          stage: 'execute',
          description: `Save return address: ${this.pc + 1}`,
          source: 'PC+1',
          destination: `Memory[${this.sp}]`,
          value: this.pc + 1,
        });
        ops.push({
          stage: 'execute',
          description: `Decrement SP: ${this.sp} → ${(this.sp - 1) & 0xff}`,
          destination: 'SP',
          value: (this.sp - 1) & 0xff,
        });
        ops.push({
          stage: 'writeback',
          description: `Jump to ${target}`,
          destination: 'PC',
          value: target,
        });
        break;
      }
      case 'RET': {
        const newSp = (this.sp + 1) & 0xff;
        const returnAddr = this.memory[newSp]!;
        ops.push({
          stage: 'execute',
          description: `Increment SP: ${this.sp} → ${newSp}`,
          destination: 'SP',
          value: newSp,
        });
        ops.push({
          stage: 'execute',
          description: `Read return address: ${returnAddr}`,
          source: `Memory[${newSp}]`,
          destination: 'PC',
          value: returnAddr,
        });
        break;
      }
      case 'NOP':
        ops.push({
          stage: 'execute',
          description: 'No operation',
          operation: 'NOP',
        });
        break;
      case 'HALT':
      case 'HLT':
        ops.push({
          stage: 'execute',
          description: 'Halt CPU',
          operation: 'HALT',
        });
        break;
      // GPU Instructions
      case 'GLOAD': {
        const vramAddr = this.parseValue(parts[1]!);
        const cpuAddr = this.parseValue(parts[2]!);
        const length = this.parseValue(parts[3]!);
        ops.push({
          stage: 'execute',
          description: `GPU: Load ${length} values from CPU[${cpuAddr}] to VRAM[${vramAddr}]`,
          source: `CPU Memory[${cpuAddr}]`,
          destination: `VRAM[${vramAddr}]`,
          operation: 'GLOAD',
        });
        break;
      }
      case 'GSTORE': {
        const cpuAddr = this.parseValue(parts[1]!);
        const vramAddr = this.parseValue(parts[2]!);
        const length = this.parseValue(parts[3]!);
        ops.push({
          stage: 'execute',
          description: `GPU: Store ${length} values from VRAM[${vramAddr}] to CPU[${cpuAddr}]`,
          source: `VRAM[${vramAddr}]`,
          destination: `CPU Memory[${cpuAddr}]`,
          operation: 'GSTORE',
        });
        break;
      }
      case 'GEXEC': {
        const gpuOp = parts[1]!.toUpperCase();
        const srcAddr = this.parseValue(parts[2]!);
        const dstAddr = this.parseValue(parts[3]!);
        const length = this.parseValue(parts[4]!);
        ops.push({
          stage: 'execute',
          description: `GPU: Execute ${gpuOp} on ${length} elements (parallel)`,
          source: `VRAM[${srcAddr}]`,
          destination: `VRAM[${dstAddr}]`,
          operation: gpuOp,
        });
        break;
      }
      case 'GWAIT':
        ops.push({
          stage: 'execute',
          description: 'GPU: Wait for operation to complete',
          operation: 'GWAIT',
        });
        break;
      case 'GRESULT': {
        const dest = parts[1]!;
        ops.push({
          stage: 'execute',
          description: `GPU: Read result into ${dest}`,
          source: 'GPU Result',
          destination: dest,
          operation: 'GRESULT',
        });
        break;
      }
      case 'GWRITE': {
        const addr = this.parseValue(parts[1]!);
        const value = this.parseValue(parts[2]!);
        ops.push({
          stage: 'execute',
          description: `GPU: Write ${value} to VRAM[${addr}]`,
          destination: `VRAM[${addr}]`,
          value: value,
          operation: 'GWRITE',
        });
        break;
      }
      case 'GREAD': {
        const dest = parts[1]!;
        const addr = this.parseValue(parts[2]!);
        ops.push({
          stage: 'execute',
          description: `GPU: Read VRAM[${addr}] into ${dest}`,
          source: `VRAM[${addr}]`,
          destination: dest,
          operation: 'GREAD',
        });
        break;
      }
      default:
        ops.push({
          stage: 'execute',
          description: `Unknown: ${op}`,
          operation: op,
        });
    }

    return ops;
  }

  private executeInstruction(instruction: string): void {
    const parts = instruction.split(/[\s,]+/).filter((p) => p);
    const op = parts[0]!.toUpperCase();

    this.cycles++;

    switch (op) {
      case 'MOV': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        this.registers[destIdx] = value & 0xffff;
        break;
      }
      case 'ADD': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        const result = this.registers[destIdx]! + value;
        this.registers[destIdx] = result & 0xffff;
        this.setFlags(result);
        break;
      }
      case 'SUB': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        const result = this.registers[destIdx]! - value;
        this.registers[destIdx] = result & 0xffff;
        this.setFlags(result);
        break;
      }
      case 'MUL': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        const result = this.registers[destIdx]! * value;
        this.registers[destIdx] = result & 0xffff;
        this.setFlags(result);
        break;
      }
      case 'DIV': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        if (value === 0) throw new Error('Division by zero');
        const result = Math.floor(this.registers[destIdx]! / value);
        this.registers[destIdx] = result & 0xffff;
        this.setFlags(result);
        break;
      }
      case 'MOD': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        if (value === 0) throw new Error('Division by zero');
        const result = this.registers[destIdx]! % value;
        this.registers[destIdx] = result & 0xffff;
        this.setFlags(result);
        break;
      }
      case 'AND': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        this.registers[destIdx]! &= value;
        this.setFlags(this.registers[destIdx]!);
        break;
      }
      case 'OR': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        this.registers[destIdx]! |= value;
        this.setFlags(this.registers[destIdx]!);
        break;
      }
      case 'XOR': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        this.registers[destIdx]! ^= value;
        this.setFlags(this.registers[destIdx]!);
        break;
      }
      case 'NOT': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        this.registers[destIdx] = ~this.registers[destIdx]! & 0xffff;
        this.setFlags(this.registers[destIdx]!);
        break;
      }
      case 'SHL': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        this.registers[destIdx] = (this.registers[destIdx]! << value) & 0xffff;
        this.setFlags(this.registers[destIdx]!);
        break;
      }
      case 'SHR': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const value = this.parseValue(parts[2]!);
        this.registers[destIdx] = this.registers[destIdx]! >>> value;
        this.setFlags(this.registers[destIdx]!);
        break;
      }
      case 'INC': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const result = this.registers[destIdx]! + 1;
        this.registers[destIdx] = result & 0xffff;
        this.setFlags(result);
        break;
      }
      case 'DEC': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const result = this.registers[destIdx]! - 1;
        this.registers[destIdx] = result & 0xffff;
        this.setFlags(result);
        break;
      }
      case 'CMP': {
        const reg1 = this.parseValue(parts[1]!);
        const reg2 = this.parseValue(parts[2]!);
        const result = reg1 - reg2;
        this.setFlags(result);
        break;
      }
      case 'JMP': {
        const target = this.parseValue(parts[1]!);
        this.pc = target;
        return;
      }
      case 'JZ':
      case 'JE': {
        if (this.flags.zero) {
          this.pc = this.parseValue(parts[1]!);
          return;
        }
        break;
      }
      case 'JNZ':
      case 'JNE': {
        if (!this.flags.zero) {
          this.pc = this.parseValue(parts[1]!);
          return;
        }
        break;
      }
      case 'JG': {
        if (!this.flags.zero && !this.flags.negative) {
          this.pc = this.parseValue(parts[1]!);
          return;
        }
        break;
      }
      case 'JGE': {
        if (!this.flags.negative) {
          this.pc = this.parseValue(parts[1]!);
          return;
        }
        break;
      }
      case 'JL': {
        if (this.flags.negative) {
          this.pc = this.parseValue(parts[1]!);
          return;
        }
        break;
      }
      case 'JLE': {
        if (this.flags.zero || this.flags.negative) {
          this.pc = this.parseValue(parts[1]!);
          return;
        }
        break;
      }
      case 'LOAD': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        const addr = this.parseValue(parts[2]!);
        this.registers[destIdx] = this.memory[addr & 0xff]!;
        break;
      }
      case 'STORE': {
        const addr = this.parseValue(parts[1]!);
        const value = this.parseValue(parts[2]!);
        this.memory[addr & 0xff] = value & 0xffff;
        break;
      }
      case 'PUSH': {
        const value = this.parseValue(parts[1]!);
        this.memory[this.sp] = value;
        this.sp = (this.sp - 1) & 0xff;
        break;
      }
      case 'POP': {
        const destIdx = this.getRegisterIndex(parts[1]!);
        this.sp = (this.sp + 1) & 0xff;
        this.registers[destIdx] = this.memory[this.sp]!;
        break;
      }
      case 'CALL': {
        const target = this.parseValue(parts[1]!);
        this.memory[this.sp] = this.pc + 1;
        this.sp = (this.sp - 1) & 0xff;
        this.pc = target;
        return;
      }
      case 'RET': {
        this.sp = (this.sp + 1) & 0xff;
        this.pc = this.memory[this.sp]!;
        return;
      }
      case 'NOP':
        break;
      case 'HALT':
      case 'HLT':
        this.halted = true;
        break;
      // GPU Instructions
      case 'GLOAD': {
        // GLOAD vramAddr, cpuAddr, length
        if (!this.gpu) throw new Error('GPU not available');
        const vramAddr = this.parseValue(parts[1]!);
        const cpuAddr = this.parseValue(parts[2]!);
        const length = this.parseValue(parts[3]!);
        this.gpu.loadToVRAM(this.memory, cpuAddr, vramAddr, length);
        break;
      }
      case 'GSTORE': {
        // GSTORE cpuAddr, vramAddr, length
        if (!this.gpu) throw new Error('GPU not available');
        const cpuAddr = this.parseValue(parts[1]!);
        const vramAddr = this.parseValue(parts[2]!);
        const length = this.parseValue(parts[3]!);
        this.gpu.storeFromVRAM(this.memory, vramAddr, cpuAddr, length);
        break;
      }
      case 'GEXEC': {
        // GEXEC op, srcAddr, dstAddr, length [, scalar]
        if (!this.gpu) throw new Error('GPU not available');
        const gpuOp = parts[1]!.toUpperCase() as GPUOperation;
        const srcAddr = this.parseValue(parts[2]!);
        const dstAddr = this.parseValue(parts[3]!);
        const length = this.parseValue(parts[4]!);
        const scalar = parts[5] ? this.parseValue(parts[5]) : 0;
        this.gpu.startOperation(gpuOp, srcAddr, dstAddr, length, scalar);
        break;
      }
      case 'GWAIT': {
        // GWAIT - Wait for GPU (in our sim, we execute all cycles immediately)
        if (!this.gpu) throw new Error('GPU not available');
        while (this.gpu.isBusy()) {
          this.gpu.cycle();
        }
        break;
      }
      case 'GRESULT': {
        // GRESULT Rd - Get GPU result into register
        if (!this.gpu) throw new Error('GPU not available');
        const destIdx = this.getRegisterIndex(parts[1]!);
        this.registers[destIdx] = this.gpu.getResult();
        break;
      }
      case 'GWRITE': {
        // GWRITE vramAddr, value
        if (!this.gpu) throw new Error('GPU not available');
        const addr = this.parseValue(parts[1]!);
        const value = this.parseValue(parts[2]!);
        this.gpu.writeVRAM(addr, value);
        break;
      }
      case 'GREAD': {
        // GREAD Rd, vramAddr
        if (!this.gpu) throw new Error('GPU not available');
        const destIdx = this.getRegisterIndex(parts[1]!);
        const addr = this.parseValue(parts[2]!);
        this.registers[destIdx] = this.gpu.readVRAM(addr);
        break;
      }
      default:
        throw new Error(`Unknown instruction: ${op}`);
    }

    this.pc++;
  }

  // Execute one micro-operation (for detailed stepping)
  microStep(): MicroOp | null {
    if (this.halted || this.pc >= this.program.length) {
      this.halted = true;
      this.currentStage = 'idle';
      return null;
    }

    // Start new instruction if needed
    if (this.currentMicroOpIndex >= this.microOps.length) {
      this.instructionRegister = this.program[this.pc]!;
      this.microOps = this.generateMicroOps(this.instructionRegister);
      this.currentMicroOpIndex = 0;
    }

    const microOp = this.microOps[this.currentMicroOpIndex]!;
    this.currentStage = microOp.stage;
    this.currentMicroOpIndex++;

    // Emit micro event
    this.emit({
      type: 'micro',
      state: this.getState(),
      instruction: this.instructionRegister,
      microOp,
    });

    // If this was the last micro-op, execute the instruction
    if (this.currentMicroOpIndex >= this.microOps.length) {
      this.previousRegisters = [...this.registers];

      try {
        this.executeInstruction(this.instructionRegister);

        const changedRegisters: number[] = [];
        for (let i = 0; i < REGISTER_COUNT; i++) {
          if (this.registers[i] !== this.previousRegisters[i]) {
            changedRegisters.push(i);
          }
        }

        this.emit({
          type: 'step',
          state: this.getState(),
          instruction: this.instructionRegister,
          changedRegisters,
        });

        this.currentStage = 'idle';
        this.microOps = [];
        this.currentMicroOpIndex = 0;

        if (this.halted) {
          this.emit({ type: 'halt', state: this.getState() });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.emit({
          type: 'error',
          state: this.getState(),
          instruction: this.instructionRegister,
          error: message,
        });
        this.halted = true;
      }
    }

    return microOp;
  }

  // Execute full instruction (all micro-ops at once)
  step(): boolean {
    if (this.halted || this.pc >= this.program.length) {
      this.halted = true;
      this.emit({ type: 'halt', state: this.getState() });
      return false;
    }

    this.previousRegisters = [...this.registers];
    const instruction = this.program[this.pc]!;
    this.instructionRegister = instruction;
    this.microOps = this.generateMicroOps(instruction);

    try {
      this.executeInstruction(instruction);

      const changedRegisters: number[] = [];
      for (let i = 0; i < REGISTER_COUNT; i++) {
        if (this.registers[i] !== this.previousRegisters[i]) {
          changedRegisters.push(i);
        }
      }

      this.currentStage = 'idle';

      this.emit({
        type: 'step',
        state: this.getState(),
        instruction,
        changedRegisters,
      });

      return !this.halted;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emit({
        type: 'error',
        state: this.getState(),
        instruction,
        error: message,
      });
      this.halted = true;
      return false;
    }
  }
}
