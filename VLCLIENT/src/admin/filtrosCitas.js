const CAMPOS = ['estado', 'id_inquilino', 'id_propiedad', 'fecha',
  'reagendado_estado'];

const contarFiltrosActivos = (filtros) => CAMPOS.filter((campo) =>
  String(filtros[campo] ?? '').trim() !== '').length;

const parametrosCitas = (filtros, pagina = 1) => {
  const parametros = { pagina: String(pagina), limite: '20' };
  for (const campo of CAMPOS) {
    const valor = String(filtros[campo] ?? '').trim();
    if (valor) parametros[campo] = valor;
  }
  return parametros;
};

const etiquetaInquilino = (item) =>
  `${item.nombre} ${item.apellido} · ${item.propiedad || 'Sin propiedad'} · #${item.id_inquilino}`;

const combinarInquilinos = (actual, nuevos, primeraPagina) => primeraPagina ?
  nuevos : [...actual, ...nuevos.filter((item) => !actual.some((previo) =>
    previo.id_inquilino === item.id_inquilino))];

module.exports = { contarFiltrosActivos, parametrosCitas, etiquetaInquilino,
  combinarInquilinos };
