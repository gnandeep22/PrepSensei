import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-white/20 bg-primary/95 text-primary-foreground shadow-xs [a]:hover:bg-primary/85",
        secondary:
          "border-black/[0.04] dark:border-white/[0.08] bg-black/[0.04] dark:bg-white/[0.08] text-foreground backdrop-blur-sm [a]:hover:bg-black/[0.08] dark:[a]:hover:bg-white/[0.12]",
        destructive:
          "border-destructive/30 bg-destructive/12 text-destructive dark:bg-destructive/20 dark:border-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-white/60 dark:border-white/15 bg-white/40 dark:bg-white/[0.05] backdrop-blur-md text-foreground shadow-xs [a]:hover:bg-white/60 dark:[a]:hover:bg-white/[0.1]",
        ghost:
          "border-transparent hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
