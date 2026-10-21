import type { ListaPrecio, PrecioLista, Vehiculo } from '../dominio/tipos'

export const MAYOREO: Record<string, number> = {
  'prod-gar': 17,
  'prod-bot': 30,
  'prod-bol': 7.5,
  'prod-dis': 459,
  'prod-srv': 20,
}

export function flotaInicial(): Vehiculo[] {
  return [
    { id: 'veh-01', codigo: 'VEH-0001', placa: 'P-841BND', nombre: 'Panel 01', sucursalId: 'suc-z10', anio: 2022, valor: 85000, estado: 'disponible' },
    { id: 'veh-02', codigo: 'VEH-0002', placa: 'P-552KRM', nombre: 'Panel 02', sucursalId: 'suc-mix', anio: 2021, valor: 78000, estado: 'disponible' },
    { id: 'veh-03', codigo: 'VEH-0003', placa: 'P-219VLL', nombre: 'Panel 03', sucursalId: 'suc-vn', anio: 2020, valor: 72000, estado: 'disponible' },
    { id: 'veh-04', codigo: 'VEH-0004', placa: 'P-673ZNA', nombre: 'Panel 04', sucursalId: 'suc-z10', anio: 2024, valor: 91000, estado: 'disponible' },
  ]
}

export function listasIniciales(productos: { id: string; precio: number }[]): { listas: ListaPrecio[]; precios: PrecioLista[] } {
  const listas: ListaPrecio[] = [
    { id: 'lista-general', codigo: 'GENERAL', nombre: 'General', activa: true, esBase: true },
    { id: 'lista-mayoreo', codigo: 'MAYOREO', nombre: 'Mayoreo', activa: true, esBase: false },
  ]
  const precios: PrecioLista[] = []
  for (const producto of productos) {
    precios.push({ id: `px-general-${producto.id}`, listaId: 'lista-general', productoId: producto.id, precio: producto.precio })
    precios.push({ id: `px-mayoreo-${producto.id}`, listaId: 'lista-mayoreo', productoId: producto.id, precio: MAYOREO[producto.id] ?? producto.precio })
  }
  return { listas, precios }
}
