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
import type { ReactNode } from 'react'
import './App.css'
import { OrderPdf } from './pdf/OrderPdf'
import {
  defaultSettings,
  deleteDistributor,
  emptyDraft,
  emptyItem,
  finalizeOrder,
  formatDate,
  getDistributors,
  getOrders,
  getSettings,
  now,
  sanitizeFilename,
  saveDistributors,
  saveSettings,
  uid,
  voidOrder,
} from './storage/heraStorage'
import type { ClinicSettings, Distributor, DraftOrder, Order, Page } from './types/hera'

const navItems: Array<{ key: Page; label: string; Icon: typeof FilePlus2 }> = [
  { key: 'create', label: 'Buat Surat', Icon: FilePlus2 },
  { key: 'history', label: 'History', Icon: FileClock },
  { key: 'distributors', label: 'Distributor', Icon: Store },
  { key: 'settings', label: 'Settings', Icon: Settings },
]

const readImage = (file: File, done: (value: string) => void) => {
  const reader = new FileReader()
  reader.onload = () => done(String(reader.result || ''))
  reader.readAsDataURL(file)
}

const downloadPdf = async (order: Order) => {
  const element = createElement(OrderPdf, { order }) as Parameters<typeof pdf>[0]
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
  const [page, setPage] = useState<Page>('create')
  const [settings, setSettings] = useState<ClinicSettings>(getSettings)
  const [distributors, setDistributors] = useState<Distributor[]>(getDistributors)
  const [orders, setOrders] = useState<Order[]>(getOrders)
  const [draft, setDraft] = useState<DraftOrder>(emptyDraft)
  const [preview, setPreview] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [notice, setNotice] = useState('')

  const activeDistributors = distributors.filter((item) => !item.isDeleted)
  const stats = useMemo(
    () => ({
      finalized: orders.filter((order) => order.status === 'finalized').length,
      void: orders.filter((order) => order.status === 'void').length,
      distributors: activeDistributors.length,
    }),
    [orders, activeDistributors.length],
  )

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const patchDraft = (patch: Partial<DraftOrder>) => setDraft({ ...draft, ...patch, updatedAt: now() })
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
    const order = finalizeOrder(draft, settings)
    setOrders([order, ...orders])
    setDistributors(getDistributors())
    setDraft(emptyDraft())
    setPreview(false)
    setPage('history')
    flash(`Order ${order.orderNumber} finalized.`)
    await downloadPdf(order)
  }

  const duplicateOrder = (order: Order) => {
    setDraft({
      id: uid('draft'),
      orderDate: new Date().toISOString().slice(0, 10),
      distributorId: order.distributorId,
      distributorSnapshot: { ...order.distributorSnapshot },
      items: order.items.map((item) => ({ ...item, id: uid('item') })),
      createdAt: now(),
      updatedAt: now(),
    })
    setSelectedOrder(null)
    setPreview(false)
    setPage('create')
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
          <div className="brand-icon">H</div>
          <div>
            <strong>Hera Form</strong>
            <span>Surat Pemesanan Produk</span>
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
          <small>Audit Status</small>
          <p>
            Finalized <b>{stats.finalized}</b>
          </p>
          <p>
            Void <b>{stats.void}</b>
          </p>
          <p>
            Distributor <b>{stats.distributors}</b>
          </p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <small>Premium Clinic Admin</small>
            <h1>Surat Pemesanan Produk Klinik</h1>
          </div>
          <span className="badge good">Immutable finalized snapshot</span>
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
          <Preview order={makePreviewOrder()} onBack={() => setPreview(false)} onFinalize={finalize} onPdf={() => downloadPdf(makePreviewOrder())} />
        ) : null}

        {page === 'history' ? (
          <History
            orders={orders}
            selected={selectedOrder}
            setSelected={setSelectedOrder}
            duplicate={duplicateOrder}
            markVoid={markVoid}
          />
        ) : null}

        {page === 'distributors' ? (
          <DistributorPage distributors={distributors} setDistributors={setDistributors} flash={flash} />
        ) : null}

        {page === 'settings' ? <SettingsPage settings={settings} setSettings={setSettings} flash={flash} /> : null}
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

function Preview({
  order,
  onBack,
  onFinalize,
  onPdf,
}: {
  order: Order
  onBack?: () => void
  onFinalize?: () => void
  onPdf: () => void
}) {
  return (
    <div className="stack">
      <div className="preview-actions">
        <button className="secondary" type="button" onClick={onBack}>
          Back / Edit Draft
        </button>
        {onFinalize ? (
          <button className="primary" type="button" onClick={onFinalize}>
            <FileCheck2 size={17} /> Save / Finalize Order
          </button>
        ) : null}
        <button className="secondary strong" type="button" onClick={onPdf}>
          <Download size={17} /> Generate PDF
        </button>
      </div>
      <article className="paper">
        <header>
          <div className={order.clinicSnapshot.logoUrl ? 'paper-logo' : 'paper-logo empty'}>
            {order.clinicSnapshot.logoUrl ? <img src={order.clinicSnapshot.logoUrl} alt="Logo" /> : null}
          </div>
          <div>
            <h2>{order.clinicSnapshot.companyName}</h2>
            {order.clinicSnapshot.nib ? <p>NIB: {order.clinicSnapshot.nib}</p> : null}
            {order.clinicSnapshot.licenseNumber ? <p>Izin Klinik: {order.clinicSnapshot.licenseNumber}</p> : null}
            {order.clinicSnapshot.address ? <p>{order.clinicSnapshot.address}</p> : null}
            {[order.clinicSnapshot.contactNumber, order.clinicSnapshot.email].filter(Boolean).length ? (
              <p>{[order.clinicSnapshot.contactNumber, order.clinicSnapshot.email].filter(Boolean).join(' | ')}</p>
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
              {order.pharmacistSnapshot.stampUrl ? <img className="stamp-preview" src={order.pharmacistSnapshot.stampUrl} alt="Stamp" /> : null}
              {order.pharmacistSnapshot.signatureUrl ? (
                <img className="signature-preview" src={order.pharmacistSnapshot.signatureUrl} alt="Signature" />
              ) : null}
            </div>
            <b>{order.pharmacistSnapshot.name || '( Nama Apoteker )'}</b>
            <p>No. SIPA: {order.pharmacistSnapshot.sipa || '........................'}</p>
          </div>
        </footer>
      </article>
    </div>
  )
}

function History({
  orders,
  selected,
  setSelected,
  duplicate,
  markVoid,
}: {
  orders: Order[]
  selected: Order | null
  setSelected: (order: Order | null) => void
  duplicate: (order: Order) => void
  markVoid: (order: Order) => void
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
          <button className="secondary strong" type="button" onClick={() => downloadPdf(selected)}>
            <Download size={17} /> Generate PDF again
          </button>
          <button className="secondary" type="button" onClick={() => duplicate(selected)}>
            <CopyPlus size={17} /> Duplicate as new order
          </button>
          <button className="danger-btn" type="button" disabled={selected.status === 'void'} onClick={() => markVoid(selected)}>
            <ShieldX size={17} /> Void
          </button>
        </div>
        {selected.status === 'void' ? <div className="void-note">Void reason: {selected.voidReason}</div> : null}
        <Preview order={selected} onPdf={() => downloadPdf(selected)} />
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
                  <button className="icon" type="button" onClick={() => downloadPdf(order)}>
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
  flash,
}: {
  settings: ClinicSettings
  setSettings: (settings: ClinicSettings) => void
  flash: (message: string) => void
}) {
  const [form, setForm] = useState(settings || defaultSettings())
  const patch = (patchValue: Partial<ClinicSettings>) => setForm({ ...form, ...patchValue })
  const imageField = (label: string, key: 'logoUrl' | 'signatureUrl' | 'stampUrl') => (
    <div className="image-field">
      <div className="image-preview">{form[key] ? <img src={form[key]} alt={label} /> : <ImagePlus size={22} />}</div>
      <label>
        {label}
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0], (value) => patch({ [key]: value }))} />
      </label>
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
    </div>
  )
}

export default App
