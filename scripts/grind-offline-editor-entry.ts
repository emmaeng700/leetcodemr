import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { indentWithTab, undo, redo } from '@codemirror/commands'
import { indentationMarkers } from '@replit/codemirror-indentation-markers'

export type GrindLang = 'python3' | 'cpp' | 'javascript'

export type GrindEditorHandle = {
  setDoc: (code: string) => void
  getDoc: () => string
  setLang: (lang: GrindLang) => void
  undo: () => void
  redo: () => void
  destroy: () => void
}

function langExt(lang: GrindLang) {
  if (lang === 'python3') return python()
  if (lang === 'javascript') return javascript()
  return cpp()
}

function smartEnter(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const base = line.text.match(/^(\s*)/)?.[1] ?? ''
  const trimmed = line.text.trimEnd()
  const extra = trimmed.endsWith(':') || trimmed.endsWith('{') ? '    ' : ''
  const insert = '\n' + base + extra
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  })
  return true
}

export function createGrindEditor(
  parent: HTMLElement,
  opts: { lang: GrindLang; value: string; onChange: (code: string) => void },
): GrindEditorHandle {
  let lang = opts.lang
  let view: EditorView | null = null

  const build = (value: string) => {
    if (view) {
      view.destroy()
      view = null
    }
    parent.innerHTML = ''
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        langExt(lang),
        oneDark,
        EditorView.lineWrapping,
        indentationMarkers(),
        Prec.highest(keymap.of([{ key: 'Enter', run: smartEnter }, indentWithTab])),
        EditorView.theme({
          '&': {
            height: '100%',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            fontSize: '9px',
            '--indent-marker-bg-color': 'rgba(120, 140, 190, 0.35)',
            '--indent-marker-active-bg-color': 'rgba(150, 175, 255, 0.55)',
          },
          '.cm-scroller': {
            flex: '1 1 0',
            minHeight: 0,
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
          '.cm-content': { fontSize: '9px', lineHeight: '1.45' },
          '.cm-gutters': { fontSize: '9px' },
        }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) opts.onChange(update.state.doc.toString())
        }),
      ],
    })
    view = new EditorView({ state, parent })
  }

  build(opts.value)

  return {
    setDoc(code: string) {
      if (!view) return
      const cur = view.state.doc.toString()
      if (cur === code) return
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      })
    },
    getDoc() {
      return view?.state.doc.toString() ?? ''
    },
    undo() {
      if (view) { undo(view); view.focus() }
    },
    redo() {
      if (view) { redo(view); view.focus() }
    },
    setLang(next: GrindLang) {
      if (next === lang) return
      lang = next
      build(view?.state.doc.toString() ?? '')
    },
    destroy() {
      view?.destroy()
      view = null
      parent.innerHTML = ''
    },
  }
}

declare global {
  interface Window {
    GrindOfflineEditor: { create: typeof createGrindEditor }
  }
}

window.GrindOfflineEditor = { create: createGrindEditor }
