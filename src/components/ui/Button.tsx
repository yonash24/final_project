import * as React from "react"
import { cn } from "@/lib/utils/cn"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "subtle" | "outline" | "destructive" | "default" | "glass" | "danger"
    size?: "sm" | "md" | "lg" | "icon"
    loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "md", loading = false, ...props }, ref) => {
        const resolvedVariant = variant === "default" ? "primary" : variant === "glass" ? "secondary" : variant === "danger" ? "destructive" : variant;
        return (
            <button
                ref={ref}
                className={cn("btn", `btn-${resolvedVariant}`, `btn-${size}`, loading && "btn-loading", className)}
                disabled={loading || props.disabled}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
