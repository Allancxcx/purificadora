# Manantial

Operación de una purificadora en Guatemala: sucursales, socios de negocio, series, compras, ventas, inventario, contabilidad, facturación FEL y reparto con handheld.

Es una demostración que corre entera en el navegador. No envía nada a la SAT. El certificador simulado devuelve un UUID falso a propósito.

## Entrar

```bash
npm install
npm run dev
```

La clave de todos los usuarios es `manantial`.

| Correo | Para qué |
| --- | --- |
| admin@manantial.gt | Toda la operación y la handheld |
| contador@manantial.gt | Libros, facturas y cobros |
| ventas.z10@manantial.gt | Socios y órdenes de Zona 10 |
| bodega@manantial.gt | Compras e inventario |
| gerencia.mixco@manantial.gt | Solo ve Mixco |
| juan.reparto@manantial.gt | Handheld de la ruta de Zona 10 |
| maria.reparto@manantial.gt | Handheld de Mixco |
| carlos.reparto@manantial.gt | Ruta ya cerrada en Villa Nueva |

Para ver el mapa moverse mientras se entrega, dejá una ventana como administración en Rutas y abrí otra con Juan. Comparten los datos guardados en el navegador y cada una conserva su sesión.

## Ver la interfaz

La demostración publicada está en GitHub Pages:

https://allancxcx.github.io/purificadora/

Entrá con `admin@manantial.gt` y la clave `manantial`. Desde ahí se puede recorrer el punto de venta, la empresa (razón social, nombre comercial, NIT, dirección y teléfono), la certificación y el libro diario. El código está en `main` y la interfaz publicada sale de la rama `gh-pages`. La salida a producción, con API y certificador de pago, queda para después.

En local:

```bash
npm install
npm run dev
```

`npm run build` deja `dist/` listo para un hosting estático. Incluye `vercel.json`, `public/_redirects` para Netlify y una copia `404.html` para GitHub Pages. En el teléfono, desde la handheld, se puede instalar como aplicación.

## Producción

El navegador no es el lugar de las llaves ni del correlativo cuando haya varios usuarios a la vez. `src/contratos/api.ts` lista los casos de uso que hoy viven en `src/datos/motor.ts`. El reemplazo es un API con la misma forma: cada función ya devuelve el estado siguiente o un error, y certificar solo avanza un borrador, así un reintento no duplica el asiento.

### Certificador

1. El DTE sale en XML SAT 0.2.0 desde `src/servicios/fel.ts`, con IVA incluido, frase de ISR tipo 1 y el establecimiento de la sucursal.
2. Factura y nota de crédito son los documentos que se certifican. Órdenes y recibos de caja se quedan internos.
3. Cuando contraten certificador, se implementa `CertificadorFel.certificar` para INFILE, Digifact, G4S, Megaprint u otro. El acuse que deben devolver es el mismo: UUID, serie, número y fecha. La firma la pone el certificador.
4. El NIT `9999999-9` existe para probar un rechazo sin gastar correlativo.

La contabilidad resume caja, bancos, clientes, IVA, inventario, proveedores, ventas, costo y gastos de flota. El camión saca inventario al iniciar la ruta. La venta de mostrador lo saca al certificar.

Los nombres, el NIT del emisor y los UUID de la semilla son ficticios.
