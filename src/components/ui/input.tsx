
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-lg border border-gray-200 bg-white/50 px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-500 transition-all outline-none ring-0 ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:border-[#004C8F]/30 hover:bg-white focus:bg-white focus:border-[#004C8F] focus:shadow-[0_0_0_3px_rgba(0,76,143,0.12)] disabled:opacity-50 disabled:cursor-not-allowed file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

    