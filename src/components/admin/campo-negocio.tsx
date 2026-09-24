// Campo oculto con el local sobre el que actúa el formulario. El super admin lo necesita
// (edita varios locales); a un dueño se le ignora: su local sale de su perfil, no del formulario.
export function CampoNegocio({ id }: { id: string }) {
  return <input type="hidden" name="negocio" value={id} />;
}
