import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { TODAS_LAS_OPCIONES } from '../dominio/permisos'
import type { Empresa, Estado, EstadoFactura, Rol, SerieDocumento, Usuario } from '../dominio/tipos'
import { aplicarCertificacion, type Resultado } from './motor'
import { armarDte } from './dte'
import { construirSemilla } from './semilla'
import { crearCertificador } from '../servicios/fel'

const LLAVE = 'manantial.datos.v1'
const SESION = 'manantial.sesion'
const SUC = 'manantial.sucursal'

export interface Aviso {
  tipo: 'ok' | 'error'
  texto: string
}

const COMPLEMENTO_ROL: Record<string, string[]> = {
  'rol-ventas': ['pos.operar', 'facturas.cobrar'],
  'rol-gerente': ['pos.operar', 'facturas.emitir', 'facturas.cobrar'],
  'rol-conta': ['empresa.ver'],
}

function estadoDocumento(valor: string): EstadoFactura {
  if (valor === 'cerrada' || valor === 'certificada') return 'cerrada'
  if (valor === 'cancelada' || valor === 'anulada') return 'cancelada'
  return 'abierta'
}

function migrar(estado: Estado): Estado {
  const previa = estado.empresa
  const empresa: Empresa = {
    razonSocial: previa.razonSocial,
    nombreComercial: previa.nombreComercial,
    nit: previa.nit,
    correo: previa.correo,
    telefono: previa.telefono,
    direccion: previa.direccion || '12 avenida 2-45, zona 10',
    municipio: previa.municipio || 'Guatemala',
    departamento: previa.departamento || 'Guatemala',
    codigoPostal: previa.codigoPostal || 1010,
  }
  const series: SerieDocumento[] = [...estado.series]
  for (const sucursal of estado.sucursales) {
    if (series.some((s) => s.sucursalId === sucursal.id && s.tipo === 'NOTA_DEBITO' && s.activa)) continue
    const credito = series.find((s) => s.sucursalId === sucursal.id && s.tipo === 'NOTA_CREDITO')
    series.push({
      id: `ser-nd-${sucursal.id}`,
      sucursalId: sucursal.id,
      tipo: 'NOTA_DEBITO',
      prefijo: `ND-${sucursal.codigo}`,
      serieFel: credito?.serieFel || 'A',
      resolucion: 'Control interno de demostración',
      correlativo: 1,
      hasta: 999999,
      activa: true,
    })
  }
  return {
    ...estado,
    empresa,
    series,
    facturas: estado.facturas.map((factura) => ({ ...factura, estado: estadoDocumento(String(factura.estado)) })),
    ordenesVenta: estado.ordenesVenta.map((orden) => ({
      ...orden,
      lineas: orden.lineas.map((linea) => ({
        ...linea,
        despachada: linea.despachada ?? (orden.estado === 'en_ruta' || orden.estado === 'entregada' ? linea.cantidad : 0),
      })),
    })),
    roles: estado.roles.map((rol) => {
      if (rol.id === 'rol-admin') return { ...rol, opciones: TODAS_LAS_OPCIONES }
      const extra = (COMPLEMENTO_ROL[rol.id] ?? []).filter((codigo) => !rol.opciones.includes(codigo))
      return extra.length ? { ...rol, opciones: [...rol.opciones, ...extra] } : rol
    }),
  }
}

function leer(): Estado {
  const crudo = localStorage.getItem(LLAVE)
  if (crudo) {
    try {
      const parsed = JSON.parse(crudo) as Estado
      if (parsed.version === 1 && parsed.empresa) return migrar(parsed)
    } catch {
      /* se reconstruye la demostración */
    }
  }
  const fresco = construirSemilla()
  localStorage.setItem(LLAVE, JSON.stringify(fresco))
  return fresco
}

interface ErpValor {
  estado: Estado
  sesion: Usuario | null
  rol: Rol | null
  sucursalActiva: string
  verEmpresa: boolean
  aviso: Aviso | null
  certificando: string | null
  puede: (codigo: string) => boolean
  setSucursalActiva: (id: string) => void
  entrar: (correo: string, clave: string) => string | null
  salir: () => void
  restaurar: () => void
  ejecutar: (fn: (estado: Estado) => Resultado) => Resultado
  certificar: (facturaId: string) => Promise<boolean>
  probarFel: () => Promise<void>
}

const Ctx = createContext<ErpValor | null>(null)

export function ErpProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() => leer())
  const [sesionId, setSesionId] = useState<string | null>(() => sessionStorage.getItem(SESION))
  const [elegida, setElegida] = useState(() => sessionStorage.getItem(SUC) ?? 'todas')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [certificando, setCertificando] = useState<string | null>(null)
  const ref = useRef(estado)
  ref.current = estado

  useEffect(() => {
    const alCambiar = (evento: StorageEvent) => {
      if (evento.key === LLAVE && evento.newValue) {
        try {
          const parsed = JSON.parse(evento.newValue) as Estado
          ref.current = parsed
          setEstado(parsed)
        } catch {
          /* ignora un guardado incompleto */
        }
      }
    }
    window.addEventListener('storage', alCambiar)
    return () => window.removeEventListener('storage', alCambiar)
  }, [])

  useEffect(() => {
    if (!aviso) return
    const reloj = window.setTimeout(() => setAviso(null), 4600)
    return () => window.clearTimeout(reloj)
  }, [aviso])

  const sesion = estado.usuarios.find((u) => u.id === sesionId && u.activo) ?? null
  const rol = estado.roles.find((r) => r.id === sesion?.rolId) ?? null
  const verEmpresa = rol?.alcance === 'empresa'
  const sucursalActiva = verEmpresa ? elegida : (sesion?.sucursalId ?? 'todas')

  function commit(siguiente: Estado) {
    ref.current = siguiente
    localStorage.setItem(LLAVE, JSON.stringify(siguiente))
    setEstado(siguiente)
  }

  function publicar(r: Resultado): Resultado {
    if (r.estado) commit(r.estado)
    if (!r.ok) setAviso({ tipo: 'error', texto: r.error })
    else if (r.aviso) setAviso({ tipo: 'ok', texto: r.aviso })
    return r
  }

  const valor: ErpValor = {
    estado,
    sesion,
    rol,
    sucursalActiva,
    verEmpresa: Boolean(verEmpresa),
    aviso,
    certificando,
    puede: (codigo) => Boolean(rol?.opciones.includes(codigo)),
    setSucursalActiva: (id) => {
      if (!verEmpresa) return
      sessionStorage.setItem(SUC, id)
      setElegida(id)
    },
    entrar: (correo, clave) => {
      const usuario = ref.current.usuarios.find((u) => u.correo === correo.trim().toLowerCase() && u.clave === clave && u.activo)
      if (!usuario) return 'Correo o clave incorrectos.'
      const rolUsuario = ref.current.roles.find((r) => r.id === usuario.rolId)
      const sucursal = rolUsuario?.alcance === 'empresa' ? 'todas' : usuario.sucursalId
      sessionStorage.setItem(SESION, usuario.id)
      sessionStorage.setItem(SUC, sucursal)
      setSesionId(usuario.id)
      setElegida(sucursal)
      return null
    },
    salir: () => {
      sessionStorage.removeItem(SESION)
      setSesionId(null)
    },
    restaurar: () => {
      const fresco = construirSemilla()
      commit(fresco)
      setAviso({ tipo: 'ok', texto: 'Demostración restaurada.' })
    },
    ejecutar: (fn) => publicar(fn(ref.current)),
    certificar: async (facturaId) => {
      const armado = armarDte(ref.current, facturaId)
      if (!armado.ok) {
        setAviso({ tipo: 'error', texto: armado.error })
        return false
      }
      setCertificando(facturaId)
      try {
        const acuse = await crearCertificador(ref.current.fel).certificar(armado.dte)
        const resultado = publicar(aplicarCertificacion(ref.current, facturaId, acuse, armado.dte))
        return resultado.ok
      } finally {
        setCertificando(null)
      }
    },
    probarFel: async () => {
      const prueba = await crearCertificador(ref.current.fel).probar()
      setAviso({ tipo: prueba.ok ? 'ok' : 'error', texto: prueba.mensaje })
    },
  }

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useErp() {
  const valor = useContext(Ctx)
  if (!valor) throw new Error('useErp fuera del proveedor')
  return valor
}

export function Avisos() {
  const { aviso } = useErp()
  if (!aviso) return null
  return (
    <div className={`no-imprimir fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-md rounded px-4 py-3 text-sm shadow-lg sm:left-auto ${aviso.tipo === 'ok' ? 'bg-[#083844] text-white' : 'bg-rose-700 text-white'}`}>
      {aviso.texto}
    </div>
  )
}
