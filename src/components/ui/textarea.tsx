import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground selection:bg-brand selection:text-brand-foreground flex field-sizing-content min-h-20 w-full rounded-lg border border-input bg-field px-3 py-2 text-base leading-relaxed transition-[color,box-shadow] outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/35",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
