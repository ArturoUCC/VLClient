const generarHorarios = () => {
  const opciones = [];
  for (let minutos = 8 * 60; minutos <= 18 * 60; minutos += 30) {
    opciones.push(`${String(Math.floor(minutos / 60)).padStart(2, '0')}:` +
      `${String(minutos % 60).padStart(2, '0')}`);
  }
  return opciones;
};

const horarioHabilitado = (horarios, hora) => horarios.some((item) =>
  item.hora === hora && item.horario_habilitado === true);

module.exports = { generarHorarios, horarioHabilitado };
