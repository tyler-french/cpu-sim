import { AssembledProgram } from '../cpu/types';

export interface AssemblyError {
  line: number;
  message: string;
}

export interface AssemblyResult {
  success: boolean;
  program?: AssembledProgram;
  errors: AssemblyError[];
}

const VALID_INSTRUCTIONS = new Set([
  // CPU Instructions
  'MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD',
  'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR',
  'INC', 'DEC', 'CMP',
  'JMP', 'JZ', 'JE', 'JNZ', 'JNE', 'JG', 'JGE', 'JL', 'JLE',
  'LOAD', 'STORE', 'PUSH', 'POP',
  'CALL', 'RET', 'NOP', 'HALT', 'HLT',
  // GPU Instructions
  'GLOAD',    // GLOAD vramAddr, cpuAddr, length - CPU mem → VRAM
  'GSTORE',   // GSTORE cpuAddr, vramAddr, length - VRAM → CPU mem
  'GEXEC',    // GEXEC op, srcAddr, dstAddr, length - Execute GPU op
  'GWAIT',    // GWAIT - Wait for GPU to complete
  'GRESULT',  // GRESULT Rd - Get GPU result into register
  'GWRITE',   // GWRITE vramAddr, value - Write value to VRAM
  'GREAD',    // GREAD Rd, vramAddr - Read VRAM into register
]);

const GPU_OPERATIONS = new Set([
  'VADD', 'VSUB', 'VMUL', 'VDIV', 'VSCALE',
  'VDOT', 'VSUM', 'VMAX', 'VMIN',
  'VABS', 'VSQRT', 'VCOPY',
]);

export class Assembler {
  assemble(code: string): AssemblyResult {
    const lines = code.split('\n');
    const instructions: string[] = [];
    const labels: Record<string, number> = {};
    const sourceMap: number[] = [];
    const errors: AssemblyError[] = [];

    // First pass: collect labels and clean instructions
    let instructionIndex = 0;
    const cleanedLines: { line: number; content: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Remove comments
      const withoutComment = line.split(';')[0]!.trim();
      if (!withoutComment) continue;

      // Check for label
      const labelMatch = withoutComment.match(/^(\w+):(.*)$/);
      if (labelMatch) {
        const labelName = labelMatch[1]!;
        if (labels[labelName] !== undefined) {
          errors.push({ line: i + 1, message: `Duplicate label: ${labelName}` });
          continue;
        }
        labels[labelName] = instructionIndex;

        const rest = labelMatch[2]!.trim();
        if (rest) {
          cleanedLines.push({ line: i + 1, content: rest });
          instructionIndex++;
        }
      } else {
        cleanedLines.push({ line: i + 1, content: withoutComment });
        instructionIndex++;
      }
    }

    // Second pass: validate instructions
    for (const { line, content } of cleanedLines) {
      const parts = content.split(/[\s,]+/).filter((p) => p);
      if (parts.length === 0) continue;

      const op = parts[0]!.toUpperCase();

      if (!VALID_INSTRUCTIONS.has(op)) {
        errors.push({ line, message: `Unknown instruction: ${op}` });
        continue;
      }

      // Validate operand counts
      const operandCount = parts.length - 1;
      if (!this.validateOperandCount(op, operandCount)) {
        errors.push({
          line,
          message: `Invalid operand count for ${op}: expected ${this.getExpectedOperands(op)}, got ${operandCount}`,
        });
        continue;
      }

      // Validate register references
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i]!;
        if (/^R\d$/i.test(part)) {
          const regNum = parseInt(part.charAt(1), 10);
          if (regNum > 7) {
            errors.push({ line, message: `Invalid register: ${part} (valid: R0-R7)` });
          }
        }
      }

      // Check label references for jump instructions
      if (['JMP', 'JZ', 'JE', 'JNZ', 'JNE', 'JG', 'JGE', 'JL', 'JLE', 'CALL'].includes(op)) {
        const target = parts[1]!;
        if (!/^(0x[0-9A-Fa-f]+|\d+|R\d)$/i.test(target) && labels[target] === undefined) {
          errors.push({ line, message: `Undefined label: ${target}` });
        }
      }

      // Validate GPU operation names
      if (op === 'GEXEC') {
        const gpuOp = parts[1]?.toUpperCase();
        if (gpuOp && !GPU_OPERATIONS.has(gpuOp)) {
          errors.push({ line, message: `Unknown GPU operation: ${gpuOp}` });
        }
      }

      instructions.push(content);
      sourceMap.push(line);
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      program: { instructions, labels, sourceMap },
      errors: [],
    };
  }

  private validateOperandCount(op: string, count: number): boolean {
    const expected = this.getExpectedOperands(op);
    if (typeof expected === 'number') {
      return count === expected;
    }
    return count >= expected[0] && count <= expected[1];
  }

  private getExpectedOperands(op: string): number | [number, number] {
    switch (op) {
      case 'NOP':
      case 'RET':
      case 'HALT':
      case 'HLT':
      case 'GWAIT':
        return 0;
      case 'NOT':
      case 'INC':
      case 'DEC':
      case 'JMP':
      case 'JZ':
      case 'JE':
      case 'JNZ':
      case 'JNE':
      case 'JG':
      case 'JGE':
      case 'JL':
      case 'JLE':
      case 'CALL':
      case 'PUSH':
      case 'POP':
      case 'GRESULT':
        return 1;
      case 'GREAD':
      case 'GWRITE':
        return 2;
      case 'GLOAD':
      case 'GSTORE':
        return 3;
      case 'GEXEC':
        return [3, 4]; // GEXEC op, src, dst, len OR GEXEC VSCALE, src, dst, len, scalar
      default:
        return 2;
    }
  }
}
