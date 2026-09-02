import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" : produit .next/standalone/server.js, un serveur minimal
  // autonome, utilisé par l'application de bureau (Electron).
  output: "standalone",

  // Force l'inclusion du client Prisma et de son moteur dans le build autonome.
  outputFileTracingIncludes: {
    "*": [
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./prisma/migrations/**/*",
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
