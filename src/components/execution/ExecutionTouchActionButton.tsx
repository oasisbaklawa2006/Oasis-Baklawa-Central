import { Button, type ButtonProps } from "@/components/ui/button";
import { EXECUTION_TOUCH_MIN_PX } from "@/lib/execution-ux/executionUxConstants";
import { cn } from "@/lib/utils";

/** Large-touch operational action — icon + label for readability. */
export function ExecutionTouchActionButton({
  label,
  icon,
  className,
  ...props
}: ButtonProps & { label: string; icon?: React.ReactNode }) {
  return (
    <Button
      type="button"
      className={cn("min-h-[44px] min-w-[44px] gap-2 px-4 text-sm font-semibold", className)}
      style={{ minHeight: EXECUTION_TOUCH_MIN_PX, minWidth: EXECUTION_TOUCH_MIN_PX }}
      aria-label={label}
      {...props}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}
