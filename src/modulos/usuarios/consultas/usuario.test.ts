import { describe, expect, it } from "vitest";
import {
  credencialAEmail,
  emailDesdeUsuario,
  normalizarUsuario,
  usuarioParaMostrar,
  validarUsuario,
} from "./usuario";

describe("normalizarUsuario", () => {
  it("baja a minúsculas y saca acentos", () => {
    expect(normalizarUsuario("Martín")).toBe("martin");
    expect(normalizarUsuario("SOFÍA")).toBe("sofia");
  });

  it("los espacios pasan a punto", () => {
    expect(normalizarUsuario("juan perez")).toBe("juan.perez");
    expect(normalizarUsuario("  ana   maria  ")).toBe("ana.maria");
  });

  it("descarta lo que Auth podría rechazar", () => {
    expect(normalizarUsuario("mar#cos!")).toBe("marcos");
    expect(normalizarUsuario("ñoño")).toBe("nono");
  });
});

describe("emailDesdeUsuario", () => {
  it("arma el correo interno", () => {
    expect(emailDesdeUsuario("marcos")).toBe("marcos@marlyn.local");
    expect(emailDesdeUsuario("Juan Perez")).toBe("juan.perez@marlyn.local");
  });
});

describe("credencialAEmail", () => {
  // Los dueños que ya existían entran con su correo real: la pantalla
  // de ingreso tiene que seguir aceptándolo.
  it("un correo real pasa tal cual", () => {
    expect(credencialAEmail("enzopazzelli1@gmail.com")).toBe("enzopazzelli1@gmail.com");
  });

  it("normaliza mayúsculas en el correo", () => {
    expect(credencialAEmail("  Enzo@Gmail.com ")).toBe("enzo@gmail.com");
  });

  it("un usuario suelto recibe el dominio interno", () => {
    expect(credencialAEmail("marcos")).toBe("marcos@marlyn.local");
  });
});

describe("validarUsuario", () => {
  it("acepta un usuario normal", () => {
    expect(validarUsuario("marcos")).toBeNull();
    expect(validarUsuario("Juan Perez")).toBeNull();
  });

  it("rechaza vacío", () => {
    expect(validarUsuario("   ")).toMatch(/Escribí un usuario/);
  });

  it("rechaza uno demasiado corto", () => {
    expect(validarUsuario("ab")).toMatch(/al menos 3/);
  });

  // Para que no cargue "marcos@gmail.com" como usuario y después el
  // correo interno quede "marcosgmail.com@marlyn.local".
  it("rechaza que peguen un correo en el campo usuario", () => {
    expect(validarUsuario("marcos@gmail.com")).toMatch(/sin @/);
  });
});

describe("usuarioParaMostrar", () => {
  it("de una cuenta interna muestra solo el usuario", () => {
    expect(usuarioParaMostrar("marcos@marlyn.local")).toBe("marcos");
  });

  it("de un correo real muestra el correo entero", () => {
    expect(usuarioParaMostrar("enzopazzelli1@gmail.com")).toBe("enzopazzelli1@gmail.com");
  });
});
