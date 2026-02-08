'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  AnalyticsMetrics,
  TicketsPerDayData,
  TicketsByTypeData,
  TicketsBySeverityData,
  ResolutionTrendData,
  TopApplicationData,
  AIConfidenceData,
} from '@/types/analytics';

interface ExportData {
  metrics?: AnalyticsMetrics;
  ticketsPerDay?: TicketsPerDayData[];
  ticketsByType?: TicketsByTypeData[];
  ticketsBySeverity?: TicketsBySeverityData[];
  resolutionTrend?: ResolutionTrendData[];
  topApplications?: TopApplicationData[];
  aiConfidence?: AIConfidenceData[];
}

interface ExportCSVButtonProps {
  data: ExportData;
  isLoading?: boolean;
}

function convertToCSV(data: ExportData): string {
  const lines: string[] = [];

  // Metrics section
  if (data.metrics) {
    lines.push('=== METRICS ===');
    lines.push('Metric,Value,Change %');
    lines.push(
      `Total Tickets,${data.metrics.totalTickets},${data.metrics.totalTicketsChange.toFixed(1)}`
    );
    lines.push(
      `Avg Resolution Time (h),${data.metrics.avgResolutionTime.toFixed(1)},${data.metrics.avgResolutionTimeChange.toFixed(1)}`
    );
    lines.push(
      `AI Accuracy %,${data.metrics.aiAccuracy.toFixed(1)},${data.metrics.aiAccuracyChange.toFixed(1)}`
    );
    lines.push(
      `Active Users,${data.metrics.activeUsers},${data.metrics.activeUsersChange.toFixed(1)}`
    );
    lines.push('');
  }

  // Tickets per day
  if (data.ticketsPerDay?.length) {
    lines.push('=== TICKETS PER DAY ===');
    lines.push('Date,Tickets');
    data.ticketsPerDay.forEach(item => {
      lines.push(`${item.date},${item.tickets}`);
    });
    lines.push('');
  }

  // Tickets by type
  if (data.ticketsByType?.length) {
    lines.push('=== TICKETS BY TYPE ===');
    lines.push('Type,Count');
    data.ticketsByType.forEach(item => {
      lines.push(`${item.type},${item.count}`);
    });
    lines.push('');
  }

  // Tickets by severity
  if (data.ticketsBySeverity?.length) {
    lines.push('=== TICKETS BY SEVERITY ===');
    lines.push('Severity,Count');
    data.ticketsBySeverity.forEach(item => {
      lines.push(`${item.severity},${item.count}`);
    });
    lines.push('');
  }

  // Resolution trend
  if (data.resolutionTrend?.length) {
    lines.push('=== RESOLUTION TREND ===');
    lines.push('Date,Avg Time (h)');
    data.resolutionTrend.forEach(item => {
      lines.push(`${item.date},${item.avgTime.toFixed(2)}`);
    });
    lines.push('');
  }

  // Top applications
  if (data.topApplications?.length) {
    lines.push('=== TOP APPLICATIONS ===');
    lines.push('Application,Ticket Count');
    data.topApplications.forEach(item => {
      lines.push(`${item.applicationName},${item.ticketCount}`);
    });
    lines.push('');
  }

  // AI confidence
  if (data.aiConfidence?.length) {
    lines.push('=== AI CONFIDENCE ===');
    lines.push('Date,Avg Confidence %,Total Predictions');
    data.aiConfidence.forEach(item => {
      lines.push(`${item.date},${item.avgConfidence.toFixed(1)},${item.totalPredictions}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function ExportCSVButton({ data, isLoading }: ExportCSVButtonProps) {
  const handleExport = () => {
    const csvContent = convertToCSV(data);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `analytics-export-${timestamp}.csv`);
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={isLoading}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
