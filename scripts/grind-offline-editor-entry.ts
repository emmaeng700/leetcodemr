import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { oneDark } from '@codemirror/theme-one-dark'
import { indentWithTab } from '@codemirror/commands'

export type GrindLang = 'python3' | 'cpp'

export type GrindEditorHandle = {
  setDoc: (code: string) => void
  getDoc: () => string
  setLang: (lang: GrindLang) => void
  destroy: () => void
}

function langExt(lang: GrindLang) {
  return lang === 'python3' ? python() : cpp()
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
        Prec.highest(keymap.of([indentWithTab])),
        EditorView.theme({
          '&': { height: '100%', fontSize: '9px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
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
