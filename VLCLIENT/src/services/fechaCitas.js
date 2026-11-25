const ahoraMexico = (instante = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return { fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}` };
};

const horarioPasadoMexico = (fecha, hora, instante = new Date()) => {
  const actual = ahoraMexico(instante);
  return fecha < actual.fecha || fecha === actual.fecha && hora <= actual.hora;
};

const inicioDiaMexicoLocal = (instante = new Date()) => {
  const [anio, mes, dia] = ahoraMexico(instante).fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
};

module.exports = { ahoraMexico, horarioPasadoMexico, inicioDiaMexicoLocal };
