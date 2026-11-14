(() => {
  const parametros = new URLSearchParams(window.location.hash.slice(1));
  let token = parametros.get('token');
  // El fragmento vive solo en memoria durante esta visita.
  window.history.replaceState(null, '', window.location.pathname);

  const formulario = document.getElementById('formulario');
  const password = document.getElementById('password');
  const confirmacion = document.getElementById('confirmacion');
  const boton = document.getElementById('enviar');
  const mensaje = document.getElementById('mensaje');

  const mostrar = (texto, tipo = 'error') => {
    mensaje.textContent = texto;
    mensaje.className = `mensaje ${tipo}`;
    mensaje.hidden = false;
  };

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = null;
    formulario.hidden = true;
    mostrar('El enlace es inválido. Solicita uno nuevo desde VLClient.');
    return;
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nuevaPassword = password.value;
    if (nuevaPassword.length < 12 || new TextEncoder().encode(nuevaPassword).length > 72) {
      mostrar('La contraseña debe tener al menos 12 caracteres y no superar 72 bytes.');
      return;
    }
    if (nuevaPassword !== confirmacion.value) {
      mostrar('Las contraseñas no coinciden.');
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Guardando…';
    mensaje.hidden = true;
    try {
      const respuesta = await fetch('/api/auth/restablecer-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nuevaPassword }),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer'
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        mostrar(respuesta.status === 429
          ? 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
          : datos.mensaje || 'No se pudo restablecer la contraseña.');
        return;
      }
      token = null;
      password.value = '';
      confirmacion.value = '';
      formulario.hidden = true;
      mostrar('Contraseña actualizada. Ya puedes iniciar sesión en VLClient.', 'exito');
    } catch (_) {
      mostrar('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      boton.disabled = false;
      boton.textContent = 'Guardar nueva contraseña';
    }
  });
})();
