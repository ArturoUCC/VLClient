const crearMotorSincronizacion = (dependencias) => {
  let ocupado = false;
  const ejecutar = async (token, idInquilino) => {
    if (!token || !Number.isSafeInteger(Number(idInquilino)) || Number(idInquilino) <= 0) {
      return { estado: 'sin_sesion', enviados: 0 };
    }
    if (ocupado) return { estado: 'en_curso', enviados: 0 };
    ocupado = true;
    let enviados = 0;
    try {
      await dependencias.recuperarSincronizaciones(idInquilino);
      const red = await dependencias.estadoRed();
      if (red.isConnected === false || red.isInternetReachable === false ||
          !(await dependencias.backendDisponible(token))) {
        return { estado: 'sin_conexion', enviados };
      }
      try {
        const propietario = await dependencias.verificarPropietario(token);
        if (Number(propietario) !== Number(idInquilino)) {
          return { estado: 'otra_cuenta', enviados };
        }
      } catch (error) {
        if (error?.name === 'SesionExpiradaError' || error?.status === 401) {
          return { estado: 'sesion_vencida', enviados };
        }
        return { estado: 'sin_conexion', enviados };
      }
      const borradores = await dependencias.listarBorradores(idInquilino);
      for (const candidato of borradores) {
        if (candidato.estado !== 'pendiente_sincronizacion') continue;
        const borrador = await dependencias.reclamarBorrador(candidato.id, idInquilino);
        if (!borrador) continue;
        dependencias.notificar?.();
        try {
          if (dependencias.fotosFaltantes(borrador.fotos).length) {
            throw Object.assign(new Error('Falta una fotografía local'), { status: 400 });
          }
          // Persistir las claves antes de cualquier petición. Un reinicio
          // conserva exactamente los mismos identificadores de cada foto.
          const fotos = borrador.fotos.map((foto) => ({
            ...foto, clave_idempotencia: foto.clave_idempotencia || dependencias.nuevaClave(),
          }));
          await dependencias.guardarProgreso(borrador.id, idInquilino, { fotos });
          let idReporte = borrador.id_reporte;
          if (!idReporte) {
            const resultado = await dependencias.crearReporte(token, {
              titulo: borrador.titulo.trim(),
              descripcion: borrador.descripcion.trim(),
              categoria: borrador.categoria,
              clave_idempotencia: borrador.id,
            });
            idReporte = resultado.reporte.id_reporte;
            if (!Number.isSafeInteger(Number(idReporte)) || Number(idReporte) <= 0) {
              throw new Error('Respuesta de reporte incompleta');
            }
            await dependencias.guardarProgreso(borrador.id, idInquilino,
              { id_reporte: idReporte, fotos });
            dependencias.notificar?.();
          }
          for (let i = 0; i < fotos.length; i++) {
            if (fotos[i].enviada) continue;
            const resultado = await dependencias.subirFotoReporteIdempotente(
              token, idReporte, fotos[i]
            );
            fotos[i] = { ...fotos[i], enviada: true,
              id_foto: resultado.foto.id_foto };
            await dependencias.guardarProgreso(borrador.id, idInquilino,
              { id_reporte: idReporte, fotos });
            dependencias.notificar?.();
          }
          await dependencias.guardarProgreso(borrador.id, idInquilino,
            { id_reporte: idReporte, fotos, estado: 'enviado' });
          enviados++;
          dependencias.notificar?.();
        } catch (error) {
          const sesionVencida = error?.name === 'SesionExpiradaError' || error?.status === 401;
          const redInterrumpida = error?.name === 'TypeError' ||
            error?.message === 'Network request failed';
          const estado = sesionVencida || redInterrumpida
            ? 'pendiente_sincronizacion'
            : [400, 409].includes(error?.status) ? 'error' : 'error_reintentar';
          await dependencias.cambiarEstadoBorrador(borrador.id, idInquilino,
            'sincronizando_idempotente', estado);
          dependencias.notificar?.();
          if (sesionVencida) return { estado: 'sesion_vencida', enviados };
          if (redInterrumpida) return { estado: 'sin_conexion', enviados };
        }
      }
      return { estado: 'completado', enviados };
    } finally {
      ocupado = false;
    }
  };
  return { ejecutar };
};

module.exports = { crearMotorSincronizacion };
