import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

/** Input with a fixed prefix or suffix, such as "₱" or "%". */
function InputGroup({
  prefix,
  suffix,
  className,
  inputClassName,
  ...props
}: Omit<React.ComponentProps<"input">, "prefix"> & {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  inputClassName?: string;
}) {
  return (
    <div className={cn("relative flex items-center", className)}>
      {prefix && (
        <span className="pointer-events-none absolute left-3 text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        className={cn(prefix && "pl-7", suffix && "pr-8", "tabular-nums", inputClassName)}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

export { Input, InputGroup };
