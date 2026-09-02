import Link from "next/link";
import { PageHeader, Card, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DeleteInvoiceButton } from "@/components/DeleteInvoiceButton";
import { CreateUserForm, ChangePasswordForm } from "./UserForms";
import { deleteUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function UtilisateursPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle="Comptes autorisés à ouvrir l'application."
        action={<Link href="/parametres" className="text-sm text-[var(--muted)]">← Paramètres</Link>}
      />

      <Card className="mb-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Rôle</th>
              <th>Créé le</th>
              <th>Dernière connexion</th>
              {isAdmin && <th className="actions"></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">
                  {u.name}
                  {u.id === me.id && <span className="ml-1.5 text-xs text-[var(--muted)]">(vous)</span>}
                </td>
                <td>
                  <Badge tone={u.role === "admin" ? "info" : "neutral"}>
                    {u.role === "admin" ? "Administrateur" : "Utilisateur"}
                  </Badge>
                </td>
                <td className="text-xs">{formatDate(u.createdAt)}</td>
                <td className="text-xs">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}</td>
                {isAdmin && (
                  <td className="actions">
                    {u.id !== me.id && (
                      <DeleteInvoiceButton
                        action={deleteUser.bind(null, u.id)}
                        variant="icon"
                        label="Supprimer l'utilisateur"
                        confirmText={`Supprimer le compte « ${u.name} » ?`}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {isAdmin && (
        <Card className="mb-4 p-4">
          <h2 className="mb-3 text-sm font-semibold">Ajouter un utilisateur</h2>
          <CreateUserForm />
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Changer mon mot de passe</h2>
        <ChangePasswordForm />
      </Card>
    </>
  );
}
