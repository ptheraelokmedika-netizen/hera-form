import type { ClinicSettings, Distributor, DraftOrder, Order, OrderItem } from '../types/hera'

const SETTINGS_KEY = 'hera-form.settings'
const DISTRIBUTORS_KEY = 'hera-form.distributors'
const ORDERS_KEY = 'hera-form.orders'

export const now = () => new Date().toISOString()
export const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
export const today = () => new Date().toISOString().slice(0, 10)

const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

const write = <T,>(key: string, value: T) => localStorage.setItem(key, JSON.stringify(value))

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
  updatedAt: now(),
})

export const emptyItem = (): OrderItem => ({
  id: uid('item'),
  productName: '',
  dosageForm: '',
  quantity: '',
  notes: '',
})

export const emptyDraft = (): DraftOrder => ({
  id: uid('draft'),
  orderDate: today(),
  distributorId: '',
  distributorSnapshot: { name: '', address: '', contactNumber: '', email: '', notes: '' },
  items: [emptyItem()],
  createdAt: now(),
  updatedAt: now(),
})

export const getSettings = () => read<ClinicSettings>(SETTINGS_KEY, defaultSettings())
export const saveSettings = (settings: ClinicSettings) => {
  const next = { ...settings, updatedAt: now() }
  write(SETTINGS_KEY, next)
  return next
}

export const getDistributors = () => read<Distributor[]>(DISTRIBUTORS_KEY, [])
export const saveDistributors = (items: Distributor[]) => write(DISTRIBUTORS_KEY, items)
export const getOrders = () => read<Order[]>(ORDERS_KEY, [])
export const saveOrders = (orders: Order[]) => write(ORDERS_KEY, orders)

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
  const list = getDistributors()
  const existingIndex = draft.distributorId
    ? list.findIndex((item) => item.id === draft.distributorId)
    : list.findIndex((item) => item.name.trim().toLowerCase() === snapshot.name.trim().toLowerCase())
  const timestamp = now()

  if (existingIndex >= 0) {
    const next = {
      ...list[existingIndex],
      name: snapshot.name.trim(),
      address: snapshot.address,
      contactNumber: snapshot.contactNumber,
      email: snapshot.email,
      notes: snapshot.notes,
      isDeleted: false,
      updatedAt: timestamp,
    }
    list[existingIndex] = next
    saveDistributors(list)
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
  saveDistributors([distributor, ...list])
  return distributor
}

export const finalizeOrder = (draft: DraftOrder, settings: ClinicSettings) => {
  const distributor = upsertDistributor(draft)
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
    clinicSnapshot: { ...settings },
    pharmacistSnapshot: {
      name: settings.pharmacistName,
      sipa: settings.pharmacistSipa,
      signatureUrl: settings.signatureUrl,
      stampUrl: settings.stampUrl,
    },
    items: draft.items.filter((item) => item.productName.trim() && item.quantity.trim()).map((item) => ({ ...item })),
    status: 'finalized',
    createdAt: draft.createdAt,
    updatedAt: timestamp,
    finalizedAt: timestamp,
    voidedAt: '',
    voidReason: '',
  }
  saveOrders([order, ...getOrders()])
  return order
}

export const voidOrder = (id: string, reason: string) => {
  const timestamp = now()
  const next = getOrders().map((order) =>
    order.id === id
      ? { ...order, status: 'void' as const, voidReason: reason, voidedAt: timestamp, updatedAt: timestamp }
      : order,
  )
  saveOrders(next)
  return next
}

export const deleteDistributor = (id: string) => {
  const used = getOrders().some((order) => order.distributorId === id)
  const next = getDistributors()
    .map((item) => (item.id === id && used ? { ...item, isDeleted: true, updatedAt: now() } : item))
    .filter((item) => item.id !== id || used)
  saveDistributors(next)
  return next
}

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`))

export const sanitizeFilename = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-')
