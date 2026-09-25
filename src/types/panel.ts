// Datos que muestra el panel (pedidos, clientes y reportes).
import type { EstadoPedido } from "@/lib/pedidos-estados";
import type { Categoria, Producto } from "@/types/menu";

// Lo que ve el dueño en su panel: el stock y si la categoría está visible (el público nunca ve el stock).
export type ProductoPanel = Producto & { stock: number | null };
export type CategoriaPanel = Categoria & { activa: boolean };

export type PedidoItem = {
  id: string;
  pedido_id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario_usd: number;
};

export type Pedido = {
  id: string;
  cliente_nombre: string | null;
  cliente_telefono: string;
  total_usd: number;
  tasa_bs: number;
  metodo_pago: string | null;
  estado: EstadoPedido;
  entrega: "retiro" | "domicilio";
  direccion: string | null;
  notas: string | null;
  created_at: string;
  items: PedidoItem[];
};

export type ClienteResumen = {
  cliente_id: string;
  telefono: string;
  nombre: string | null;
  pedidos: number;
  total_usd: number;
  primera_compra: string;
  ultima_compra: string;
};

export type VentaPeriodo = { periodo: string; pedidos: number; total_usd: number; total_bs: number };
export type ProductoVendido = { producto_id: string | null; nombre: string; unidades: number; total_usd: number };
