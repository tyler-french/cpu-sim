import { StreamLanguage, LanguageSupport } from '@codemirror/language';

const assemblyLanguage = StreamLanguage.define({
  token(stream) {
    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Comments
    if (stream.match(/;.*/)) {
      return 'comment';
    }

    // Labels (word followed by colon)
    if (stream.match(/^[a-zA-Z_]\w*:/)) {
      return 'labelName';
    }

    // Instructions
    if (
      stream.match(
        /^(MOV|ADD|SUB|MUL|DIV|MOD|AND|OR|XOR|NOT|SHL|SHR|INC|DEC|CMP|JMP|JZ|JE|JNZ|JNE|JG|JGE|JL|JLE|LOAD|STORE|PUSH|POP|CALL|RET|NOP|HALT|HLT)\b/i
      )
    ) {
      return 'keyword';
    }

    // Registers
    if (stream.match(/^R[0-7]\b/i)) {
      return 'variableName';
    }

    // Hex numbers
    if (stream.match(/^0x[0-9A-Fa-f]+\b/)) {
      return 'number';
    }

    // Decimal numbers
    if (stream.match(/^-?\d+\b/)) {
      return 'number';
    }

    // Label references (identifiers)
    if (stream.match(/^[a-zA-Z_]\w*/)) {
      return 'variableName.special';
    }

    // Skip any other character
    stream.next();
    return null;
  },
});

export function assembly(): LanguageSupport {
  return new LanguageSupport(assemblyLanguage);
}
