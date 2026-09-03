import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" : produit .next/standalone/server.js, un serveur minimal
  // autonome, utilisé par l'application de bureau (Electron).
  output: "standalone",

  // Ces paquets utilisent des fichiers natifs / WASM et des "workers" : Next ne
  // doit pas les regrouper dans son bundle, mais les charger via require().
  //   - mupdf        : rend les pages PDF en image (pour l'OCR des scans)
  //   - tesseract.js : reconnaissance de texte (OCR), en français
  serverExternalPackages: ["mupdf", "tesseract.js"],

  experimental: {
    // Import de factures via Server Action : le corps doit pouvoir contenir un
    // scan lourd (la limite Next par défaut est de 1 Mo, incompatible avec
    // MAX_SIZE = 20 Mo côté import).
    serverActions: { bodySizeLimit: "25mb" },
  },

  // Force l'inclusion du client Prisma et de son moteur dans le build autonome,
  // ainsi que des moteurs OCR et de leurs données de langue.
  outputFileTracingIncludes: {
    "*": [
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./prisma/migrations/**/*",
      "./node_modules/mupdf/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./src/lib/parsing/tessdata/**/*",
    ],
  },
  // N'embarque JAMAIS les données utilisateur ni les gros binaires inutiles.
  outputFileTracingExcludes: {
    "*": [
      "./data/**",
      "./dist-app/**",
      "./node_modules/@prisma/engines/**",
      "./node_modules/electron/**",
      "./node_modules/electron-builder/**",
    ],
  },
};

export default nextConfig;
