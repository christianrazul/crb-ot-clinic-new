"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg! border! border-border! bg-popover! text-popover-foreground! shadow-lg! font-sans!",
          description: "text-muted-foreground!",
          icon: "text-success!",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
