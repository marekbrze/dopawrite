import { useState } from 'react'
import { db } from '../../db'

interface Props {
  onClose: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function CreateFolderModal({ onClose }: Props) {
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const now = new Date().toISOString()
    await db.folders.add({
      id: generateId(),
      name: name.trim(),
      parentId: null,
      order: Date.now(),
      createdAt: now,
      updatedAt: now,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="simple-modal">
        <div className="simple-modal-header">
          <span>New folder</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="simple-modal-body">
          <input
            className="modal-text-input"
            type="text"
            placeholder="Folder name…"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="modal-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-btn-primary" disabled={!name.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}
