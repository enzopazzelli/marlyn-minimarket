-- Backup legible + reimportable (ver README): al reimportar
-- productos/categorias/proveedores el nombre de categoria/proveedor
-- tiene que resolver a un id sin ambigüedad, igual que ya hace
-- importar_catalogo() para altas. Antes de poder agregar esa garantía
-- hay que fusionar los duplicados case-insensitive que ya existan (el
-- catálogo real se cargó por Excel, sin esta restricción todavía).
--
-- Gana el más antiguo (creado_en, con el id como desempate estable);
-- los productos que apuntaban a los perdedores se repuntan al ganador
-- antes de borrarlos, para no dejar ningún producto sin categoria o
-- proveedor por esta fusión.

create temporary table _dedupe_categorias as
select id, first_value(id) over (partition by lower(trim(nombre)) order by creado_en, id) as id_ganador
from public.categorias;

update public.productos p
set categoria_id = d.id_ganador
from _dedupe_categorias d
where p.categoria_id = d.id and d.id <> d.id_ganador;

delete from public.categorias c
using _dedupe_categorias d
where c.id = d.id and d.id <> d.id_ganador;

drop table _dedupe_categorias;

create temporary table _dedupe_proveedores as
select id, first_value(id) over (partition by lower(trim(nombre)) order by creado_en, id) as id_ganador
from public.proveedores;

update public.productos p
set proveedor_id = d.id_ganador
from _dedupe_proveedores d
where p.proveedor_id = d.id and d.id <> d.id_ganador;

delete from public.proveedores pr
using _dedupe_proveedores d
where pr.id = d.id and d.id <> d.id_ganador;

drop table _dedupe_proveedores;

create unique index categorias_nombre_unico on public.categorias (lower(nombre));
create unique index proveedores_nombre_unico on public.proveedores (lower(nombre));
