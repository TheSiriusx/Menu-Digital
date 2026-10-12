import { fuentesMenu } from "./fuentes";

// El menú público lleva la identidad del local, no la de Pidelo: «tema-menu» le devuelve su paleta cálida y sus
// fuentes (ver globals.css), y «light» lo deja siempre en tema claro aunque el teléfono esté en modo oscuro.
export default function LayoutMenu({ children }: LayoutProps<"/[slug]">) {
  return <div className={`${fuentesMenu} tema-menu light flex flex-1 flex-col`}>{children}</div>;
}
