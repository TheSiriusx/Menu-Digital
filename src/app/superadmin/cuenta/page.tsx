import { FormularioClave } from "@/components/admin/vistas";
import { requerirSuperadmin } from "@/lib/admin";

export const metadata = { title: "Super admin — Mi cuenta" };

export default async function Cuenta() {
  await requerirSuperadmin();
  return (
    <main>
      <FormularioClave />
    </main>
  );
}
