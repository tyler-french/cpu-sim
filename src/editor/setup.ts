import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, Decoration, DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { assembly } from './assembly-lang';

// Effect to set the executing line
const setExecutingLine = StateEffect.define<number | null>();

// State field to track the executing line decoration
const executingLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setExecutingLine)) {
        if (effect.value === null) {
          return Decoration.none;
        }
        const line = tr.state.doc.line(effect.value);
        const deco = Decoration.line({ class: 'cm-executingLine' }).range(line.from);
        return Decoration.set([deco]);
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: '#1a1b26',
  },
  '.cm-content': {
    fontFamily: '"JetBrains Mono", monospace',
    padding: '12px 0',
    caretColor: '#c0caf5',
  },
  '.cm-cursor': {
    borderLeftColor: '#c0caf5',
  },
  '.cm-activeLine': {
    backgroundColor: '#24283b',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#24283b',
  },
  '.cm-executingLine': {
    backgroundColor: 'rgba(158, 206, 106, 0.15)',
    borderLeft: '3px solid #9ece6a',
  },
  '.cm-gutters': {
    backgroundColor: '#1a1b26',
    color: '#565f89',
    border: 'none',
    borderRight: '1px solid #3b4261',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 8px',
    minWidth: '40px',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#3b4261 !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: '#3b4261 !important',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
});

const highlightStyles = HighlightStyle.define([
  { tag: tags.keyword, color: '#bb9af7', fontWeight: '600' },
  { tag: tags.comment, color: '#565f89', fontStyle: 'italic' },
  { tag: tags.number, color: '#ff9e64' },
  { tag: tags.variableName, color: '#7dcfff' },
  { tag: tags.labelName, color: '#9ece6a', fontWeight: '600' },
  { tag: tags.special(tags.variableName), color: '#7aa2f7' },
]);

export function createEditor(
  parent: HTMLElement,
  initialCode: string,
  onChange?: (code: string) => void
): EditorView {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      onChange(update.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      assembly(),
      syntaxHighlighting(highlightStyles),
      theme,
      updateListener,
      executingLineField,
      EditorView.lineWrapping,
    ],
  });

  return new EditorView({
    state,
    parent,
  });
}

export function setEditorContent(view: EditorView, content: string): void {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: content,
    },
  });
}

export function highlightLine(view: EditorView, lineNumber: number | null): void {
  // lineNumber is 1-based, null clears the highlight
  if (lineNumber !== null && (lineNumber < 1 || lineNumber > view.state.doc.lines)) {
    return;
  }
  view.dispatch({
    effects: setExecutingLine.of(lineNumber),
  });
}
