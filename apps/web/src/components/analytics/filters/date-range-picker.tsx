'use client';

import * as React from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange, DateRangePreset } from '@/types/analytics';

interface AnalyticsDateRangePickerProps {
  dateRange: DateRange;
  preset: DateRangePreset;
  onDateRangeChange: (range: DateRange, preset: DateRangePreset) => void;
}

const presets: { label: string; value: DateRangePreset; getDates: () => DateRange }[] = [
  {
    label: 'Today',
    value: 'today',
    getDates: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Last 7 days',
    value: '7d',
    getDates: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Last 30 days',
    value: '30d',
    getDates: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
];

export function AnalyticsDateRangePicker({
  dateRange,
  preset,
  onDateRangeChange,
}: AnalyticsDateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedRange, setSelectedRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: dateRange.from,
    to: dateRange.to,
  });

  const handlePresetClick = (presetItem: (typeof presets)[0]) => {
    const dates = presetItem.getDates();
    onDateRangeChange(dates, presetItem.value);
    setSelectedRange({ from: dates.from, to: dates.to });
    setIsOpen(false);
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;

    setSelectedRange({
      from: range.from,
      to: range.to,
    });

    if (range.from && range.to) {
      onDateRangeChange(
        {
          from: startOfDay(range.from),
          to: endOfDay(range.to),
        },
        'custom'
      );
    }
  };

  const getDisplayText = () => {
    const currentPreset = presets.find(p => p.value === preset);
    if (currentPreset && preset !== 'custom') {
      return currentPreset.label;
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
    }
    return 'Select date range';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !dateRange && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="flex-1">{getDisplayText()}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="flex flex-col border-r p-2 gap-1">
            {presets.map(presetItem => (
              <Button
                key={presetItem.value}
                variant={preset === presetItem.value ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick(presetItem)}
              >
                {presetItem.label}
              </Button>
            ))}
            <Button
              variant={preset === 'custom' ? 'default' : 'ghost'}
              size="sm"
              className="justify-start"
              onClick={() => {
                // Keep current selection but mark as custom
                if (selectedRange.from && selectedRange.to) {
                  onDateRangeChange(
                    {
                      from: selectedRange.from,
                      to: selectedRange.to,
                    },
                    'custom'
                  );
                }
              }}
            >
              Custom
            </Button>
          </div>
          <div className="p-3">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={selectedRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
