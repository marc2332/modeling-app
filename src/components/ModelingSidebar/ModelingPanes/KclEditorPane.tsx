import { TEST } from 'env'
import { useSettingsAuthContext } from 'hooks/useSettingsAuthContext'
import { Themes, getSystemTheme } from 'lib/theme'
import { useMemo, useRef } from 'react'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { lineHighlightField } from 'editor/highlightextension'
import { onMouseDragMakeANewNumber, onMouseDragRegex } from 'lib/utils'
import {
  lineNumbers,
  rectangularSelection,
  highlightActiveLineGutter,
  highlightSpecialChars,
  highlightActiveLine,
  keymap,
  EditorView,
  dropCursor,
  drawSelection,
} from '@codemirror/view'
import {
  indentWithTab,
  defaultKeymap,
  historyKeymap,
  history,
} from '@codemirror/commands'
import { diagnosticCount, lintGutter, lintKeymap } from '@codemirror/lint'
import {
  foldGutter,
  foldKeymap,
  bracketMatching,
  indentOnInput,
  codeFolding,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language'
import interact from '@replit/codemirror-interact'
import { kclManager, editorManager, codeManager } from 'lib/singletons'
import { useHotkeys } from 'react-hotkeys-hook'
import { useLspContext } from 'components/LspProvider'
import { Prec, EditorState, Extension } from '@codemirror/state'
import {
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import CodeEditor from './CodeEditor'
import { codeManagerHistoryCompartment } from 'lang/codeManager'

export const editorShortcutMeta = {
  formatCode: {
    display: 'Alt + Shift + F',
  },
  convertToVariable: {
    codeMirror: 'Ctrl-Shift-c',
    display: 'Ctrl + Shift + C',
  },
}

export const KclEditorPane = () => {
  const {
    settings: { context },
  } = useSettingsAuthContext()
  const theme =
    context.app.theme.current === Themes.System
      ? getSystemTheme()
      : context.app.theme.current
  const { copilotLSP, kclLSP } = useLspContext()

  // Since these already exist in the editor, we don't need to define them
  // with the wrapper.
  useHotkeys('mod+z', (e) => {
    e.preventDefault()
    editorManager.undo()
  })
  useHotkeys('mod+shift+z', (e) => {
    e.preventDefault()
    editorManager.redo()
  })

  const textWrapping = context.textEditor.textWrapping
  const cursorBlinking = context.textEditor.blinkingCursor
  // DO NOT ADD THE CODEMIRROR HOTKEYS HERE TO THE DEPENDENCY ARRAY
  // It reloads the editor every time we do _anything_ in the editor
  // I have no idea why.
  // Instead, hot load hotkeys via code mirror native.
  const codeMirrorHotkeys = codeManager.getCodemirrorHotkeys()

  const editorExtensions = useMemo(() => {
    const extensions = [
      drawSelection({
        cursorBlinkRate: cursorBlinking.current ? 1200 : 0,
      }),
      lineHighlightField,
      codeManagerHistoryCompartment.of(history()),
      closeBrackets(),
      codeFolding(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
        ...codeMirrorHotkeys,
        {
          key: editorShortcutMeta.convertToVariable.codeMirror,
          run: () => {
            return editorManager.convertToVariable()
          },
        },
      ]),
    ] as Extension[]

    if (kclLSP) extensions.push(Prec.highest(kclLSP))
    if (copilotLSP) extensions.push(copilotLSP)

    // These extensions have proven to mess with vitest
    if (!TEST) {
      extensions.push(
        lintGutter(),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        foldGutter(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, {
          fallback: true,
        }),
        rectangularSelection(),
        dropCursor(),
        interact({
          rules: [
            // a rule for a number dragger
            {
              // the regexp matching the value
              regexp: onMouseDragRegex,
              // set cursor to "ew-resize" on hover
              cursor: 'ew-resize',
              // change number value based on mouse X movement on drag
              onDrag: (text, setText, e) => {
                onMouseDragMakeANewNumber(text, setText, e)
              },
            },
          ],
        })
      )
      if (textWrapping.current) extensions.push(EditorView.lineWrapping)
    }

    return extensions
  }, [kclLSP, copilotLSP, textWrapping.current, cursorBlinking.current])

  const initialCode = useRef(codeManager.code)

  return (
    <div className="relative">
      <div
        id="code-mirror-override"
        className={
          'absolute inset-0 ' + (cursorBlinking.current ? 'blink' : '')
        }
      >
        <CodeEditor
          initialDocValue={initialCode.current}
          extensions={editorExtensions}
          theme={theme}
          onCreateEditor={(_editorView) => {
            if (_editorView === null) return

            editorManager.setEditorView(_editorView)

            // On first load of this component, ensure we show the current errors
            // in the editor.
            // Make sure we don't add them twice.
            if (diagnosticCount(_editorView.state) === 0) {
              kclManager.setDiagnosticsForCurrentErrors()
            }
          }}
        />
      </div>
    </div>
  )
}
