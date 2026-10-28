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
