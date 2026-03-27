import { useState, useRef, useCallback } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { translations } from './translations';
import FormInput from './FormInput';
import FormPreview from './FormPreview';

const PDF_URL = '/original-form.pdf';

const initialData = {
  leaveType: '',
  otherReason: '',
  formDate: '',
  fullName: '',
  registrationNo: '',
  department: '',
  currentLeaveBalance: '',
  leaveStartDate: '',
  leaveEndDate: '',
  totalLeaveDuration: '',
  returnDate: '',
  remainingBalance: '',
  email: '',
  mobile: '',
  coordinatorName: '',
  coordinatorTitle: '',
  coordinatorDate: '',
  managerName: '',
  managerTitle: '',
  managerDate: '',
};

// Google Form pre-fill mapping
const GOOGLE_FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSf3Npl5kPDTXxbWlXC5frDL3wGhZJG055D_Ufc_NcJ_ZWQDWA/viewform';
const GOOGLE_FORM_ENTRIES = {
  registrationNo: 'entry.2014580184',
  fullName:       'entry.1747636637',
  department:     'entry.315797148',
  managerName:    'entry.1687677015',
  email:          'entry.1111784480',
  mobile:         'entry.1626895228',
  leaveDates:     'entry.1450898044',
};

// PDF coordinates from actual annotations (pdf-lib: bottom-left origin, points)
// Page is 612 x 792 pt
const PDF_FIELDS = {
  // Date top-right split into DD / MM / YYYY (annotation Text7/8/9)
  formDateDay:   { x: 512, y: 685, size: 10 },
  formDateMonth: { x: 530, y: 685, size: 10 },
  formDateYear:  { x: 550, y: 685, size: 10 },

  // Checkboxes - left column (center of checkbox annotation rects)
  annual:          { x: 275, y: 592, size: 11, type: 'check' },
  compensatory:    { x: 275, y: 571, size: 11, type: 'check' },
  marriage:        { x: 275, y: 548, size: 11, type: 'check' },
  paternity:       { x: 275, y: 525, size: 11, type: 'check' },
  maternityPaid:   { x: 275, y: 503, size: 11, type: 'check' },
  maternityUnpaid: { x: 275, y: 480, size: 11, type: 'check' },

  // Checkboxes - right column
  bereavementFirst:    { x: 561, y: 594, size: 11, type: 'check' },
  bereavementOther:    { x: 561, y: 571, size: 11, type: 'check' },
  naturalDisaster:     { x: 561, y: 549, size: 11, type: 'check' },
  shortTermAssignment: { x: 561, y: 526, size: 11, type: 'check' },
  unpaid:              { x: 561, y: 502, size: 11, type: 'check' },
  other:               { x: 561, y: 480, size: 11, type: 'check' },

  otherReason: { x: 370, y: 480, size: 8 },

  // Personal info (left edge of annotation rects)
  fullName:            { x: 192, y: 410, size: 10 },
  registrationNo:      { x: 192, y: 387, size: 10 },
  department:          { x: 192, y: 365, size: 10 },
  currentLeaveBalance: { x: 192, y: 340, size: 10 },
  leaveStartDate:      { x: 192, y: 320, size: 10 },
  leaveEndDate:        { x: 192, y: 297, size: 10 },
  totalLeaveDuration:  { x: 192, y: 274, size: 10 },
  returnDate:          { x: 192, y: 252, size: 10 },
  remainingBalance:    { x: 192, y: 229, size: 10 },

  // Approval left (Coordinator)
  coordinatorName:  { x: 102, y: 96, size: 8 },
  coordinatorTitle: { x: 102, y: 79, size: 8 },
  coordinatorDate:  { x: 102, y: 63, size: 8 },

  // Approval right (Manager)
  managerName:  { x: 370, y: 96, size: 8 },
  managerTitle: { x: 370, y: 79, size: 8 },
  managerDate:  { x: 370, y: 63, size: 8 },
};

function App() {
  const [lang, setLang] = useState('tr');
  const [data, setData] = useState(initialData);
  const [generating, setGenerating] = useState(false);
  const [mobileView, setMobileView] = useState('form');
  const previewRef = useRef(null);

  const t = translations[lang];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formattedData = {
    ...data,
    formDate: formatDate(data.formDate),
    leaveStartDate: formatDate(data.leaveStartDate),
    leaveEndDate: formatDate(data.leaveEndDate),
    returnDate: formatDate(data.returnDate),
    coordinatorDate: formatDate(data.coordinatorDate),
    managerDate: formatDate(data.managerDate),
  };

  const downloadPdf = useCallback(async () => {
    setGenerating(true);
    try {
      // Load original PDF and custom font (supports Turkish characters)
      const [existingPdfBytes, fontBytes] = await Promise.all([
        fetch(PDF_URL).then(r => r.arrayBuffer()),
        fetch('/arial.ttf').then(r => r.arrayBuffer()),
      ]);

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      pdfDoc.registerFontkit(fontkit);

      const font = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.getPages()[0];
      const fd = formattedData;

      const draw = (text, x, y, size = 10) => {
        if (!text) return;
        page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
      };

      // Checkmark — draw a proper ✓ shape
      if (fd.leaveType && PDF_FIELDS[fd.leaveType]) {
        const pos = PDF_FIELDS[fd.leaveType];
        const cx = pos.x;
        const cy = pos.y;
        // V-shape checkmark
        page.drawLine({ start: { x: cx - 4, y: cy }, end: { x: cx - 1, y: cy - 4 }, thickness: 1.8, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: cx - 1, y: cy - 4 }, end: { x: cx + 5, y: cy + 4 }, thickness: 1.8, color: rgb(0, 0, 0) });
      }

      // Other reason
      if (fd.leaveType === 'other' && fd.otherReason) {
        const p = PDF_FIELDS.otherReason;
        draw(fd.otherReason, p.x, p.y, p.size);
      }

      // Date — split DD / MM / YYYY
      if (fd.formDate) {
        const parts = fd.formDate.split('/');
        if (parts.length === 3) {
          draw(parts[0], PDF_FIELDS.formDateDay.x, PDF_FIELDS.formDateDay.y, PDF_FIELDS.formDateDay.size);
          draw(parts[1], PDF_FIELDS.formDateMonth.x, PDF_FIELDS.formDateMonth.y, PDF_FIELDS.formDateMonth.size);
          draw(parts[2], PDF_FIELDS.formDateYear.x, PDF_FIELDS.formDateYear.y, PDF_FIELDS.formDateYear.size);
        }
      }

      // All text fields
      const textFields = [
        'fullName', 'registrationNo', 'department',
        'currentLeaveBalance', 'leaveStartDate', 'leaveEndDate',
        'totalLeaveDuration', 'returnDate', 'remainingBalance',
        'coordinatorName', 'coordinatorTitle', 'coordinatorDate',
        'managerName', 'managerTitle', 'managerDate',
      ];
      textFields.forEach(field => {
        if (fd[field] && PDF_FIELDS[field]) {
          const p = PDF_FIELDS[field];
          draw(fd[field], p.x, p.y, p.size);
        }
      });

      // Flatten form fields so the PDF doesn't show editable widgets
      const form = pdfDoc.getForm();
      form.flatten();

      // Save — everything is client-side, nothing is uploaded
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Robust download that works across all browsers
      const a = document.createElement('a');
      a.href = url;
      a.download = fd.fullName
        ? `izin-talep-${fd.fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`
        : 'izin-talep-formu.pdf';
      document.body.appendChild(a);
      a.click();
      // Delay cleanup to ensure download starts
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert(lang === 'tr' ? 'PDF oluşturulurken hata oluştu.' : 'Error generating PDF.');
    } finally {
      setGenerating(false);
    }
  }, [formattedData, lang]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const openGoogleForm = useCallback(() => {
    const fd = formattedData;
    // Build leave dates string: "01/04/2026 - 10/04/2026 (5 gün)"
    const leaveDates = fd.leaveStartDate && fd.leaveEndDate
      ? `${fd.leaveStartDate} - ${fd.leaveEndDate} (${fd.totalLeaveDuration || ''})`
      : '';

    const params = new URLSearchParams();
    if (fd.registrationNo) params.set(GOOGLE_FORM_ENTRIES.registrationNo, fd.registrationNo);
    if (fd.fullName) params.set(GOOGLE_FORM_ENTRIES.fullName, fd.fullName);
    if (fd.department) params.set(GOOGLE_FORM_ENTRIES.department, fd.department);
    if (fd.managerName) params.set(GOOGLE_FORM_ENTRIES.managerName, fd.managerName);
    if (fd.email) params.set(GOOGLE_FORM_ENTRIES.email, fd.email);
    if (fd.mobile) params.set(GOOGLE_FORM_ENTRIES.mobile, fd.mobile);
    if (leaveDates) params.set(GOOGLE_FORM_ENTRIES.leaveDates, leaveDates);

    window.open(`${GOOGLE_FORM_BASE}?${params.toString()}`, '_blank');
  }, [formattedData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      {/* Top Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50 no-print">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/aa-logo.svg" alt="Anadolu Ajansı" className="h-9 w-auto" />
            <h1 className="text-lg font-bold text-gray-800 hidden sm:block">{t.appTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setLang('tr')}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                  lang === 'tr' ? 'bg-white shadow text-aa-blue' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🇹🇷 TR
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                  lang === 'en' ? 'bg-white shadow text-aa-blue' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🇬🇧 EN
              </button>
            </div>
            <button
              onClick={() => setData(initialData)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-all"
            >
              {t.reset}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Toggle */}
      <div className="lg:hidden sticky top-[57px] z-40 bg-white border-b border-gray-200 no-print">
        <div className="flex">
          <button
            onClick={() => setMobileView('form')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-all ${
              mobileView === 'form' ? 'text-aa-blue border-b-2 border-aa-blue bg-blue-50/50' : 'text-gray-500'
            }`}
          >
            ✏️ {t.formData}
          </button>
          <button
            onClick={() => setMobileView('preview')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-all ${
              mobileView === 'preview' ? 'text-aa-blue border-b-2 border-aa-blue bg-blue-50/50' : 'text-gray-500'
            }`}
          >
            👁️ {t.preview}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Form Input */}
          <div className={`w-full lg:w-[420px] lg:flex-shrink-0 ${mobileView !== 'form' ? 'hidden lg:block' : ''} no-print`}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-[70px] lg:max-h-[calc(100vh-90px)] lg:overflow-y-auto">
              <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-aa-blue/10 text-aa-blue rounded-lg flex items-center justify-center text-xs">✏️</span>
                {t.formData}
              </h2>
              <FormInput data={data} setData={setData} t={t} />
            </div>
          </div>

          {/* Right: Preview */}
          <div className={`flex-1 min-w-0 ${mobileView !== 'preview' ? 'hidden lg:block' : ''}`}>
            {/* Action Buttons */}
            <div className="flex gap-3 mb-4 no-print">
              <button
                onClick={downloadPdf}
                disabled={generating}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-aa-blue text-white rounded-lg font-medium text-sm hover:bg-aa-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generating ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                )}
                {t.downloadPdf}
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                {t.print}
              </button>
              <button
                onClick={openGoogleForm}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {t.submitToGoogle}
              </button>
            </div>

            {/* Preview Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <FormPreview ref={previewRef} data={formattedData} t={t} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
