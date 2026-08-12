import { BarraLateral } from "@/componentes/BarraLateral";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <BarraLateral />
      <div className="flex min-w-0 flex-1 flex-col bg-fondo">{children}</div>
    </div>
  );
}
