import * as React from "react"
import { cn } from "@/lib/utils/cn"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "ghost" | "danger" | "glass"
    size?: "sm" | "md" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "md", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn("btn", `btn-${variant}`, `btn-${size}`, className)}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
