import { useState, useEffect } from 'react'
import { db, isCloudSchema } from '../db'
import { migrateToCloudSchema, connectToExistingCloud } from '../utils/cloudMigration'

type WizardMode = 'upload' | 'connect-existing'
type WizardStep = 'choose-mode' | 'enter-url' | 'migrating' | 'login' | 'connected'

const WIZARD_STATE_KEY = 'dopawrite-wizard-state'

function getStoredMode(): WizardMode | null {
  try {
    const raw = localStorage.getItem(WIZARD_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.mode ?? null
  } catch {
    return null
  }
}

function computeInitialStep(): WizardStep {
  if (isCloudSchema()) return 'login'
  return 'choose-mode'
}

function validateDexieCloudUrl(url: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.endsWith('.dexie.cloud')) return 'URL must point to a *.dexie.cloud domain'
    return null
  } catch {
    return 'Invalid URL'
  }
}

const STEP_LABELS = ['Mode', 'URL', 'Login'] as const

function stepToIndex(step: WizardStep): number {
  switch (step) {
    case 'choose-mode': return 0
    case 'enter-url':
    case 'migrating': return 1
    case 'login':
    case 'connected': return 2
  }
}

function StepIndicator({ step }: { step: WizardStep }) {
  const activeIndex = stepToIndex(step)
  return (
    <div className="wizard-steps">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="wizard-step-wrapper">
          {i > 0 && (
            <div className={`wizard-step-connector${i <= activeIndex ? ' done' : ''}`} />
          )}
          <div className={`wizard-step${i === activeIndex ? ' active' : ''}${i < activeIndex ? ' done' : ''}`}>
            <span className="wizard-step-dot" />
            <span className="wizard-step-label">{label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SyncWizard() {
  const [step, setStep] = useState<WizardStep>(computeInitialStep)
  const [mode, setMode] = useState<WizardMode | null>(getStoredMode)
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [migrating, setMigrating] = useState(false)
  const [syncEmail, setSyncEmail] = useState('')
  const [syncOtp, setSyncOtp] = useState('')
  const [loginStatus, setLoginStatus] = useState<'idle' | 'sending' | 'awaiting-otp' | 'verifying'>('idle')
  const [currentUser, setCurrentUser] = useState<{ userId?: string; email?: string; isLoggedIn: boolean } | null>(null)

  useEffect(() => {
    const cloudUrl = localStorage.getItem('dopawrite-cloud-url')
    if (!cloudUrl) return
    try {
      const subscription = db.cloud.currentUser.subscribe((user) => {
        const u = user
          ? { userId: user.userId, email: user.email, isLoggedIn: user.isLoggedIn ?? false }
          : { isLoggedIn: false }
        setCurrentUser(u)
        if (u.isLoggedIn) {
          setStep('connected')
          localStorage.removeItem(WIZARD_STATE_KEY)
        }
      })
      return () => subscription.unsubscribe()
    } catch {
      // cloud not configured
    }
  }, [])

  const handleChooseMode = (m: WizardMode) => {
    setMode(m)
    setStep('enter-url')
  }

  const handleUrlNext = async () => {
    const err = validateDexieCloudUrl(urlDraft)
    if (err) { setUrlError(err); return }
    setUrlError(null)

    localStorage.setItem('dopawrite-cloud-url', urlDraft)
    localStorage.setItem(WIZARD_STATE_KEY, JSON.stringify({ mode }))

    setMigrating(true)
    setStep('migrating')

    if (mode === 'upload') {
      await migrateToCloudSchema()
    } else {
      await connectToExistingCloud()
    }
    // page reloads after migration
  }

  const handleLogin = async () => {
    if (!syncEmail.trim()) return
    setLoginStatus('sending')
    try {
      await db.cloud.login({ email: syncEmail.trim(), grant_type: 'otp' })
      setLoginStatus('awaiting-otp')
    } catch {
      setLoginStatus('idle')
    }
  }

  const handleVerifyOtp = async () => {
    if (!syncOtp.trim()) return
    setLoginStatus('verifying')
    try {
      await db.cloud.login({ email: syncEmail.trim(), grant_type: 'otp', otp: syncOtp.trim() })
      setLoginStatus('idle')
      setSyncOtp('')
    } catch {
      setLoginStatus('awaiting-otp')
    }
  }

  const handleLogout = async () => {
    try {
      await db.cloud.logout()
      setCurrentUser(null)
    } catch {
      // ignore
    }
  }

  return (
    <div className="sync-section">
      {step !== 'connected' && <StepIndicator step={step} />}

      {step === 'choose-mode' && (
        <div className="wizard-choices">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Choose how to sync your data with Dexie Cloud.
          </p>
          <button
            className="wizard-option-card"
            onClick={() => handleChooseMode('upload')}
          >
            <div className="wizard-option-card-title">Upload data to the server</div>
            <div className="wizard-option-card-desc">
              All your local entries will be uploaded to the cloud and synced across devices.
            </div>
          </button>
          <button
            className="wizard-option-card"
            onClick={() => handleChooseMode('connect-existing')}
          >
            <div className="wizard-option-card-title">Connect to an existing database</div>
            <div className="wizard-option-card-desc">
              Data will be downloaded from the server. Local entries will be overwritten.
            </div>
          </button>
        </div>
      )}

      {step === 'enter-url' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Enter your Dexie Cloud database URL.
          </p>
          <input
            type="url"
            value={urlDraft}
            onChange={e => { setUrlDraft(e.target.value); setUrlError(null) }}
            placeholder="https://xxxxxxxx.dexie.cloud"
            className="wizard-url-input"
            onKeyDown={e => { if (e.key === 'Enter') handleUrlNext() }}
            autoFocus
          />
          {urlError && <p className="wizard-error">{urlError}</p>}
          <div className="wizard-nav">
            <button
              className="modal-btn-secondary"
              onClick={() => { setStep('choose-mode'); setUrlError(null) }}
            >
              Back
            </button>
            <button
              className="sync-btn"
              onClick={handleUrlNext}
              disabled={!urlDraft.trim() || migrating}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 'migrating' && (
        <div className="wizard-migrating">
          Preparing sync...
        </div>
      )}

      {step === 'login' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Enter the email address linked to Dexie Cloud to sign in for sync.
          </p>
          {loginStatus === 'idle' || loginStatus === 'sending' ? (
            <div className="sync-login-form">
              <input
                type="email"
                value={syncEmail}
                onChange={e => setSyncEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
              />
              <button
                onClick={handleLogin}
                disabled={loginStatus === 'sending'}
                className="sync-btn"
              >
                {loginStatus === 'sending' ? 'Sending...' : 'Send code'}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>
                An OTP code was sent to {syncEmail}
              </p>
              <div className="sync-login-form">
                <input
                  type="text"
                  value={syncOtp}
                  onChange={e => setSyncOtp(e.target.value)}
                  placeholder="OTP code from email"
                  onKeyDown={e => { if (e.key === 'Enter') handleVerifyOtp() }}
                  autoFocus
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={loginStatus === 'verifying'}
                  className="sync-btn"
                >
                  {loginStatus === 'verifying' ? 'Verifying...' : 'Sign in'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'connected' && (
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Connected to cloud
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            Signed in as <strong>{currentUser?.email ?? currentUser?.userId}</strong>
          </p>
          <button onClick={handleLogout} className="sync-btn">Sign out</button>
        </div>
      )}
    </div>
  )
}
