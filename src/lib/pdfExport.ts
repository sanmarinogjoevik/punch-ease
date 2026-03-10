import html2pdf from 'html2pdf.js';

const PDF_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #111; }
  .header { text-align: center; margin-bottom: 8px; }
  .header h1 { font-size: 14px; margin-bottom: 2px; }
  .header h2 { font-size: 11px; font-weight: 600; margin-top: 4px; }
  .header p { font-size: 8px; color: #666; line-height: 1.3; }
  .employee-info { margin-bottom: 6px; font-size: 9px; }
  .employee-info strong { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { background: #f0f0f0; font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  th, td { border: 1px solid #ccc; padding: 3px 5px; text-align: center; font-size: 9px; }
  .total-row { font-weight: 700; background: #f5f5f5; }
  .total-row td { border-top: 2px solid #333; }
  .text-right { text-align: right; }
  .signature-section { margin-top: 16px; display: flex; gap: 40px; }
  .signature-box { flex: 1; }
  .signature-box p { font-size: 9px; margin-bottom: 20px; }
  .signature-line { border-bottom: 1px solid #333; height: 1px; margin-bottom: 4px; }
  .signature-label { font-size: 7px; color: #666; }
  .zebra { background: #fafafa; }
`;

interface CompanyInfo {
  company_name?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  org_number?: string;
}

function buildCompanyHeader(company: CompanyInfo, subtitle: string): string {
  const name = company?.company_name || 'Mitt Företag AB';
  let html = `<div class="header"><h1>${name}</h1>`;
  if (company?.address) html += `<p>${company.address}</p>`;
  if (company?.postal_code || company?.city) html += `<p>${company.postal_code || ''} ${company.city || ''}</p>`;
  if (company?.org_number) html += `<p>Org.nr: ${company.org_number}</p>`;
  html += `<h2>${subtitle}</h2></div>`;
  return html;
}

function wrapInPage(content: string, landscape = false): string {
  return `<div style="width:${landscape ? '277mm' : '190mm'}; padding: 0;">${content}</div>`;
}

interface TimelistRow {
  day: string;
  dayName: string;
  punchIn: string;
  punchOut: string;
  lunch: string;
  total: string;
}

export function exportTimelistPDF(
  company: CompanyInfo,
  monthLabel: string,
  employeeName: string,
  personalNumber: string,
  rows: TimelistRow[],
  totalFormatted: string,
  filename: string
) {
  let html = buildCompanyHeader(company, `Timelista - ${monthLabel}`);

  html += `<div class="employee-info">
    <strong>Namn:</strong> ${employeeName} &nbsp;&nbsp; 
    <strong>Personnummer:</strong> ${personalNumber}
  </div>`;

  html += `<table>
    <thead><tr>
      <th style="width:8%">Datum</th>
      <th style="width:12%">Dag</th>
      <th style="width:15%">In</th>
      <th style="width:15%">Ut</th>
      <th style="width:12%">Paus</th>
      <th style="width:12%">Totalt</th>
    </tr></thead><tbody>`;

  rows.forEach((row, i) => {
    const cls = i % 2 === 0 ? ' class="zebra"' : '';
    html += `<tr${cls}>
      <td>${row.day}</td>
      <td>${row.dayName}</td>
      <td>${row.punchIn || '-'}</td>
      <td>${row.punchOut || '-'}</td>
      <td>${row.lunch || '-'}</td>
      <td><strong>${row.total || '-'}</strong></td>
    </tr>`;
  });

  html += `<tr class="total-row">
    <td colspan="5" class="text-right">TOTALT:</td>
    <td><strong>${totalFormatted}</strong></td>
  </tr>`;
  html += `</tbody></table>`;

  html += `<div class="signature-section">
    <div class="signature-box">
      <p>Anställds underskrift:</p>
      <div class="signature-line"></div>
      <div class="signature-label">Datum</div>
    </div>
    <div class="signature-box">
      <p>Chefs underskrift:</p>
      <div class="signature-line"></div>
      <div class="signature-label">Datum</div>
    </div>
  </div>`;

  const container = document.createElement('div');
  container.innerHTML = `<style>${PDF_STYLES}</style>${wrapInPage(html)}`;

  const opt = {
    margin: [8, 10, 8, 10] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
    pagebreak: { mode: ['avoid-all'] as any }
  };

  html2pdf().set(opt).from(container).save();
}

interface ShiftDay {
  date: string;
  dayLabel: string;
  shifts: { name: string; time: string; location?: string }[];
}

export function exportShiftListPDF(
  company: CompanyInfo,
  monthLabel: string,
  weeks: ShiftDay[][],
  filename: string
) {
  let html = buildCompanyHeader(company, `Vaktlista - ${monthLabel}`);

  const dayHeaders = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

  html += `<table>
    <thead><tr>${dayHeaders.map(d => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>`;

  weeks.forEach(week => {
    html += `<tr>`;
    week.forEach(day => {
      html += `<td style="vertical-align:top; text-align:left; min-height:40px; padding:3px;">
        <div style="font-weight:600; font-size:8px; margin-bottom:2px;">${day.dayLabel}</div>`;
      day.shifts.forEach(s => {
        html += `<div style="font-size:7px; background:#e8f0fe; border:1px solid #b0c4de; border-radius:2px; padding:1px 2px; margin:1px 0;">
          <strong>${s.name}</strong><br/>${s.time}${s.location ? `<br/>📍${s.location}` : ''}
        </div>`;
      });
      html += `</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  const container = document.createElement('div');
  container.innerHTML = `<style>${PDF_STYLES}</style>${wrapInPage(html, true)}`;

  const opt = {
    margin: [8, 8, 8, 8] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'landscape' as const },
    pagebreak: { mode: ['avoid-all'] as any }
  };

  html2pdf().set(opt).from(container).save();
}

interface TempRow {
  datetime: string;
  employee: string;
  equipment: string;
  temperature: string;
  tempColor: string;
  notes: string;
}

export function exportTemperaturePDF(
  company: CompanyInfo,
  dateRange: string,
  rows: TempRow[],
  filename: string
) {
  let html = buildCompanyHeader(company, `Temperaturkontroll - ${dateRange}`);

  html += `<table>
    <thead><tr>
      <th>Datum & Tid</th>
      <th>Anställd</th>
      <th>Utrustning</th>
      <th>Temperatur</th>
      <th>Anteckningar</th>
    </tr></thead><tbody>`;

  rows.forEach((row, i) => {
    const cls = i % 2 === 0 ? ' class="zebra"' : '';
    html += `<tr${cls}>
      <td>${row.datetime}</td>
      <td>${row.employee}</td>
      <td>${row.equipment}</td>
      <td style="color:${row.tempColor}; font-weight:600;">${row.temperature}</td>
      <td style="text-align:left;">${row.notes}</td>
    </tr>`;
  });

  html += `</tbody></table>`;

  const container = document.createElement('div');
  container.innerHTML = `<style>${PDF_STYLES}</style>${wrapInPage(html, true)}`;

  const opt = {
    margin: [8, 8, 8, 8] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'landscape' as const },
    pagebreak: { mode: ['avoid-all'] as any }
  };

  html2pdf().set(opt).from(container).save();
}
