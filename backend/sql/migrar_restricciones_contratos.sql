-- PREPARADO, NO EJECUTADO. Ejecutar tras diagnosticar_actualizacion.sql.
-- Conserva todos los contratos y correos existentes; aborta si hay conflictos.
BEGIN;

-- Evita que cambien los conjuntos comprobados mientras se crean los índices.
LOCK TABLE public.contratos, public.inquilinos IN SHARE ROW EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.contratos WHERE estado='activo'
    GROUP BY id_propiedad HAVING COUNT(*)>1) THEN
    RAISE EXCEPTION 'Propiedades con varios contratos activos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inquilinos
    GROUP BY lower(correo) HAVING COUNT(*)>1) THEN
    RAISE EXCEPTION 'Correos de inquilinos duplicados sin distinguir mayúsculas';
  END IF;
END $$;

CREATE UNIQUE INDEX contratos_propiedad_activa_uidx
  ON public.contratos(id_propiedad) WHERE estado='activo';
CREATE UNIQUE INDEX inquilinos_correo_normalizado_uidx
  ON public.inquilinos(lower(correo));

COMMIT;
