export interface ExampleProgram {
  id: string;
  title: string;
  description: string;
  code: string;
}

export const examples: ExampleProgram[] = [
  {
    id: 'infinite',
    title: 'Infinite Loop',
    description: 'Runs forever, incrementing counters',
    code: `; Infinite Loop
; Runs forever, incrementing counters
; Click "Stop" to pause execution

MOV R0, 0       ; Initialize counter

loop:
    INC R0      ; Increment R0
    ADD R1, 2   ; Increment R1 by 2
    JMP loop    ; Loop forever

; This HALT is never reached
HALT`,
  },
  {
    id: 'counter',
    title: 'Simple Counter',
    description: 'Counts from 0 to 10',
    code: `; Simple Counter
; Counts from 0 to 10

MOV R0, 0       ; Initialize counter to 0
MOV R1, 10      ; Set limit to 10

loop:
    INC R0      ; Increment counter
    CMP R0, R1  ; Compare with limit
    JNZ loop    ; If not equal, continue loop

HALT            ; Stop when done`,
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci Sequence',
    description: 'Calculates Fibonacci numbers',
    code: `; Fibonacci Sequence
; Calculates Fibonacci numbers
; R0 = current, R1 = previous, R2 = temp

MOV R0, 1       ; First Fibonacci number
MOV R1, 0       ; "Previous" number
MOV R3, 12      ; How many to calculate
MOV R4, 0       ; Counter

loop:
    MOV R2, R0  ; Save current
    ADD R0, R1  ; current = current + previous
    MOV R1, R2  ; previous = old current

    INC R4      ; Increment counter
    CMP R4, R3  ; Compare with limit
    JNZ loop    ; Continue if not done

HALT`,
  },
  {
    id: 'multiply',
    title: 'Multiplication',
    description: 'Multiplies using repeated addition',
    code: `; Multiplication using Addition
; Multiplies R0 * R1 using repeated addition
; Result stored in R2

MOV R0, 7       ; First number
MOV R1, 6       ; Second number
MOV R2, 0       ; Result (accumulator)

loop:
    CMP R1, 0   ; Check if multiplier is zero
    JZ done     ; If zero, we're done

    ADD R2, R0  ; Add first number to result
    DEC R1      ; Decrement multiplier
    JMP loop    ; Continue

done:
HALT            ; R2 now contains 7 * 6 = 42`,
  },
  {
    id: 'memory',
    title: 'Memory Operations',
    description: 'Demonstrates LOAD and STORE',
    code: `; Memory Operations Demo
; Shows LOAD and STORE instructions

; Store values in memory
MOV R0, 42
STORE 0x10, R0  ; Store 42 at address 0x10

MOV R0, 100
STORE 0x11, R0  ; Store 100 at address 0x11

; Clear R0 to prove LOAD works
MOV R0, 0

; Load values back
LOAD R1, 0x10   ; R1 = 42
LOAD R2, 0x11   ; R2 = 100

; Add them together
MOV R3, R1
ADD R3, R2      ; R3 = 142

; Store result
STORE 0x12, R3  ; Store result at 0x12

HALT`,
  },
  {
    id: 'subroutine',
    title: 'Subroutine Call',
    description: 'Demonstrates CALL and RET',
    code: `; Subroutine Demo
; Demonstrates CALL and RET instructions

MOV R0, 5       ; First operand
MOV R1, 3       ; Second operand

CALL add_nums   ; Call the subroutine
; Result is now in R2

MOV R3, R2      ; Copy result to R3
HALT

; Subroutine: add two numbers
; Input: R0, R1
; Output: R2
add_nums:
    MOV R2, R0  ; Copy first operand
    ADD R2, R1  ; Add second operand
    RET         ; Return to caller`,
  },
  {
    id: 'stack',
    title: 'Stack Operations',
    description: 'Demonstrates PUSH and POP',
    code: `; Stack Operations Demo
; Shows PUSH and POP instructions

; Push some values onto the stack
MOV R0, 10
PUSH R0         ; Push 10

MOV R0, 20
PUSH R0         ; Push 20

MOV R0, 30
PUSH R0         ; Push 30

; Clear registers
MOV R0, 0

; Pop values back (in reverse order)
POP R1          ; R1 = 30
POP R2          ; R2 = 20
POP R3          ; R3 = 10

HALT`,
  },
  {
    id: 'bitwise',
    title: 'Bitwise Operations',
    description: 'AND, OR, XOR, shift operations',
    code: `; Bitwise Operations Demo
; Demonstrates AND, OR, XOR, shifts

MOV R0, 0xFF    ; 11111111 in binary
MOV R1, 0x0F    ; 00001111 in binary

; AND operation
MOV R2, R0
AND R2, R1      ; R2 = 0x0F (00001111)

; OR operation
MOV R3, 0xF0    ; 11110000
OR R3, R1       ; R3 = 0xFF (11111111)

; XOR operation
MOV R4, R0
XOR R4, R1      ; R4 = 0xF0 (11110000)

; Shift left
MOV R5, 1
SHL R5, 4       ; R5 = 16 (00010000)

; Shift right
MOV R6, 128
SHR R6, 3       ; R6 = 16 (00010000)

HALT`,
  },
  // GPU Examples
  {
    id: 'gpu-intro',
    title: 'GPU: Vector Add',
    description: 'Add two vectors in parallel on GPU',
    code: `; GPU Vector Addition
; Demonstrates parallel processing on GPU
;
; The GPU has 8 cores that work in PARALLEL
; It processes 8 elements simultaneously!
;
; Vector A: [1, 2, 3, 4, 5, 6, 7, 8] at VRAM[0]
; Vector B: [10,10,10,10,10,10,10,10] at VRAM[16]
; Result:   [11,12,13,14,15,16,17,18] at VRAM[16]

; First, set up data in CPU memory
MOV R0, 1
STORE 0x00, R0    ; A[0] = 1
MOV R0, 2
STORE 0x01, R0    ; A[1] = 2
MOV R0, 3
STORE 0x02, R0    ; A[2] = 3
MOV R0, 4
STORE 0x03, R0    ; A[3] = 4
MOV R0, 5
STORE 0x04, R0    ; A[4] = 5
MOV R0, 6
STORE 0x05, R0    ; A[5] = 6
MOV R0, 7
STORE 0x06, R0    ; A[6] = 7
MOV R0, 8
STORE 0x07, R0    ; A[7] = 8

; Store vector B (all 10s)
MOV R0, 10
STORE 0x10, R0
STORE 0x11, R0
STORE 0x12, R0
STORE 0x13, R0
STORE 0x14, R0
STORE 0x15, R0
STORE 0x16, R0
STORE 0x17, R0

; ====== GPU OPERATIONS ======

; 1. Transfer vectors to GPU VRAM
GLOAD 0, 0x00, 8   ; CPU[0x00] → VRAM[0], 8 values
GLOAD 16, 0x10, 8  ; CPU[0x10] → VRAM[16], 8 values

; 2. Execute parallel vector add
;    GEXEC VADD, src, dst, length
;    Adds VRAM[src] to VRAM[dst]
;    ALL 8 CORES WORK SIMULTANEOUSLY!
GEXEC VADD, 0, 16, 8
GWAIT             ; Wait for GPU to finish

; 3. Transfer result back to CPU
GSTORE 0x20, 16, 8  ; VRAM[16] → CPU[0x20]

; Load first result to show it worked
LOAD R1, 0x20     ; R1 = 11 (1+10)
LOAD R2, 0x21     ; R2 = 12 (2+10)

HALT`,
  },
  {
    id: 'gpu-scale',
    title: 'GPU: Scale Vector',
    description: 'Multiply all elements by a scalar',
    code: `; GPU Vector Scaling
; Multiply every element by a constant
; This shows how GPUs excel at data-parallel ops
;
; Input:  [2, 4, 6, 8, 10, 12, 14, 16]
; Scale:  x3
; Output: [6, 12, 18, 24, 30, 36, 42, 48]

; Set up input data
MOV R0, 2
STORE 0x00, R0
MOV R0, 4
STORE 0x01, R0
MOV R0, 6
STORE 0x02, R0
MOV R0, 8
STORE 0x03, R0
MOV R0, 10
STORE 0x04, R0
MOV R0, 12
STORE 0x05, R0
MOV R0, 14
STORE 0x06, R0
MOV R0, 16
STORE 0x07, R0

; Transfer to GPU
GLOAD 0, 0x00, 8

; Scale by 3 (all 8 elements in parallel!)
; GEXEC VSCALE, src, dst, len, scalar
GEXEC VSCALE, 0, 0, 8, 3
GWAIT

; Get results back
GSTORE 0x10, 0, 8

; Check results
LOAD R1, 0x10     ; R1 = 6  (2*3)
LOAD R2, 0x11     ; R2 = 12 (4*3)
LOAD R3, 0x17     ; R3 = 48 (16*3)

HALT`,
  },
  {
    id: 'gpu-dotproduct',
    title: 'GPU: Dot Product',
    description: 'Compute dot product of two vectors',
    code: `; GPU Dot Product
; Computes: A · B = sum(A[i] * B[i])
;
; This is a "reduction" operation:
; 1. GPU multiplies pairs in parallel
; 2. GPU sums all products
;
; A = [1, 2, 3, 4]
; B = [2, 2, 2, 2]
; A·B = 1*2 + 2*2 + 3*2 + 4*2
;     = 2 + 4 + 6 + 8 = 20

; Set up vector A
MOV R0, 1
STORE 0x00, R0
MOV R0, 2
STORE 0x01, R0
MOV R0, 3
STORE 0x02, R0
MOV R0, 4
STORE 0x03, R0

; Set up vector B (all 2s)
MOV R0, 2
STORE 0x10, R0
STORE 0x11, R0
STORE 0x12, R0
STORE 0x13, R0

; Load to GPU
GLOAD 0, 0x00, 4   ; Vector A → VRAM[0]
GLOAD 8, 0x10, 4   ; Vector B → VRAM[8]

; Compute dot product
; VDOT multiplies element-wise and sums
GEXEC VDOT, 0, 8, 4
GWAIT

; Get the result (stored in GPU result register)
GRESULT R7        ; R7 = 20

HALT`,
  },
  {
    id: 'gpu-parallel-demo',
    title: 'GPU: Parallel Demo',
    description: 'Shows 8 cores working together',
    code: `; GPU Parallel Processing Demo
; Watch the GPU cores light up!
;
; This demo shows why GPUs are fast:
; - CPU processes 1 element at a time
; - GPU processes 8 elements SIMULTANEOUSLY
;
; We'll square 16 numbers. The GPU does
; this in just 2 cycles (16/8 = 2)!

; Initialize 16 values: 1,2,3...16
MOV R0, 1
MOV R1, 0         ; Counter/address

init_loop:
    STORE R1, R0  ; Store value
    INC R0
    INC R1
    CMP R1, 16
    JNZ init_loop

; Transfer all 16 values to GPU
GLOAD 0, 0, 16

; Square each element (multiply by itself)
; VMUL: dst[i] = src[i] * dst[i]
; First, copy to make src=dst
GEXEC VCOPY, 0, 32, 16
GWAIT
GEXEC VMUL, 0, 32, 16
GWAIT

; Get results back
GSTORE 0x20, 32, 16

; Check: 4^2=16, 8^2=64
LOAD R2, 0x23     ; Index 3 (value 4) → 16
LOAD R3, 0x27     ; Index 7 (value 8) → 64

HALT`,
  },
  {
    id: 'gpu-sum',
    title: 'GPU: Sum Reduction',
    description: 'Sum all elements using GPU',
    code: `; GPU Sum Reduction
; Add up all elements of a vector
;
; This shows a "reduction" operation where
; many values become one (parallel reduce)
;
; Sum of [1,2,3,4,5,6,7,8] = 36

; Set up values 1-8
MOV R0, 1
STORE 0x00, R0
MOV R0, 2
STORE 0x01, R0
MOV R0, 3
STORE 0x02, R0
MOV R0, 4
STORE 0x03, R0
MOV R0, 5
STORE 0x04, R0
MOV R0, 6
STORE 0x05, R0
MOV R0, 7
STORE 0x06, R0
MOV R0, 8
STORE 0x07, R0

; Transfer to GPU
GLOAD 0, 0, 8

; Execute sum reduction
GEXEC VSUM, 0, 0, 8
GWAIT

; Get the sum result
GRESULT R7        ; R7 = 36

; Compare: CPU would need a loop
; GPU does it in parallel!

HALT`,
  },
];
