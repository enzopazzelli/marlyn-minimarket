import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs se usa SOLO adentro de handlers de click, con
  // `await import("exceljs")`, en los botones de export (Stock,
  // Reportes, cuenta corriente, comparación de precios). Aun así,
  // Turbopack lo seguía a través del pase "Client Component SSR" —que
  // apunta a Node, no al navegador— y ahí resuelve `exceljs.nodejs.js`,
  // que arrastra unzipper → fstream → rimraf y rompía el build entero
  // con "Can't resolve 'rimraf'".
  //
  // Con esto, exceljs queda como require externo del lado servidor en
  // vez de bundlearse: el pase de SSR ya no entra a mirar esa cadena, y
  // en el navegador se sigue usando el build de browser que declara el
  // `browser` field del paquete (`dist/exceljs.min.js`).
  //
  // (De paso: en esta máquina `node_modules/rimraf` está como carpeta
  // vacía, una instalación a medias — por eso el error apareció. Pero
  // aunque estuviera sano, meter fstream/unzipper en el bundle de SSR
  // para un export que corre en un click es peso al pedo.)
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
