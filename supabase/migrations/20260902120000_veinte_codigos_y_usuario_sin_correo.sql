-- Dos pedidos del mismo día, después de ver la primera versión:
--
-- 1) El tope de códigos de barra por producto pasa de 6 a 20. Con las
--    variantes de una misma marca que van al mismo precio (la lista de
--    Quento que mandó tiene más de 20 ítems), 6 se quedaban cortos.
--
-- 2) El alta de colaborador deja de pedir correo: solo usuario y clave.
--    Eso no se resuelve acá —Supabase Auth necesita un email sí o sí—
--    sino en el front, que arma un correo interno a partir del usuario
--    (ver src/modulos/usuarios/consultas/usuario.ts). Queda anotado en
--    esta migración porque es la decisión que explica por qué en
--    auth.users van a aparecer direcciones @marlyn.local que nadie usa.

-- ============================================================
-- Tope: 19 adicionales (20 con el principal)
-- ============================================================
create or replace function public.verificar_tope_codigos_adicionales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.productos_codigos_barras where producto_id = new.producto_id) > 19 then
    raise exception 'Un producto puede tener hasta 20 códigos de barra (1 principal + 19 adicionales)';
  end if;
  return null;
end;
$$;

create or replace function public.guardar_codigos_barras_adicionales(
  p_producto_id uuid,
  p_codigos text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limpios text[];
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para editar el catálogo';
  end if;

  if coalesce(public.auth_rol(), '') <> 'dueño' then
    raise exception 'Solo el dueño puede editar los códigos de barra';
  end if;

  if not exists (select 1 from public.productos where id = p_producto_id) then
    raise exception 'El producto no existe';
  end if;

  -- Sin vacíos y sin repetidos dentro de la misma lista. El distinct va
  -- sobre el valor YA recortado: si no, " 779" y "779" pasan los dos y
  -- después chocan contra el unique al insertar.
  select coalesce(array_agg(distinct trim(codigo)), '{}')
  into v_limpios
  from unnest(coalesce(p_codigos, '{}')) as codigo
  where nullif(trim(codigo), '') is not null;

  if array_length(v_limpios, 1) > 19 then
    raise exception 'Un producto puede tener hasta 19 códigos adicionales';
  end if;

  delete from public.productos_codigos_barras where producto_id = p_producto_id;

  if array_length(v_limpios, 1) > 0 then
    insert into public.productos_codigos_barras (producto_id, codigo)
    select p_producto_id, codigo from unnest(v_limpios) as codigo;
  end if;
end;
$$;
