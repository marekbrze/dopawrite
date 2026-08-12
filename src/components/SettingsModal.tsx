import { useState, useEffect, useRef } from 'react'
import type { ExportData, ImportPreview, ImportMode } from '../types'
import { db } from '../db'
import {
  exportAllData,
  parseImportFile,
  previewImport,
  executeImport,
  loadAutoBackup,
  clearAutoBackup,
  downloadBlob,
  formatExportDate,
  isEncryptedFile,
} from '../utils/dataPortability'
import { SyncWizard } from './SyncWizard'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState<'backup' | 'sync'>('backup')

  // Backup state
  const [exportPassword, setExportPassword] = useState('')
  const [exporting, setExporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const [importEncrypted, setImportEncrypted] = useState(false)
  const [importData, setImportData] = useState<ExportData | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [autoBackup, setAutoBackup] = useState<ExportData | null>(null)

  useEffect(() => {
    setAutoBackup(loadAutoBackup())
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportAllData(db, exportPassword || undefined)
      const date = new Date().toISOString().split('T')[0]
      downloadBlob(blob, `dopawrite-backup-${date}.json`)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    const encrypted = isEncryptedFile(content)
    setImportFile(file)
    setImportEncrypted(encrypted)
    setImportData(null)
    setImportPreview(null)
    setImportError(null)
    setImportPassword('')
    if (!encrypted) {
      await parseImportFileSafe(file, undefined)
    }
  }

  const parseImportFileSafe = async (file: File, password?: string) => {
    try {
      const data = await parseImportFile(file, password)
      setImportData(data)
      setImportError(null)
      const preview = await previewImport(db, data)
      setImportPreview(preview)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse file')
      setImportData(null)
      setImportPreview(null)
    }
  }

  const handleDecryptImport = async () => {
    if (!importFile) return
    await parseImportFileSafe(importFile, importPassword || undefined)
  }

  const handleExecuteImport = async () => {
    if (!importData) return
    setImporting(true)
    try {
      await executeImport(db, importData, importMode)
      window.location.reload()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleRestoreAutoBackup = async () => {
    if (!autoBackup) return
    setImportData(autoBackup)
    setImportMode('replace')
    const preview = await previewImport(db, autoBackup)
    setImportPreview(preview)
  }

  const handleClearAutoBackup = () => {
    clearAutoBackup()
    setAutoBackup(null)
  }

  const resetImport = () => {
    setImportFile(null)
    setImportData(null)
    setImportPreview(null)
    setImportPassword('')
    setImportEncrypted(false)
    setImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-mobile-nav">
          <select
            className="settings-mobile-select"
            value={activeCategory}
            onChange={e => setActiveCategory(e.target.value as typeof activeCategory)}
          >
            <option value="backup">Backup</option>
            <option value="sync">Sync</option>
          </select>
          <button className="settings-mobile-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-sidebar">
          <div className="settings-sidebar-title">Settings</div>
          <button
            className={`settings-nav-item ${activeCategory === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveCategory('backup')}
          >
            Backup
          </button>
          <button
            className={`settings-nav-item ${activeCategory === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveCategory('sync')}
          >
            Sync
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-content-header">
            <span>{activeCategory === 'backup' ? 'Backup' : 'Sync'}</span>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="settings-content-body">

            {activeCategory === 'backup' && (
              <div>
                {/* Auto backup */}
                {autoBackup && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Auto backup
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                      Last backup: {formatExportDate(autoBackup.exportedAt)} ({autoBackup.data.entries.length} entries)
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleRestoreAutoBackup}
                        style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                      >
                        Restore
                      </button>
                      <button
                        onClick={handleClearAutoBackup}
                        style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'transparent', color: 'var(--text-faint)', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                      >
                        Delete backup
                      </button>
                    </div>
                  </div>
                )}

                {/* Export */}
                <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border-light)' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Export data
                  </p>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Password (optional)</label>
                    <input
                      type="password"
                      value={exportPassword}
                      onChange={e => setExportPassword(e.target.value)}
                      placeholder="Leave empty to skip encryption"
                      style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', padding: '6px 0', fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    style={{ fontSize: 11, padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)', cursor: exporting ? 'default' : 'pointer', background: 'var(--accent)', color: 'var(--surface)', fontFamily: 'inherit', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, opacity: exporting ? 0.6 : 1 }}
                  >
                    {exporting ? 'Exporting…' : 'Export JSON'}
                  </button>
                </div>

                {/* Import */}
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Import data
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, display: 'block' }}
                  />
                  {importEncrypted && !importData && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Decryption password</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="password"
                          value={importPassword}
                          onChange={e => setImportPassword(e.target.value)}
                          placeholder="Enter password"
                          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', padding: '6px 0', fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', outline: 'none' }}
                        />
                        <button
                          onClick={handleDecryptImport}
                          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                        >
                          Decrypt
                        </button>
                      </div>
                    </div>
                  )}
                  {importError && (
                    <p style={{ fontSize: 13, color: '#c0392b', marginBottom: 10 }}>{importError}</p>
                  )}
                  {importPreview && (
                    <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(92,74,56,.05)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-muted)' }}>
                      <p>Entries: +{importPreview.entries.added} new, {importPreview.entries.updated} updated</p>
                    </div>
                  )}
                  {importData && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Import mode</label>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                        {(['merge', 'replace'] as ImportMode[]).map(mode => (
                          <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <input type="radio" name="importMode" value={mode} checked={importMode === mode} onChange={() => setImportMode(mode)} style={{ accentColor: 'var(--accent)' }} />
                            {mode === 'merge' ? 'Merge' : 'Replace all'}
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={handleExecuteImport}
                          disabled={importing}
                          style={{ fontSize: 11, padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)', cursor: importing ? 'default' : 'pointer', background: 'var(--accent)', color: 'var(--surface)', fontFamily: 'inherit', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, opacity: importing ? 0.6 : 1 }}
                        >
                          {importing ? 'Importing…' : 'Import'}
                        </button>
                        <button
                          onClick={resetImport}
                          style={{ fontSize: 11, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeCategory === 'sync' && <SyncWizard />}
          </div>
        </div>
      </div>
    </div>
  )
}
