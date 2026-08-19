"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clienteConfig } from "@/config/cliente";
import { BotonCerrarSesion } from "@/componentes/BotonCerrarSesion";
import type { Perfil } from "@/lib/supabase/perfil";

type ItemNav = { href: string; etiqueta: string; soloDueño?: boolean };

// Agrupado por frecuencia de uso, no por jerarquía técnica (prompt-base
// sección 4.3): lo que se toca cada hora primero, lo que se toca cada
// tanto después. Apagar un módulo en config/cliente.ts oculta su link
// acá solo, sin tocar rutas ni componentes. soloDueño hace lo mismo
// pero por rol en vez de por módulo (Fase 2 de PLAN-ROLES-AUDITORIA.md):
// un operador ni ve el link, no es solo que la pantalla lo rebote.
function construirGrupoDiaADia(): ItemNav[] {
  return [
    ...(clienteConfig.modulos.ventas ? [{ href: "/ventas", etiqueta: "Ventas" }] : []),
    ...(clienteConfig.modulos.caja ? [{ href: "/caja", etiqueta: "Caja" }] : []),
    ...(clienteConfig.modulos.reportes ? [{ href: "/reportes", etiqueta: "Reportes", soloDueño: true }] : []),
  ];
}

function construirGrupoAdministracion(): ItemNav[] {
  return [
    ...(clienteConfig.modulos.stock ? [{ href: "/stock", etiqueta: "Stock" }] : []),
    ...(clienteConfig.modulos.clientes ? [{ href: "/clientes", etiqueta: "Clientes" }] : []),
    ...(clienteConfig.modulos.proveedores ? [{ href: "/proveedores", etiqueta: "Proveedores" }] : []),
    ...(clienteConfig.modulos.notas ? [{ href: "/notas", etiqueta: "Notas" }] : []),
    ...(clienteConfig.modulos.usuariosGranular ? [{ href: "/usuarios", etiqueta: "Usuarios", soloDueño: true }] : []),
  ];
}

function construirGrupoComplementos(): ItemNav[] {
  return [
    ...(clienteConfig.complementos.pantallaCliente
      ? [{ href: "/pantalla-cliente", etiqueta: "Pantalla al cliente" }]
      : []),
  ];
}

const ETIQUETA_ROL: Record<Perfil["rol"], string> = { dueño: "Dueño", operador: "Empleado" };

export function BarraLateral({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname();
  const esDueño = perfil.rol === "dueño";

  const filtrarPorRol = (items: ItemNav[]) => items.filter((item) => !item.soloDueño || esDueño);

  return (
    <aside className="flex w-full shrink-0 flex-row overflow-x-auto bg-marco text-white md:w-[212px] md:flex-col md:overflow-x-visible">
      <div className="flex shrink-0 items-center border-white/10 px-4 py-3 md:block md:border-b md:py-5">
        <p className="whitespace-nowrap font-[family-name:var(--font-display)] text-base leading-tight md:text-lg">
          {clienteConfig.comercio.nombre}
        </p>
      </div>

      <nav className="flex flex-row gap-1 px-2 py-2 md:flex-1 md:flex-col md:gap-6 md:overflow-y-auto md:py-4">
        <GrupoNav titulo="Día a día" items={filtrarPorRol(construirGrupoDiaADia())} pathname={pathname} />
        <GrupoNav titulo="Administración" items={filtrarPorRol(construirGrupoAdministracion())} pathname={pathname} />
        <GrupoNav
          titulo="Complementos"
          items={filtrarPorRol(construirGrupoComplementos())}
          pathname={pathname}
          distintivo
        />
      </nav>

      <div className="flex shrink-0 flex-row items-center gap-3 border-white/10 px-4 py-3 md:flex-col md:items-stretch md:gap-1 md:border-t">
        <p className="whitespace-nowrap text-sm font-medium text-white md:truncate">{perfil.nombre}</p>
        <span className="whitespace-nowrap font-[family-name:var(--font-numero)] text-[11px] uppercase tracking-wider text-white/50">
          {ETIQUETA_ROL[perfil.rol]}
        </span>
        <BotonCerrarSesion />
      </div>
    </aside>
  );
}

function GrupoNav({
  titulo,
  items,
  pathname,
  distintivo = false,
}: {
  titulo: string;
  items: ItemNav[];
  pathname: string | null;
  distintivo?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-row items-center gap-1 md:block md:px-2">
      <p className="hidden shrink-0 px-2 font-[family-name:var(--font-numero)] text-[11px] uppercase tracking-wider text-white/50 md:mb-2 md:block">
        {titulo}
      </p>
      <ul className="flex flex-row gap-1 md:flex-col">
        {items.map((item) => {
          const activo = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2 whitespace-nowrap rounded-[var(--radius-base)] px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-acento ${
                  activo
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.etiqueta}
                {distintivo && (
                  <span className="rounded-full bg-acento px-1.5 py-0.5 font-[family-name:var(--font-numero)] text-[10px] text-acento-texto">
                    +
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
