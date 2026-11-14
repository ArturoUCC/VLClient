const ENVIO_URL = 'https://exp.host/--/api/v2/push/send';
const RECIBOS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const TIMEOUT_MS = 15000;

class ExpoPushError extends Error {
  constructor(tipo) {
    super('Falló la comunicación con Expo Push Service');
    this.tipo = tipo;
  }
}

const solicitarExpo = async (url, body, { fetchImpl = fetch, accessToken = process.env.EXPO_ACCESS_TOKEN } = {}) => {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error',
    });
  } catch (_) {
    // El servidor pudo recibir la solicitud antes del corte: no reenvíe.
    throw new ExpoPushError('ambiguo');
  }

  if (response.status === 429) throw new ExpoPushError('reintentar');
  if (response.status >= 500) throw new ExpoPushError('ambiguo');
  if (!response.ok) throw new ExpoPushError('permanente');

  try {
    const contenido = await response.json();
    if (!contenido || contenido.errors || !contenido.data) {
      throw new Error('Respuesta incompleta');
    }
    return contenido.data;
  } catch (_) {
    throw new ExpoPushError('ambiguo');
  }
};

const enviarLoteExpo = async (mensajes, opciones) => {
  if (!Array.isArray(mensajes) || mensajes.length < 1 || mensajes.length > 100) {
    throw new Error('Lote push inválido');
  }
  const tickets = await solicitarExpo(ENVIO_URL, mensajes, opciones);
  if (!Array.isArray(tickets) || tickets.length !== mensajes.length) {
    throw new ExpoPushError('ambiguo');
  }
  return tickets;
};

const consultarRecibosExpo = async (ids, opciones) => {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 1000) {
    throw new Error('Lote de recibos inválido');
  }
  const recibos = await solicitarExpo(RECIBOS_URL, { ids }, opciones);
  if (!recibos || typeof recibos !== 'object' || Array.isArray(recibos)) {
    throw new ExpoPushError('ambiguo');
  }
  return recibos;
};

module.exports = { enviarLoteExpo, consultarRecibosExpo, ExpoPushError };
