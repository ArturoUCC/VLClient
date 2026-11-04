const API_URL = "https://vlclient-backend.onrender.com/api";

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
