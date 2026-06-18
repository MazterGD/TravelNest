const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #0F172A;
    line-height: 1.5;
    padding: 40px;
    background: #fff;
  }
  @media print {
    body { padding: 20px; }
    @page { margin: 15mm; size: A4 portrait; }
  }
  .tn-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 2px solid #20B0E9;
    margin-bottom: 28px;
  }
  .tn-brand { font-size: 22px; font-weight: 800; color: #20B0E9; letter-spacing: -0.5px; }
  .tn-doc-meta { text-align: right; }
  .tn-doc-meta .ref { font-size: 15px; font-weight: 700; color: #0F172A; }
  .tn-doc-meta .sub { font-size: 12px; color: #475569; margin-top: 2px; }
  .tn-section {
    margin-bottom: 20px;
    padding: 16px;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    background: #fff;
  }
  .tn-section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569;
    margin-bottom: 10px;
  }
  .tn-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 13px;
    border-bottom: 1px dashed #F1F5F9;
  }
  .tn-row:last-child { border-bottom: none; }
  .tn-row .lbl { color: #475569; }
  .tn-row .val { font-weight: 500; color: #0F172A; text-align: right; }
  .tn-divider { border: none; border-top: 1px solid #E2E8F0; margin: 12px 0; }
  .tn-total {
    display: flex;
    justify-content: space-between;
    padding: 10px 0 0 0;
    border-top: 2px solid #20B0E9;
    margin-top: 8px;
  }
  .tn-total .lbl { font-weight: 700; font-size: 15px; }
  .tn-total .val { font-weight: 700; font-size: 18px; color: #20B0E9; }
  .tn-status-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    background: #E0F5FF;
    color: #20B0E9;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tn-paid-box {
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
    border-radius: 8px;
    padding: 10px 14px;
    margin-top: 10px;
  }
  .tn-paid-box .lbl { font-size: 11px; color: #16A34A; font-weight: 600; }
  .tn-paid-box .val { font-size: 16px; font-weight: 700; color: #16A34A; }
  .tn-footer {
    margin-top: 36px;
    padding-top: 14px;
    border-top: 1px solid #E2E8F0;
    font-size: 11px;
    color: #94A3B8;
    text-align: center;
  }
  .tn-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  /* Comparison-specific */
  .cmp-grid { display: grid; gap: 16px; }
  .cmp-card {
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    padding: 16px;
    background: #fff;
  }
  .cmp-card.best { border-color: #20B0E9; border-width: 2px; }
  .cmp-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 6px; }
  .cmp-owner { font-size: 12px; color: #475569; margin-bottom: 10px; }
  .cmp-price { font-size: 20px; font-weight: 700; color: #20B0E9; margin-bottom: 10px; }
  .cmp-best-badge {
    display: inline-block;
    margin-bottom: 6px;
    padding: 2px 8px;
    background: #E0F5FF;
    color: #20B0E9;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .cmp-breakdown { margin-top: 8px; padding-top: 8px; border-top: 1px solid #E2E8F0; }
  .cmp-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; color: #475569; }
  .cmp-row .v { font-weight: 500; color: #0F172A; }
`;

function buildDocument(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function printAsPDF(body: string, title: string): void {
  const w = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
  if (!w) return;
  w.document.write(buildDocument(title, body));
  w.document.close();
  w.focus();
  w.print();
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(d: string): string {
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
}

function fmtRs(n: number): string {
  return `Rs. ${Number(n).toLocaleString()}`;
}

export interface InvoiceBooking {
  bookingRef: string;
  status: string;
  createdAt: string;
  customer: { name: string; email: string; phone: string };
  trip: {
    startDate: string;
    endDate: string;
    startTime?: string | null;
    pickupLocation: string;
    dropoffLocation: string;
    passengers: number;
    estimatedDistance?: string | null;
  };
  vehicle: { name: string; type: string; capacity: number; registration: string };
  owner: { name: string; phone: string };
  driver?: { name: string; phone?: string | null; license?: string | null } | null;
  payment: {
    total: number;
    paid: number;
    status: string;
    method: string;
    paidAt?: string | null;
    platformCommission: number;
    netAmount: number;
    breakdown?: {
      basePrice: number;
      driverAllowance: number;
      additionalCharges: number;
      subtotal?: number;
      tax?: number;
      customItems?: Array<{ description: string; amount: number }>;
    } | null;
  };
  notes?: string;
}

export function buildInvoiceHTML(b: InvoiceBooking): string {
  const breakdown = b.payment.breakdown;

  const customItemRows = (breakdown?.customItems ?? [])
    .map(item => `<div class="tn-row"><span class="lbl">${esc(item.description)}</span><span class="val">${fmtRs(item.amount)}</span></div>`)
    .join('');

  const breakdownSection = breakdown
    ? `<div class="tn-row"><span class="lbl">Base Price</span><span class="val">${fmtRs(breakdown.basePrice)}</span></div>
       <div class="tn-row"><span class="lbl">Driver Allowance</span><span class="val">${fmtRs(breakdown.driverAllowance)}</span></div>
       <div class="tn-row"><span class="lbl">Additional Charges</span><span class="val">${fmtRs(breakdown.additionalCharges)}</span></div>
       ${customItemRows}
       ${breakdown.subtotal ? `<div class="tn-row"><span class="lbl">Subtotal</span><span class="val">${fmtRs(breakdown.subtotal)}</span></div>` : ''}
       ${breakdown.tax ? `<div class="tn-row"><span class="lbl">Tax</span><span class="val">${fmtRs(breakdown.tax)}</span></div>` : ''}`
    : '';

  const driverSection = b.driver
    ? `<div class="tn-section">
        <div class="tn-section-title">Assigned Driver</div>
        <div class="tn-row"><span class="lbl">Name</span><span class="val">${esc(b.driver.name)}</span></div>
        ${b.driver.phone ? `<div class="tn-row"><span class="lbl">Phone</span><span class="val">${esc(b.driver.phone)}</span></div>` : ''}
        ${b.driver.license ? `<div class="tn-row"><span class="lbl">License</span><span class="val">${esc(b.driver.license)}</span></div>` : ''}
      </div>`
    : '';

  const notesSection = b.notes
    ? `<div class="tn-section">
        <div class="tn-section-title">Special Requirements</div>
        <p style="font-size:13px;color:#475569;">${esc(b.notes)}</p>
      </div>`
    : '';

  return `
  <div class="tn-header">
    <div class="tn-brand">TraveNest</div>
    <div class="tn-doc-meta">
      <div class="ref">Invoice ${esc(b.bookingRef)}</div>
      <div class="sub">Issued: ${fmtDate(b.createdAt)}</div>
      <div class="sub" style="margin-top:4px;"><span class="tn-status-badge">${esc(b.status.toUpperCase())}</span></div>
    </div>
  </div>

  <div class="tn-grid-2">
    <div class="tn-section">
      <div class="tn-section-title">Customer</div>
      <div class="tn-row"><span class="lbl">Name</span><span class="val">${esc(b.customer.name)}</span></div>
      <div class="tn-row"><span class="lbl">Email</span><span class="val">${esc(b.customer.email)}</span></div>
      <div class="tn-row"><span class="lbl">Phone</span><span class="val">${esc(b.customer.phone)}</span></div>
    </div>
    <div class="tn-section">
      <div class="tn-section-title">Owner / Operator</div>
      <div class="tn-row"><span class="lbl">Name</span><span class="val">${esc(b.owner.name)}</span></div>
      <div class="tn-row"><span class="lbl">Phone</span><span class="val">${esc(b.owner.phone)}</span></div>
    </div>
  </div>

  <div class="tn-section">
    <div class="tn-section-title">Trip Details</div>
    <div class="tn-row"><span class="lbl">From</span><span class="val">${esc(b.trip.pickupLocation)}</span></div>
    <div class="tn-row"><span class="lbl">To</span><span class="val">${esc(b.trip.dropoffLocation)}</span></div>
    <div class="tn-row"><span class="lbl">Start Date</span><span class="val">${fmtDate(b.trip.startDate)}${b.trip.startTime ? ` at ${esc(b.trip.startTime)}` : ''}</span></div>
    <div class="tn-row"><span class="lbl">End Date</span><span class="val">${fmtDate(b.trip.endDate)}</span></div>
    <div class="tn-row"><span class="lbl">Passengers</span><span class="val">${esc(b.trip.passengers)}</span></div>
    ${b.trip.estimatedDistance ? `<div class="tn-row"><span class="lbl">Distance</span><span class="val">${esc(b.trip.estimatedDistance)}</span></div>` : ''}
  </div>

  <div class="tn-section">
    <div class="tn-section-title">Vehicle</div>
    <div class="tn-row"><span class="lbl">Name</span><span class="val">${esc(b.vehicle.name)}</span></div>
    <div class="tn-row"><span class="lbl">Type</span><span class="val">${esc(b.vehicle.type)}</span></div>
    <div class="tn-row"><span class="lbl">Capacity</span><span class="val">${esc(b.vehicle.capacity)} seats</span></div>
    <div class="tn-row"><span class="lbl">Registration</span><span class="val">${esc(b.vehicle.registration)}</span></div>
  </div>

  ${driverSection}
  ${notesSection}

  <div class="tn-section">
    <div class="tn-section-title">Payment Breakdown</div>
    ${breakdownSection}
    <div class="tn-total">
      <span class="lbl">Total Amount</span>
      <span class="val">${fmtRs(b.payment.total)}</span>
    </div>
    <div class="tn-paid-box">
      <div class="lbl">Amount Paid</div>
      <div class="val">${fmtRs(b.payment.paid)}</div>
    </div>
    <div style="margin-top:10px;">
      <div class="tn-row"><span class="lbl">Payment Method</span><span class="val">${esc(b.payment.method || 'N/A')}</span></div>
      <div class="tn-row"><span class="lbl">Payment Status</span><span class="val">${esc(b.payment.status)}</span></div>
      ${b.payment.paidAt ? `<div class="tn-row"><span class="lbl">Paid On</span><span class="val">${fmtDate(b.payment.paidAt)}</span></div>` : ''}
    </div>
  </div>

  <div class="tn-footer">
    TraveNest — Sri Lanka's Bus Charter Marketplace &nbsp;|&nbsp; support@travelnest.lk<br />
    This document was generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} and serves as an official booking invoice.
  </div>`;
}

export interface ComparisonQuotation {
  vehicleName: string;
  ownerName: string;
  price: number;
  validUntil: string;
  notes?: string;
  priceBreakdown?: {
    vehicleRentalCost: number;
    driverCost: number;
    fuelCost: number;
    tollCharges: number;
    permitFees: number;
    otherCharges: number;
    tax: number;
  };
  vehicleSpecifications?: {
    brand: string;
    model: string;
    year: number;
    seats: number;
  };
  amenities?: string[];
}

export interface ComparisonTripDetails {
  pickupCity: string;
  dropoffCity: string;
  pickupDate: string;
  pickupTime: string;
  passengerCount: number;
}

export function buildComparisonHTML(
  quotations: ComparisonQuotation[],
  trip: ComparisonTripDetails,
): string {
  const minPrice = Math.min(...quotations.map(q => q.price));

  const cards = quotations
    .map(q => {
      const isBest = q.price === minPrice;
      const bd = q.priceBreakdown;
      const specs = q.vehicleSpecifications;

      const breakdownRows = bd
        ? `<div class="cmp-breakdown">
            <div class="cmp-row"><span>Vehicle Rental</span><span class="v">${fmtRs(bd.vehicleRentalCost)}</span></div>
            <div class="cmp-row"><span>Driver</span><span class="v">${fmtRs(bd.driverCost)}</span></div>
            <div class="cmp-row"><span>Fuel</span><span class="v">${fmtRs(bd.fuelCost)}</span></div>
            <div class="cmp-row"><span>Tolls</span><span class="v">${fmtRs(bd.tollCharges)}</span></div>
            <div class="cmp-row"><span>Permits</span><span class="v">${fmtRs(bd.permitFees)}</span></div>
            ${bd.otherCharges ? `<div class="cmp-row"><span>Other</span><span class="v">${fmtRs(bd.otherCharges)}</span></div>` : ''}
            ${bd.tax ? `<div class="cmp-row"><span>Tax</span><span class="v">${fmtRs(bd.tax)}</span></div>` : ''}
          </div>`
        : '';

      const specsText = specs
        ? `${esc(specs.brand)} ${esc(specs.model)}${specs.year ? ` (${specs.year})` : ''}, ${specs.seats} seats`
        : '';

      return `<div class="cmp-card${isBest ? ' best' : ''}">
        ${isBest ? '<div class="cmp-best-badge">Best Value</div>' : ''}
        <div class="cmp-title">${esc(q.vehicleName)}</div>
        <div class="cmp-owner">${esc(q.ownerName)}</div>
        ${specsText ? `<div style="font-size:12px;color:#475569;margin-bottom:8px;">${specsText}</div>` : ''}
        <div class="cmp-price">${fmtRs(q.price)}</div>
        ${q.validUntil ? `<div style="font-size:11px;color:#94A3B8;margin-bottom:6px;">Valid until: ${esc(q.validUntil)}</div>` : ''}
        ${q.amenities?.length ? `<div style="font-size:11px;color:#475569;margin-bottom:8px;">${q.amenities.slice(0, 5).map(esc).join(' · ')}</div>` : ''}
        ${q.notes ? `<div style="font-size:12px;color:#475569;font-style:italic;margin-bottom:8px;">"${esc(q.notes)}"</div>` : ''}
        ${breakdownRows}
      </div>`;
    })
    .join('\n');

  return `
  <div class="tn-header">
    <div class="tn-brand">TraveNest</div>
    <div class="tn-doc-meta">
      <div class="ref">Quotation Comparison</div>
      <div class="sub">${quotations.length} quotation${quotations.length !== 1 ? 's' : ''} compared</div>
    </div>
  </div>

  <div class="tn-section" style="margin-bottom:24px;">
    <div class="tn-section-title">Trip Summary</div>
    <div class="tn-row"><span class="lbl">Route</span><span class="val">${esc(trip.pickupCity)} → ${esc(trip.dropoffCity)}</span></div>
    <div class="tn-row"><span class="lbl">Date</span><span class="val">${fmtDate(trip.pickupDate)}${trip.pickupTime ? ` at ${esc(trip.pickupTime)}` : ''}</span></div>
    <div class="tn-row"><span class="lbl">Passengers</span><span class="val">${esc(trip.passengerCount)}</span></div>
  </div>

  <div class="cmp-grid" style="grid-template-columns:repeat(${Math.min(quotations.length, 2)},1fr);">
    ${cards}
  </div>

  <div class="tn-footer">
    TraveNest — Sri Lanka's Bus Charter Marketplace &nbsp;|&nbsp; support@travelnest.lk<br />
    Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. Prices are valid as stated above and subject to owner confirmation.
  </div>`;
}
