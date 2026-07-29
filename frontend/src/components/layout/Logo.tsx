import logo from "@/assets/marca-deusa.png";

export function DeusaLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return <img src={logo} alt="Deusa Alimentos" className={className} />;
}
