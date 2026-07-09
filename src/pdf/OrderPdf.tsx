import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import plusJakartaRegular from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff'
import plusJakartaMedium from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff'
import plusJakartaSemiBold from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff'
import plusJakartaBold from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff'
import type { Order } from '../types/hera'
import { assetBox, getDocumentDesign, normalizeDocumentAssetLayout } from '../documentDesign'
import { formatDate } from '../storage/heraStorage'

Font.register({
  family: 'Plus Jakarta Sans',
  fonts: [
    { src: plusJakartaRegular, fontWeight: 400 },
    { src: plusJakartaMedium, fontWeight: 500 },
    { src: plusJakartaSemiBold, fontWeight: 600 },
    { src: plusJakartaBold, fontWeight: 700 },
  ],
})

const s = StyleSheet.create({
  page: { padding: 39, fontSize: 9.35, fontFamily: 'Plus Jakarta Sans', color: '#24342f', lineHeight: 1.38 },
  pagePremium: { backgroundColor: '#fffdf8' },
  pageMinimal: { backgroundColor: '#ffffff', color: '#202421' },
  pageModern: { backgroundColor: '#fffdf8' },
  header: { flexDirection: 'row', gap: 11, paddingBottom: 10, borderBottom: '0.8 solid #c5a35b', marginBottom: 10 },
  headerCentered: { justifyContent: 'center', textAlign: 'center' },
  logoBox: { width: 54, height: 52, alignItems: 'center', justifyContent: 'center' },
  logoSpacer: { width: 14, height: 52 },
  logo: { width: 54, height: 52, objectFit: 'contain' },
  headerText: { flex: 1 },
  company: { fontSize: 16, fontWeight: 700, color: '#173d36', marginBottom: 2.5, letterSpacing: 0.15, lineHeight: 1.18 },
  muted: { color: '#5f6d67', marginBottom: 1, fontSize: 8.8, fontWeight: 400, lineHeight: 1.28 },
  title: {
    textAlign: 'center',
    fontSize: 13.4,
    fontWeight: 700,
    textDecoration: 'underline',
    marginBottom: 7,
    marginTop: 0,
    letterSpacing: 0.25,
    color: '#173d36',
    lineHeight: 1.18,
  },
  titleModern: {
    alignSelf: 'center',
    backgroundColor: '#f4ead1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    textDecoration: 'none',
  },
  metaBox: { marginBottom: 9 },
  metaCard: { padding: 7, border: '0.8 solid #e7ddc8', borderRadius: 7, backgroundColor: '#fbf6ea' },
  metaModern: { width: 210, alignSelf: 'flex-end', padding: 7, border: '0.8 solid #e7ddc8', borderRadius: 7, backgroundColor: '#fffaf0' },
  row: { flexDirection: 'row', marginBottom: 1.8, lineHeight: 1.28 },
  label: { width: 68, color: '#5f6d67', fontWeight: 500 },
  recipient: { marginBottom: 9, lineHeight: 1.35 },
  recipientCard: { padding: 7, border: '0.8 solid #e7ddc8', borderRadius: 7, backgroundColor: '#fbf6ea' },
  bold: { fontWeight: 600 },
  paragraph: { marginBottom: 5.5, lineHeight: 1.42, fontWeight: 400 },
  table: { border: '0.8 solid #d9cfba', marginTop: 6, marginBottom: 9 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f7f1e4', borderBottom: '0.8 solid #d9cfba', fontWeight: 600 },
  tableHeadGreen: { backgroundColor: '#dfe9df' },
  tableRow: { flexDirection: 'row', borderBottom: '0.6 solid #eee7d9', minHeight: 20 },
  cell: { paddingHorizontal: 4.8, paddingVertical: 3.9, borderRight: '0.6 solid #eee7d9', fontSize: 8.65, lineHeight: 1.28 },
  headCell: { fontSize: 8.7, fontWeight: 600, color: '#24342f' },
  no: { width: 28, textAlign: 'center' },
  product: { width: 182 },
  dosage: { width: 92 },
  qty: { width: 76, textAlign: 'center' },
  notes: { flex: 1, borderRight: 0 },
  signatureWrap: { marginTop: 7, alignItems: 'flex-end' },
  signature: { width: 250 },
  signatureLine: { fontSize: 9, lineHeight: 1.28, marginBottom: 0 },
  signArea: { height: 106, marginTop: -1, marginBottom: -8, position: 'relative', overflow: 'hidden' },
  signImg: { position: 'absolute', left: 4, top: 34, objectFit: 'contain' },
  stampImg: { position: 'absolute', left: 104, top: -3, objectFit: 'contain' },
  pharmacistName: { fontSize: 10.2, fontWeight: 600, color: '#1f302b', lineHeight: 1.25 },
  sipa: { fontSize: 8.7, fontWeight: 400, color: '#34443f', lineHeight: 1.25 },
  statusBadge: {
    alignSelf: 'center',
    marginTop: -2,
    marginBottom: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
    backgroundColor: '#f4ead1',
    color: '#6f5728',
    fontSize: 7.8,
    fontWeight: 600,
  },
})

export function OrderPdf({ order }: { order: Order }) {
  const c = order.clinicSnapshot
  const d = order.distributorSnapshot
  const p = order.pharmacistSnapshot
  const design = order.selectedDesign || 'official-compact'
  const tokens = getDocumentDesign(design)
  const isPremium = design === 'premium-editorial'
  const isApothecary = design === 'apothecary-professional'
  const isMinimal = design === 'minimal-legal-letter'
  const isModern = design === 'modern-clinic-admin'
  const stampLayout = normalizeDocumentAssetLayout(
    order.stampLayout,
    'stamp',
    design,
  )
  const signatureLayout = normalizeDocumentAssetLayout(
    order.signatureLayout,
    'signature',
    design,
  )
  const stampBox = assetBox(stampLayout, 'stamp', 'pdf', design)
  const signatureBox = assetBox(signatureLayout, 'signature', 'pdf', design)
  const pageStyle = [s.page, isPremium ? s.pagePremium : {}, isMinimal ? s.pageMinimal : {}, isModern ? s.pageModern : {}]
  const headerStyle = [s.header, isPremium ? s.headerCentered : {}]
  const titleStyle = [s.title, isModern ? s.titleModern : {}]
  const metaStyle = [s.metaBox, isApothecary ? s.metaCard : {}, isModern ? s.metaModern : {}]
  const recipientStyle = [s.recipient, isApothecary ? s.recipientCard : {}]
  const tableHeadStyle = [s.tableHead, isApothecary || isModern ? s.tableHeadGreen : {}]
  const lines = [
    c.nib ? `NIB: ${c.nib}` : '',
    c.licenseNumber ? `Izin Klinik: ${c.licenseNumber}` : '',
    c.address,
    [c.contactNumber, c.email].filter(Boolean).join(' | '),
  ].filter(Boolean)
  const orderNumber = order.orderNumber === 'DRAFT-BELUM-FINAL' ? 'DRAFT' : order.orderNumber
  const distributorContact = [d.contactNumber, d.email].filter(Boolean).join(' | ')

  return (
    <Document title={`Surat Pemesanan ${order.orderNumber}`}>
      <Page size="A4" style={pageStyle} wrap>
        <View style={headerStyle} fixed>
          {c.logoUrl ? (
            <View style={s.logoBox}>
              <Image src={c.logoUrl} style={s.logo} />
            </View>
          ) : (
            <View style={s.logoSpacer} />
          )}
          <View style={s.headerText}>
            <Text style={s.company}>{c.companyName}</Text>
            {lines.map((line) => (
              <Text key={line} style={s.muted}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <Text style={titleStyle}>SURAT PEMESANAN PRODUK</Text>
        <Text style={s.statusBadge}>{order.status === 'finalized' ? 'FINAL' : 'DRAFT'}</Text>
        <View style={metaStyle}>
          <View style={s.row}>
            <Text style={s.label}>Nomor</Text>
            <Text>: {orderNumber}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Tanggal</Text>
            <Text>: {formatDate(order.orderDate)}</Text>
          </View>
        </View>

        <View style={recipientStyle}>
          <Text>Kepada Yth.</Text>
          <Text style={s.bold}>{d.name}</Text>
          {d.address ? <Text>{d.address}</Text> : null}
          {distributorContact ? <Text>{distributorContact}</Text> : null}
        </View>

        <Text style={s.paragraph}>Dengan hormat,</Text>
        <Text style={s.paragraph}>Bersama ini kami mengajukan pemesanan produk dengan rincian sebagai berikut:</Text>

        <View style={s.table}>
          <View style={tableHeadStyle} fixed>
            <Text style={[s.cell, s.headCell, s.no]}>No</Text>
            <Text style={[s.cell, s.headCell, s.product]}>Nama Produk</Text>
            <Text style={[s.cell, s.headCell, s.dosage]}>Bentuk Sediaan</Text>
            <Text style={[s.cell, s.headCell, s.qty]}>Kuantitas</Text>
            <Text style={[s.cell, s.headCell, s.notes]}>Keterangan</Text>
          </View>
          {order.items.map((item, index) => (
            <View key={item.id} style={s.tableRow} wrap={false}>
              <Text style={[s.cell, s.no]}>{index + 1}</Text>
              <Text style={[s.cell, s.product]}>{item.productName}</Text>
              <Text style={[s.cell, s.dosage]}>{item.dosageForm || '-'}</Text>
              <Text style={[s.cell, s.qty]}>{item.quantity}</Text>
              <Text style={[s.cell, s.notes]}>{item.notes || '-'}</Text>
            </View>
          ))}
        </View>

        <Text style={s.paragraph}>
          Demikian surat pemesanan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.
        </Text>

        <View style={s.signatureWrap}>
          <View style={[s.signature, { width: tokens.signature.pdfWidth }]}>
            <Text style={s.signatureLine}>Dengan hormat,</Text>
            <Text style={s.signatureLine}>Apoteker Penanggung Jawab</Text>
            <View style={[s.signArea, { width: tokens.signature.pdfWidth, height: tokens.signature.pdfHeight }]}>
              {p.stampUrl ? (
                <Image
                  src={p.stampUrl}
                  style={[
                    s.stampImg,
                    {
                      left: stampBox.left,
                      top: stampBox.top,
                      width: stampBox.width,
                      height: stampBox.height,
                      opacity: stampBox.opacity,
                    },
                  ]}
                />
              ) : null}
              {p.signatureUrl ? (
                <Image
                  src={p.signatureUrl}
                  style={[
                    s.signImg,
                    {
                      left: signatureBox.left,
                      top: signatureBox.top,
                      width: signatureBox.width,
                      height: signatureBox.height,
                      opacity: signatureBox.opacity,
                    },
                  ]}
                />
              ) : null}
            </View>
            <Text style={s.pharmacistName}>{p.name || '( Nama Apoteker )'}</Text>
            <Text style={s.sipa}>No. SIPA: {p.sipa || '........................'}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
