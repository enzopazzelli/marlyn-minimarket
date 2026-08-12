import { redirect } from "next/navigation";

// La pantalla de Ventas manda (sección 4.5): es donde el comercio pasa
// el 90% del día, así que es lo primero que ve el operador al entrar.
export default function Home() {
  redirect("/ventas");
}
