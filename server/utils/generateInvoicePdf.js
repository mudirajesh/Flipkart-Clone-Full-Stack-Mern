import PDFDocument from "pdfkit"

// ---------- helpers ----------
const BRAND_BLUE = "#2874F0"
const DARK = "#1F2937"
const GRAY = "#6B7280"
const LIGHT_LINE = "#E5E7EB"
const LIGHT_BG = "#F3F4F6"

// Standard PDF fonts don't include the ₹ glyph, so we use "Rs."
const formatINR = (amount) => {
  const num = Number(amount || 0)
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/**
 * Generates an invoice PDF for a single order document.
 * @param {Object} order - mongoose order doc populated with
 *                         `delivery_address` and `userId` (name, email, mobile)
 * @returns {Promise<Buffer>} the PDF file as a buffer
 */
const generateInvoicePdf = (order) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 })

      const chunks = []
      doc.on("data", (chunk) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", reject)

      const pageWidth = doc.page.width // 595.28
      const margin = 50
      const contentWidth = pageWidth - margin * 2

      const user = order.userId || {}
      const address = order.delivery_address || {}

      const invoiceNo = `INV-${String(order.orderId).replace("ORD-", "").slice(-8).toUpperCase()}`
      const isCOD = String(order.payment_status).toUpperCase().includes("CASH")

      // ---------- header band ----------
      doc.rect(0, 0, pageWidth, 95).fill(BRAND_BLUE)

      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(26)
        .text("Flipkart", margin, 30)

      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .text("Explore  Plus", margin + 2, 60)

      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .text("INVOICE", margin, 32, { width: contentWidth, align: "right" })

      doc
        .font("Helvetica")
        .fontSize(10)
        .text(invoiceNo, margin, 58, { width: contentWidth, align: "right" })

      // ---------- meta: customer / address / invoice details ----------
      let y = 125

      // left column — billed to
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(9)
      doc.text("BILLED TO", margin, y)

      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      doc.text(user.name || "Customer", margin, y + 15, { width: 220 })

      doc.font("Helvetica").fontSize(9).fillColor(DARK)
      let cursorY = doc.y + 3
      if (user.email) {
        doc.text(user.email, margin, cursorY, { width: 220 })
        cursorY = doc.y + 2
      }
      if (address.mobile) {
        doc.text(`Mobile : ${address.mobile}`, margin, cursorY, { width: 220 })
        cursorY = doc.y + 2
      }

      // delivery address under billed to
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(9)
      doc.text("DELIVERY ADDRESS", margin, cursorY + 10)

      const addressText = [
        address.address_line,
        [address.city, address.state].filter(Boolean).join(", "),
        [address.country, address.pincode].filter(Boolean).join(" - "),
      ]
        .filter(Boolean)
        .join("\n")

      doc.fillColor(DARK).font("Helvetica").fontSize(9)
      doc.text(addressText || "Not available", margin, cursorY + 25, {
        width: 240,
        lineGap: 2,
      })

      const leftBlockBottom = doc.y

      // right column — invoice details
      const rightX = margin + 300
      const rightW = contentWidth - 300
      const detail = (label, value, dy) => {
        doc.fillColor(GRAY).font("Helvetica").fontSize(9)
        doc.text(label, rightX, dy, { lineBreak: false })
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
        // manual right-alignment so long values (e.g. order id) never wrap
        const valueText = String(value)
        const valueWidth = doc.widthOfString(valueText)
        doc.text(valueText, rightX + rightW - valueWidth, dy, { lineBreak: false })
      }

      detail("Invoice Date", formatDate(order.createdAt), y)
      detail("Order ID", String(order.orderId), y + 18)
      detail("Payment Method", isCOD ? "Cash on Delivery" : "Online (Card/UPI)", y + 36)
      detail(
        "Payment Status",
        isCOD ? "PAY ON DELIVERY" : String(order.payment_status || "").toUpperCase(),
        y + 54
      )
      if (order.paymentId) {
        detail("Payment Ref", String(order.paymentId).slice(0, 22), y + 72)
      }

      // ---------- items table ----------
      y = Math.max(leftBlockBottom, y + 95) + 30

      const colItemX = margin + 30
      const colAmountX = margin + contentWidth - 110

      // table header
      doc.rect(margin, y, contentWidth, 24).fill(LIGHT_BG)
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(9)
      doc.text("#", margin + 10, y + 8)
      doc.text("ITEM DESCRIPTION", colItemX, y + 8)
      doc.text("AMOUNT", colAmountX, y + 8, { width: 100, align: "right" })

      y += 24

      // single item row (each order document = one product)
      const productName = order.product_details?.name || "Product"
      const rowTextHeight = doc
        .font("Helvetica")
        .fontSize(10)
        .heightOfString(productName, { width: colAmountX - colItemX - 20 })
      const rowHeight = Math.max(rowTextHeight + 16, 30)

      doc.fillColor(DARK).font("Helvetica").fontSize(10)
      doc.text("1", margin + 10, y + 8)
      doc.text(productName, colItemX, y + 8, { width: colAmountX - colItemX - 20 })
      doc.text(formatINR(order.subTotalAmt), colAmountX, y + 8, {
        width: 100,
        align: "right",
      })

      y += rowHeight
      doc
        .moveTo(margin, y)
        .lineTo(margin + contentWidth, y)
        .lineWidth(0.5)
        .strokeColor(LIGHT_LINE)
        .stroke()

      // ---------- totals ----------
      y += 15
      const totalsLabelX = margin + contentWidth - 250
      const totalsValueX = margin + contentWidth - 110

      const totalRow = (label, value, bold = false) => {
        doc
          .fillColor(bold ? DARK : GRAY)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(bold ? 12 : 10)
        doc.text(label, totalsLabelX, y, { width: 140 })
        doc.text(value, totalsValueX, y, { width: 110, align: "right" })
        y += bold ? 22 : 18
      }

      const subTotal = Number(order.subTotalAmt || 0)
      const grandTotal = Number(order.totalAmt || 0)
      const otherCharges = grandTotal - subTotal

      totalRow("Subtotal", formatINR(subTotal))
      if (otherCharges > 0) {
        totalRow("Delivery & Other Charges", formatINR(otherCharges))
      }

      doc
        .moveTo(totalsLabelX, y)
        .lineTo(margin + contentWidth, y)
        .lineWidth(0.75)
        .strokeColor(DARK)
        .stroke()
      y += 8

      doc.fillColor(BRAND_BLUE)
      doc.font("Helvetica-Bold").fontSize(12)
      doc.text("Grand Total", totalsLabelX, y, { width: 140 })
      doc.text(formatINR(grandTotal), totalsValueX, y, { width: 110, align: "right" })
      y += 40

      // ---------- footer ----------
      const footerY = doc.page.height - 90
      doc
        .moveTo(margin, footerY)
        .lineTo(margin + contentWidth, footerY)
        .lineWidth(0.5)
        .strokeColor(LIGHT_LINE)
        .stroke()

      doc.fillColor(GRAY).font("Helvetica").fontSize(8)
      doc.text(
        "This is a computer generated invoice and does not require a signature.",
        margin,
        footerY + 12,
        { width: contentWidth, align: "center" }
      )
      doc.text(
        "Thank you for shopping with Flipkart!",
        margin,
        footerY + 26,
        { width: contentWidth, align: "center" }
      )

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

export default generateInvoicePdf
