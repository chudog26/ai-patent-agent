import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      /* 输入框：填充 + 发丝轮廓。静止态必须能看出轮廓，
         因此用 border-input（控件描边）而不是 border-0；
         填充用 bg-field（近白），落在卡片/浅灰面板上都不会同色隐形 */
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-brand selection:text-brand-foreground h-9 w-full min-w-0 rounded-lg border border-input bg-field px-3 py-1 text-base transition-[color,box-shadow] outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:ring-2 focus-visible:ring-ring/35",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
