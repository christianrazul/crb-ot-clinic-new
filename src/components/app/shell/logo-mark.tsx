import Image from "next/image";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5",
        className,
      )}
    >
      <Image
        src="/logo.png"
        alt=""
        width={32}
        height={32}
        className="size-full object-contain p-0.5"
        priority
      />
    </span>
  );
}
