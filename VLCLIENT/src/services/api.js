const API_URL = "https://vlclient-backend.onrender.com/api";

import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';

// Iniciar sesión
export const loginInquilino = async (correo, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      correo,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.mensaje || 'Error al iniciar sesión');
  }

  return data;
};

// Solicitar un enlace de recuperación sin revelar si el correo está registrado.
export const solicitarRecuperacionPassword = async (correo) => {
  const response = await fetch(`${API_URL}/auth/solicitar-recuperacion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ correo }),
  });

  if (!response.ok) {
    throw new Error('No se pudo enviar la solicitud. Inténtalo más tarde.');
  }
};

// Consultar estado de cuenta
export const obtenerMiEstadoCuenta = async (token) => {
  const response = await fetch(
    `${API_URL}/estados-de-cuenta/mi-cuenta`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'Error al consultar estado de cuenta'
    );
  }

  return data;
};

export const obtenerMiPerfil = async (token) => {
  const response = await fetch(`${API_URL}/perfil/mi-perfil`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.mensaje || 'No se pudo consultar el perfil');
  }

  return data;
};

export const actualizarRecordatorioRenta = async (token, dias) => {
  const response = await fetch(`${API_URL}/perfil/recordatorio-renta`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recordatorio_renta_dias: dias }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.mensaje || 'No se pudo guardar la anticipación');
  }
  return data;
};


export const obtenerMisPagos = async (token) => {
  const response = await fetch(`${API_URL}/pagos/mis-pagos`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudo consultar el historial de pagos'
    );
  }

  return data.pagos || [];
};


export const obtenerMisReportes = async (token) => {
  const response = await fetch(`${API_URL}/reportes/mis-reportes`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudieron consultar los reportes'
    );
  }

  return data.reportes || [];
};


export const crearReporte = async (token, reporte) => {
  const response = await fetch(`${API_URL}/reportes/crear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(reporte),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudo registrar el reporte'
    );
  }

  return data;
};



export const subirFotosReporte = async (
  token,
  idReporte,
  fotografias
) => {
  if (!token) {
    throw new Error('No se encontró una sesión válida.');
  }

  if (!idReporte) {
    throw new Error('No se encontró el identificador del reporte.');
  }

  if (
    !Array.isArray(fotografias) ||
    fotografias.length === 0 ||
    fotografias.length > 5
  ) {
    throw new Error('Selecciona entre 1 y 5 fotografías.');
  }

  const formData = new FormData();

  // Convertir las fotografías al formato compatible con Expo 58
  fotografias.forEach((foto) => {
    const archivo = new File(foto.uri);
    formData.append('fotos', archivo);
  });

  const response = await expoFetch(
    `${API_URL}/reporte-fotos/${idReporte}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudieron subir las fotografías.'
    );
  }

  return data;
};


export const obtenerFotosReporte = async (token, idReporte) => {
  const response = await fetch(
    `${API_URL}/reporte-fotos/${idReporte}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'Error al consultar fotografías'
    );
  }

  return data.fotos || [];
};


export const obtenerMisCitas = async (token) => {
  const response = await fetch(`${API_URL}/citas/mis-citas`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudieron consultar las citas'
    );
  }

  return data.citas || [];
};

export const crearCita = async (token, cita) => {
  const response = await fetch(`${API_URL}/citas/crear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cita),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudo registrar la cita'
    );
  }

  return data;
};

export const reagendarCita = async (token, idCita, solicitud) => {
  const response = await fetch(`${API_URL}/citas/${idCita}/reagendar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(solicitud),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.mensaje || 'No se pudo reagendar la cita');
  }
  return data;
};


export const obtenerMisNotificaciones = async (token) => {
  const response = await fetch(
    `${API_URL}/notificaciones/mis-notificaciones`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudieron consultar las notificaciones'
    );
  }

  return data;
};

export const marcarNotificacionLeida = async (
  token,
  idNotificacion
) => {
  const response = await fetch(
    `${API_URL}/notificaciones/${idNotificacion}/leida`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudo marcar la notificación'
    );
  }

  return data;
};

export const marcarTodasNotificacionesLeidas = async (token) => {
  const response = await fetch(
    `${API_URL}/notificaciones/marcar-todas-leidas`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.mensaje || 'No se pudieron actualizar las notificaciones'
    );
  }

  return data;
};

