import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * generateFocusReport
 * -------------------
 * Produces a downloadable PDF report for Focus10010 analytics.
 *
 * Design goals
 *  1. Human-scannable — clear headings, stat cards, and visual hierarchy.
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
  if (!fetchedData) return;

  // ─── 1. Build lookup maps ──────────────────────────────────────────
  const dataMap = {};        // date → totalMs
  const tagMapByDate = {};   // date → { tagName → ms }

  fetchedData.forEach(d => {
    dataMap[d.date] = d.totalMs;
    if (d.tags) tagMapByDate[d.date] = d.tags;
  });

  // Reference date (shifted -4 h to align with the app's "day boundary")
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

  const endDate = new Date(dRef);
  const startDate = new Date(dRef);
  startDate.setDate(startDate.getDate() - (periodDays - 1));
  const fmtDate = d => d.toISOString().split('T')[0];

  // ─── 3. Compute aggregate metrics ─────────────────────────────────
  let thisPeriodMs = 0;
  let lastPeriodMs = 0;
  const dailyRows = [];

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

  // Peak day
  let peakMs = 0, peakDate = 'None';
  dailyRows.forEach(r => {
    if (r.hours * 3600000 > peakMs) {
      peakMs = r.hours * 3600000;
      peakDate = `${r.monthDay} (${r.dayName})`;
    }
  });
  const peakHours = Number((peakMs / 3600000).toFixed(2));

  // Streaks
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    const ms = dataMap[fmtDate(d)] || 0;
    if (i === 0 && ms < 1800000) continue;
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
        range: `${weekStart} to ${weekEnd}`,
        totalHours: Number((totalMs / 3600000).toFixed(2)),
        dailyAvg: Number((totalMs / 3600000 / slice.length).toFixed(2)),
        days: slice.length,
      });
    }
  }

  // ─── 4. Build PDF ──────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Palette (refined, restrained) ──────────────────────────────────
  const bg        = [16, 16, 18];
  const cardBg     = [26, 26, 29];
  const cardBorder = [42, 42, 46];
  const gold       = [244, 196, 48];
  const goldSoft   = [90, 76, 30];
  const textHi     = [240, 240, 240];
  const textMid    = [185, 185, 190];
  const textMuted  = [128, 128, 134];
  const green      = [95, 209, 143];
  const red        = [232, 108, 108];
  const divider    = [40, 40, 44];

  const fillPage = () => {
    doc.setFillColor(...bg);
    doc.rect(0, 0, pageW, pageH, 'F');
  };
  fillPage();

  const autoTableDefaults = { didDrawPage: () => fillPage() };

  const ensureSpace = (needed) => {
    if (y + needed > pageH - 22) {
      doc.addPage();
      fillPage();
      y = margin;
    }
  };

  // ── Small drawing helpers ──────────────────────────────────────────
  const card = (x, cy, w, h, r = 2.2) => {
    doc.setFillColor(...cardBg);
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, cy, w, h, r, r, 'FD');
  };

  const statCard = (x, cy, w, h, label, value, sub, subColor) => {
    card(x, cy, w, h);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...textMuted);
    doc.text(label.toUpperCase(), x + 4, cy + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...textHi);
    doc.text(value, x + 4, cy + 15.5);

    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.setTextColor(...(subColor || textMuted));
      doc.text(sub, x + 4, cy + h - 4);
    }
  };

  const progressBar = (x, py, w, h, pct, color) => {
    doc.setFillColor(...cardBorder);
    doc.roundedRect(x, py, w, h, h / 2, h / 2, 'F');
    const fillW = Math.max(h, (Math.min(pct, 100) / 100) * w);
    doc.setFillColor(...color);
    doc.roundedRect(x, py, fillW, h, h / 2, h / 2, 'F');
  };

  const sectionHeader = (title, subtitle) => {
    ensureSpace(subtitle ? 16 : 12);
    doc.setFillColor(...gold);
    doc.rect(margin, y, 2.2, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...textHi);
    doc.text(title, margin + 5, y + 4.7);
    y += 8.5;
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(...textMuted);
      const lines = doc.splitTextToSize(subtitle, contentW - 5);
      doc.text(lines, margin + 5, y);
      y += lines.length * 3.6 + 3;
    } else {
      y += 1;
    }
  };

  const tableTheme = {
    styles: {
      fillColor: cardBg,
      textColor: textMid,
      lineColor: divider,
      lineWidth: 0.15,
      fontSize: 8.3,
      cellPadding: 3.2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [34, 34, 38],
      textColor: gold,
      fontStyle: 'bold',
      fontSize: 8.2,
      lineColor: divider,
    },
    alternateRowStyles: { fillColor: [21, 21, 24] },
    ...autoTableDefaults,
  };

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFillColor(...gold);
  doc.roundedRect(margin, y, 9, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('F', margin + 3.1, y + 6.3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...textHi);
  doc.text('FOCUS10010', margin + 12, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  doc.text('Analytics Report', pageW - margin, y + 3.5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...gold);
  doc.text(periodLabel, pageW - margin, y + 8, { align: 'right' });
  y += 15;

  doc.setDrawColor(...divider);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`User: ${userName || 'Unknown'}`, margin, y);
  doc.text(`Range: ${fmtDate(startDate)}  to  ${fmtDate(endDate)}`, pageW / 2, y, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, y, { align: 'right' });
  y += 9;

  // ── Section: Executive Summary (stat cards) ─────────────────────────
  sectionHeader('EXECUTIVE SUMMARY');

  const gap = 4;
  const cardW = (contentW - gap * 3) / 4;
  const cardH = 24;
  const trendColor = percentChange >= 0 ? green : red;
  const trendSign = percentChange >= 0 ? '+' : '';

  statCard(margin, y, cardW, cardH,
    'Total Hours', `${thisPeriodHours}h`, periodLabel, textMuted);
  statCard(margin + (cardW + gap), y, cardW, cardH,
    'Daily Average', `${dailyAvgHours}h`, 'per day', textMuted);
  statCard(margin + (cardW + gap) * 2, y, cardW, cardH,
    `vs ${comparisonLabel}`, `${trendSign}${percentChange}%`,
    `${lastPeriodHours}h -> ${thisPeriodHours}h`, trendColor);
  statCard(margin + (cardW + gap) * 3, y, cardW, cardH,
    'Current Streak', `${currentStreak}d`, '>= 30 min/day', textMuted);

  y += cardH + gap;

  statCard(margin, y, cardW, cardH,
    'Longest Streak', `${longestStreak}d`, 'all-time best', textMuted);
  statCard(margin + (cardW + gap), y, cardW, cardH,
    'Peak Day', `${peakHours}h`, peakDate, textMuted);
  statCard(margin + (cardW + gap) * 2, y, cardW * 2 + gap, cardH,
    '30-Day Consistency', `${consistency}%`, `${activeDays30} / 30 active days`, textMuted);
  progressBar(margin + (cardW + gap) * 2 + 4, y + cardH - 6.5, cardW * 2 + gap - 8, 2.4, consistency, gold);

  y += cardH + 10;

  // ── Section: Daily Breakdown ─────────────────────────────────────────
  sectionHeader('DAILY BREAKDOWN',
    'Each row is one calendar day. Hours reflect total deep-focus time logged that day (day boundary offset -4h from UTC).');

  const dailyTableBody = dailyRows.map(r => {
    const tagStr = Object.entries(r.tags)
      .sort((a, b) => b[1] - a[1])
      .map(([t, ms]) => `${t}: ${(ms / 3600000).toFixed(1)}h`)
      .join('  |  ') || '-';
    return [r.date, r.dayName, `${r.hours}h`, `${r.minutes} min`, tagStr];
  });

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Day', 'Hours', 'Minutes', 'Tags Breakdown']],
    body: dailyTableBody,
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 14 },
      2: { cellWidth: 16, halign: 'right', textColor: textHi, fontStyle: 'bold' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 'auto' },
    },
    ...tableTheme,
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section: Weekly Summary (monthly & allTime only) ────────────────
  if (weekSummaries.length > 0) {
    sectionHeader('WEEKLY SUMMARY', 'Daily data aggregated into consecutive 7-day buckets.');

    const weekBody = weekSummaries.map(w => [
      w.label, w.range, `${w.totalHours}h`, `${w.dailyAvg}h/day`, `${w.days} days`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Week', 'Date Range', 'Total Hours', 'Daily Avg', 'Days']],
      body: weekBody,
      margin: { left: margin, right: margin },
      columnStyles: {
        2: { halign: 'right', textColor: textHi, fontStyle: 'bold' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      ...tableTheme,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Section: Tag Distribution ────────────────────────────────────────
  if (sortedTags.length > 0) {
    sectionHeader('TAG DISTRIBUTION',
      `Tags used during ${periodLabel.toLowerCase()}. Percentage is relative to total focus within this period.`);

    const maxTagMs = sortedTags[0][1];

    const tagBody = sortedTags.map(([tag, ms]) => {
      const pct = thisPeriodMs > 0 ? Math.round((ms / thisPeriodMs) * 100) : 0;
      return [tag, `${(ms / 3600000).toFixed(2)}h`, `${Math.round(ms / 60000)} min`, `${pct}%`];
    });

    autoTable(doc, {
      startY: y,
      head: [['Tag', 'Hours', 'Minutes', '% of Period']],
      body: tagBody,
      margin: { left: margin, right: margin },
      columnStyles: {
        1: { halign: 'right', textColor: textHi, fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
      didDrawCell: (data) => {
        // Small in-cell bar for the "Tag" column to visualize relative share
        if (data.section === 'body' && data.column.index === 0) {
          const [tag, ms] = sortedTags[data.row.index];
          const barMaxW = data.cell.width - 4;
          const barW = Math.max(1, (ms / maxTagMs) * barMaxW);
          const barY = data.cell.y + data.cell.height - 1.6;
          doc.setFillColor(...goldSoft);
          doc.rect(data.cell.x + 2, barY, barMaxW, 0.8, 'F');
          doc.setFillColor(...gold);
          doc.rect(data.cell.x + 2, barY, barW, 0.8, 'F');
        }
      },
      ...tableTheme,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Section: Streak & Consistency detail ────────────────────────────
  sectionHeader('STREAK & CONSISTENCY',
    'A "streak day" requires >= 30 minutes of logged focus. Consistency = active days in the last 30 calendar days.');

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value', 'How It Is Calculated']],
    body: [
      ['Current Streak', `${currentStreak} days`, 'Consecutive days with >= 30 min of focus, counting backwards from today.'],
      ['Longest Streak', `${longestStreak} days`, 'Longest consecutive run of >= 30 min days in the last 365 days.'],
      ['30-Day Consistency', `${consistency}%`, `${activeDays30} out of the last 30 calendar days had > 0 minutes logged.`],
    ],
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: textHi, cellWidth: 38 },
      1: { cellWidth: 25, textColor: gold, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
    },
    ...tableTheme,
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section: Methodology (so AI models understand the data) ─────────
  sectionHeader('METHODOLOGY & DEFINITIONS');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...textMuted);

  const methodLines = [
    'Focus Time: Total milliseconds of active focus sessions tracked via the Focus10010 stopwatch, converted to hours (ms / 3,600,000).',
    'Day Boundary: Days are offset by -4 hours from UTC midnight to account for late-night sessions (work until 3:59 AM counts for the previous day).',
    'Weekly Period: The most recent 7 calendar days (including today).',
    'Monthly Period: The most recent 28 calendar days (4 complete weeks).',
    'All-Time Period: The most recent 365 calendar days.',
    'vs Previous Period: Compares the current period total hours against the immediately preceding period of equal length. Formula: ((current - previous) / previous) * 100.',
    'Daily Average: Total period hours divided by the number of days in that period.',
    'Streak: A day counts toward a streak if >= 30 minutes (1,800,000 ms) were logged. Today is excluded if it has less than 30 min so far.',
    'Tags: User-applied activity categories. Tag durations are tracked per session and summed per day.',
  ];

  methodLines.forEach(line => {
    const bulletX = margin;
    const textX = margin + 3.5;
    const splitLines = doc.splitTextToSize(line, contentW - 3.5);
    ensureSpace(splitLines.length * 3.8 + 2);
    doc.setFillColor(...gold);
    doc.circle(bulletX + 0.6, y - 1.1, 0.5, 'F');
    doc.text(splitLines, textX, y);
    y += splitLines.length * 3.8 + 1.6;
  });

  y += 2;
  doc.setDrawColor(...divider);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('This report was generated by Focus10010 (focus10010.app). All times are in hours unless otherwise noted.', margin, y);

  // ── Footer on every page ─────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...divider);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text(`Focus10010 - ${periodLabel} Report`, margin, pageH - 7.5);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 7.5, { align: 'right' });
  }

  // ── Save ───────────────────────────────────────────────────────────
  const fileName = `Focus10010_${period}_report_${fmtDate(new Date())}.pdf`;
  doc.save(fileName);
}