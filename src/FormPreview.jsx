import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const PDF_URL = '/original-form.pdf';

// Positions as percentage of page width/height, extracted from PDF annotations
// PDF is 612x792pt. Annotations give us exact rects.
// x% = pdfX / 612 * 100, y% = (1 - pdfY / 792) * 100 (flip Y for CSS top-origin)
const FIELD_POSITIONS = {
  // Date split into 3 slots: DD / MM / YYYY
  formDateDay:   { x: 84.37, y: 13.1 },
  formDateMonth: { x: 87.32, y: 13.1 },
  formDateYear:  { x: 91.92, y: 13.1 },

  // Checkboxes - LEFT column (center of checkbox annotation)
  annual:          { x: 45.5, y: 25.2 },
  compensatory:    { x: 45.5, y: 27.9 },
  marriage:        { x: 45.4, y: 30.7 },
  paternity:       { x: 45.3, y: 33.6 },
  maternityPaid:   { x: 45.3, y: 36.5 },
  maternityUnpaid: { x: 45.3, y: 39.4 },

  // Checkboxes - RIGHT column
  bereavementFirst:    { x: 92.1, y: 25.0 },
  bereavementOther:    { x: 92.2, y: 27.9 },
  naturalDisaster:     { x: 92.1, y: 30.6 },
  shortTermAssignment: { x: 92.2, y: 33.5 },
  unpaid:              { x: 92.3, y: 36.6 },
  other:               { x: 92.3, y: 39.3 },

  otherReason: { x: 60.0, y: 39.0 },

  // Text fields (left edge of annotation rects, vertically centered)
  fullName:            { x: 31.0, y: 47.5 },
  registrationNo:      { x: 31.0, y: 50.4 },
  department:          { x: 31.0, y: 53.3 },
  currentLeaveBalance: { x: 31.0, y: 56.3 },
  leaveStartDate:      { x: 31.0, y: 59.0 },
  leaveEndDate:        { x: 31.0, y: 61.8 },
  totalLeaveDuration:  { x: 31.0, y: 64.7 },
  returnDate:          { x: 31.0, y: 67.5 },
  remainingBalance:    { x: 31.0, y: 70.4 },

  // Approval left (Coordinator)
  coordinatorName:  { x: 16.5, y: 87.1 },
  coordinatorTitle: { x: 16.5, y: 89.5 },
  coordinatorDate:  { x: 16.5, y: 91.6 },

  // Approval right (Manager)
  managerName:  { x: 60.5, y: 87.1 },
  managerTitle: { x: 60.5, y: 89.5 },
  managerDate:  { x: 60.5, y: 91.6 },
};

const FormPreview = forwardRef(({ data }, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfRendered, setPdfRendered] = useState(false);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    let cancelled = false;
    const renderPdf = async () => {
      try {
        const pdf = await pdfjsLib.getDocument(PDF_URL).promise;
        const page = await pdf.getPage(1);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setPdfRendered(true);
      } catch (err) {
        console.error('PDF render error:', err);
      }
    };
    renderPdf();
    return () => { cancelled = true; };
  }, []);

  // Track container width for font scaling
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pdfRendered]);

  // Scale factor: base font sizes are designed for ~900px container
  const scale = containerWidth / 900;
  const textSize = Math.round(20 * scale);
  const checkSize = Math.round(22 * scale);
  const smallSize = Math.round(16 * scale);

  const TextOverlay = useCallback(({ x, y, size, children, bold, center }) => (
    <span
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        fontSize: `${size || textSize}px`,
        fontWeight: bold ? 'bold' : 'normal',
        color: '#111',
        pointerEvents: 'none',
        fontFamily: "'Times New Roman', Times, serif",
        whiteSpace: 'nowrap',
        transform: center ? 'translate(-50%, -50%)' : 'translate(0%, -50%)',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  ), [textSize]);

  return (
    <div ref={(el) => { containerRef.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }} style={{ position: 'relative', background: 'white', maxWidth: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />
      {pdfRendered && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {/* Checkmark */}
          {data.leaveType && FIELD_POSITIONS[data.leaveType] && (
            <TextOverlay
              x={FIELD_POSITIONS[data.leaveType].x}
              y={FIELD_POSITIONS[data.leaveType].y}
              size={checkSize}
              bold
              center
            >
              ✓
            </TextOverlay>
          )}

          {/* Other reason */}
          {data.leaveType === 'other' && data.otherReason && (
            <TextOverlay x={FIELD_POSITIONS.otherReason.x} y={FIELD_POSITIONS.otherReason.y} size={smallSize}>
              {data.otherReason}
            </TextOverlay>
          )}

          {/* Date - split into DD / MM / YYYY slots */}
          {data.formDate && (() => {
            const parts = data.formDate.split('/');
            if (parts.length !== 3) return null;
            return (
              <>
                <TextOverlay x={FIELD_POSITIONS.formDateDay.x} y={FIELD_POSITIONS.formDateDay.y} size={textSize} center>{parts[0]}</TextOverlay>
                <TextOverlay x={FIELD_POSITIONS.formDateMonth.x} y={FIELD_POSITIONS.formDateMonth.y} size={textSize} center>{parts[1]}</TextOverlay>
                <TextOverlay x={FIELD_POSITIONS.formDateYear.x} y={FIELD_POSITIONS.formDateYear.y} size={textSize} center>{parts[2]}</TextOverlay>
              </>
            );
          })()}

          {/* Personal info fields */}
          {['fullName', 'registrationNo', 'department', 'currentLeaveBalance',
            'leaveStartDate', 'leaveEndDate', 'totalLeaveDuration',
            'returnDate', 'remainingBalance',
          ].map(field => data[field] ? (
            <TextOverlay key={field} x={FIELD_POSITIONS[field].x} y={FIELD_POSITIONS[field].y} size={textSize}>
              {data[field]}
            </TextOverlay>
          ) : null)}

          {/* Approval fields */}
          {['coordinatorName', 'coordinatorTitle', 'coordinatorDate',
            'managerName', 'managerTitle', 'managerDate',
          ].map(field => data[field] ? (
            <TextOverlay key={field} x={FIELD_POSITIONS[field].x} y={FIELD_POSITIONS[field].y} size={smallSize}>
              {data[field]}
            </TextOverlay>
          ) : null)}
        </div>
      )}
    </div>
  );
});

FormPreview.displayName = 'FormPreview';
export default FormPreview;
