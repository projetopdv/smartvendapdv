import jsPDF from "jspdf";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface ReceiptData {
  storeName: string;
  saleNumber: number | string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountReceived?: number | null;
  change?: number | null;
  cashier?: string;
  date?: Date;
  pixPayload?: string | null;
  widthMm?: number;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function paymentLabel(p: string): string {
  return (
    {
      cash: "Dinheiro",
      pix: "PIX",
      credit: "Crédito",
      debit: "Débito",
      other: "Outro",
    }[p] || p
  );
}

export function buildReceiptHtml(data: ReceiptData): string {
  const date = (data.date ?? new Date()).toLocaleString("pt-BR");
  const w = data.widthMm ?? 80;
  const items = data.items
    .map(
      (i) => `
      <div class="row">
        <div>${i.quantity}x ${escapeHtml(i.name)}</div>
        <div class="r">${BRL.format(i.subtotal)}</div>
      </div>
      <div class="muted small">  ${BRL.format(i.unit_price)} / un</div>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Cupom #${data.saleNumber}</title>
<style>
@page { size: ${w}mm auto; margin: 4mm; }
* { box-sizing: border-box; }
body { font-family: 'Courier New', monospace; font-size: 12px; width: ${w - 8}mm; margin: 0; color: #000; }
h1 { font-size: 14px; text-align: center; margin: 4px 0; }
.center { text-align: center; }
.r { text-align: right; }
.muted { color: #555; }
.small { font-size: 10px; }
hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
.row { display: flex; justify-content: space-between; gap: 8px; }
.total { font-size: 14px; font-weight: bold; }
.qr { text-align: center; margin-top: 8px; }
.qr img { width: 55mm; height: 55mm; }
.copia { font-size: 8px; word-break: break-all; }
@media print { button { display: none; } }
</style></head><body>
<h1>${escapeHtml(data.storeName)}</h1>
<div class="center small">CUPOM NÃO FISCAL</div>
<div class="center small">${date}</div>
<div class="center small">Venda Nº ${data.saleNumber}</div>
<hr/>
${items}
<hr/>
<div class="row"><span>Subtotal</span><span>${BRL.format(data.subtotal)}</span></div>
${data.discount > 0 ? `<div class="row"><span>Desconto</span><span>-${BRL.format(data.discount)}</span></div>` : ""}
<div class="row total"><span>TOTAL</span><span>${BRL.format(data.total)}</span></div>
<hr/>
<div class="row"><span>Pagamento</span><span>${paymentLabel(data.paymentMethod)}</span></div>
${data.amountReceived ? `<div class="row"><span>Recebido</span><span>${BRL.format(data.amountReceived)}</span></div>` : ""}
${data.change && data.change > 0 ? `<div class="row"><span>Troco</span><span>${BRL.format(data.change)}</span></div>` : ""}
${data.cashier ? `<div class="small">Operador: ${escapeHtml(data.cashier)}</div>` : ""}
${data.pixPayload ? `<hr/><div class="center small">Pague com PIX</div><div class="qr" id="qr"></div><div class="copia">${escapeHtml(data.pixPayload)}</div>` : ""}
<hr/>
<div class="center small">Obrigado pela preferência!</div>
<div class="center" style="margin-top:8px;"><button onclick="window.print()">Imprimir</button></div>
${data.pixPayload ? `<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
<script>QRCode.toDataURL(${JSON.stringify(data.pixPayload)},{margin:1,width:300},function(e,u){if(!e){var i=new Image();i.src=u;document.getElementById('qr').appendChild(i);}});</script>` : ""}
<script>setTimeout(function(){ window.print(); }, 400);</script>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

export function printReceipt(data: ReceiptData) {
  const html = buildReceiptHtml(data);
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function downloadReceiptPdf(data: ReceiptData) {
  const widthMm = data.widthMm ?? 80;
  const doc = new jsPDF({ unit: "mm", format: [widthMm, 297] });
  const date = (data.date ?? new Date()).toLocaleString("pt-BR");
  let y = 6;
  const x = 4;
  const w = widthMm - 8;

  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.text(data.storeName, widthMm / 2, y, { align: "center" });
  y += 5;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.text("CUPOM NÃO FISCAL", widthMm / 2, y, { align: "center" });
  y += 3.5;
  doc.text(date, widthMm / 2, y, { align: "center" });
  y += 3.5;
  doc.text(`Venda Nº ${data.saleNumber}`, widthMm / 2, y, { align: "center" });
  y += 4;
  doc.line(x, y, x + w, y);
  y += 3;

  doc.setFontSize(8);
  data.items.forEach((it) => {
    doc.text(`${it.quantity}x ${it.name}`.substring(0, 32), x, y);
    doc.text(BRL.format(it.subtotal), x + w, y, { align: "right" });
    y += 3.5;
    doc.setTextColor(120);
    doc.text(`  ${BRL.format(it.unit_price)} / un`, x, y);
    doc.setTextColor(0);
    y += 3.5;
  });

  doc.line(x, y, x + w, y);
  y += 3.5;
  doc.text("Subtotal", x, y);
  doc.text(BRL.format(data.subtotal), x + w, y, { align: "right" });
  y += 3.5;
  if (data.discount > 0) {
    doc.text("Desconto", x, y);
    doc.text(`-${BRL.format(data.discount)}`, x + w, y, { align: "right" });
    y += 3.5;
  }
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL", x, y);
  doc.text(BRL.format(data.total), x + w, y, { align: "right" });
  y += 4;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.line(x, y, x + w, y);
  y += 3.5;
  doc.text("Pagamento", x, y);
  doc.text(paymentLabel(data.paymentMethod), x + w, y, { align: "right" });
  y += 3.5;
  if (data.amountReceived) {
    doc.text("Recebido", x, y);
    doc.text(BRL.format(data.amountReceived), x + w, y, { align: "right" });
    y += 3.5;
  }
  if (data.change && data.change > 0) {
    doc.text("Troco", x, y);
    doc.text(BRL.format(data.change), x + w, y, { align: "right" });
    y += 3.5;
  }
  if (data.cashier) {
    doc.text(`Operador: ${data.cashier}`, x, y);
    y += 3.5;
  }
  doc.line(x, y, x + w, y);
  y += 4;
  doc.text("Obrigado pela preferência!", widthMm / 2, y, { align: "center" });

  doc.save(`cupom-${data.saleNumber}.pdf`);
}
