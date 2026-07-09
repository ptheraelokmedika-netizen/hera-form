import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import plusJakartaRegular from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff'
import plusJakartaSemiBold from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff'
import plusJakartaBold from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff'
import type { Order } from '../types/hera'
import { formatDate, normalizeVisualSettings } from '../storage/heraStorage'

Font.register({
  family: 'Plus Jakarta Sans',
  fonts: [
    { src: plusJakartaRegular, fontWeight: 400 },
    { src: plusJakartaSemiBold, fontWeight: 600 },
    { src: plusJakartaBold, fontWeight: 700 },
  ],
})

const s = StyleSheet.create({
  page: { padding: 38, fontSize: 9.2, fontFamily: 'Plus Jakarta Sans', color: '#24342f', lineHeight: 1.34 },
  header: { flexDirection: 'row', gap: 12, paddingBottom: 11, borderBottom: '1 solid #c5a35b', marginBottom: 13 },
  logoBox: { width: 58, height: 56, alignItems: 'center', justifyContent: 'center' },
  logoSpacer: { width: 18, height: 56 },
  logo: { width: 58, height: 56, objectFit: 'contain' },
  headerText: { flex: 1 },
  company: { fontSize: 13.5, fontWeight: 700, color: '#173d36', marginBottom: 3 },
  muted: { color: '#5f6d67', marginBottom: 1.5, fontSize: 8.6 },
  title: {
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: 700,
    textDecoration: 'underline',
    marginBottom: 9,
    marginTop: 1,
  },
  metaBox: { marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 2.2 },
  label: { width: 70, color: '#5f6d67' },
  recipient: { marginBottom: 12 },
  bold: { fontWeight: 700 },
  paragraph: { marginBottom: 7 },
  table: { border: '1 solid #d9cfba', marginTop: 8, marginBottom: 12 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f7f1e4', borderBottom: '1 solid #d9cfba', fontWeight: 700 },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #eee7d9', minHeight: 22 },
  cell: { padding: 4.6, borderRight: '1 solid #eee7d9' },
  no: { width: 28, textAlign: 'center' },
  product: { width: 182 },
  dosage: { width: 92 },
  qty: { width: 76 },
  notes: { flex: 1, borderRight: 0 },
  signatureWrap: { marginTop: 12, alignItems: 'flex-end' },
  signature: { width: 250 },
  signArea: { height: 108, marginTop: 2, marginBottom: -4, position: 'relative' },
  signImg: { position: 'absolute', left: 4, top: 34, objectFit: 'contain' },
  stampImg: { position: 'absolute', left: 104, top: -3, objectFit: 'contain' },
})

export function OrderPdf({ order }: { order: Order }) {
  const c = order.clinicSnapshot
  const d = order.distributorSnapshot
  const p = order.pharmacistSnapshot
  const visual = normalizeVisualSettings(order.visualSettings)
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
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
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

        <Text style={s.title}>SURAT PEMESANAN PRODUK</Text>
        <View style={s.metaBox}>
          <View style={s.row}>
            <Text style={s.label}>Nomor</Text>
            <Text>: {orderNumber}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Tanggal</Text>
            <Text>: {formatDate(order.orderDate)}</Text>
          </View>
        </View>

        <View style={s.recipient}>
          <Text>Kepada Yth.</Text>
          <Text style={s.bold}>{d.name}</Text>
          {d.address ? <Text>{d.address}</Text> : null}
          {distributorContact ? <Text>{distributorContact}</Text> : null}
        </View>

        <Text style={s.paragraph}>Dengan hormat,</Text>
        <Text style={s.paragraph}>Bersama ini kami mengajukan pemesanan produk dengan rincian sebagai berikut:</Text>

        <View style={s.table}>
          <View style={s.tableHead} fixed>
            <Text style={[s.cell, s.no]}>No</Text>
            <Text style={[s.cell, s.product]}>Nama Produk</Text>
            <Text style={[s.cell, s.dosage]}>Bentuk Sediaan</Text>
            <Text style={[s.cell, s.qty]}>Kuantitas</Text>
            <Text style={[s.cell, s.notes]}>Keterangan</Text>
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
          <View style={s.signature}>
            <Text>Dengan hormat,</Text>
            <Text>Apoteker Penanggung Jawab</Text>
            <View style={s.signArea}>
              {p.stampUrl ? (
                <Image
                  src={p.stampUrl}
                  style={[s.stampImg, { width: visual.stampWidth * 0.72, height: visual.stampWidth * 0.58, opacity: visual.stampOpacity / 100 }]}
                />
              ) : null}
              {p.signatureUrl ? (
                <Image
                  src={p.signatureUrl}
                  style={[
                    s.signImg,
                    { width: visual.signatureWidth * 0.72, height: visual.signatureWidth * 0.34, opacity: visual.signatureOpacity / 100 },
                  ]}
                />
              ) : null}
            </View>
            <Text style={s.bold}>{p.name || '( Nama Apoteker )'}</Text>
            <Text>No. SIPA: {p.sipa || '........................'}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
