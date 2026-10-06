import { FormularioClave } from "@/components/admin/vistas";
import { EncabezadoPagina } from "@/components/superadmin/marco";
import { requerirSuperadmin } from "@/lib/admin";

export const metadata = { title: "Super admin — Mi cuenta" };

export default async function Cuenta() {
  await requerirSuperadmin();
  return (
    <>
      <EncabezadoPagina titulo="Mi cuenta" descripcion="Tu contraseña de super admin. Usa una larga y que no uses en otro sitio." />
      <main className="max-w-2xl">
        <FormularioClave />
      </main>
    </>
  );
}
