"use client";

// Dernier filet : erreur qui remonte jusqu'à la racine (rare). Doit fournir sa
// propre coquille <html>/<body>.

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#f6f7f9",
          color: "#1a1d21",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18 }}>Une erreur inattendue s&apos;est produite</h1>
          <p style={{ color: "#667085", fontSize: 14 }}>
            L&apos;application a rencontré un problème. Vos données ne sont pas touchées.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#1e5eff",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
