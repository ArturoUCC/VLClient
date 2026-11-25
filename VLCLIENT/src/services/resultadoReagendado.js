// Clasifica una lectura autenticada posterior a una respuesta HTTP perdida.
// Nunca infiere éxito solo porque el POST se haya enviado.
const evaluarResultadoReagendado = (citas, idCita, fecha, hora) => {
  if (!Array.isArray(citas)) return { estado: 'sin_confirmacion' };
  const cita = citas.find((item) => Number(item?.id_cita) === Number(idCita));
  if (!cita) return { estado: 'sin_confirmacion' };

  if (cita.reagendado_estado === 'utilizado' && cita.reagendado_usado_at) {
    const mismoHorario = String(cita.fecha_cita).slice(0, 10) === fecha &&
      String(cita.hora_cita).slice(0, 5) === hora;
    return { estado: mismoHorario && cita.estado === 'programada'
      ? 'confirmado' : 'oportunidad_utilizada', cita };
  }

  if (cita.reagendado_estado === 'solicitado' && !cita.reagendado_usado_at &&
      ['programada', 'confirmada'].includes(cita.estado)) {
    return { estado: 'todavia_solicitado', cita };
  }

  return { estado: 'no_disponible', cita };
};

module.exports = { evaluarResultadoReagendado };
