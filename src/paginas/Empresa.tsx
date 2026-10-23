import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarEmpresa } from '../datos/motor'
import { DEPARTAMENTOS_GT, municipiosDelDepartamento } from '../dominio/geografia'
import type { Empresa as DatosEmpresa } from '../dominio/tipos'
import { Buscador } from '../componentes/Buscador'
import { Boton, Campo, Pagina, Tarjeta, Texto } from '../componentes/ui'

export function EmpresaPagina() {
  const { estado, puede, ejecutar } = useErp()
  const [empresa, setEmpresa] = useState<DatosEmpresa>(estado.empresa)
  const editar = puede('empresa.editar')
  const set = (parcial: Partial<DatosEmpresa>) => setEmpresa({ ...empresa, ...parcial })

  return (
    <Pagina titulo="Empresa" detalle="Estos datos salen en la factura y en el DTE. La razón social es el nombre legal; el nombre comercial es el que ve el cliente.">
      <form className="grid gap-3 lg:grid-cols-2" onSubmit={(e) => { e.preventDefault(); ejecutar((actual) => guardarEmpresa(actual, empresa)) }}>
        <Tarjeta className="space-y-3">
          <h2 className="font-display text-2xl">Identidad</h2>
          <Campo etiqueta="Razón social"><Texto value={empresa.razonSocial} disabled={!editar} onChange={(e) => set({ razonSocial: e.target.value })} /></Campo>
          <Campo etiqueta="Nombre comercial"><Texto value={empresa.nombreComercial} disabled={!editar} onChange={(e) => set({ nombreComercial: e.target.value })} /></Campo>
          <Campo etiqueta="NIT del emisor"><Texto value={empresa.nit} disabled={!editar} onChange={(e) => set({ nit: e.target.value })} /></Campo>
          <p className="text-xs text-slate-500">El mismo NIT se usa en la configuración de certificación. Se guarda sin guion.</p>
        </Tarjeta>
        <Tarjeta className="space-y-3">
          <h2 className="font-display text-2xl">Contacto y domicilio fiscal</h2>
          <Campo etiqueta="Dirección"><Texto value={empresa.direccion} disabled={!editar} onChange={(e) => set({ direccion: e.target.value })} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Departamento">
              <Buscador disabled={!editar} opciones={DEPARTAMENTOS_GT.map((d) => ({ value: d.nombre, etiqueta: `${d.codigo} · ${d.nombre}` }))} value={empresa.departamento} onChange={(departamento) => set({ departamento, municipio: municipiosDelDepartamento(departamento).some((item) => item.nombre === empresa.municipio) ? empresa.municipio : '' })} placeholder="Departamento" />
            </Campo>
            <Campo etiqueta="Municipio">
              <Buscador disabled={!editar} opciones={municipiosDelDepartamento(empresa.departamento).map((item) => ({ value: item.nombre, etiqueta: `${item.codigo} · ${item.nombre}` }))} value={empresa.municipio} onChange={(municipio) => set({ municipio })} placeholder="Municipio" />
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Código postal"><Texto type="number" value={empresa.codigoPostal} disabled={!editar} onChange={(e) => set({ codigoPostal: Number(e.target.value) })} /></Campo>
            <Campo etiqueta="Teléfono"><Texto value={empresa.telefono} disabled={!editar} onChange={(e) => set({ telefono: e.target.value })} /></Campo>
          </div>
          <Campo etiqueta="Correo de facturación"><Texto value={empresa.correo} disabled={!editar} onChange={(e) => set({ correo: e.target.value })} /></Campo>
          {editar && <Boton type="submit">Guardar empresa</Boton>}
        </Tarjeta>
      </form>
    </Pagina>
  )
}
