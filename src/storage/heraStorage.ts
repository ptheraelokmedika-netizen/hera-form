import type { ClinicSettings, Distributor, DraftOrder, HeraStorage, Order, OrderItem, SignatureAssetLayout, SignatureVisualSettings } from '../types/hera'

export const STORAGE_KEY = 'hera-form-storage-v1'
const CORRUPT_BACKUP_KEY = 'hera-form-storage-corrupt-backup'
const PRE_OPTIMIZE_BACKUP_KEY = 'hera-form-storage-pre-optimize-backup'
const BEFORE_QUOTA_MIGRATION_KEY = 'hera-form-storage-before-quota-migration'
export const SIGNATURE_CANVAS = { width: 520, height: 250 }
const OLD_KEYS = [
  'clinicSettings',
  'distributors',
  'orders',
  'heraFormSettings',
  'heraFormOrders',
  'heraFormDistributors',
  'orderHistory',
  'currentOrderDraft',
  'hera-form.settings',
  'hera-form.distributors',
  'hera-form.orders',
]

export const now = () => new Date().toISOString()
export const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
export const today = () => new Date().toISOString().slice(0, 10)

export const defaultVisualSettings = (): SignatureVisualSettings => ({
  stampWidth: 160,
  signatureWidth: 220,
  stampOpacity: 100,
  signatureOpacity: 100,
})

export const defaultStampLayout = (): SignatureAssetLayout => ({
  x: 27,
  y: 24,
  width: 170,
  opacity: 100,
  zIndex: 1,
})

export const defaultSignatureLayout = (): SignatureAssetLayout => ({
  x: 43,
  y: 32,
  width: 230,
  opacity: 100,
  zIndex: 2,
})

export const normalizeVisualSettings = (value?: Partial<SignatureVisualSettings> | null): SignatureVisualSettings => {
  const defaults = defaultVisualSettings()
  return {
    stampWidth: clampNumber(value?.stampWidth, 80, 260, defaults.stampWidth),
    signatureWidth: clampNumber(value?.signatureWidth, 100, 320, defaults.signatureWidth),
    stampOpacity: clampNumber(value?.stampOpacity, 40, 100, defaults.stampOpacity),
    signatureOpacity: clampNumber(value?.signatureOpacity, 60, 100, defaults.signatureOpacity),
  }
}

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

const isDataUrl = (value: unknown) => typeof value === 'string' && value.startsWith('data:image/')

const assetHeight = (kind: 'stamp' | 'signature', width: number) => Math.round(width * (kind === 'stamp' ? 0.72 : 0.36))

export const normalizeSignatureLayout = (
  value: Partial<SignatureAssetLayout> | null | undefined,
  fallback: SignatureAssetLayout,
  kind: 'stamp' | 'signature' = 'stamp',
): SignatureAssetLayout => {
  if (value?.widthUnit === 'percent') {
    const width = clampNumber(value.width, kind === 'stamp' ? 28 : 38, kind === 'stamp' ? 88 : 96, fallback.width)
    const heightPercent = width * (kind === 'stamp' ? 1.58 : 0.79)
    const maxX = Math.max(0, 100 - width)
    const maxY = Math.max(0, 100 - heightPercent - 4)
    return {
      x: clampNumber(value.x, 0, maxX, fallback.x),
      y: clampNumber(value.y, 0, maxY, fallback.y),
      width,
      widthUnit: 'percent',
      opacity: clampNumber(value.opacity, kind === 'stamp' ? 40 : 60, 100, fallback.opacity),
      zIndex: clampNumber(value.zIndex, 0, 5, fallback.zIndex),
    }
  }
  const maxWidth = kind === 'stamp' ? 320 : 340
  const minWidth = kind === 'stamp' ? 80 : 120
  const width = Math.min(SIGNATURE_CANVAS.width - 24, clampNumber(value?.width, minWidth, maxWidth, fallback.width))
  const height = assetHeight(kind, width)
  const maxX = Math.max(0, Math.floor(((SIGNATURE_CANVAS.width - width) / SIGNATURE_CANVAS.width) * 100))
  const maxY = Math.max(0, Math.floor(((SIGNATURE_CANVAS.height - height - 22) / SIGNATURE_CANVAS.height) * 100))
  return {
    x: clampNumber(value?.x, 0, maxX, fallback.x),
    y: clampNumber(value?.y, 0, maxY, fallback.y),
    width,
    widthUnit: value?.widthUnit,
    opacity: clampNumber(value?.opacity, kind === 'stamp' ? 40 : 60, 100, fallback.opacity),
    zIndex: clampNumber(value?.zIndex, 0, 5, fallback.zIndex),
  }
}

export const normalizeAssetLayout = (
  value: Partial<SignatureAssetLayout> | null | undefined,
  fallback: SignatureAssetLayout,
  kind: 'stamp' | 'signature' = 'stamp',
): SignatureAssetLayout => normalizeSignatureLayout(value, fallback, kind)

export const defaultSettings = (): ClinicSettings => ({
  companyName: 'PT HERA ELOK MEDIKA',
  logoUrl: '',
  nib: '',
  licenseNumber: '',
  address: '',
  contactNumber: '',
  email: 'ptheraelokmedika@gmail.com',
  pharmacistName: '',
  pharmacistSipa: '',
  signatureUrl: '',
  stampUrl: '',
  ...defaultVisualSettings(),
  updatedAt: now(),
})

export const emptyItem = (): OrderItem => ({
  id: uid('item'),
  productName: '',
  dosageForm: '',
  quantity: '',
  notes: '',
})

export const emptyDraft = (settings?: ClinicSettings, selectedDesign = 'official-compact'): DraftOrder => ({
  id: uid('draft'),
  orderDate: today(),
  distributorId: '',
  distributorSnapshot: { name: '', address: '', contactNumber: '', email: '', notes: '' },
  selectedDesign,
  stampLayout: defaultStampLayout(),
  signatureLayout: defaultSignatureLayout(),
  visualSettings: normalizeVisualSettings(settings),
  items: [emptyItem()],
  createdAt: now(),
  updatedAt: now(),
})

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const normalizeSettings = (value?: Partial<ClinicSettings> | null): ClinicSettings => ({
  ...defaultSettings(),
  ...(value || {}),
  ...normalizeVisualSettings(value),
  imageSizes: value?.imageSizes || {},
  updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : now(),
})

const normalizeDraft = (value: Partial<DraftOrder> | null | undefined, settings: ClinicSettings): DraftOrder | null => {
  if (!value) return null
  return {
    id: value.id || uid('draft'),
    orderDate: value.orderDate || today(),
    distributorId: value.distributorId || '',
    distributorSnapshot: {
      name: value.distributorSnapshot?.name || '',
      address: value.distributorSnapshot?.address || '',
      contactNumber: value.distributorSnapshot?.contactNumber || '',
      email: value.distributorSnapshot?.email || '',
      notes: value.distributorSnapshot?.notes || '',
    },
    selectedDesign: value.selectedDesign || 'official-compact',
    stampLayout: normalizeAssetLayout(value.stampLayout, {
      ...defaultStampLayout(),
      width: normalizeVisualSettings(value.visualSettings || settings).stampWidth,
      opacity: normalizeVisualSettings(value.visualSettings || settings).stampOpacity,
    }, 'stamp'),
    signatureLayout: normalizeAssetLayout(value.signatureLayout, {
      ...defaultSignatureLayout(),
      width: normalizeVisualSettings(value.visualSettings || settings).signatureWidth,
      opacity: normalizeVisualSettings(value.visualSettings || settings).signatureOpacity,
    }, 'signature'),
    visualSettings: normalizeVisualSettings(value.visualSettings || settings),
    items: Array.isArray(value.items) && value.items.length ? value.items.map((item) => ({ ...emptyItem(), ...item })) : [emptyItem()],
    createdAt: value.createdAt || now(),
    updatedAt: value.updatedAt || now(),
  }
}

const normalizeOrder = (value: Partial<Order>, settings: ClinicSettings): Order | null => {
  if (!value.orderDate || !value.distributorSnapshot || !Array.isArray(value.items)) return null
  return {
    id: value.id || uid('order'),
    orderNumber: value.orderNumber || 'DRAFT',
    orderDate: value.orderDate,
    distributorId: value.distributorId || '',
    distributorSnapshot: {
      name: value.distributorSnapshot.name || '',
      address: value.distributorSnapshot.address || '',
      contactNumber: value.distributorSnapshot.contactNumber || '',
      email: value.distributorSnapshot.email || '',
      notes: value.distributorSnapshot.notes || '',
    },
    clinicSnapshot: normalizeSettings(stripSnapshotImages(value.clinicSnapshot || settings)),
    pharmacistSnapshot: {
      name: value.pharmacistSnapshot?.name || '',
      sipa: value.pharmacistSnapshot?.sipa || '',
      signatureUrl: isDataUrl(value.pharmacistSnapshot?.signatureUrl) ? 'settings.signatureUrl' : value.pharmacistSnapshot?.signatureUrl || 'settings.signatureUrl',
      stampUrl: isDataUrl(value.pharmacistSnapshot?.stampUrl) ? 'settings.stampUrl' : value.pharmacistSnapshot?.stampUrl || 'settings.stampUrl',
    },
    selectedDesign: value.selectedDesign || 'official-compact',
    stampLayout: normalizeAssetLayout(value.stampLayout, {
      ...defaultStampLayout(),
      width: normalizeVisualSettings(value.visualSettings || value.clinicSnapshot || settings).stampWidth,
      opacity: normalizeVisualSettings(value.visualSettings || value.clinicSnapshot || settings).stampOpacity,
    }, 'stamp'),
    signatureLayout: normalizeAssetLayout(value.signatureLayout, {
      ...defaultSignatureLayout(),
      width: normalizeVisualSettings(value.visualSettings || value.clinicSnapshot || settings).signatureWidth,
      opacity: normalizeVisualSettings(value.visualSettings || value.clinicSnapshot || settings).signatureOpacity,
    }, 'signature'),
    visualSettings: normalizeVisualSettings(value.visualSettings || value.clinicSnapshot || settings),
    items: value.items.map((item) => ({ ...emptyItem(), ...item })),
    status: value.status || 'finalized',
    createdAt: value.createdAt || now(),
    updatedAt: value.updatedAt || now(),
    finalizedAt: value.finalizedAt || '',
    voidedAt: value.voidedAt || '',
    voidReason: value.voidReason || '',
  }
}

const stripSnapshotImages = <T extends Partial<ClinicSettings> | undefined | null>(settings: T): T => {
  if (!settings) return settings
  return {
    ...settings,
    logoUrl: isDataUrl(settings.logoUrl) ? 'settings.logoUrl' : settings.logoUrl || 'settings.logoUrl',
    signatureUrl: isDataUrl(settings.signatureUrl) ? 'settings.signatureUrl' : settings.signatureUrl || 'settings.signatureUrl',
    stampUrl: isDataUrl(settings.stampUrl) ? 'settings.stampUrl' : settings.stampUrl || 'settings.stampUrl',
  }
}

const stripOrderImages = (order: Order): Order => ({
  ...order,
  clinicSnapshot: stripSnapshotImages(order.clinicSnapshot),
  pharmacistSnapshot: {
    ...order.pharmacistSnapshot,
    signatureUrl: isDataUrl(order.pharmacistSnapshot.signatureUrl) ? 'settings.signatureUrl' : order.pharmacistSnapshot.signatureUrl || 'settings.signatureUrl',
    stampUrl: isDataUrl(order.pharmacistSnapshot.stampUrl) ? 'settings.stampUrl' : order.pharmacistSnapshot.stampUrl || 'settings.stampUrl',
  },
  stampLayout: normalizeSignatureLayout(order.stampLayout, defaultStampLayout(), 'stamp'),
  signatureLayout: normalizeSignatureLayout(order.signatureLayout, defaultSignatureLayout(), 'signature'),
})

const normalizeStore = (value?: Partial<HeraStorage> | null): HeraStorage => {
  const settings = normalizeSettings(value?.settings)
  const orders = Array.isArray(value?.orders)
    ? value.orders.map((order) => normalizeOrder(order, settings)).filter((order): order is Order => Boolean(order))
    : []
  return {
    version: 1,
    settings,
    distributors: Array.isArray(value?.distributors) ? value.distributors : [],
    orders: orders.map(stripOrderImages),
    currentDraft: normalizeDraft(value?.currentDraft, settings),
    selectedDesign: value?.selectedDesign,
    updatedAt: value?.updatedAt || now(),
  }
}

const readOldKey = <T,>(key: string) => safeParse<T>(localStorage.getItem(key))

const migrateOldKeys = (): HeraStorage | null => {
  const settings =
    readOldKey<Partial<ClinicSettings>>('clinicSettings') ||
    readOldKey<Partial<ClinicSettings>>('heraFormSettings') ||
    readOldKey<Partial<ClinicSettings>>('hera-form.settings')
  const distributors =
    readOldKey<Distributor[]>('distributors') ||
    readOldKey<Distributor[]>('heraFormDistributors') ||
    readOldKey<Distributor[]>('hera-form.distributors')
  const orders =
    readOldKey<Order[]>('orders') ||
    readOldKey<Order[]>('heraFormOrders') ||
    readOldKey<Order[]>('orderHistory') ||
    readOldKey<Order[]>('hera-form.orders')
  const currentDraft = readOldKey<DraftOrder>('currentOrderDraft')
  if (!settings && !distributors && !orders && !currentDraft) return null
  localStorage.setItem(`hera-form-storage-old-keys-backup-${Date.now()}`, JSON.stringify(Object.fromEntries(OLD_KEYS.map((key) => [key, localStorage.getItem(key)]))))
  return normalizeStore({ settings: settings || undefined, distributors: distributors || [], orders: orders || [], currentDraft, updatedAt: now() } as Partial<HeraStorage>)
}

export const loadStore = (): HeraStorage => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    const parsed = safeParse<Partial<HeraStorage>>(raw)
    if (parsed) {
      const hadBloatedImages = raw.includes('clinicSnapshot') && raw.includes('data:image/')
      if (hadBloatedImages && !localStorage.getItem(BEFORE_QUOTA_MIGRATION_KEY)) {
        try {
          localStorage.setItem(BEFORE_QUOTA_MIGRATION_KEY, raw)
        } catch {
          // If quota is already full, continue with normalized in-memory data.
        }
      }
      const normalized = normalizeStore(parsed)
      if (hadBloatedImages) safeSaveStore(normalized)
      return normalized
    }
    localStorage.setItem(CORRUPT_BACKUP_KEY, raw)
  }
  const migrated = migrateOldKeys()
  if (migrated) {
    saveStore(migrated)
    return migrated
  }
  const fresh = normalizeStore({ settings: defaultSettings(), distributors: [], orders: [], currentDraft: null, updatedAt: now() })
  saveStore(fresh)
  return fresh
}

export const saveStore = (store: HeraStorage) => {
  const next = normalizeStore({ ...store, updatedAt: now() })
  safeSetStorage(STORAGE_KEY, JSON.stringify(next))
  return next
}

const safeSetStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      const optimized = optimizeStorage(false)
      localStorage.setItem(key, JSON.stringify(optimized))
      if (key !== STORAGE_KEY) localStorage.setItem(key, value)
      return
    }
    throw error
  }
}

const safeSaveStore = (store: HeraStorage) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Loading should never destroy data just because the browser storage is full.
  }
}

export const getSettings = () => loadStore().settings
export const saveSettings = (settings: ClinicSettings) => saveStore({ ...loadStore(), settings: normalizeSettings(settings) }).settings
export const getDistributors = () => loadStore().distributors
export const saveDistributors = (items: Distributor[]) => saveStore({ ...loadStore(), distributors: items })
export const getOrders = () => loadStore().orders
export const saveOrders = (orders: Order[]) => saveStore({ ...loadStore(), orders })
export const saveCurrentDraft = (currentDraft: DraftOrder | null) => saveStore({ ...loadStore(), currentDraft })
export const getCurrentDraft = () => loadStore().currentDraft
export const saveSelectedDesign = (selectedDesign: string) => saveStore({ ...loadStore(), selectedDesign })

export const monthKey = (date: string) => date.replaceAll('-', '').slice(0, 6)
export const nextOrderNumber = (date: string) => {
  const key = monthKey(date)
  const max = Math.max(
    0,
    ...getOrders()
      .filter((order) => order.orderNumber.includes(`/${key}/`))
      .map((order) => Number(order.orderNumber.split('/').at(-1)))
      .filter(Number.isFinite),
  )
  return `SP-HERA/${key}/${String(max + 1).padStart(4, '0')}`
}

export const upsertDistributor = (draft: DraftOrder) => {
  const snapshot = draft.distributorSnapshot
  const store = loadStore()
  const list = [...store.distributors]
  const existingIndex = draft.distributorId
    ? list.findIndex((item) => item.id === draft.distributorId)
    : list.findIndex((item) => item.name.trim().toLowerCase() === snapshot.name.trim().toLowerCase())
  const timestamp = now()
  if (existingIndex >= 0) {
    const next = { ...list[existingIndex], ...snapshot, name: snapshot.name.trim(), isDeleted: false, updatedAt: timestamp }
    list[existingIndex] = next
    saveStore({ ...store, distributors: list })
    return next
  }
  const distributor: Distributor = {
    id: uid('dist'),
    name: snapshot.name.trim(),
    address: snapshot.address,
    contactNumber: snapshot.contactNumber,
    email: snapshot.email,
    notes: snapshot.notes,
    isDeleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  saveStore({ ...store, distributors: [distributor, ...list] })
  return distributor
}

export const finalizeOrder = (draft: DraftOrder, settings: ClinicSettings) => {
  const distributor = upsertDistributor(draft)
  const store = loadStore()
  const timestamp = now()
  const order: Order = {
    id: uid('order'),
    orderNumber: nextOrderNumber(draft.orderDate),
    orderDate: draft.orderDate,
    distributorId: distributor.id,
    distributorSnapshot: {
      name: distributor.name,
      address: draft.distributorSnapshot.address,
      contactNumber: draft.distributorSnapshot.contactNumber,
      email: draft.distributorSnapshot.email,
      notes: draft.distributorSnapshot.notes,
    },
    clinicSnapshot: normalizeSettings(stripSnapshotImages(settings)),
    pharmacistSnapshot: {
      name: settings.pharmacistName,
      sipa: settings.pharmacistSipa,
      signatureUrl: 'settings.signatureUrl',
      stampUrl: 'settings.stampUrl',
    },
    selectedDesign: draft.selectedDesign || store.selectedDesign || 'official-compact',
    stampLayout: normalizeAssetLayout(draft.stampLayout, defaultStampLayout(), 'stamp'),
    signatureLayout: normalizeAssetLayout(draft.signatureLayout, defaultSignatureLayout(), 'signature'),
    visualSettings: normalizeVisualSettings(draft.visualSettings),
    items: draft.items.filter((item) => item.productName.trim() && item.quantity.trim()).map((item) => ({ ...item })),
    status: 'finalized',
    createdAt: draft.createdAt,
    updatedAt: timestamp,
    finalizedAt: timestamp,
    voidedAt: '',
    voidReason: '',
  }
  saveStore({ ...store, distributors: getDistributors(), orders: [order, ...store.orders], currentDraft: null })
  return order
}

export const optimizeStorage = (backup = true) => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (backup && raw) {
    try {
      localStorage.setItem(PRE_OPTIMIZE_BACKUP_KEY, raw)
    } catch {
      // Ignore backup write failure; optimization still helps recover quota.
    }
  }
  const current = raw ? safeParse<Partial<HeraStorage>>(raw) : loadStore()
  const optimized = normalizeStore(current || {})
  localStorage.setItem(STORAGE_KEY, JSON.stringify(optimized))
  OLD_KEYS.forEach((key) => {
    const oldValue = localStorage.getItem(key)
    if (!oldValue) return
    try {
      localStorage.setItem(`hera-form-storage-obsolete-key-backup-${key}`, oldValue)
      localStorage.removeItem(key)
    } catch {
      // Keep old key if backup cannot be written.
    }
  })
  return optimized
}

export const getStorageUsage = () => {
  const total = Object.keys(localStorage).reduce((sum, key) => sum + key.length + (localStorage.getItem(key)?.length || 0), 0)
  const usedBytes = total * 2
  const quotaBytes = 5 * 1024 * 1024
  return { usedBytes, quotaBytes, percent: Math.round((usedBytes / quotaBytes) * 100) }
}

export const voidOrder = (id: string, reason: string) => {
  const store = loadStore()
  const timestamp = now()
  const orders = store.orders.map((order) =>
    order.id === id ? { ...order, status: 'void' as const, voidReason: reason, voidedAt: timestamp, updatedAt: timestamp } : order,
  )
  saveStore({ ...store, orders })
  return orders
}

export const deleteDistributor = (id: string) => {
  const store = loadStore()
  const used = store.orders.some((order) => order.distributorId === id)
  const distributors = store.distributors
    .map((item) => (item.id === id && used ? { ...item, isDeleted: true, updatedAt: now() } : item))
    .filter((item) => item.id !== id || used)
  saveStore({ ...store, distributors })
  return distributors
}

export const mergeImportedStore = (incoming: HeraStorage, mode: 'merge' | 'replace') => {
  const current = loadStore()
  const normalized = normalizeStore(incoming)
  if (mode === 'replace') return saveStore(normalized)
  const distributors = [...current.distributors]
  normalized.distributors.forEach((item) => {
    const index = distributors.findIndex((existing) => existing.id === item.id)
    if (index >= 0) distributors[index] = item
    else distributors.push(item)
  })
  const orders = [...current.orders]
  normalized.orders.forEach((item) => {
    const index = orders.findIndex((existing) => existing.id === item.id)
    if (index >= 0) orders[index] = item
    else orders.push(item)
  })
  return saveStore({
    ...current,
    settings: normalized.settings,
    distributors,
    orders,
    currentDraft: normalized.currentDraft || current.currentDraft,
    selectedDesign: normalized.selectedDesign || current.selectedDesign,
  })
}

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`))

export const backupFilename = () => {
  const value = new Date()
  const date = value.toISOString().slice(0, 10).replaceAll('-', '')
  const time = value.toTimeString().slice(0, 5).replace(':', '')
  return `hera-form-backup-${date}-${time}.json`
}

export const sanitizeFilename = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-')
