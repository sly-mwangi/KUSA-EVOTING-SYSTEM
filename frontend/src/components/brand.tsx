import LogoIcon from "@/assets/kusa-icon.png";
import { Link } from "wouter";

export function Brand({
  to = "/",
  small = false,
}: {
  to?: string;
  small?: boolean;
}) {
  return (
    <Link href={to} className="flex items-center gap-2 group">
      <div className="relative">
        <div className="grid place-items-center h-9 w-9 overflow-hidden shadow-sm">
          <img
            src={LogoIcon}
            alt="Kuvote Logo"
            className="h-6 w-6 object-contain"
          />
        </div>
      </div>
      <div
        className={small ? "text-sm leading-tight" : "text-base leading-tight"}
      >
        <div className="font-bold tracking-tight">KUVOTE</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          KUSA E-Voting
        </div>
      </div>
    </Link>
  );
}
