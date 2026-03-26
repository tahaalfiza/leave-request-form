import React, { useEffect } from 'react';

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-200">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', readOnly = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aa-blue focus:border-aa-blue outline-none transition-all ${readOnly ? 'bg-gray-50 text-gray-500' : ''}`}
      />
    </div>
  );
}

export default function FormInput({ data, setData, t }) {
  const leaveTypeKeys = [
    'annual', 'compensatory', 'marriage', 'paternity',
    'maternityPaid', 'maternityUnpaid', 'bereavementFirst',
    'bereavementOther', 'naturalDisaster', 'shortTermAssignment',
    'unpaid', 'other',
  ];

  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  // Auto-calculate total leave duration and return date
  useEffect(() => {
    if (data.leaveStartDate && data.leaveEndDate) {
      const start = new Date(data.leaveStartDate + 'T00:00:00');
      const end = new Date(data.leaveEndDate + 'T00:00:00');

      if (end >= start) {
        // Calculate calendar days (inclusive)
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const totalStr = `${diffDays} ${t.days}`;

        // Return date = day after end date
        const returnDate = new Date(end);
        returnDate.setDate(returnDate.getDate() + 1);
        // Skip weekends for return date
        while (returnDate.getDay() === 0 || returnDate.getDay() === 6) {
          returnDate.setDate(returnDate.getDate() + 1);
        }
        const returnStr = returnDate.toISOString().split('T')[0];

        setData(prev => ({
          ...prev,
          totalLeaveDuration: totalStr,
          returnDate: returnStr,
        }));
      }
    }
  }, [data.leaveStartDate, data.leaveEndDate, t.days, setData]);

  // Auto-calculate remaining balance
  useEffect(() => {
    if (data.currentLeaveBalance && data.leaveStartDate && data.leaveEndDate) {
      const balance = parseInt(data.currentLeaveBalance);
      if (!isNaN(balance)) {
        const start = new Date(data.leaveStartDate + 'T00:00:00');
        const end = new Date(data.leaveEndDate + 'T00:00:00');
        if (end >= start) {
          const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
          const remaining = balance - diffDays;
          setData(prev => ({ ...prev, remainingBalance: `${remaining} ${t.days}` }));
        }
      }
    }
  }, [data.currentLeaveBalance, data.leaveStartDate, data.leaveEndDate, t.days, setData]);

  return (
    <div className="space-y-2">
      {/* Leave Type */}
      <Section title={t.leaveType}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {leaveTypeKeys.map(key => (
            <label
              key={key}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all text-sm ${
                data.leaveType === key
                  ? 'bg-blue-50 border-aa-blue text-aa-blue font-medium'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="leaveType"
                value={key}
                checked={data.leaveType === key}
                onChange={e => update('leaveType', e.target.value)}
                className="accent-aa-blue"
              />
              <span>{t.leaveTypes[key]}</span>
            </label>
          ))}
        </div>
        {data.leaveType === 'other' && (
          <Field label={t.otherSpecify} value={data.otherReason || ''} onChange={v => update('otherReason', v)} placeholder={t.otherSpecify} />
        )}
      </Section>

      {/* Personal Info */}
      <Section title={t.personalInfo}>
        <Field label={t.formDate} value={data.formDate || ''} onChange={v => update('formDate', v)} type="date" />
        <Field label={t.fullName} value={data.fullName || ''} onChange={v => update('fullName', v)} />
        <Field label={t.registrationNo} value={data.registrationNo || ''} onChange={v => update('registrationNo', v)} />
        <Field label={t.department} value={data.department || ''} onChange={v => update('department', v)} />
      </Section>

      {/* Leave Details */}
      <Section title={t.leaveDetails}>
        <Field label={t.currentLeaveBalance} value={data.currentLeaveBalance || ''} onChange={v => update('currentLeaveBalance', v)} placeholder="14" />
        <Field label={t.leaveStartDate} value={data.leaveStartDate || ''} onChange={v => update('leaveStartDate', v)} type="date" />
        <Field label={t.leaveEndDate} value={data.leaveEndDate || ''} onChange={v => update('leaveEndDate', v)} type="date" />
        <Field label={t.totalLeaveDuration} value={data.totalLeaveDuration || ''} onChange={v => update('totalLeaveDuration', v)} readOnly placeholder={t.autoCalculated || 'Auto'} />
        <Field label={t.returnDate} value={data.returnDate || ''} onChange={v => update('returnDate', v)} type="date" readOnly />
        <Field label={t.remainingBalance} value={data.remainingBalance || ''} onChange={v => update('remainingBalance', v)} readOnly placeholder={t.autoCalculated || 'Auto'} />
      </Section>

      {/* Approval */}
      <Section title={t.approvalSection}>
        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          <p className="text-xs font-semibold text-gray-500">{t.approval} {t.deptCoordinator}</p>
          <Field label={t.coordinatorName} value={data.coordinatorName || ''} onChange={v => update('coordinatorName', v)} />
          <Field label={t.coordinatorTitle} value={data.coordinatorTitle || ''} onChange={v => update('coordinatorTitle', v)} />
          <Field label={t.coordinatorDate} value={data.coordinatorDate || ''} onChange={v => update('coordinatorDate', v)} type="date" />
        </div>
        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          <p className="text-xs font-semibold text-gray-500">{t.approval} {t.manager}</p>
          <Field label={t.managerName} value={data.managerName || ''} onChange={v => update('managerName', v)} />
          <Field label={t.managerTitle} value={data.managerTitle || ''} onChange={v => update('managerTitle', v)} />
          <Field label={t.managerDate} value={data.managerDate || ''} onChange={v => update('managerDate', v)} type="date" />
        </div>
      </Section>
    </div>
  );
}
