import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * generateFocusReport
 * -------------------
 * Produces a downloadable PDF report for Focus10010 analytics.
 *
 * Design goals
 *  1. Human-scannable — clear headings, tables, and visual hierarchy.
 *  2. AI-readable    — every metric is explicitly labelled with its unit
 *     and the exact date range it covers so any LLM can parse it
 *     without needing additional context.
 *  3. Consistent template — only the numbers change between exports.
 *
 * @param {'weekly' | 'monthly' | 'allTime'} period
 * @param {Array}  fetchedData  — raw rows from Convex stats table
 * @param {string} userName     — display name of the user
 */
export function generateFocusReport(period, fetchedData, userName) {
  if (!fetchedData || fetchedData.length === 0) return;

  // ─── 1. Build lookup maps ──────────────────────────────────────────
  const dataMap = {};        // date → totalMs
  const tagMapByDate = {};   // date → { tagName → ms }
  const tagSumAll = {};      // tagName → total ms (all-time)

  fetchedData.forEach(d => {
    dataMap[d.date] = d.totalMs;
    if (d.tags) {
      tagMapByDate[d.date] = d.tags;
      for (const [tag, dur] of Object.entries(d.tags)) {
        tagSumAll[tag] = (tagSumAll[tag] || 0) + dur;
      }
    }
  });

  // Reference date (shifted −4 h to align with the app's "day boundary")
  const dRef = new Date();
  dRef.setTime(dRef.getTime() - 4 * 60 * 60 * 1000);

  // ─── 2. Determine date range ───────────────────────────────────────
  let periodDays, periodLabel, comparisonLabel;
  if (period === 'weekly') {
    periodDays = 7;
    periodLabel = 'Current Week';
    comparisonLabel = 'Previous Week';
  } else if (period === 'monthly') {
    periodDays = 28;
    periodLabel = 'Current Month (28 days)';
    comparisonLabel = 'Previous Month (28 days)';
  } else {
    periodDays = 365;
    periodLabel = 'All Time (last 365 days)';
    comparisonLabel = 'Prior 365-day window';
  }

  // Start & end dates for the current period
  const endDate = new Date(dRef);
  const startDate = new Date(dRef);
  startDate.setDate(startDate.getDate() - (periodDays - 1));
  const fmtDate = d => d.toISOString().split('T')[0];

  // ─── 3. Compute aggregate metrics ─────────────────────────────────
  let thisPeriodMs = 0;
  let lastPeriodMs = 0;
  const dailyRows = []; // { date, dayName, hours, tags }

  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    const dateStr = fmtDate(d);
    const ms = dataMap[dateStr] || 0;
    thisPeriodMs += ms;

    dailyRows.push({
      date: dateStr,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      monthDay: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: Number((ms / 3600000).toFixed(2)),
      minutes: Math.round(ms / 60000),
      tags: tagMapByDate[dateStr] || {},
    });
  }

  for (let i = periodDays; i < periodDays * 2; i++) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    lastPeriodMs += dataMap[fmtDate(d)] || 0;
  }

  const thisPeriodHours = Number((thisPeriodMs / 3600000).toFixed(2));
  const lastPeriodHours = Number((lastPeriodMs / 3600000).toFixed(2));
  const dailyAvgHours = Number((thisPeriodHours / periodDays).toFixed(2));
  let percentChange = 0;
  if (lastPeriodMs > 0) {
    percentChange = Math.round(((thisPeriodMs - lastPeriodMs) / lastPeriodMs) * 100);
  } else if (thisPeriodMs > 0) {
    percentChange = 100;
  }

  // Peak day (within selected period)
  let peakMs = 0, peakDate = 'None';
  dailyRows.forEach(r => {
    if (r.hours * 3600000 > peakMs) {
      peakMs = r.hours * 3600000;
      peakDate = `${r.monthDay} (${r.dayName})`;
    }
  });
  const peakHours = Number((peakMs / 3600000).toFixed(2));

  // Streak
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    const ms = dataMap[fmtDate(d)] || 0;
    if (i === 0 && ms < 1800000) continue;       // today doesn't count if < 30 min
    if (ms >= 1800000) currentStreak++;
    else if (i > 0) break;
  }

  let longestStreak = 0, tempStreak = 0;
  for (let i = 364; i >= 0; i--) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    const ms = dataMap[fmtDate(d)] || 0;
    if (ms >= 1800000) { tempStreak++; longestStreak = Math.max(longestStreak, tempStreak); }
    else tempStreak = 0;
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  // Consistency (last 30 days)
  let activeDays30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    if ((dataMap[fmtDate(d)] || 0) > 0) activeDays30++;
  }
  const consistency = Math.round((activeDays30 / 30) * 100);

  // Tag breakdown for the period
  const periodTagSum = {};
  dailyRows.forEach(r => {
    for (const [tag, ms] of Object.entries(r.tags)) {
      periodTagSum[tag] = (periodTagSum[tag] || 0) + ms;
    }
  });
  const sortedTags = Object.entries(periodTagSum).sort((a, b) => b[1] - a[1]);

  // Weekly summaries (for monthly & allTime)
  const weekSummaries = [];
  if (period === 'monthly' || period === 'allTime') {
    const weeksCount = Math.ceil(dailyRows.length / 7);
    for (let w = 0; w < weeksCount; w++) {
      const slice = dailyRows.slice(w * 7, (w + 1) * 7);
      const totalMs = slice.reduce((s, r) => s + r.hours * 3600000, 0);
      const weekStart = slice[0]?.date || '';
      const weekEnd = slice[slice.length - 1]?.date || '';
      weekSummaries.push({
        label: `Week ${w + 1}`,
        range: `${weekStart} → ${weekEnd}`,
        totalHours: Number((totalMs / 3600000).toFixed(2)),
        dailyAvg: Number((totalMs / 3600000 / slice.length).toFixed(2)),
        days: slice.length,
      });
    }
  }

  // ─── 4. Build PDF ──────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Colours
  const brandYellow = [255, 238, 0];
  const darkBg = [18, 18, 18];
  const cardBg = [30, 30, 30];
  const textWhite = [240, 240, 240];
  const textMuted = [160, 160, 160];
  const accentGreen = [100, 220, 130];
  const accentRed = [240, 100, 100];

  // Full-page dark background
  const fillPage = () => {
    doc.setFillColor(...darkBg);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F');
  };
  fillPage();

  // Override autoTable's didDrawPage to repaint background on new pages
  const autoTableDefaults = {
    didDrawPage: () => fillPage(),
  };

  // Helper: ensure space on page
  const ensureSpace = (needed) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      fillPage();
      y = margin;
    }
  };

  // ── Header ─────────────────────────────────────────────────────────
  doc.setFillColor(...brandYellow);
  doc.rect(margin, y, contentW, 1.2, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...brandYellow);
  doc.text('FOCUS10010', margin, y);

  doc.setFontSize(10);
  doc.setTextColor(...textMuted);
  doc.text('Analytics Report', margin + 48, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  doc.text(`Report: ${periodLabel}`, margin, y);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, y, { align: 'right' });
  y += 5;
  doc.text(`Period: ${fmtDate(startDate)}  to  ${fmtDate(endDate)}`, margin, y);
  doc.text(`User: ${userName || 'Unknown'}`, pageW - margin, y, { align: 'right' });
  y += 3;

  doc.setDrawColor(...brandYellow);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Section: Executive Summary ─────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...brandYellow);
  doc.text('EXECUTIVE SUMMARY', margin, y);
  y += 7;

  const summaryRows = [
    [`Total Focus Hours (${periodLabel})`, `${thisPeriodHours} hours`],
    ['Daily Average', `${dailyAvgHours} hours/day`],
    [`vs ${comparisonLabel}`, `${percentChange >= 0 ? '+' : ''}${percentChange}% (${lastPeriodHours}h → ${thisPeriodHours}h)`],
    ['Trend Direction', percentChange >= 0 ? '↑ Positive' : '↓ Negative'],
    [`Peak Day (within ${periodLabel.toLowerCase()})`, `${peakDate} — ${peakHours}h`],
    ['Current Streak', `${currentStreak} consecutive days (≥30 min/day)`],
    ['Longest Streak (all-time)', `${longestStreak} days`],
    ['30-Day Consistency', `${consistency}% (${activeDays30}/30 active days)`],
  ];

  doc.autoTable({
    startY: y,
    head: [['Metric', 'Value']],
    body: summaryRows,
    margin: { left: margin, right: margin },
    styles: {
      fillColor: cardBg,
      textColor: textWhite,
      lineColor: [50, 50, 50],
      lineWidth: 0.2,
      fontSize: 9,
      cellPadding: 3.5,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: brandYellow,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [26, 26, 26] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    ...autoTableDefaults,
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section: Daily Breakdown ───────────────────────────────────────
  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...brandYellow);
  doc.text('DAILY BREAKDOWN', margin, y);
  y += 3;
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`Each row = one calendar day. Hours = total deep-focus time logged that day.`, margin, y);
  y += 5;

  // For weekly: show all 7 days
  // For monthly/allTime: show all daily rows
  const dailyTableBody = dailyRows.map(r => {
    const tagStr = Object.entries(r.tags)
      .sort((a, b) => b[1] - a[1])
      .map(([t, ms]) => `${t}: ${(ms / 3600000).toFixed(1)}h`)
      .join(', ') || '—';
    return [r.date, r.dayName, `${r.hours}h`, `${r.minutes} min`, tagStr];
  });

  doc.autoTable({
    startY: y,
    head: [['Date', 'Day', 'Hours', 'Minutes', 'Tags Breakdown']],
    body: dailyTableBody,
    margin: { left: margin, right: margin },
    styles: {
      fillColor: cardBg,
      textColor: textWhite,
      lineColor: [50, 50, 50],
      lineWidth: 0.2,
      fontSize: 8,
      cellPadding: 3,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: brandYellow,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [26, 26, 26] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 14 },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 'auto' },
    },
    ...autoTableDefaults,
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section: Weekly Summary (monthly & allTime only) ───────────────
  if (weekSummaries.length > 0) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...brandYellow);
    doc.text('WEEKLY SUMMARY', margin, y);
    y += 3;
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text('Aggregated daily data grouped into 7-day weeks.', margin, y);
    y += 5;

    const weekBody = weekSummaries.map(w => [
      w.label,
      w.range,
      `${w.totalHours}h`,
      `${w.dailyAvg}h/day`,
      `${w.days} days`,
    ]);

    doc.autoTable({
      startY: y,
      head: [['Week', 'Date Range', 'Total Hours', 'Daily Avg', 'Days']],
      body: weekBody,
      margin: { left: margin, right: margin },
      styles: {
        fillColor: cardBg,
        textColor: textWhite,
        lineColor: [50, 50, 50],
        lineWidth: 0.2,
        fontSize: 8.5,
        cellPadding: 3,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: brandYellow,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [26, 26, 26] },
      ...autoTableDefaults,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Section: Tag Distribution ──────────────────────────────────────
  if (sortedTags.length > 0) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...brandYellow);
    doc.text('TAG DISTRIBUTION', margin, y);
    y += 3;
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(`Tags used during ${periodLabel.toLowerCase()}. Percentage is relative to total focus within this period.`, margin, y);
    y += 5;

    const tagBody = sortedTags.map(([tag, ms]) => [
      tag,
      `${(ms / 3600000).toFixed(2)}h`,
      `${Math.round(ms / 60000)} min`,
      `${thisPeriodMs > 0 ? Math.round((ms / thisPeriodMs) * 100) : 0}%`,
    ]);

    doc.autoTable({
      startY: y,
      head: [['Tag', 'Hours', 'Minutes', '% of Period']],
      body: tagBody,
      margin: { left: margin, right: margin },
      styles: {
        fillColor: cardBg,
        textColor: textWhite,
        lineColor: [50, 50, 50],
        lineWidth: 0.2,
        fontSize: 8.5,
        cellPadding: 3,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: brandYellow,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [26, 26, 26] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
      ...autoTableDefaults,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Section: Streak & Consistency detail ───────────────────────────
  ensureSpace(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...brandYellow);
  doc.text('STREAK & CONSISTENCY', margin, y);
  y += 3;
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text('A "streak day" requires ≥ 30 minutes of logged focus. Consistency = active days in last 30 calendar days.', margin, y);
  y += 5;

  doc.autoTable({
    startY: y,
    head: [['Metric', 'Value', 'How It Is Calculated']],
    body: [
      ['Current Streak', `${currentStreak} days`, 'Consecutive days with ≥ 30 min of focus, counting backwards from today.'],
      ['Longest Streak', `${longestStreak} days`, 'Longest consecutive run of ≥ 30 min days in the last 365 days.'],
      ['30-Day Consistency', `${consistency}%`, `${activeDays30} out of the last 30 calendar days had > 0 minutes logged.`],
    ],
    margin: { left: margin, right: margin },
    styles: {
      fillColor: cardBg,
      textColor: textWhite,
      lineColor: [50, 50, 50],
      lineWidth: 0.2,
      fontSize: 8.5,
      cellPadding: 3,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: brandYellow,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [26, 26, 26] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 }, 1: { cellWidth: 25 } },
    ...autoTableDefaults,
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section: Methodology (so AI models understand the data) ────────
  ensureSpace(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...brandYellow);
  doc.text('METHODOLOGY & DEFINITIONS', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);

  const methodLines = [
    '• Focus Time: Total milliseconds of active focus sessions tracked via the Focus10010 stopwatch, converted to hours (ms ÷ 3,600,000).',
    '• Day Boundary: Days are offset by −4 hours from UTC midnight to account for late-night sessions (i.e. work until 3:59 AM counts for the previous day).',
    '• Weekly Period: The most recent 7 calendar days (including today).',
    '• Monthly Period: The most recent 28 calendar days (4 complete weeks).',
    '• All-Time Period: The most recent 365 calendar days.',
    '• vs Last Period: Compares the current period\'s total hours against the immediately preceding period of equal length. Formula: ((current − previous) ÷ previous) × 100.',
    '• Daily Average: Total period hours ÷ number of days in that period.',
    '• Streak: A day counts toward a streak if ≥ 30 minutes (1,800,000 ms) were logged. Today is excluded if it has < 30 min so far.',
    '• Tags: User-applied activity categories. Tag durations are tracked per-session and summed per day.',
    '',
    'This report was generated by Focus10010 (focus10010.app). All times are in hours unless otherwise noted.',
  ];

  methodLines.forEach(line => {
    const splitLines = doc.splitTextToSize(line, contentW);
    ensureSpace(splitLines.length * 4 + 2);
    doc.text(splitLines, margin, y);
    y += splitLines.length * 4;
  });

  // ── Footer on every page ───────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    const pageH = doc.internal.pageSize.getHeight();
    doc.text(`Focus10010 — ${periodLabel} Report`, margin, pageH - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });

    doc.setDrawColor(...brandYellow);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
  }

  // ── Save ───────────────────────────────────────────────────────────
  const fileName = `Focus10010_${period}_report_${fmtDate(new Date())}.pdf`;
  doc.save(fileName);
}
