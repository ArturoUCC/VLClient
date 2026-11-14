const idValido = (valor) => Number.isSafeInteger(Number(valor)) && Number(valor) > 0;

const crearConciliadorCitasBorradores = ({ obtenerMiPerfil, obtenerMisCitas,
  retirarBorradorConCita }) => {
  const propietario = async (token, idInquilinoEsperado) => {
    if (!token) throw new Error('Se requiere una sesión válida');
    const perfil = await obtenerMiPerfil(token);
    const idInquilino = perfil?.id_inquilino;
    if (!idValido(idInquilino) || (idInquilinoEsperado != null &&
        Number(idInquilino) !== Number(idInquilinoEsperado))) {
      throw new Error('La sesión no corresponde al propietario del borrador');
    }
    return Number(idInquilino);
  };

  const confirmar = async (token, idReporte, cita) => {
    if (!idValido(idReporte) || !idValido(cita?.id_cita) ||
        Number(cita.id_reporte) !== Number(idReporte)) {
      throw new Error('La cita confirmada no corresponde al reporte');
    }
    const idInquilino = await propietario(token);
    return retirarBorradorConCita(idReporte, idInquilino);
  };

  const conciliar = async (token, idInquilinoEsperado) => {
    const idInquilino = await propietario(token, idInquilinoEsperado);
    const citas = await obtenerMisCitas(token);
    if (!Array.isArray(citas)) throw new Error('Respuesta de citas inválida');
    let retirados = 0;
    const reportes = new Set();
    for (const cita of citas) {
      if (!idValido(cita?.id_cita) || !idValido(cita?.id_reporte)) continue;
      const idReporte = Number(cita.id_reporte);
      if (reportes.has(idReporte)) continue;
      reportes.add(idReporte);
      retirados += await retirarBorradorConCita(idReporte, idInquilino);
    }
    return retirados;
  };

  return { confirmar, conciliar };
};

module.exports = { crearConciliadorCitasBorradores };
