import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  variant?: "hero" | "sidebar" | "compact";
  href?: string;
  className?: string;
};

const sizes = {
  hero: { w: 360, h: 140, img: "h-[88px] sm:h-[104px]" },
  sidebar: { w: 220, h: 88, img: "h-[64px]" },
  compact: { w: 140, h: 56, img: "h-[40px]" },
} as const;

export function BrandLogo({ variant = "hero", href, className = "" }: BrandLogoProps) {
  const { w, h, img } = sizes[variant];

  const panelClass =
    variant === "hero"
      ? "brand-logo-panel brand-logo-panel-hero"
      : variant === "compact"
        ? "brand-logo-panel brand-logo-panel-compact"
        : "brand-logo-panel brand-logo-panel-sidebar";

  const inner = (
    <div className={`${panelClass} ${className}`}>
      <Image
        src="/logo-bci.png"
        alt="Brown Cinnamon Indonesia"
        width={w}
        height={h}
        className={`${img} w-auto max-w-full mx-auto object-contain`}
        priority
        unoptimized
      />
      {variant === "hero" && (
        <div className="mt-3 pt-3 border-t border-[#f7c200]/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#7a4f00]">
            SuperApps Enterprise
          </p>
        </div>
      )}
      {variant === "sidebar" && (
        <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a4f00]">
          SuperApps
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {inner}
      </Link>
    );
  }

  return inner;
}
