export type OrderStatus = 'draft' | 'finalized' | 'void'

export type ClinicSettings = {
  companyName: string
  logoUrl: string
  nib: string
  licenseNumber: string
  address: string
  contactNumber: string
  email: string
  pharmacistName: string
  pharmacistSipa: string
  signatureUrl: string
  stampUrl: string
  stampWidth: number
  signatureWidth: number
  stampOpacity: number
  signatureOpacity: number
  updatedAt: string
}

export type Distributor = {
  id: string
  name: string
  address: string
  contactNumber: string
  email: string
  notes: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export type OrderItem = {
  id: string
  productName: string
  dosageForm: string
  quantity: string
  notes: string
}

export type Order = {
  id: string
  orderNumber: string
  orderDate: string
  distributorId: string
  distributorSnapshot: Pick<Distributor, 'name' | 'address' | 'contactNumber' | 'email' | 'notes'>
  clinicSnapshot: ClinicSettings
  pharmacistSnapshot: {
    name: string
    sipa: string
    signatureUrl: string
    stampUrl: string
  }
  selectedDesign: string
  stampLayout: SignatureAssetLayout
  signatureLayout: SignatureAssetLayout
  visualSettings: SignatureVisualSettings
  items: OrderItem[]
  status: OrderStatus
  createdAt: string
  updatedAt: string
  finalizedAt: string
  voidedAt: string
  voidReason: string
}

export type DraftOrder = {
  id: string
  orderDate: string
  distributorId: string
  distributorSnapshot: Pick<Distributor, 'name' | 'address' | 'contactNumber' | 'email' | 'notes'>
  selectedDesign: string
  stampLayout: SignatureAssetLayout
  signatureLayout: SignatureAssetLayout
  visualSettings: SignatureVisualSettings
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export type SignatureVisualSettings = {
  stampWidth: number
  signatureWidth: number
  stampOpacity: number
  signatureOpacity: number
}

export type SignatureAssetLayout = {
  x: number
  y: number
  width: number
  opacity: number
  zIndex: number
}

export type HeraStorage = {
  version: 1
  settings: ClinicSettings
  distributors: Distributor[]
  orders: Order[]
  currentDraft: DraftOrder | null
  selectedDesign?: string
  updatedAt: string
}

export type Page = 'create' | 'history' | 'distributors' | 'settings' | 'designs'
