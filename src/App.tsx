import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/sora/600.css'
import { pdf } from '@react-pdf/renderer'
import {
  Building2,
  CopyPlus,
  Download,
  Eye,
  FileCheck2,
  FileClock,
  FilePlus2,
  ImagePlus,
  PackagePlus,
  PenLine,
  Save,
  Search,
  Settings,
  ShieldX,
  Store,
  Trash2,
} from 'lucide-react'
import { createElement, useMemo, useState } from 'react'
import { useRef } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import './App.css'
import { assetBox, getDocumentDesign, normalizeDocumentAssetLayout } from './documentDesign'
import { OrderPdf } from './pdf/OrderPdf'
import {
  defaultSettings,
  deleteDistributor,
  emptyDraft,
  emptyItem,
  backupFilename,
  finalizeOrder,
  formatDate,
  getStorageUsage,
  getCurrentDraft,
  loadStore,
  mergeImportedStore,
  now,
  normalizeVisualSettings,
  normalizeSignatureLayout,
  optimizeStorage,
  sanitizeFilename,
  saveDistributors,
  saveCurrentDraft,
  saveSelectedDesign,
  saveSettings,
  uid,
  voidOrder,
} from './storage/heraStorage'
import type { ClinicSettings, Distributor, DraftOrder, HeraStorage, Order, Page, SignatureAssetLayout, SignatureVisualSettings } from './types/hera'

const navItems: Array<{ key: Page; label: string; Icon: typeof FilePlus2 }> = [
  { key: 'create', label: 'Buat Surat', Icon: FilePlus2 },
  { key: 'history', label: 'History', Icon: FileClock },
  { key: 'distributors', label: 'Distributor', Icon: Store },
  { key: 'settings', label: 'Settings', Icon: Settings },
  { key: 'designs', label: 'Pilihan Desain Surat', Icon: FileCheck2 },
]

const pageMeta: Record<Page, { title: string; subtitle: string }> = {
  create: { title: 'Buat Surat', subtitle: 'Buat dan finalisasi surat pemesanan produk klinik.' },
  history: { title: 'History', subtitle: 'Kelola arsip finalized, draft, dan void surat pemesanan.' },
  distributors: { title: 'Distributor', subtitle: 'Master data distributor untuk mempercepat pembuatan surat.' },
  settings: { title: 'Settings', subtitle: 'Atur identitas klinik, apoteker, backup, dan ukuran tanda tangan.' },
  designs: { title: 'Pilihan Desain Surat', subtitle: 'Pilih desain surat yang paling sesuai dengan kebutuhan klinik Anda.' },
}

const compressDataUrl = (source: string, kind: 'logoUrl' | 'signatureUrl' | 'stampUrl', fallbackSize = 0) =>
  new Promise<{ value: string; size: number }>((resolve) => {
    const maxWidth = kind === 'logoUrl' ? 600 : 900
    const img = new window.Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve({ value: source, size: fallbackSize || source.length })
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const needsTransparency = kind !== 'logoUrl' || source.startsWith('data:image/png')
      const value = needsTransparency ? canvas.toDataURL('image/png') : canvas.toDataURL('image/webp', 0.82)
      resolve({ value, size: Math.round((value.length * 3) / 4) })
    }
    img.onerror = () => resolve({ value: source, size: fallbackSize || source.length })
    img.src = source
  })

const readImage = (file: File, kind: 'logoUrl' | 'signatureUrl' | 'stampUrl', done: (value: string, size: number) => void) => {
  const reader = new FileReader()
  reader.onload = async () => {
    const result = await compressDataUrl(String(reader.result || ''), kind, file.size)
    done(result.value, result.size)
  }
  reader.readAsDataURL(file)
}

const isSettingsRef = (value: string | undefined, key: 'logoUrl' | 'signatureUrl' | 'stampUrl') => value === `settings.${key}`

const resolveOrderAssets = (order: Order, settings: ClinicSettings): Order => ({
  ...order,
  clinicSnapshot: {
    ...order.clinicSnapshot,
    logoUrl: isSettingsRef(order.clinicSnapshot.logoUrl, 'logoUrl') ? settings.logoUrl : order.clinicSnapshot.logoUrl,
  },
  pharmacistSnapshot: {
    ...order.pharmacistSnapshot,
    signatureUrl: isSettingsRef(order.pharmacistSnapshot.signatureUrl, 'signatureUrl') ? settings.signatureUrl : order.pharmacistSnapshot.signatureUrl,
    stampUrl: isSettingsRef(order.pharmacistSnapshot.stampUrl, 'stampUrl') ? settings.stampUrl : order.pharmacistSnapshot.stampUrl,
  },
  stampLayout: normalizeDocumentAssetLayout(order.stampLayout, 'stamp', order.selectedDesign),
  signatureLayout: normalizeDocumentAssetLayout(order.signatureLayout, 'signature', order.selectedDesign),
})

const toEditableAssetLayout = (layout: SignatureAssetLayout, designId: string): SignatureAssetLayout => {
  if (layout.widthUnit !== 'percent') return layout
  const design = getDocumentDesign(designId)
  return { ...layout, width: Math.round((design.signature.webWidth * layout.width) / 100), widthUnit: 'px' }
}

const downloadPdf = async (order: Order, settings: ClinicSettings) => {
  const element = createElement(OrderPdf, { order: resolveOrderAssets(order, settings) }) as Parameters<typeof pdf>[0]
  const blob = await pdf(element).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Surat-Pemesanan-${sanitizeFilename(order.orderNumber)}-${sanitizeFilename(order.distributorSnapshot.name)}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

const validateDraft = (draft: DraftOrder) => {
  if (!draft.orderDate) return 'Tanggal pemesanan wajib diisi.'
  if (!draft.distributorSnapshot.name.trim()) return 'Nama distributor wajib diisi.'
  const rows = draft.items.filter((item) => item.productName.trim() || item.quantity.trim())
  if (!rows.length) return 'Minimal satu produk wajib diisi.'
  if (rows.some((item) => !item.productName.trim() || !item.quantity.trim())) return 'Nama produk dan kuantitas wajib diisi.'
  return ''
}

function App() {
  const initialStore = useMemo(() => loadStore(), [])
  const [page, setPage] = useState<Page>('create')
  const [settings, setSettings] = useState<ClinicSettings>(initialStore.settings)
  const [distributors, setDistributors] = useState<Distributor[]>(initialStore.distributors)
  const [orders, setOrders] = useState<Order[]>(initialStore.orders)
  const [draft, setDraft] = useState<DraftOrder>(initialStore.currentDraft || emptyDraft(initialStore.settings, initialStore.selectedDesign || 'official-compact'))
  const [preview, setPreview] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [notice, setNotice] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState(draft.updatedAt)
  const [selectedDesign, setSelectedDesign] = useState(initialStore.selectedDesign || 'official-compact')
  const [layoutDebug, setLayoutDebug] = useState(false)
  const draftSaveTimer = useRef<number | null>(null)
  const finalizingRef = useRef(false)

  const activeDistributors = distributors.filter((item) => !item.isDeleted)
  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const persistDraft = (nextDraft: DraftOrder | null, message?: string) => {
    if (finalizingRef.current && nextDraft) return
    saveCurrentDraft(nextDraft)
    if (nextDraft) setDraftSavedAt(nextDraft.updatedAt)
    if (message) flash(message)
  }

  const patchDraft = (patch: Partial<DraftOrder>) => {
    const nextDraft = { ...draft, ...patch, updatedAt: now() }
    setDraft(nextDraft)
    if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current)
    draftSaveTimer.current = window.setTimeout(() => persistDraft(nextDraft), 450)
  }

  const makePreviewOrder = (): Order => ({
    id: draft.id,
    orderNumber: 'DRAFT-BELUM-FINAL',
    orderDate: draft.orderDate,
    distributorId: draft.distributorId,
    distributorSnapshot: { ...draft.distributorSnapshot },
    clinicSnapshot: { ...settings },
    pharmacistSnapshot: {
      name: settings.pharmacistName,
      sipa: settings.pharmacistSipa,
      signatureUrl: settings.signatureUrl,
      stampUrl: settings.stampUrl,
    },
    visualSettings: normalizeVisualSettings(draft.visualSettings),
    selectedDesign: draft.selectedDesign || selectedDesign || 'official-compact',
    stampLayout: draft.stampLayout,
    signatureLayout: draft.signatureLayout,
    items: draft.items.filter((item) => item.productName.trim() || item.quantity.trim()),
    status: 'draft',
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    finalizedAt: '',
    voidedAt: '',
    voidReason: '',
  })

  const finalize = async () => {
    const error = validateDraft(draft)
    if (error) return alert(error)
    if (!confirm('Finalisasi order? Setelah final, data akan terkunci dan tidak bisa diedit diam-diam.')) return
    finalizingRef.current = true
    if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current)
    try {
      const finalDesign = draft.selectedDesign || selectedDesign || 'official-compact'
      const order = finalizeOrder({
        ...draft,
        selectedDesign: finalDesign,
        stampLayout: normalizeDocumentAssetLayout(draft.stampLayout, 'stamp', finalDesign),
        signatureLayout: normalizeDocumentAssetLayout(draft.signatureLayout, 'signature', finalDesign),
      }, settings)
      const store = loadStore()
      setOrders(store.orders)
      setDistributors(store.distributors)
      setDraft(emptyDraft(settings, selectedDesign || 'official-compact'))
      saveCurrentDraft(null)
      setDraftSavedAt(now())
      setPreview(false)
      setSelectedOrder(order)
      setPage('history')
      flash('Order berhasil difinalisasi. PDF final sedang dibuat.')
      try {
        await downloadPdf(order, settings)
      } catch {
        flash('Order sudah finalized. Klik Download PDF Final jika file belum otomatis terunduh.')
      }
    } catch (err) {
      finalizingRef.current = false
      flash(`Gagal finalisasi: ${err instanceof Error ? err.message : 'unknown error'}`)
      return
    }
    finalizingRef.current = false
  }

  const duplicateOrder = (order: Order) => {
    const nextDraft = {
      id: uid('draft'),
      orderDate: new Date().toISOString().slice(0, 10),
      distributorId: order.distributorId,
      distributorSnapshot: { ...order.distributorSnapshot },
      selectedDesign: order.selectedDesign || selectedDesign || 'official-compact',
      stampLayout: toEditableAssetLayout(order.stampLayout, order.selectedDesign || selectedDesign || 'official-compact'),
      signatureLayout: toEditableAssetLayout(order.signatureLayout, order.selectedDesign || selectedDesign || 'official-compact'),
      visualSettings: normalizeVisualSettings(order.visualSettings),
      items: order.items.map((item) => ({ ...item, id: uid('item') })),
      createdAt: now(),
      updatedAt: now(),
    }
    setDraft(nextDraft)
    setSelectedOrder(null)
    setPreview(false)
    setPage('create')
    persistDraft(nextDraft)
    flash('Order disalin sebagai draft baru.')
  }

  const markVoid = (order: Order) => {
    const reason = prompt('Alasan void / cancel order:')
    if (!reason?.trim()) return
    const next = voidOrder(order.id, reason.trim())
    setOrders(next)
    setSelectedOrder(next.find((item) => item.id === order.id) || null)
    flash('Order berhasil diberi status void.')
  }

  const selectDistributor = (id: string) => {
    const distributor = activeDistributors.find((item) => item.id === id)
    if (!distributor) return patchDraft({ distributorId: '' })
    patchDraft({
      distributorId: distributor.id,
      distributorSnapshot: {
        name: distributor.name,
        address: distributor.address,
        contactNumber: distributor.contactNumber,
        email: distributor.email,
        notes: distributor.notes,
      },
    })
  }

  return (
    <div className="app-shell">
      {notice ? <div className="toast">{notice}</div> : null}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">HF</div>
          <div>
            <strong>HERA FORM</strong>
            <span>Order Management</span>
          </div>
        </div>
        <nav>
          {navItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={page === key ? 'active' : ''}
              type="button"
              onClick={() => {
                setPage(key)
                setPreview(false)
                setSelectedOrder(null)
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="audit-card">
          <div className="audit-icon">H</div>
          <div>
            <b>Hera Form</b>
            <span>Klinik Profesional</span>
          </div>
          <small>v1.0.0</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{pageMeta[page].title}</h1>
            <p>{pageMeta[page].subtitle}</p>
          </div>
          {page === 'designs' ? (
            <div className="top-info-card">
              <span>i</span>
              <p>
                <b>Desain yang dipilih belum diterapkan ke PDF.</b>
                Hanya sebagai preview pilihan.
              </p>
            </div>
          ) : (
            <span className="badge good">Immutable finalized snapshot</span>
          )}
        </header>

        {page === 'create' && !preview ? (
          <div className="stack">
            <section className="panel">
              <Title icon={<FilePlus2 size={18} />} title="Data Surat" text="Nomor surat auto-generate dan terkunci setelah finalisasi." />
              <div className="grid two">
                <label>
                  Tanggal pemesanan
                  <input type="date" value={draft.orderDate} onChange={(e) => patchDraft({ orderDate: e.target.value })} />
                </label>
                <label>
                  Nomor surat pemesanan
                  <input disabled value="Auto: SP-HERA/YYYYMM/0001" />
                </label>
              </div>
              <div className="identity-strip">
                <div className="mini-logo">{settings.logoUrl ? <img src={settings.logoUrl} alt="Logo" /> : 'H'}</div>
                <div>
                  <b>{settings.companyName}</b>
                  <p>{[settings.nib && `NIB ${settings.nib}`, settings.licenseNumber, settings.email].filter(Boolean).join(' | ')}</p>
                </div>
              <span className="badge warm">Snapshot saat finalize</span>
            </div>
              <div className="draft-toolbar">
                <span>Draft tersimpan otomatis: {new Date(draftSavedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                <button type="button" className="secondary" onClick={() => persistDraft(draft, 'Draft disimpan manual.')}>
                  Simpan Draft
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => {
                    if (!confirm('Buang draft saat ini?')) return
                    const nextDraft = emptyDraft(settings, selectedDesign || 'official-compact')
                    setDraft(nextDraft)
                    persistDraft(null, 'Draft dibuang.')
                  }}
                >
                  Discard Draft
                </button>
              </div>
            </section>

            <section className="panel">
              <Title icon={<Building2 size={18} />} title="Distributor" text="Tersimpan otomatis setelah order finalized." />
              <div className="grid two">
                <label>
                  Kepada Yth. / Nama distributor
                  <input
                    list="dist-list"
                    value={draft.distributorSnapshot.name}
                    placeholder="Contoh: PT Distributor Medika"
                    onChange={(e) =>
                      patchDraft({ distributorId: '', distributorSnapshot: { ...draft.distributorSnapshot, name: e.target.value } })
                    }
                  />
                  <datalist id="dist-list">
                    {activeDistributors.map((item) => (
                      <option key={item.id} value={item.name} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Pilih dari master
                  <select value={draft.distributorId} onChange={(e) => selectDistributor(e.target.value)}>
                    <option value="">Input manual / distributor baru</option>
                    {activeDistributors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Alamat distributor
                  <textarea
                    value={draft.distributorSnapshot.address}
                    placeholder="Opsional"
                    onChange={(e) => patchDraft({ distributorSnapshot: { ...draft.distributorSnapshot, address: e.target.value } })}
                  />
                </label>
                <div className="stack tight">
                  <label>
                    Nomor kontak distributor
                    <input
                      value={draft.distributorSnapshot.contactNumber}
                      placeholder="Opsional"
                      onChange={(e) => patchDraft({ distributorSnapshot: { ...draft.distributorSnapshot, contactNumber: e.target.value } })}
                    />
                  </label>
                  <label>
                    Email distributor
                    <input
                      type="email"
                      value={draft.distributorSnapshot.email}
                      placeholder="Opsional"
                      onChange={(e) => patchDraft({ distributorSnapshot: { ...draft.distributorSnapshot, email: e.target.value } })}
                    />
                  </label>
                  <label>
                    Optional notes
                    <input
                      value={draft.distributorSnapshot.notes}
                      placeholder="Opsional"
                      onChange={(e) => patchDraft({ distributorSnapshot: { ...draft.distributorSnapshot, notes: e.target.value } })}
                    />
                  </label>
                </div>
              </div>
              <p className="helper-note">
                {draft.distributorId
                  ? 'Kontak, email, dan alamat yang diedit di sini akan ikut diperbarui di master distributor setelah order difinalisasi.'
                  : 'Alamat, kontak, dan email distributor boleh kosong. PDF hanya menampilkan data yang terisi.'}
              </p>
            </section>

            <section className="panel">
              <div className="section-head spread">
                <Title icon={<PackagePlus size={18} />} title="Produk Dipesan" text="Nama produk dan kuantitas wajib diisi." />
                <button className="secondary" type="button" onClick={() => patchDraft({ items: [...draft.items, emptyItem()] })}>
                  <PackagePlus size={16} /> Add Produk
                </button>
              </div>
              <div className="product-table">
                <div className="product-head">
                  <span>No</span>
                  <span>Nama Produk</span>
                  <span>Bentuk Sediaan</span>
                  <span>Kuantitas</span>
                  <span>Keterangan</span>
                  <span />
                </div>
                {draft.items.map((item, index) => (
                  <div className="product-row" key={item.id}>
                    <b>{index + 1}</b>
                    {(['productName', 'dosageForm', 'quantity', 'notes'] as const).map((key) => (
                      <input
                        key={key}
                        value={item[key]}
                        placeholder={{ productName: 'Nama produk', dosageForm: 'Krim/tablet...', quantity: '10 box', notes: 'Opsional' }[key]}
                        onChange={(e) =>
                          patchDraft({ items: draft.items.map((row) => (row.id === item.id ? { ...row, [key]: e.target.value } : row)) })
                        }
                      />
                    ))}
                    <button
                      className="icon danger"
                      type="button"
                      onClick={() => patchDraft({ items: draft.items.length === 1 ? [emptyItem()] : draft.items.filter((row) => row.id !== item.id) })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <Title icon={<PenLine size={18} />} title="Apoteker & Tanda Tangan" text="Diambil dari Settings, boleh kosong untuk diisi manual." />
              <div className="identity-strip">
                <div>
                  <small>Apoteker Penanggung Jawab</small>
                  <h3>{settings.pharmacistName || 'Belum diisi'}</h3>
                  <p>No. SIPA: {settings.pharmacistSipa || 'Belum diisi'}</p>
                </div>
                <span className={settings.pharmacistName && settings.pharmacistSipa ? 'badge good' : 'badge danger'}>Signature readiness</span>
              </div>
            </section>

            <SignatureControls
              title="Pengaturan TTD & Stempel Surat Ini"
              value={draft}
              defaults={settings}
              onChange={(patch) => patchDraft(patch)}
            />

            <div className="actions">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  const error = validateDraft(draft)
                  if (error) return alert(error)
                  setPreview(true)
                }}
              >
                <Eye size={17} /> Preview
              </button>
            </div>
          </div>
        ) : null}

        {page === 'create' && preview ? (
          <Preview
            order={makePreviewOrder()}
            settings={settings}
            layoutDebug={layoutDebug}
            setLayoutDebug={setLayoutDebug}
            onBack={() => setPreview(false)}
            onFinalize={finalize}
            onPdf={() => downloadPdf(makePreviewOrder(), settings)}
          />
        ) : null}

        {page === 'history' ? (
          <History
            orders={orders}
            currentDraft={getCurrentDraft()}
            selected={selectedOrder}
            setSelected={setSelectedOrder}
            openDraft={(nextDraft) => {
              setDraft(nextDraft)
              setPreview(false)
              setSelectedOrder(null)
              setPage('create')
            }}
            duplicate={duplicateOrder}
            markVoid={markVoid}
            settings={settings}
          />
        ) : null}

        {page === 'distributors' ? (
          <DistributorPage distributors={distributors} setDistributors={setDistributors} flash={flash} />
        ) : null}

        {page === 'settings' ? (
          <SettingsPage
            settings={settings}
            setSettings={(nextSettings) => {
              setSettings(nextSettings)
              setDraft({ ...draft, visualSettings: normalizeVisualSettings(draft.visualSettings || nextSettings) })
            }}
            refreshFromStore={() => {
              const store = loadStore()
              setSettings(store.settings)
              setDistributors(store.distributors)
              setOrders(store.orders)
              setDraft(store.currentDraft || emptyDraft(store.settings, store.selectedDesign || 'official-compact'))
              setSelectedDesign(store.selectedDesign || 'official-compact')
            }}
            flash={flash}
          />
        ) : null}
        {page === 'designs' ? (
          <DesignOptionsPage
            selectedDesign={selectedDesign}
            onSelect={(id) => {
              setSelectedDesign(id)
              saveSelectedDesign(id)
              patchDraft({ selectedDesign: id })
              flash('Desain dipilih dan diterapkan ke preview/PDF draft.')
            }}
          />
        ) : null}
      </main>
    </div>
  )
}

function Title({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="section-head">
      <span className="pill-icon">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  )
}

function NumberSlider({
  label,
  value,
  min,
  max,
  suffix = 'px',
  hints,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  hints?: [string, string, string]
  onChange: (value: number) => void
}) {
  const safeValue = Math.min(max, Math.max(min, Math.round(value)))
  return (
    <label className="slider-field">
      <span>{label}</span>
      <div>
        <input type="range" min={min} max={max} value={safeValue} onChange={(e) => onChange(Number(e.target.value))} />
        <input type="number" min={min} max={max} value={safeValue} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))} />
        <small>{suffix}</small>
      </div>
      {hints ? (
        <em>
          <span>{hints[0]}</span>
          <span>{hints[1]}</span>
          <span>{hints[2]}</span>
        </em>
      ) : null}
    </label>
  )
}

const safeStamp = (layout?: Partial<SignatureAssetLayout>) => normalizeSignatureLayout(layout, { x: 27, y: 24, width: 170, opacity: 100, zIndex: 1 }, 'stamp')
const safeSignature = (layout?: Partial<SignatureAssetLayout>) =>
  normalizeSignatureLayout(layout, { x: 43, y: 32, width: 230, opacity: 100, zIndex: 2 }, 'signature')

function SignatureControls({
  title,
  value,
  defaults,
  onChange,
}: {
  title: string
  value: Pick<DraftOrder, 'visualSettings' | 'stampLayout' | 'signatureLayout'>
  defaults: Partial<SignatureVisualSettings>
  onChange: (value: Partial<DraftOrder>) => void
}) {
  const visual = normalizeVisualSettings(value.visualSettings)
  const stampLayout = safeStamp(value.stampLayout)
  const signatureLayout = safeSignature(value.signatureLayout)
  const patchVisual = (patchValue: Partial<SignatureVisualSettings>) => {
    const nextVisual = normalizeVisualSettings({ ...visual, ...patchValue })
    onChange({
      visualSettings: nextVisual,
      stampLayout: { ...stampLayout, width: nextVisual.stampWidth, opacity: nextVisual.stampOpacity },
      signatureLayout: { ...signatureLayout, width: nextVisual.signatureWidth, opacity: nextVisual.signatureOpacity },
    })
  }
  const patchStamp = (patchValue: Partial<typeof stampLayout>) =>
    onChange({
      stampLayout: safeStamp({ ...stampLayout, ...patchValue, widthUnit: 'px' }),
      visualSettings: normalizeVisualSettings({ ...visual, stampWidth: patchValue.width ?? stampLayout.width, stampOpacity: patchValue.opacity ?? stampLayout.opacity }),
    })
  const patchSignature = (patchValue: Partial<typeof signatureLayout>) =>
    onChange({
      signatureLayout: safeSignature({ ...signatureLayout, ...patchValue, widthUnit: 'px' }),
      visualSettings: normalizeVisualSettings({
        ...visual,
        signatureWidth: patchValue.width ?? signatureLayout.width,
        signatureOpacity: patchValue.opacity ?? signatureLayout.opacity,
      }),
    })
  const preset = (stampWidth: number, signatureWidth: number, stampX: number, stampY: number, signX: number, signY: number) =>
    onChange({
      visualSettings: normalizeVisualSettings({ ...visual, stampWidth, signatureWidth }),
      stampLayout: safeStamp({ ...stampLayout, x: stampX, y: stampY, width: stampWidth, widthUnit: 'px' }),
      signatureLayout: safeSignature({ ...signatureLayout, x: signX, y: signY, width: signatureWidth, widthUnit: 'px' }),
    })
  return (
    <section className="panel">
      <Title icon={<PenLine size={18} />} title={title} text="Geser langsung di area preview atau pakai slider di bawah." />
      <div className="preset-row">
        <button type="button" className="secondary" onClick={() => preset(130, 180, 24, 28, 46, 36)}>
          Kecil
        </button>
        <button type="button" className="secondary" onClick={() => preset(170, 230, 27, 24, 43, 32)}>
          Normal
        </button>
        <button type="button" className="secondary" onClick={() => preset(220, 280, 21, 18, 38, 30)}>
          Besar
        </button>
        <button type="button" className="secondary" onClick={() => onChange({ stampLayout: safeStamp(), signatureLayout: safeSignature(), visualSettings: normalizeVisualSettings(defaults) })}>
          Reset Posisi
        </button>
        <button type="button" className="secondary" onClick={() => patchVisual(normalizeVisualSettings(defaults))}>
          Reset ke Default
        </button>
      </div>
      <SignatureFreeformEditor
        stampLayout={stampLayout}
        signatureLayout={signatureLayout}
        onStampChange={patchStamp}
        onSignatureChange={patchSignature}
      />
      <div className="grid two">
        <NumberSlider label="Geser Stempel: Kiri ↔ Kanan" value={stampLayout.x} min={0} max={100} suffix="%" hints={['Kiri', 'Tengah', 'Kanan']} onChange={(x) => patchStamp({ x })} />
        <NumberSlider label="Naik/Turun Stempel" value={stampLayout.y} min={0} max={100} suffix="%" hints={['Atas', 'Tengah', 'Bawah']} onChange={(y) => patchStamp({ y })} />
        <NumberSlider label="Besar Stempel" value={stampLayout.width} min={80} max={320} hints={['Kecil', 'Normal', 'Besar']} onChange={(width) => patchStamp({ width })} />
        <NumberSlider
          label="Transparansi Stempel"
          value={stampLayout.opacity}
          min={20}
          max={100}
          suffix="%"
          onChange={(opacity) => patchStamp({ opacity })}
        />
        <NumberSlider label="Geser Tanda Tangan: Kiri ↔ Kanan" value={signatureLayout.x} min={0} max={100} suffix="%" hints={['Kiri', 'Tengah', 'Kanan']} onChange={(x) => patchSignature({ x })} />
        <NumberSlider label="Naik/Turun Tanda Tangan" value={signatureLayout.y} min={0} max={100} suffix="%" hints={['Atas', 'Tengah', 'Bawah']} onChange={(y) => patchSignature({ y })} />
        <NumberSlider
          label="Besar Tanda Tangan"
          value={signatureLayout.width}
          min={120}
          max={340}
          hints={['Kecil', 'Normal', 'Besar']}
          onChange={(width) => patchSignature({ width })}
        />
        <NumberSlider
          label="Transparansi Tanda Tangan"
          value={signatureLayout.opacity}
          min={20}
          max={100}
          suffix="%"
          onChange={(opacity) => patchSignature({ opacity })}
        />
      </div>
    </section>
  )
}

function SignatureFreeformEditor({
  stampLayout,
  signatureLayout,
  onStampChange,
  onSignatureChange,
}: {
  stampLayout: DraftOrder['stampLayout']
  signatureLayout: DraftOrder['signatureLayout']
  onStampChange: (value: Partial<DraftOrder['stampLayout']>) => void
  onSignatureChange: (value: Partial<DraftOrder['signatureLayout']>) => void
}) {
  const [active, setActive] = useState<'stamp' | 'signature'>('signature')
  const startDrag = (
    event: PointerEvent<HTMLElement>,
    layout: DraftOrder['stampLayout'],
    onChange: (value: Partial<DraftOrder['stampLayout']>) => void,
    mode: 'move' | 'resize',
  ) => {
    const area = event.currentTarget.closest('.freeform-area') as HTMLDivElement | null
    if (!area) return
    const rect = area.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const start = { ...layout }
    event.currentTarget.setPointerCapture(event.pointerId)
    const move = (moveEvent: globalThis.PointerEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      if (mode === 'resize') {
        onChange({ width: start.width + dx })
      } else {
        onChange({
          x: Math.round(start.x + (dx / rect.width) * 100),
          y: Math.round(start.y + (dy / rect.height) * 100),
        })
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="freeform-editor">
      <div className="freeform-toolbar">
        <button type="button" className={active === 'stamp' ? 'secondary strong' : 'secondary'} onClick={() => setActive('stamp')}>
          Pilih Stempel
        </button>
        <button type="button" className={active === 'signature' ? 'secondary strong' : 'secondary'} onClick={() => setActive('signature')}>
          Pilih TTD
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => (active === 'stamp' ? onStampChange({ x: 34, y: 24 }) : onSignatureChange({ x: 42, y: 32 }))}
        >
          Center
        </button>
      </div>
      <div className="freeform-area">
        <div className="freeform-text top">
          <b>Dengan hormat,</b>
          <span>Apoteker Penanggung Jawab</span>
        </div>
        <div
          className={`freeform-item stamp-item ${active === 'stamp' ? 'active' : ''}`}
          style={{ left: `${stampLayout.x}%`, top: `${stampLayout.y}%`, width: stampLayout.width, opacity: stampLayout.opacity / 100, zIndex: stampLayout.zIndex }}
          onPointerDown={(event) => { setActive('stamp'); startDrag(event, stampLayout, onStampChange, 'move') }}
        >
          <span>Stempel</span>
          <i onPointerDown={(event) => { event.stopPropagation(); startDrag(event, stampLayout, onStampChange, 'resize') }} />
        </div>
        <div
          className={`freeform-item signature-item ${active === 'signature' ? 'active' : ''}`}
          style={{
            left: `${signatureLayout.x}%`,
            top: `${signatureLayout.y}%`,
            width: signatureLayout.width,
            opacity: signatureLayout.opacity / 100,
            zIndex: signatureLayout.zIndex,
          }}
          onPointerDown={(event) => { setActive('signature'); startDrag(event, signatureLayout, onSignatureChange, 'move') }}
        >
          <span>TTD</span>
          <i onPointerDown={(event) => { event.stopPropagation(); startDrag(event, signatureLayout, onSignatureChange, 'resize') }} />
        </div>
        <div className="freeform-name-zone">
          <b>Nama Apoteker</b>
          <span>No. SIPA</span>
        </div>
      </div>
      <p className="helper-note">Area TTD & Stempel: objek otomatis ditahan di dalam area aman agar tidak keluar dari kertas/PDF.</p>
    </div>
  )
}

function Preview({
  order,
  settings,
  layoutDebug = false,
  setLayoutDebug,
  onBack,
  onFinalize,
  onPdf,
}: {
  order: Order
  settings: ClinicSettings
  layoutDebug?: boolean
  setLayoutDebug?: (value: boolean) => void
  onBack?: () => void
  onFinalize?: () => void
  onPdf: () => void
}) {
  const resolvedOrder = resolveOrderAssets(order, settings)
  const visual = normalizeVisualSettings(resolvedOrder.visualSettings)
  const design = order.selectedDesign || 'official-compact'
  const designTokens = getDocumentDesign(design)
  const stampLayout = resolvedOrder.stampLayout
  const signatureLayout = resolvedOrder.signatureLayout
  const stampBox = assetBox(stampLayout, 'stamp', 'web', design)
  const signatureBox = assetBox(signatureLayout, 'signature', 'web', design)
  return (
    <div className="stack">
      <div className="preview-actions">
        {onBack ? (
          <button className="secondary" type="button" onClick={onBack}>
            Back / Edit Draft
          </button>
        ) : null}
        {onFinalize ? (
          <button className="primary" type="button" onClick={onFinalize}>
            <FileCheck2 size={17} /> Save / Finalize Order
          </button>
        ) : null}
        <button className="secondary strong" type="button" onClick={onPdf}>
          <Download size={17} /> Generate PDF
        </button>
        {setLayoutDebug ? (
          <button className={layoutDebug ? 'secondary strong' : 'secondary'} type="button" onClick={() => setLayoutDebug(!layoutDebug)}>
            Show PDF Layout Debug
          </button>
        ) : null}
      </div>
      <article
        className={`paper actual-letter design-${design} status-${order.status === 'finalized' ? 'finalized' : 'draft'} ${layoutDebug ? 'layout-debug' : ''}`}
        style={{
          '--paper-pad-x': `${designTokens.page.webPaddingX}px`,
          '--paper-pad-y': `${designTokens.page.webPaddingY}px`,
          '--body-size': `${designTokens.font.webBody}px`,
          '--body-line': String(designTokens.font.lineHeight),
          '--title-size': `${designTokens.font.webTitle}px`,
          '--signature-width': `${designTokens.signature.webWidth}px`,
          '--signature-height': `${designTokens.signature.webHeight}px`,
          '--table-border': designTokens.table.borderColor,
          '--table-header': designTokens.table.headerBg,
        } as CSSProperties}
      >
        <header>
          <div className={resolvedOrder.clinicSnapshot.logoUrl ? 'paper-logo' : 'paper-logo empty'}>
            {resolvedOrder.clinicSnapshot.logoUrl ? <img src={resolvedOrder.clinicSnapshot.logoUrl} alt="Logo" /> : null}
          </div>
          <div>
            <h2>{resolvedOrder.clinicSnapshot.companyName}</h2>
            {resolvedOrder.clinicSnapshot.nib ? <p>NIB: {resolvedOrder.clinicSnapshot.nib}</p> : null}
            {resolvedOrder.clinicSnapshot.licenseNumber ? <p>Izin Klinik: {resolvedOrder.clinicSnapshot.licenseNumber}</p> : null}
            {resolvedOrder.clinicSnapshot.address ? <p>{resolvedOrder.clinicSnapshot.address}</p> : null}
            {[resolvedOrder.clinicSnapshot.contactNumber, resolvedOrder.clinicSnapshot.email].filter(Boolean).length ? (
              <p>{[resolvedOrder.clinicSnapshot.contactNumber, resolvedOrder.clinicSnapshot.email].filter(Boolean).join(' | ')}</p>
            ) : null}
          </div>
        </header>
        <h2 className="paper-title">SURAT PEMESANAN PRODUK</h2>
        <div className="meta">
          <span>Nomor</span>
          <b>{order.orderNumber === 'DRAFT-BELUM-FINAL' ? 'DRAFT' : order.orderNumber}</b>
          <span>Tanggal</span>
          <b>{formatDate(order.orderDate)}</b>
        </div>
        <section className="recipient">
          <p>Kepada Yth.</p>
          <b>{order.distributorSnapshot.name}</b>
          {order.distributorSnapshot.address ? <p>{order.distributorSnapshot.address}</p> : null}
          {[order.distributorSnapshot.contactNumber, order.distributorSnapshot.email].filter(Boolean).length ? (
            <p>{[order.distributorSnapshot.contactNumber, order.distributorSnapshot.email].filter(Boolean).join(' | ')}</p>
          ) : null}
        </section>
        <p>Dengan hormat,</p>
        <p>Bersama ini kami mengajukan pemesanan produk dengan rincian sebagai berikut:</p>
        <div className="pdf-table">
          <div>
            <b>No</b>
            <b>Nama Produk</b>
            <b>Bentuk Sediaan</b>
            <b>Kuantitas</b>
            <b>Keterangan</b>
          </div>
          {order.items.map((item, index) => (
            <div key={item.id}>
              <span>{index + 1}</span>
              <span>{item.productName}</span>
              <span>{item.dosageForm || '-'}</span>
              <span>{item.quantity}</span>
              <span>{item.notes || '-'}</span>
            </div>
          ))}
        </div>
        <p>Demikian surat pemesanan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>
        <footer className="signature">
          <div>
            <p>Dengan hormat,</p>
            <p>Apoteker Penanggung Jawab</p>
            <div className="sign-box">
              {resolvedOrder.pharmacistSnapshot.stampUrl ? (
                <img
                  className="stamp-preview"
                  src={resolvedOrder.pharmacistSnapshot.stampUrl}
                  alt="Stamp"
                  style={{
                    left: stampBox.left,
                    top: stampBox.top,
                    width: stampBox.width,
                    height: stampBox.height,
                    opacity: stampBox.opacity || visual.stampOpacity / 100,
                    zIndex: stampLayout.zIndex,
                  }}
                />
              ) : null}
              {resolvedOrder.pharmacistSnapshot.signatureUrl ? (
                <img
                  className="signature-preview"
                  src={resolvedOrder.pharmacistSnapshot.signatureUrl}
                  alt="Signature"
                  style={{
                    left: signatureBox.left,
                    top: signatureBox.top,
                    width: signatureBox.width,
                    height: signatureBox.height,
                    opacity: signatureBox.opacity || visual.signatureOpacity / 100,
                    zIndex: signatureLayout.zIndex,
                  }}
                />
              ) : null}
            </div>
            <b>{resolvedOrder.pharmacistSnapshot.name || '( Nama Apoteker )'}</b>
            <p>No. SIPA: {resolvedOrder.pharmacistSnapshot.sipa || '........................'}</p>
          </div>
        </footer>
      </article>
    </div>
  )
}

function History({
  orders,
  currentDraft,
  selected,
  setSelected,
  openDraft,
  duplicate,
  markVoid,
  settings,
}: {
  orders: Order[]
  currentDraft: DraftOrder | null
  selected: Order | null
  setSelected: (order: Order | null) => void
  openDraft: (draft: DraftOrder) => void
  duplicate: (order: Order) => void
  markVoid: (order: Order) => void
  settings: ClinicSettings
}) {
  const [query, setQuery] = useState('')
  const filtered = orders.filter((order) => `${order.orderNumber} ${order.distributorSnapshot.name}`.toLowerCase().includes(query.toLowerCase()))
  if (selected) {
    return (
      <div className="stack">
        <div className="preview-actions">
          <button className="secondary" type="button" onClick={() => setSelected(null)}>
            Back
          </button>
          <button className="secondary strong" type="button" onClick={() => downloadPdf(selected, settings)}>
            <Download size={17} /> Download PDF Final
          </button>
          <button className="secondary" type="button" onClick={() => duplicate(selected)}>
            <CopyPlus size={17} /> Duplicate as new order
          </button>
          <button className="danger-btn" type="button" disabled={selected.status === 'void'} onClick={() => markVoid(selected)}>
            <ShieldX size={17} /> Void
          </button>
        </div>
        {selected.status === 'void' ? <div className="void-note">Void reason: {selected.voidReason}</div> : null}
        <Preview order={selected} settings={settings} layoutDebug={false} onPdf={() => downloadPdf(selected, settings)} />
      </div>
    )
  }
  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <small>History</small>
          <h2>Riwayat Surat Pemesanan</h2>
        </div>
        <div className="search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor / distributor" />
        </div>
      </div>
      <section className="panel">
        {currentDraft ? (
          <div className="draft-history-row">
            <div>
              <span className="badge warm">Draft</span>
              <b>{currentDraft.distributorSnapshot.name || 'Draft belum diberi distributor'}</b>
              <p>{formatDate(currentDraft.orderDate)} | {currentDraft.items.length} item</p>
            </div>
            <button className="secondary" type="button" onClick={() => openDraft(currentDraft)}>
              Buka & Edit Draft
            </button>
          </div>
        ) : null}
        {filtered.length ? (
          <div className="history-table">
            <div className="history-head">
              <span>Tanggal</span>
              <span>Nomor surat</span>
              <span>Distributor</span>
              <span>Jumlah item</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filtered.map((order) => (
              <div className="history-row" key={order.id}>
                <span>{formatDate(order.orderDate)}</span>
                <b>{order.orderNumber}</b>
                <span>{order.distributorSnapshot.name}</span>
                <span>{order.items.length} item</span>
                <span className={order.status === 'void' ? 'badge danger' : 'badge good'}>{order.status}</span>
                <div className="row-actions">
                  <button className="icon" type="button" onClick={() => setSelected(order)}>
                    <Eye size={16} />
                  </button>
                  <button className="icon" type="button" onClick={() => downloadPdf(order, settings)}>
                    <Download size={16} />
                  </button>
                  <button className="icon" type="button" onClick={() => duplicate(order)}>
                    <CopyPlus size={16} />
                  </button>
                  <button className="icon danger" type="button" disabled={order.status === 'void'} onClick={() => markVoid(order)}>
                    <ShieldX size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <b>Belum ada finalized order.</b>
            <p>History akan muncul setelah surat pertama difinalisasi.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function DistributorPage({
  distributors,
  setDistributors,
  flash,
}: {
  distributors: Distributor[]
  setDistributors: (items: Distributor[]) => void
  flash: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ id: '', name: '', address: '', contactNumber: '', email: '', notes: '' })
  const filtered = distributors.filter((item) => !item.isDeleted && `${item.name} ${item.address}`.toLowerCase().includes(query.toLowerCase()))
  const save = () => {
    if (!form.name.trim()) return alert('Nama distributor wajib diisi.')
    const timestamp = now()
    const item: Distributor = form.id
      ? { ...(distributors.find((dist) => dist.id === form.id) as Distributor), ...form, name: form.name.trim(), updatedAt: timestamp }
      : { ...form, id: uid('dist'), name: form.name.trim(), isDeleted: false, createdAt: timestamp, updatedAt: timestamp }
    const next = form.id ? distributors.map((dist) => (dist.id === item.id ? item : dist)) : [item, ...distributors]
    saveDistributors(next)
    setDistributors(next)
    setForm({ id: '', name: '', address: '', contactNumber: '', email: '', notes: '' })
    flash('Distributor tersimpan.')
  }
  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <small>Master Data</small>
          <h2>Distributor</h2>
        </div>
        <div className="search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari distributor" />
        </div>
      </div>
      <section className="panel">
        <Title icon={<Store size={18} />} title={form.id ? 'Edit Distributor' : 'Tambah Distributor'} text="Soft delete otomatis jika sudah dipakai di history." />
        <div className="grid two">
          <label>
            Nama distributor
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Nomor kontak
            <input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <label className="full">
            Alamat
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
        </div>
        <button className="primary" type="button" onClick={save}>
          <Save size={17} /> Simpan Distributor
        </button>
      </section>
      <section className="card-grid">
        {filtered.map((item) => (
          <article className="dist-card" key={item.id}>
            <div>
              <h3>{item.name}</h3>
              <p>{item.address || 'Alamat belum diisi'}</p>
              <small>{[item.contactNumber, item.email].filter(Boolean).join(' | ') || 'Kontak belum diisi'}</small>
            </div>
            <div className="row-actions">
              <button className="icon" type="button" onClick={() => setForm(item)}>
                <Eye size={16} />
              </button>
              <button
                className="icon danger"
                type="button"
                onClick={() => {
                  if (!confirm('Hapus distributor ini?')) return
                  const next = deleteDistributor(item.id)
                  setDistributors(next)
                  flash('Distributor diperbarui.')
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

function SettingsPage({
  settings,
  setSettings,
  refreshFromStore,
  flash,
}: {
  settings: ClinicSettings
  setSettings: (settings: ClinicSettings) => void
  refreshFromStore: () => void
  flash: (message: string) => void
}) {
  const [form, setForm] = useState(settings || defaultSettings())
  const [usage, setUsage] = useState(getStorageUsage())
  const patch = (patchValue: Partial<ClinicSettings>) => setForm({ ...form, ...patchValue })
  const formatBytes = (bytes = 0) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(loadStore(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFilename()
    a.click()
    URL.revokeObjectURL(url)
    flash('Backup JSON berhasil diekspor.')
  }
  const importBackup = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '')) as HeraStorage
        if (parsed.version !== 1 || !parsed.settings || !Array.isArray(parsed.distributors) || !Array.isArray(parsed.orders)) {
          throw new Error('Invalid shape')
        }
        const replace = confirm('Pilih OK untuk REPLACE semua data saat ini. Pilih Cancel untuk MERGE dengan data saat ini.')
        if (!confirm(`${replace ? 'Replace' : 'Merge'} data dari backup ini sekarang?`)) return
        mergeImportedStore(parsed, replace ? 'replace' : 'merge')
        refreshFromStore()
        flash('Backup berhasil diimpor.')
      } catch {
        alert('File backup tidak valid.')
      }
    }
    reader.readAsText(file)
  }
  const imageField = (label: string, key: 'logoUrl' | 'signatureUrl' | 'stampUrl') => (
    <div className="image-field">
      <div className="image-preview">{form[key] ? <img src={form[key]} alt={label} /> : <ImagePlus size={22} />}</div>
      <label>
        {label}
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            e.target.files?.[0] &&
            readImage(e.target.files[0], key, (value, size) => patch({ [key]: value, imageSizes: { ...(form.imageSizes || {}), [key]: size } }))
          }
        />
      </label>
      {form.imageSizes?.[key] ? <small>{formatBytes(form.imageSizes[key])}</small> : null}
    </div>
  )
  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <small>Settings</small>
          <h2>Identitas Klinik & PDF</h2>
        </div>
        <button
          className="primary"
          type="button"
          onClick={() => {
            const saved = saveSettings(form)
            setSettings(saved)
            flash('Settings tersimpan.')
          }}
        >
          <Save size={17} /> Simpan Settings
        </button>
      </div>
      <section className="panel info-panel">
        <b>Backup & keamanan data lokal</b>
        <p>Data saat ini disimpan di browser ini. Untuk keamanan sebelum update besar, klik Export Backup.</p>
        <p>Data tersimpan per browser dan per domain. Data localhost, preview Vercel, dan production Vercel bisa berbeda.</p>
        <div className={`storage-meter ${usage.percent >= 90 ? 'danger' : usage.percent >= 70 ? 'warning' : ''}`}>
          <div>
            <b>Storage browser: {formatBytes(usage.usedBytes)} digunakan</b>
            <span>Perkiraan {usage.percent}% dari kuota lokal browser.</span>
          </div>
          <i style={{ width: `${Math.min(100, usage.percent)}%` }} />
        </div>
        {usage.percent >= 70 ? <p className="helper-note">Jika hampir penuh, klik Optimalkan Storage agar gambar lama yang terduplikasi dibersihkan.</p> : null}
        <div className="preset-row">
          <button type="button" className="secondary strong" onClick={exportBackup}>
            Export Backup JSON
          </button>
          <label className="import-button">
            Import Backup JSON
            <input type="file" accept="application/json" onChange={(e) => importBackup(e.target.files?.[0])} />
          </label>
          <button
            type="button"
            className="secondary strong"
            onClick={async () => {
              const optimizedImages: Partial<ClinicSettings> = {}
              const optimizedSizes = { ...(form.imageSizes || {}) }
              for (const key of ['logoUrl', 'signatureUrl', 'stampUrl'] as const) {
                if (!form[key]?.startsWith('data:image/')) continue
                const result = await compressDataUrl(form[key], key, form.imageSizes?.[key])
                optimizedImages[key] = result.value
                optimizedSizes[key] = result.size
              }
              const saved = saveSettings({ ...form, ...optimizedImages, imageSizes: optimizedSizes })
              setForm(saved)
              setSettings(saved)
              optimizeStorage()
              refreshFromStore()
              setUsage(getStorageUsage())
              flash('Storage berhasil dioptimalkan.')
            }}
          >
            Optimalkan Storage
          </button>
        </div>
      </section>
      <section className="panel">
        <Title icon={<Settings size={18} />} title="Clinic Identity" text="Data ini menjadi snapshot saat order finalized." />
        {imageField('Logo upload', 'logoUrl')}
        <div className="grid two">
          <label>
            Company name
            <input value={form.companyName} onChange={(e) => patch({ companyName: e.target.value })} />
          </label>
          <label>
            Email pemesan
            <input value={form.email} onChange={(e) => patch({ email: e.target.value })} />
          </label>
          <label>
            NIB
            <input value={form.nib} onChange={(e) => patch({ nib: e.target.value })} />
          </label>
          <label>
            Nomor izin klinik / izin operasional
            <input value={form.licenseNumber} onChange={(e) => patch({ licenseNumber: e.target.value })} />
          </label>
          <label>
            Contact number
            <input value={form.contactNumber} onChange={(e) => patch({ contactNumber: e.target.value })} />
          </label>
          <label className="full">
            Address
            <textarea value={form.address} onChange={(e) => patch({ address: e.target.value })} />
          </label>
        </div>
      </section>
      <section className="panel">
        <Title icon={<PenLine size={18} />} title="Apoteker & Signature" text="Jika kosong, preview dan PDF tetap menampilkan placeholder rapi." />
        <div className="grid two">
          <label>
            Nama apoteker
            <input value={form.pharmacistName} onChange={(e) => patch({ pharmacistName: e.target.value })} />
          </label>
          <label>
            No. SIPA
            <input value={form.pharmacistSipa} onChange={(e) => patch({ pharmacistSipa: e.target.value })} />
          </label>
        </div>
        <div className="grid two">
          {imageField('Signature image upload', 'signatureUrl')}
          {imageField('Clinic stamp image upload', 'stampUrl')}
        </div>
      </section>
      <SignatureControls
        title="Default Ukuran TTD & Stempel"
        value={{
          ...emptyDraft(form, 'official-compact'),
          visualSettings: normalizeVisualSettings(form),
        }}
        defaults={defaultSettings()}
        onChange={(draftPatch) => {
          if (draftPatch.visualSettings) patch(draftPatch.visualSettings)
        }}
      />
    </div>
  )
}

const mockupData = {
  company: 'PT HERA ELOK MEDIKA',
  nib: '2808230057848',
  license: '28082300578480001',
  address: 'Komplek Riau Business Centre Blok D19, Pekanbaru, Riau',
  contact: '082173518808',
  email: 'ptheraelokmedika@gmail.com',
  distributor: 'PT Mensa Bina Sukses',
  distributorAddress: 'Jl SM Amin Komplek Pergudangan Angkasa Blok C No 1',
  orderNumber: 'SP-HERA/202607/0001',
  date: '09 Juli 2026',
  pharmacist: 'apt. Deddy Hasan Putra Sianturi, S. Farm',
  sipa: '122/05.15/DPMPTSP/V/2024',
  items: [
    ['Rejuran Healer', 'Injeksi', '2 box', 'Untuk tindakan klinik'],
    ['Lidocaine', 'Ampul', '10 ampul', '-'],
    ['Cannula 25G', 'Alat medis', '20 pcs', '-'],
  ],
}

const designOptions = [
  { id: 'official-compact', name: 'Official Compact', desc: 'Surat klinik resmi, ringkas, dan cocok untuk distributor formal.' },
  { id: 'premium-editorial', name: 'Premium Editorial', desc: 'Stationery klinik premium dengan ritme visual lebih modern.' },
  { id: 'apothecary-professional', name: 'Apothecary Professional', desc: 'Struktur apoteker yang rapi dengan blok informasi tegas.' },
  { id: 'minimal-legal-letter', name: 'Minimal Legal Letter', desc: 'Paling matang, minimal, dan sangat formal.' },
  { id: 'modern-clinic-admin', name: 'Modern Clinic Admin', desc: 'Lebih fresh dan Gen Z, tetap printable dan resmi.' },
]

function DesignOptionsPage({ selectedDesign, onSelect }: { selectedDesign: string; onSelect: (id: string) => void }) {
  return (
    <div className="stack">
      <section className="design-grid">
        {designOptions.map((option, index) => (
          <article className="design-card" key={option.id}>
            <div className="design-card-head">
              <div>
                <div className="design-title-row">
                  <span>Opsi {index + 1}</span>
                  <h3>{option.name}</h3>
                </div>
                <p>{option.desc}</p>
              </div>
              {selectedDesign === option.id ? <span className="selected-pill">Dipilih</span> : null}
            </div>
            <LetterMockup variant={option.id} />
            <button type="button" className="primary" onClick={() => onSelect(option.id)}>
              Pilih desain ini
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}

function LetterMockup({ variant }: { variant: string }) {
  return (
    <div className={`mock-paper ${variant}`}>
      <header>
        <div className="mock-mark">H</div>
        <div>
          <h4>{mockupData.company}</h4>
          <p>NIB: {mockupData.nib}</p>
          <p>Izin Klinik: {mockupData.license}</p>
          <p>{mockupData.address}</p>
          <p>{mockupData.contact} | {mockupData.email}</p>
        </div>
      </header>
      <div className="mock-title">SURAT PEMESANAN PRODUK</div>
      <div className="mock-meta">
        <span>Nomor</span>
        <b>{mockupData.orderNumber}</b>
        <span>Tanggal</span>
        <b>{mockupData.date}</b>
      </div>
      <section className="mock-recipient">
        <p>Kepada Yth.</p>
        <b>{mockupData.distributor}</b>
        <p>{mockupData.distributorAddress}</p>
      </section>
      <p>Dengan hormat,</p>
      <p>Bersama ini kami mengajukan pemesanan produk dengan rincian sebagai berikut:</p>
      <div className="mock-table">
        <div>
          <b>No</b>
          <b>Nama Produk</b>
          <b>Bentuk</b>
          <b>Qty</b>
          <b>Keterangan</b>
        </div>
        {mockupData.items.map((item, index) => (
          <div key={item[0]}>
            <span>{index + 1}</span>
            {item.map((cell) => (
              <span key={cell}>{cell}</span>
            ))}
          </div>
        ))}
      </div>
      <p>Demikian surat pemesanan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>
      <footer>
        <p>Dengan hormat,</p>
        <p>Apoteker Penanggung Jawab</p>
        <div className="mock-signature">
          <span className="mock-stamp" />
          <span className="mock-sign" />
        </div>
        <b>{mockupData.pharmacist}</b>
        <p>No. SIPA: {mockupData.sipa}</p>
      </footer>
    </div>
  )
}

export default App
