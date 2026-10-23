export interface DepartamentoGt {
  codigo: string
  nombre: string
}

export interface MunicipioGt {
  codigo: string
  departamento: string
  nombre: string
}

export const DEPARTAMENTOS_GT: DepartamentoGt[] = [
  { codigo: '01', nombre: 'Guatemala' },
  { codigo: '02', nombre: 'El Progreso' },
  { codigo: '03', nombre: 'Sacatepéquez' },
  { codigo: '04', nombre: 'Chimaltenango' },
  { codigo: '05', nombre: 'Escuintla' },
  { codigo: '06', nombre: 'Santa Rosa' },
  { codigo: '07', nombre: 'Sololá' },
  { codigo: '08', nombre: 'Totonicapán' },
  { codigo: '09', nombre: 'Quetzaltenango' },
  { codigo: '10', nombre: 'Suchitepéquez' },
  { codigo: '11', nombre: 'Retalhuleu' },
  { codigo: '12', nombre: 'San Marcos' },
  { codigo: '13', nombre: 'Huehuetenango' },
  { codigo: '14', nombre: 'Quiché' },
  { codigo: '15', nombre: 'Baja Verapaz' },
  { codigo: '16', nombre: 'Alta Verapaz' },
  { codigo: '17', nombre: 'Petén' },
  { codigo: '18', nombre: 'Izabal' },
  { codigo: '19', nombre: 'Zacapa' },
  { codigo: '20', nombre: 'Chiquimula' },
  { codigo: '21', nombre: 'Jalapa' },
  { codigo: '22', nombre: 'Jutiapa' },
]

function munis(departamento: string, filas: [codigo: string, nombre: string][]): MunicipioGt[] {
  return filas.map(([codigo, nombre]) => ({ codigo, nombre, departamento }))
}

export const MUNICIPIOS_GT: MunicipioGt[] = [
  ...munis('01', [
    ['0101', 'Guatemala'], ['0102', 'Santa Catarina Pinula'], ['0103', 'San José Pinula'], ['0104', 'San José del Golfo'],
    ['0105', 'Palencia'], ['0106', 'Chinautla'], ['0107', 'San Pedro Ayampuc'], ['0108', 'Mixco'],
    ['0109', 'San Pedro Sacatepéquez'], ['0110', 'San Juan Sacatepéquez'], ['0111', 'San Raymundo'], ['0112', 'Chuarrancho'],
    ['0113', 'Fraijanes'], ['0114', 'Amatitlán'], ['0115', 'Villa Nueva'], ['0116', 'Villa Canales'], ['0117', 'San Miguel Petapa'],
  ]),
  ...munis('02', [
    ['0201', 'Guastatoya'], ['0202', 'Morazán'], ['0203', 'San Agustín Acasaguastlán'], ['0204', 'San Cristóbal Acasaguastlán'],
    ['0205', 'El Jícaro'], ['0206', 'Sansare'], ['0207', 'Sanarate'], ['0208', 'San Antonio La Paz'],
  ]),
  ...munis('03', [
    ['0301', 'Antigua Guatemala'], ['0302', 'Jocotenango'], ['0303', 'Pastores'], ['0304', 'Sumpango'],
    ['0305', 'Santo Domingo Xenacoj'], ['0306', 'Santiago Sacatepéquez'], ['0307', 'San Bartolomé Milpas Altas'], ['0308', 'San Lucas Sacatepéquez'],
    ['0309', 'Santa Lucía Milpas Altas'], ['0310', 'Magdalena Milpas Altas'], ['0311', 'Santa María de Jesús'], ['0312', 'Ciudad Vieja'],
    ['0313', 'San Miguel Dueñas'], ['0314', 'Alotenango'], ['0315', 'San Antonio Aguas Calientes'], ['0316', 'Santa Catarina Barahona'],
  ]),
  ...munis('04', [
    ['0401', 'Chimaltenango'], ['0402', 'San José Poaquil'], ['0403', 'San Martín Jilotepeque'], ['0404', 'San Juan Comalapa'],
    ['0405', 'Santa Apolonia'], ['0406', 'Tecpán Guatemala'], ['0407', 'Patzún'], ['0408', 'San Miguel Pochuta'],
    ['0409', 'Patzicía'], ['0410', 'Santa Cruz Balanyá'], ['0411', 'Acatenango'], ['0412', 'San Pedro Yepocapa'],
    ['0413', 'San Andrés Itzapa'], ['0414', 'Parramos'], ['0415', 'Zaragoza'], ['0416', 'El Tejar'],
  ]),
  ...munis('05', [
    ['0501', 'Escuintla'], ['0502', 'Santa Lucía Cotzumalguapa'], ['0503', 'La Democracia'], ['0504', 'Siquinalá'],
    ['0505', 'Masagua'], ['0506', 'Tiquisate'], ['0507', 'La Gomera'], ['0508', 'Guanagazapa'],
    ['0509', 'San José'], ['0510', 'Iztapa'], ['0511', 'Palín'], ['0512', 'San Vicente Pacaya'], ['0513', 'Nueva Concepción'],
  ]),
  ...munis('06', [
    ['0601', 'Cuilapa'], ['0602', 'Barberena'], ['0603', 'Santa Rosa de Lima'], ['0604', 'Casillas'],
    ['0605', 'San Rafael las Flores'], ['0606', 'Oratorio'], ['0607', 'San Juan Tecuaco'], ['0608', 'Chiquimulilla'],
    ['0609', 'Taxisco'], ['0610', 'Santa María Ixhuatán'], ['0611', 'Guazacapán'], ['0612', 'Santa Cruz Naranjo'],
    ['0613', 'Pueblo Nuevo Viñas'], ['0614', 'Nueva Santa Rosa'],
  ]),
  ...munis('07', [
    ['0701', 'Sololá'], ['0702', 'San José Chacayá'], ['0703', 'Santa María Visitación'], ['0704', 'Santa Lucía Utatlán'],
    ['0705', 'Nahualá'], ['0706', 'Santa Catarina Ixtahuacán'], ['0707', 'Santa Clara La Laguna'], ['0708', 'Concepción'],
    ['0709', 'San Andrés Semetabaj'], ['0710', 'Panajachel'], ['0711', 'Santa Catarina Palopó'], ['0712', 'San Antonio Palopó'],
    ['0713', 'San Lucas Tolimán'], ['0714', 'Santa Cruz La Laguna'], ['0715', 'San Pablo La Laguna'], ['0716', 'San Marcos La Laguna'],
    ['0717', 'San Juan La Laguna'], ['0718', 'San Pedro La Laguna'], ['0719', 'Santiago Atitlán'],
  ]),
  ...munis('08', [
    ['0801', 'Totonicapán'], ['0802', 'San Cristóbal Totonicapán'], ['0803', 'San Francisco El Alto'], ['0804', 'San Andrés Xecul'],
    ['0805', 'Momostenango'], ['0806', 'Santa María Chiquimula'], ['0807', 'Santa Lucía La Reforma'], ['0808', 'San Bartolo'],
  ]),
  ...munis('09', [
    ['0901', 'Quetzaltenango'], ['0902', 'Salcajá'], ['0903', 'Olintepeque'], ['0904', 'San Carlos Sija'],
    ['0905', 'Sibilia'], ['0906', 'Cabricán'], ['0907', 'Cajolá'], ['0908', 'San Miguel Sigüilá'],
    ['0909', 'San Juan Ostuncalco'], ['0910', 'San Mateo'], ['0911', 'Concepción Chiquirichapa'], ['0912', 'San Martín Sacatepéquez'],
    ['0913', 'Almolonga'], ['0914', 'Cantel'], ['0915', 'Huitán'], ['0916', 'Zunil'],
    ['0917', 'Colomba'], ['0918', 'San Francisco La Unión'], ['0919', 'El Palmar'], ['0920', 'Coatepeque'],
    ['0921', 'Génova'], ['0922', 'Flores Costa Cuca'], ['0923', 'La Esperanza'], ['0924', 'Palestina de Los Altos'],
  ]),
  ...munis('10', [
    ['1001', 'Mazatenango'], ['1002', 'Cuyotenango'], ['1003', 'San Francisco Zapotitlán'], ['1004', 'San Bernardino'],
    ['1005', 'San José El Ídolo'], ['1006', 'Santo Domingo Suchitepéquez'], ['1007', 'San Lorenzo'], ['1008', 'Samayac'],
    ['1009', 'San Pablo Jocopilas'], ['1010', 'San Antonio Suchitepéquez'], ['1011', 'San Miguel Panán'], ['1012', 'San Gabriel'],
    ['1013', 'Chicacao'], ['1014', 'Patulul'], ['1015', 'Santa Bárbara'], ['1016', 'San Juan Bautista'],
    ['1017', 'Santo Tomás La Unión'], ['1018', 'Zunilito'], ['1019', 'Pueblo Nuevo'], ['1020', 'Río Bravo'],
  ]),
  ...munis('11', [
    ['1101', 'Retalhuleu'], ['1102', 'San Sebastián'], ['1103', 'Santa Cruz Muluá'], ['1104', 'San Martín Zapotitlán'],
    ['1105', 'San Felipe'], ['1106', 'San Andrés Villa Seca'], ['1107', 'Champerico'], ['1108', 'Nuevo San Carlos'], ['1109', 'El Asintal'],
  ]),
  ...munis('12', [
    ['1201', 'San Marcos'], ['1202', 'San Pedro Sacatepéquez'], ['1203', 'San Antonio Sacatepéquez'], ['1204', 'Comitancillo'],
    ['1205', 'San Miguel Ixtahuacán'], ['1206', 'Concepción Tutuapa'], ['1207', 'Tacaná'], ['1208', 'Sibinal'],
    ['1209', 'Tajumulco'], ['1210', 'Tejutla'], ['1211', 'San Rafael Pie de la Cuesta'], ['1212', 'Nuevo Progreso'],
    ['1213', 'El Tumbador'], ['1214', 'San José El Rodeo'], ['1215', 'Malacatán'], ['1216', 'Catarina'],
    ['1217', 'Ayutla'], ['1218', 'Ocós'], ['1219', 'San Pablo'], ['1220', 'El Quetzal'],
    ['1221', 'La Reforma'], ['1222', 'Pajapita'], ['1223', 'Ixchiguán'], ['1224', 'San José Ojetenán'],
    ['1225', 'San Cristóbal Cucho'], ['1226', 'Sipacapa'], ['1227', 'Esquipulas Palo Gordo'], ['1228', 'Río Blanco'], ['1229', 'San Lorenzo'],
  ]),
  ...munis('13', [
    ['1301', 'Huehuetenango'], ['1302', 'Chiantla'], ['1303', 'Malacatancito'], ['1304', 'Cuilco'],
    ['1305', 'Nentón'], ['1306', 'San Pedro Necta'], ['1307', 'Jacaltenango'], ['1308', 'San Pedro Soloma'],
    ['1309', 'San Ildefonso Ixtahuacán'], ['1310', 'Santa Bárbara'], ['1311', 'La Libertad'], ['1312', 'La Democracia'],
    ['1313', 'San Miguel Acatán'], ['1314', 'San Rafael La Independencia'], ['1315', 'Todos Santos Cuchumatán'], ['1316', 'San Juan Atitán'],
    ['1317', 'Santa Eulalia'], ['1318', 'San Mateo Ixtatán'], ['1319', 'Colotenango'], ['1320', 'San Sebastián Huehuetenango'],
    ['1321', 'Tectitán'], ['1322', 'Concepción Huista'], ['1323', 'San Juan Ixcoy'], ['1324', 'San Antonio Huista'],
    ['1325', 'San Sebastián Coatán'], ['1326', 'Santa Cruz Barillas'], ['1327', 'Aguacatán'], ['1328', 'San Rafael Petzal'],
    ['1329', 'San Gaspar Ixchil'], ['1330', 'Santiago Chimaltenango'], ['1331', 'Santa Ana Huista'], ['1332', 'Unión Cantinil'],
  ]),
  ...munis('14', [
    ['1401', 'Santa Cruz del Quiché'], ['1402', 'Chiché'], ['1403', 'Chinique'], ['1404', 'Zacualpa'],
    ['1405', 'Chajul'], ['1406', 'Chichicastenango'], ['1407', 'Patzité'], ['1408', 'San Antonio Ilotenango'],
    ['1409', 'San Pedro Jocopilas'], ['1410', 'Cunén'], ['1411', 'San Juan Cotzal'], ['1412', 'Joyabaj'],
    ['1413', 'Nebaj'], ['1414', 'San Andrés Sajcabajá'], ['1415', 'Uspantán'], ['1416', 'Sacapulas'],
    ['1417', 'San Bartolomé Jocotenango'], ['1418', 'Canillá'], ['1419', 'Chicamán'], ['1420', 'Ixcán'], ['1421', 'Pachalum'],
  ]),
  ...munis('15', [
    ['1501', 'Salamá'], ['1502', 'San Miguel Chicaj'], ['1503', 'Rabinal'], ['1504', 'Cubulco'],
    ['1505', 'Granados'], ['1506', 'Santa Cruz El Chol'], ['1507', 'San Jerónimo'], ['1508', 'Purulhá'],
  ]),
  ...munis('16', [
    ['1601', 'Cobán'], ['1602', 'Santa Cruz Verapaz'], ['1603', 'San Cristóbal Verapaz'], ['1604', 'Tactic'],
    ['1605', 'Tamahú'], ['1606', 'Tucurú'], ['1607', 'Panzós'], ['1608', 'Senahú'],
    ['1609', 'San Pedro Carchá'], ['1610', 'San Juan Chamelco'], ['1611', 'Lanquín'], ['1612', 'Cahabón'],
    ['1613', 'Chisec'], ['1614', 'Chahal'], ['1615', 'Fray Bartolomé de las Casas'], ['1616', 'La Tinta'], ['1617', 'Raxruhá'],
  ]),
  ...munis('17', [
    ['1701', 'Flores'], ['1702', 'San José'], ['1703', 'San Benito'], ['1704', 'San Andrés'],
    ['1705', 'La Libertad'], ['1706', 'San Francisco'], ['1707', 'Santa Ana'], ['1708', 'Dolores'],
    ['1709', 'San Luis'], ['1710', 'Sayaxché'], ['1711', 'Melchor de Mencos'], ['1712', 'Poptún'],
  ]),
  ...munis('18', [
    ['1801', 'Puerto Barrios'], ['1802', 'Livingston'], ['1803', 'El Estor'], ['1804', 'Morales'], ['1805', 'Los Amates'],
  ]),
  ...munis('19', [
    ['1901', 'Zacapa'], ['1902', 'Estanzuela'], ['1903', 'Río Hondo'], ['1904', 'Gualán'],
    ['1905', 'Teculután'], ['1906', 'Usumatlán'], ['1907', 'Cabañas'], ['1908', 'San Diego'],
    ['1909', 'La Unión'], ['1910', 'Huité'],
  ]),
  ...munis('20', [
    ['2001', 'Chiquimula'], ['2002', 'San José La Arada'], ['2003', 'San Juan Ermita'], ['2004', 'Jocotán'],
    ['2005', 'Camotán'], ['2006', 'Olopa'], ['2007', 'Esquipulas'], ['2008', 'Concepción Las Minas'],
    ['2009', 'Quezaltepeque'], ['2010', 'San Jacinto'], ['2011', 'Ipala'],
  ]),
  ...munis('21', [
    ['2101', 'Jalapa'], ['2102', 'San Pedro Pinula'], ['2103', 'San Luis Jilotepeque'], ['2104', 'San Manuel Chaparrón'],
    ['2105', 'San Carlos Alzatate'], ['2106', 'Monjas'], ['2107', 'Mataquescuintla'],
  ]),
  ...munis('22', [
    ['2201', 'Jutiapa'], ['2202', 'El Progreso'], ['2203', 'Santa Catarina Mita'], ['2204', 'Agua Blanca'],
    ['2205', 'Asunción Mita'], ['2206', 'Yupiltepeque'], ['2207', 'Atescatempa'], ['2208', 'Jerez'],
    ['2209', 'El Adelanto'], ['2210', 'Zapotitlán'], ['2211', 'Comapa'], ['2212', 'Jalpatagua'],
    ['2213', 'Conguaco'], ['2214', 'Moyuta'], ['2215', 'Pasaco'], ['2216', 'San José Acatempa'], ['2217', 'Quesada'],
  ]),
]

export const DEPARTAMENTOS = DEPARTAMENTOS_GT.map((item) => item.nombre)

export function municipiosDelDepartamento(nombreOCodigo: string): MunicipioGt[] {
  const codigo = DEPARTAMENTOS_GT.find((item) => item.codigo === nombreOCodigo || item.nombre === nombreOCodigo)?.codigo
  if (!codigo) return MUNICIPIOS_GT
  return MUNICIPIOS_GT.filter((item) => item.departamento === codigo)
}

export function lugarDe(departamentoCodigo: string, municipioCodigo: string) {
  const departamento = DEPARTAMENTOS_GT.find((item) => item.codigo === departamentoCodigo)
  const codigoMunicipio = departamentoCodigo.length === 2 ? `${departamentoCodigo}${municipioCodigo.padStart(2, '0')}` : ''
  const municipio = MUNICIPIOS_GT.find((item) => item.codigo === codigoMunicipio)
  return {
    departamento: departamento ? `${departamento.codigo} · ${departamento.nombre}` : departamentoCodigo,
    municipio: municipio ? `${municipio.codigo} · ${municipio.nombre}` : municipioCodigo,
  }
}
