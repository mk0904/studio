"use client"

import * as React from "react"
import { addMonths, format, isBefore, startOfMonth } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
}

export function DatePickerWithRange({
  className,
  date,
  onDateChange
}: DatePickerWithRangeProps) {
  const currentYear = new Date().getFullYear();
  const initialFromMonth = date?.from ? startOfMonth(date.from) : startOfMonth(new Date());
  const initialToMonth = date?.to ? startOfMonth(date.to) : startOfMonth(addMonths(initialFromMonth, 1));

  const [displayMonth1, setDisplayMonth1] = React.useState<Date>(initialFromMonth);
  // Ensure displayMonth2 is never before displayMonth1 on initial load or when displayMonth1 changes.
  const [displayMonth2, setDisplayMonth2] = React.useState<Date>(
    isBefore(initialToMonth, addMonths(initialFromMonth,1)) ? startOfMonth(addMonths(initialFromMonth, 1)) : initialToMonth
  );

  React.useEffect(() => {
    // Adjust displayMonth2 if displayMonth1 changes to be same or after displayMonth2
    if (displayMonth1 && displayMonth2 && !isBefore(displayMonth1, displayMonth2)) {
      setDisplayMonth2(startOfMonth(addMonths(displayMonth1, 1)));
    }
  }, [displayMonth1, displayMonth2]);


  const handleDisplayMonth1Change = (month: Date) => {
    setDisplayMonth1(startOfMonth(month));
  };

  const handleDisplayMonth2Change = (month: Date) => {
    // Prevent displayMonth2 from being set before or same as displayMonth1
    if (isBefore(month, addMonths(displayMonth1, 0))) { // strictly before or same month as displayMonth1
       setDisplayMonth2(startOfMonth(addMonths(displayMonth1,1)));
    } else {
       setDisplayMonth2(startOfMonth(month));
    }
  };


  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal h-9 sm:h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm sm:text-base shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200 focus-visible:ring-0 focus-visible:ring-offset-0",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex justify-center border-none outline-none shadow-lg rounded-lg w-[240px] md:w-auto">
          <Calendar
            initialFocus
            mode="range"
            month={displayMonth1}
            onMonthChange={handleDisplayMonth1Change}
            selected={date}
            onSelect={onDateChange}
            captionLayout="dropdown"
            fromYear={currentYear - 100}
            toYear={currentYear + 10}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
