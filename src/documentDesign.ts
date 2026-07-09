import type { SignatureAssetLayout } from './types/hera'

export type DocumentDesignId =
  | 'official-compact'
  | 'premium-editorial'
  | 'apothecary-professional'
  | 'minimal-legal-letter'
  | 'modern-clinic-admin'

export const documentDesigns = {
  'official-compact': {
    page: { margin: 39, webPaddingX: 38, webPaddingY: 34 },
    font: { body: 9.35, webBody: 13, title: 13.4, webTitle: 17, lineHeight: 1.38 },
    header: { gap: 11, bottomMargin: 10, bottomPadding: 10 },
    paragraph: { bottomMargin: 5.5 },
    table: {
      columns: [0.34, 2.18, 1.1, 0.91, 1.7],
      paddingX: 4.8,
      paddingY: 3.9,
      fontSize: 8.65,
      borderColor: '#d9cfba',
      headerBg: '#f7f1e4',
    },
    signature: {
      align: 'right',
      webWidth: 290,
      webHeight: 132,
      pdfWidth: 250,
      pdfHeight: 106,
      stampRatio: 0.72,
      signatureRatio: 0.36,
    },
    colors: {
      text: '#24342f',
      heading: '#173d36',
      muted: '#5f6d67',
      gold: '#c5a35b',
    },
  },
  'premium-editorial': {},
  'apothecary-professional': {},
  'minimal-legal-letter': {},
  'modern-clinic-admin': {},
} as const

const baseDesign = documentDesigns['official-compact']

export const getDocumentDesign = (id?: string) => ({
  ...baseDesign,
  ...(documentDesigns[(id || 'official-compact') as DocumentDesignId] || {}),
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)))

export const normalizeDocumentAssetLayout = (
  layout: Partial<SignatureAssetLayout> | null | undefined,
  kind: 'stamp' | 'signature',
  designId?: string,
): SignatureAssetLayout => {
  const design = getDocumentDesign(designId)
  const fallback = kind === 'stamp'
    ? { x: 27, y: 24, width: 170, opacity: 100, zIndex: 1 }
    : { x: 43, y: 32, width: 230, opacity: 100, zIndex: 2 }
  const rawWidth = Number(layout?.width ?? fallback.width)
  const widthPercent = layout?.widthUnit === 'percent' ? rawWidth : (rawWidth / design.signature.webWidth) * 100
  const ratio = kind === 'stamp' ? design.signature.stampRatio : design.signature.signatureRatio
  const width = clamp(widthPercent, kind === 'stamp' ? 28 : 38, kind === 'stamp' ? 88 : 96)
  const heightPercent = (width * ratio * design.signature.webWidth) / design.signature.webHeight
  const maxX = Math.max(0, 100 - width)
  const maxY = Math.max(0, 100 - heightPercent - 4)
  return {
    x: clamp(Number(layout?.x ?? fallback.x), 0, maxX),
    y: clamp(Number(layout?.y ?? fallback.y), 0, maxY),
    width,
    widthUnit: 'percent',
    opacity: clamp(Number(layout?.opacity ?? fallback.opacity), kind === 'stamp' ? 40 : 60, 100),
    zIndex: clamp(Number(layout?.zIndex ?? fallback.zIndex), 0, 5),
  }
}

export const assetBox = (
  layout: SignatureAssetLayout,
  kind: 'stamp' | 'signature',
  unit: 'web' | 'pdf',
  designId?: string,
) => {
  const design = getDocumentDesign(designId)
  const areaWidth = unit === 'web' ? design.signature.webWidth : design.signature.pdfWidth
  const areaHeight = unit === 'web' ? design.signature.webHeight : design.signature.pdfHeight
  const ratio = kind === 'stamp' ? design.signature.stampRatio : design.signature.signatureRatio
  const width = (areaWidth * layout.width) / 100
  return {
    left: (areaWidth * layout.x) / 100,
    top: (areaHeight * layout.y) / 100,
    width,
    height: width * ratio,
    opacity: layout.opacity / 100,
  }
}
