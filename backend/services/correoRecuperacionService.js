const enviarRecuperacion = async (destinatario, token) => {
  const { RESEND_API_KEY, RECOVERY_MAIL_FROM, RECOVERY_PUBLIC_URL } = process.env;
  if (!RESEND_API_KEY || !RECOVERY_MAIL_FROM || !RECOVERY_PUBLIC_URL) {
    throw new Error('Configuración de correo incompleta');
  }
  const enlace = new URL(RECOVERY_PUBLIC_URL);
  if (enlace.toString() !== 'https://vlclient-backend.onrender.com/recuperar-password') {
    throw new Error('URL pública de recuperación inválida');
  }
  // El fragmento no se envía en la petición HTTP que abre la página.
  enlace.hash = new URLSearchParams({ token }).toString();

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RECOVERY_MAIL_FROM,
      to: [destinatario],
      subject: 'Restablece tu contraseña de VLClient',
      text: `Solicitaste restablecer tu contraseña. Abre este enlace dentro de 30 minutos: ${enlace.toString()}\n\nSi no lo solicitaste, ignora este correo.`
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!respuesta.ok) {
    throw new Error('El proveedor de correo rechazó el envío');
  }
};

module.exports = { enviarRecuperacion };
