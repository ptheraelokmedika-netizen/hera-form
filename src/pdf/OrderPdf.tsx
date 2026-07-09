import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { Order } from '../types/hera'
import { formatDate } from '../storage/heraStorage'

const s = StyleSheet.create({
  page: { padding: 38, fontSize: 10, fontFamily: 'Helvetica', color: '#24342f', lineHeight: 1.42 },
  header: { flexDirection: 'row', gap: 14, paddingBottom: 14, borderBottom: '1.4 solid #c5a35b', marginBottom: 18 },
  logoBox: { width: 62, height: 62, border: '1 solid #e6dcc6', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 58, height: 58, objectFit: 'contain' },
  headerText: { flex: 1 },
  company: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#173d36', marginBottom: 4 },
  muted: { color: '#5f6d67', marginBottom: 2 },
  title: { textAlign: 'center', fontSize: 14, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 80, color: '#5f6d67' },
  recipient: { marginVertical: 15 },
  bold: { fontFamily: 'Helvetica-Bold' },
  paragraph: { marginBottom: 9 },
  table: { border: '1 solid #d9cfba', marginVertical: 12 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f4ead1', borderBottom: '1 solid #d9cfba', fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #eee7d9', minHeight: 28 },
  cell: { padding: 6, borderRight: '1 solid #eee7d9' },
  no: { width: 32, textAlign: 'center' },
  product: { width: 170 },
  dosage: { width: 95 },
  qty: { width: 78 },
  notes: { flex: 1, borderRight: 0 },
  signatureWrap: { marginTop: 20, alignItems: 'flex-end' },
  signature: { width: 220 },
  signArea: { height: 78, marginVertical: 8, position: 'relative' },
  signImg: { position: 'absolute', left: 0, top: 6, width: 130, height: 56, objectFit: 'contain' },
  stampImg: { position: 'absolute', right: 16, top: 2, width: 82, height: 70, objectFit: 'contain' },
  placeholder: { marginTop: 18, padding: 8, border: '1 dashed #d8cdb9', color: '#9a907c', fontSize: 8, textAlign: 'center' },
})

export function OrderPdf({ order }: { order: Order }) {
  const c = order.clinicSnapshot
  const d = order.distributorSnapshot
  const p = order.pharmacistSnapshot
  const lines = [
    c.nib ? `NIB: ${c.nib}` : '',
    c.licenseNumber ? `Izin Klinik: ${c.licenseNumber}` : '',
    c.address,
    [c.contactNumber, c.email].filter(Boolean).join(' | '),
  ].filter(Boolean)

  return (
    <Document title={`Surat Pemesanan ${order.orderNumber}`}>
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <View style={s.logoBox}>{c.logoUrl ? <Image src={c.logoUrl} style={s.logo} /> : <Text>LOGO</Text>}</View>
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
        <View>
          <View style={s.row}>
            <Text style={s.label}>Nomor</Text>
            <Text>: {order.orderNumber}</Text>
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
          {d.contactNumber ? <Text>Kontak: {d.contactNumber}</Text> : null}
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
              {p.signatureUrl ? <Image src={p.signatureUrl} style={s.signImg} /> : <Text style={s.placeholder}>Tanda tangan</Text>}
              {p.stampUrl ? <Image src={p.stampUrl} style={s.stampImg} /> : null}
            </View>
            <Text style={s.bold}>{p.name || '( Nama Apoteker )'}</Text>
            <Text>No. SIPA: {p.sipa || '........................'}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
