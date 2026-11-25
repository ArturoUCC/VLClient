-- OPCIONAL: solo en una base PostgreSQL aislada de pruebas.
-- No ejecutar como parte de las migraciones de producción.
BEGIN;
INSERT INTO public.propiedades
  (nombre,direccion,renta_mensual,estado)
VALUES ('Demo 01','Calle Ficticia 1',9500,'disponible')
RETURNING id_propiedad,nombre,estado;
COMMIT;
