"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-white/80 backdrop-blur-sm border border-slate-200/70 rounded-xl shadow-sm", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: cn(
          "text-sm font-medium text-[#004C8F] !hidden",
          props.captionLayout?.startsWith("dropdown") && "hidden"
        ),
        caption_dropdowns: "flex gap-2 items-center",
        nav: "space-x-2 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 p-0 opacity-70 hover:opacity-100 transition-all duration-200 rounded-lg"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-2",
        head_row: "flex",
        head_cell:
          "text-muted-foreground/70 rounded-md w-10 font-medium text-[0.8rem] mb-1",
        row: "flex w-full mt-2",
        cell: cn(
          "h-10 w-10 text-center text-sm p-0 relative hover:bg-slate-50/50 rounded-lg transition-colors duration-200",
          "[&:has([aria-selected])]:bg-[#004C8F]/5 [&:has([aria-selected])]:rounded-lg",
          "first:[&:has([aria-selected])]:rounded-lg last:[&:has([aria-selected])]:rounded-lg",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal hover:bg-transparent aria-selected:opacity-100 rounded-lg transition-all duration-200"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#004C8F] text-white hover:bg-[#004C8F]/90 hover:text-white focus:bg-[#004C8F] focus:text-white shadow-sm",
        day_today: "bg-slate-100/80 text-[#004C8F] font-medium",
        day_outside:
          "text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground/70",
        day_disabled: "text-muted-foreground/30 hover:bg-transparent cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-[#004C8F]/10 aria-selected:text-[#004C8F]",
        day_hidden: "invisible",
        dropdown: "bg-white border border-slate-200/70 rounded-lg p-2 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1",
        dropdown_month: "font-medium text-[#004C8F]",
        dropdown_year: "font-medium text-[#004C8F]",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" {...props} />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" {...props} />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
