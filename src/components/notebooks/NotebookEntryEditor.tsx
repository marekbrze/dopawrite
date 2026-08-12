import type { Notebook } from '../../types'
import { MarkdownEditor } from '../MarkdownEditor'

interface EditorState {
  id: string
  title: string
  content: string
}

interface Props {
  notebook: Notebook
  editorState: EditorState | null
  draftPrompt: string | null
  saveStatus: 'saved' | 'saving' | ''
  onEditorChange: (patch: Partial<EditorState>) => void
  onDelete: () => void
  onReroll: () => void
  onNewEntry: () => void
  onToggleEntries?: () => void
}

export function NotebookEntryEditor({
  notebook,
  editorState,
  draftPrompt,
  saveStatus,
  onEditorChange,
  onDelete,
  onReroll,
  onNewEntry,
  onToggleEntries,
}: Props) {
  const isPromptBased = notebook.type === 'prompt-based'
  const rerollLabel = notebook.promptMode === 'sequential' ? 'Next' : 'Shuffle'

  return (
    <main className="editor-panel">
      {!editorState ? (
        <div className="editor-empty">
          {onToggleEntries && (
            <button className="mobile-entries-toggle" onClick={onToggleEntries}>≡ Notes</button>
          )}
          <p>Select a note or create a new one</p>
          <button onClick={onNewEntry}>New note</button>
        </div>
      ) : (
        <>
          {isPromptBased && draftPrompt !== null && (
            <div className="prompt-banner">
              <div className="prompt-banner-top">
                <span className="prompt-banner-label">Prompt</span>
                <button className="prompt-reroll-btn" onClick={onReroll}>{rerollLabel} ↺</button>
              </div>
              <p className="prompt-banner-text">{draftPrompt}</p>
            </div>
          )}
          <div className="editor-toolbar">
            {onToggleEntries && (
              <button className="mobile-entries-toggle" onClick={onToggleEntries}>≡</button>
            )}
            {!isPromptBased && (
              <input
                type="text"
                className="editor-title-input"
                value={editorState.title}
                onChange={e => onEditorChange({ title: e.target.value })}
                placeholder="Note title…"
              />
            )}
            {saveStatus === 'saving' && <span className="editor-save-status">Zapisywanie…</span>}
            {saveStatus === 'saved' && <span className="editor-save-status">Zapisano</span>}
            <button className="editor-delete-btn" onClick={onDelete}>Delete</button>
          </div>
          <div className="editor-content">
            <MarkdownEditor
              value={editorState.content}
              onChange={content => onEditorChange({ content })}
              placeholder="Start writing…"
              autoFocus
            />
          </div>
        </>
      )}
    </main>
  )
}

export type { EditorState as NotebookEditorState }
