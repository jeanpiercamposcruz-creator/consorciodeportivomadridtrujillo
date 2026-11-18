Begin;
--
-- PostgreSQL database dump
--



-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--




--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: bump(); Type: FUNCTION; Schema: public; Owner: -
--


CREATE OR REPLACE FUNCTION public.bump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    UPDATE public.erp_meta
    SET ver = ver + 1
    WHERE id = 1;
    RETURN NULL;
END;
$function$;



--
-- Name: carnet_publico(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.carnet_publico(t text) RETURNS TABLE(codigo text, nombres text, apellidos text, categoria integer, deporte text, sede text, estado text, foto text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  select a.id, a.nombres, a.apellidos, extract(year from a.fecha_nacimiento)::int, d.nombre, s.nombre, a.estado, a.foto
  from public.alumnos a left join public.deportes d on d.id=a.deporte_id left join public.sedes s on s.id=a.sede_id
  where length(t)=16 and a.qr_token=t $$;


--
-- Name: mi_personal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mi_personal() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$ select personal_id from public.perfiles where user_id=auth.uid() $$;


--
-- Name: mis_horarios(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mis_horarios() RETURNS SETOF text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
   AS $$ select horario_id from public.horario_profesores where personal_id=public.mi_personal() $$;


--
-- Name: rol_actual(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rol_actual() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$ select rol from public.perfiles where user_id=auth.uid() $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ajustes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ajustes (
    id text NOT NULL,
    valor jsonb
);


--
-- Name: alumnos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alumnos (
    id text NOT NULL,
    nombres text,
    apellidos text,
    dni text,
    sexo text,
    fecha_nacimiento date,
    deporte_id text,
    sede_id text,
    horario_id text,
    foto text,
    seguro text,
    apoderado text,
    celular_apoderado text,
    correo_apoderado text,
    condicion text,
    modalidad text,
    estado text,
    costo_matricula numeric,
    costo_mensualidad numeric,
    meses integer,
    monto_pagado numeric,
    fecha_registro date,
    qr_token text,
    doc_dni_frente text,
    doc_dni_reverso text,
    doc_seguro text,
    doc_ficha text,
    CONSTRAINT chk_dni_valido CHECK (((dni ~ '^\d{8}$'::text) OR (dni = ''::text))),
    CONSTRAINT chk_nombres_validos CHECK ((nombres ~ '^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\.\''\-]{2,60}$'::text))
);


--
-- Name: alumnos_anterior; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alumnos_anterior (
    id text NOT NULL,
    nom text NOT NULL,
    ape text NOT NULL,
    dni text,
    sex text DEFAULT 'M'::text,
    nac date NOT NULL,
    dep text,
    sede text,
    hor text,
    foto text,
    seg text,
    an text,
    ac text,
    am text,
    con text DEFAULT 'Ninguna'::text,
    mod text DEFAULT 'Formativo'::text,
    est text DEFAULT 'Activo'::text,
    cm numeric DEFAULT 0,
    cmen numeric DEFAULT 0,
    mes integer DEFAULT 1,
    pag numeric DEFAULT 0,
    fecha date DEFAULT CURRENT_DATE
);


--
-- Name: asistencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asistencias (
    id text NOT NULL,
    fecha date,
    tipo text,
    alumno_id text,
    personal_id text,
    horario_id text,
    asistio boolean,
    pago_campo boolean,
    CONSTRAINT asistencias_tipo_check CHECK ((tipo = ANY (ARRAY['A'::text, 'P'::text])))
);


--
-- Name: asistencias_anterior; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asistencias_anterior (
    id bigint NOT NULL,
    f date DEFAULT CURRENT_DATE,
    t text NOT NULL,
    ref text NOT NULL,
    h text,
    ok boolean,
    pc boolean
);


--
-- Name: asistencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asistencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asistencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asistencias_id_seq OWNED BY public.asistencias_anterior.id;


--
-- Name: caja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caja (
    id bigint NOT NULL,
    f date DEFAULT CURRENT_DATE,
    sede text,
    t text NOT NULL,
    c text NOT NULL,
    d text,
    m numeric DEFAULT 0,
    k text
);


--
-- Name: caja_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caja_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caja_id_seq OWNED BY public.caja.id;


--
-- Name: caja_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caja_movimientos (
    id text NOT NULL,
    fecha date,
    sede_id text,
    tipo text,
    concepto text,
    detalle text,
    monto numeric,
    origen text,
    CONSTRAINT caja_movimientos_tipo_check CHECK ((tipo = ANY (ARRAY['I'::text, 'E'::text])))
);


--
-- Name: deportes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deportes (
    id text NOT NULL,
    nombre text NOT NULL
);


--
-- Name: sedes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sedes (
    id text NOT NULL,
    nombre text NOT NULL,
    direccion text,
    contacto text,
    tipo_alquiler text,
    costo_mensual numeric DEFAULT 0
);


--
-- Name: catalogo_publico; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.catalogo_publico
WITH (security_invoker = true) AS
 SELECT 'S'::text AS tipo,
    sedes.id,
    sedes.nombre
   FROM public.sedes
UNION ALL
 SELECT 'D'::text AS tipo,
    deportes.id,
    deportes.nombre
   FROM public.deportes;


--
-- Name: deportes_anterior; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deportes_anterior (
    id text NOT NULL,
    nombre text NOT NULL
);


--
-- Name: erp_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_meta (
    id integer NOT NULL,
    ver integer DEFAULT 0 NOT NULL
);


--
-- Name: erp_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_state (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    ver integer DEFAULT 0 NOT NULL
);


--
-- Name: horario_profesores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horario_profesores (
    id text NOT NULL,
    horario_id text NOT NULL,
    personal_id text NOT NULL
);


--
-- Name: horarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios (
    id text NOT NULL,
    sede_id text NOT NULL,
    deporte_id text NOT NULL,
    categoria integer NOT NULL,
    hora_inicio text,
    hora_fin text
);


--
-- Name: horarios_anterior; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios_anterior (
    id text NOT NULL,
    sede text,
    dep text,
    cat integer NOT NULL,
    ini text NOT NULL,
    fin text NOT NULL,
    profs jsonb DEFAULT '[]'::jsonb
);


--
-- Name: kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kits (
    id bigint NOT NULL,
    code text NOT NULL,
    aid text,
    al text,
    sede text,
    p text,
    t text,
    n text,
    u integer,
    f date DEFAULT CURRENT_DATE,
    e date,
    pr numeric DEFAULT 0,
    c numeric DEFAULT 0
);


--
-- Name: kits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kits_id_seq OWNED BY public.kits.id;


--
-- Name: kits_ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kits_ventas (
    id text NOT NULL,
    codigo text,
    alumno_id text,
    alumno_nombre text,
    sede_id text,
    prenda text,
    talla text,
    nombre_camiseta text,
    numero text,
    fecha_pedido date,
    fecha_entrega date,
    precio_publico numeric,
    costo_confeccion numeric
);


--
-- Name: perfiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfiles (
    user_id uuid NOT NULL,
    rol text NOT NULL,
    personal_id text,
    CONSTRAINT perfiles_rol_check CHECK ((rol = ANY (ARRAY['ADM'::text, 'REC'::text, 'ENT'::text])))
);


--
-- Name: personal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal (
    id text NOT NULL,
    nombres text NOT NULL,
    dni text,
    telefono text,
    especialidad text,
    rol text,
    precio_hora numeric DEFAULT 0,
    activo smallint DEFAULT 1,
    CONSTRAINT personal_rol_check CHECK ((rol = ANY (ARRAY['ADM'::text, 'REC'::text, 'ENT'::text])))
);


--
-- Name: personal_anterior; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_anterior (
    id text NOT NULL,
    nom text NOT NULL,
    dni text,
    tel text,
    esp text,
    rol text NOT NULL,
    precio numeric DEFAULT 0,
    activo integer DEFAULT 1
);


--
-- Name: preregistros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preregistros (
    id text NOT NULL,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    modalidad text NOT NULL,
    nombres text NOT NULL,
    apellidos text NOT NULL,
    dni text,
    sexo text,
    fecha_nacimiento date,
    deporte_id text,
    sede_id text,
    apoderado text,
    celular_apoderado text,
    correo_apoderado text,
    seguro text,
    foto text,
    doc_dni_frente text,
    doc_seguro text,
    doc_ficha text,
    CONSTRAINT preregistros_apellidos_check CHECK ((length(apellidos) <= 60)),
    CONSTRAINT preregistros_apoderado_check CHECK ((length(apoderado) <= 80)),
    CONSTRAINT preregistros_celular_apoderado_check CHECK ((celular_apoderado ~ '^\d{1,9}$'::text)),
    CONSTRAINT preregistros_correo_apoderado_check CHECK ((length(correo_apoderado) <= 120)),
    CONSTRAINT preregistros_dni_check CHECK ((dni ~ '^\d{8}$'::text)),
    CONSTRAINT preregistros_modalidad_check CHECK ((modalidad = ANY (ARRAY['Presencial'::text, 'Virtual'::text]))),
    CONSTRAINT preregistros_nombres_check CHECK ((length(nombres) <= 60)),
    CONSTRAINT preregistros_rutas_chk CHECK ((((doc_dni_frente IS NULL) OR (doc_dni_frente ~ '^preregistro/[a-z0-9]+/dni-[0-9]+\.(jpg|png|pdf)$'::text)) AND ((doc_seguro IS NULL) OR (doc_seguro ~ '^preregistro/[a-z0-9]+/seguro-[0-9]+\.(jpg|png|pdf)$'::text)) AND ((doc_ficha IS NULL) OR (doc_ficha ~ '^preregistro/[a-z0-9]+/ficha-[0-9]+\.(jpg|png|pdf)$'::text)) AND ((foto IS NULL) OR ((foto ~ '^data:image/(jpeg|png);base64,'::text) AND (length(foto) < 200000))))),
    CONSTRAINT preregistros_seguro_check CHECK ((length(seguro) <= 60)),
    CONSTRAINT preregistros_sexo_check CHECK ((sexo = ANY (ARRAY['M'::text, 'F'::text])))
);


--
-- Name: sedes_anterior; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sedes_anterior (
    id text NOT NULL,
    nombre text NOT NULL,
    dir text,
    con text,
    tipo text DEFAULT 'Mensual'::text,
    costo numeric DEFAULT 0
);


--
-- Name: asistencias_anterior id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_anterior ALTER COLUMN id SET DEFAULT nextval('public.asistencias_id_seq'::regclass);


--
-- Name: caja id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja ALTER COLUMN id SET DEFAULT nextval('public.caja_id_seq'::regclass);


--
-- Name: kits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kits ALTER COLUMN id SET DEFAULT nextval('public.kits_id_seq'::regclass);


--
-- Name: ajustes ajustes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ajustes
    ADD CONSTRAINT ajustes_pkey PRIMARY KEY (id);


--
-- Name: alumnos_anterior alumnos_dni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos_anterior
    ADD CONSTRAINT alumnos_dni_key UNIQUE (dni);


--
-- Name: alumnos_anterior alumnos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos_anterior
    ADD CONSTRAINT alumnos_pkey PRIMARY KEY (id);


--
-- Name: alumnos alumnos_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_pkey1 PRIMARY KEY (id);


--
-- Name: alumnos alumnos_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_qr_token_key UNIQUE (qr_token);


--
-- Name: asistencias_anterior asistencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_anterior
    ADD CONSTRAINT asistencias_pkey PRIMARY KEY (id);


--
-- Name: asistencias asistencias_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_pkey1 PRIMARY KEY (id);


--
-- Name: caja caja_k_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja
    ADD CONSTRAINT caja_k_key UNIQUE (k);


--
-- Name: caja_movimientos caja_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_movimientos
    ADD CONSTRAINT caja_movimientos_pkey PRIMARY KEY (id);


--
-- Name: caja caja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja
    ADD CONSTRAINT caja_pkey PRIMARY KEY (id);


--
-- Name: deportes_anterior deportes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deportes_anterior
    ADD CONSTRAINT deportes_pkey PRIMARY KEY (id);


--
-- Name: deportes deportes_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deportes
    ADD CONSTRAINT deportes_pkey1 PRIMARY KEY (id);


--
-- Name: erp_meta erp_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_meta
    ADD CONSTRAINT erp_meta_pkey PRIMARY KEY (id);


--
-- Name: erp_state erp_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_state
    ADD CONSTRAINT erp_state_pkey PRIMARY KEY (id);


--
-- Name: horario_profesores horario_profesores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_profesores
    ADD CONSTRAINT horario_profesores_pkey PRIMARY KEY (id);


--
-- Name: horarios_anterior horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_anterior
    ADD CONSTRAINT horarios_pkey PRIMARY KEY (id);


--
-- Name: horarios horarios_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_pkey1 PRIMARY KEY (id);


--
-- Name: kits kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kits
    ADD CONSTRAINT kits_pkey PRIMARY KEY (id);


--
-- Name: kits_ventas kits_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kits_ventas
    ADD CONSTRAINT kits_ventas_pkey PRIMARY KEY (id);


--
-- Name: perfiles perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_pkey PRIMARY KEY (user_id);


--
-- Name: personal_anterior personal_dni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_anterior
    ADD CONSTRAINT personal_dni_key UNIQUE (dni);


--
-- Name: personal personal_dni_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_dni_key1 UNIQUE (dni);


--
-- Name: personal_anterior personal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_anterior
    ADD CONSTRAINT personal_pkey PRIMARY KEY (id);


--
-- Name: personal personal_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_pkey1 PRIMARY KEY (id);


--
-- Name: preregistros preregistros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preregistros
    ADD CONSTRAINT preregistros_pkey PRIMARY KEY (id);


--
-- Name: sedes_anterior sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sedes_anterior
    ADD CONSTRAINT sedes_pkey PRIMARY KEY (id);


--
-- Name: sedes sedes_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_pkey1 PRIMARY KEY (id);


--
-- Name: ajustes bump_ajustes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_ajustes AFTER INSERT OR DELETE OR UPDATE ON public.ajustes FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: alumnos bump_alumnos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_alumnos AFTER INSERT OR DELETE OR UPDATE ON public.alumnos FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: asistencias bump_asistencias; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_asistencias AFTER INSERT OR DELETE OR UPDATE ON public.asistencias FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: caja_movimientos bump_caja_movimientos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_caja_movimientos AFTER INSERT OR DELETE OR UPDATE ON public.caja_movimientos FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: deportes bump_deportes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_deportes AFTER INSERT OR DELETE OR UPDATE ON public.deportes FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: horario_profesores bump_horario_profesores; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_horario_profesores AFTER INSERT OR DELETE OR UPDATE ON public.horario_profesores FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: horarios bump_horarios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_horarios AFTER INSERT OR DELETE OR UPDATE ON public.horarios FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: kits_ventas bump_kits_ventas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_kits_ventas AFTER INSERT OR DELETE OR UPDATE ON public.kits_ventas FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: personal bump_personal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_personal AFTER INSERT OR DELETE OR UPDATE ON public.personal FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: sedes bump_sedes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_sedes AFTER INSERT OR DELETE OR UPDATE ON public.sedes FOR EACH STATEMENT EXECUTE FUNCTION public.bump();


--
-- Name: alumnos_anterior alumnos_dep_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos_anterior
    ADD CONSTRAINT alumnos_dep_fkey FOREIGN KEY (dep) REFERENCES public.deportes_anterior(id);


--
-- Name: alumnos alumnos_deporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_deporte_id_fkey FOREIGN KEY (deporte_id) REFERENCES public.deportes(id);


--
-- Name: alumnos_anterior alumnos_hor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos_anterior
    ADD CONSTRAINT alumnos_hor_fkey FOREIGN KEY (hor) REFERENCES public.horarios_anterior(id);


--
-- Name: alumnos alumnos_horario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_horario_id_fkey FOREIGN KEY (horario_id) REFERENCES public.horarios(id);


--
-- Name: alumnos_anterior alumnos_sede_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos_anterior
    ADD CONSTRAINT alumnos_sede_fkey FOREIGN KEY (sede) REFERENCES public.sedes_anterior(id);


--
-- Name: alumnos alumnos_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: asistencias asistencias_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id);


--
-- Name: asistencias_anterior asistencias_h_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_anterior
    ADD CONSTRAINT asistencias_h_fkey FOREIGN KEY (h) REFERENCES public.horarios_anterior(id);


--
-- Name: asistencias asistencias_horario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_horario_id_fkey FOREIGN KEY (horario_id) REFERENCES public.horarios(id);


--
-- Name: asistencias asistencias_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id);


--
-- Name: caja_movimientos caja_movimientos_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_movimientos
    ADD CONSTRAINT caja_movimientos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: caja caja_sede_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja
    ADD CONSTRAINT caja_sede_fkey FOREIGN KEY (sede) REFERENCES public.sedes_anterior(id) ON DELETE CASCADE;


--
-- Name: horario_profesores horario_profesores_horario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_profesores
    ADD CONSTRAINT horario_profesores_horario_id_fkey FOREIGN KEY (horario_id) REFERENCES public.horarios(id) ON DELETE CASCADE;


--
-- Name: horario_profesores horario_profesores_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_profesores
    ADD CONSTRAINT horario_profesores_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id);


--
-- Name: horarios_anterior horarios_dep_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_anterior
    ADD CONSTRAINT horarios_dep_fkey FOREIGN KEY (dep) REFERENCES public.deportes_anterior(id) ON DELETE CASCADE;


--
-- Name: horarios horarios_deporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_deporte_id_fkey FOREIGN KEY (deporte_id) REFERENCES public.deportes(id);


--
-- Name: horarios_anterior horarios_sede_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_anterior
    ADD CONSTRAINT horarios_sede_fkey FOREIGN KEY (sede) REFERENCES public.sedes_anterior(id) ON DELETE CASCADE;


--
-- Name: horarios horarios_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: kits kits_aid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kits
    ADD CONSTRAINT kits_aid_fkey FOREIGN KEY (aid) REFERENCES public.alumnos_anterior(id);


--
-- Name: kits kits_sede_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kits
    ADD CONSTRAINT kits_sede_fkey FOREIGN KEY (sede) REFERENCES public.sedes_anterior(id);


--
-- Name: kits_ventas kits_ventas_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kits_ventas
    ADD CONSTRAINT kits_ventas_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id);


--
-- Name: kits_ventas kits_ventas_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kits_ventas
    ADD CONSTRAINT kits_ventas_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: perfiles perfiles_personal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id);


--
-- Name: perfiles perfiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: preregistros preregistros_deporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preregistros
    ADD CONSTRAINT preregistros_deporte_id_fkey FOREIGN KEY (deporte_id) REFERENCES public.deportes(id);


--
-- Name: preregistros preregistros_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preregistros
    ADD CONSTRAINT preregistros_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: caja_movimientos acc_caja_movimientos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY acc_caja_movimientos ON public.caja_movimientos TO authenticated USING ((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text]))) WITH CHECK ((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text])));


--
-- Name: kits_ventas acc_kits_ventas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY acc_kits_ventas ON public.kits_ventas TO authenticated USING ((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text]))) WITH CHECK ((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text])));


--
-- Name: ajustes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ajustes ENABLE ROW LEVEL SECURITY;

--
-- Name: alumnos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;

--
-- Name: alumnos_anterior; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alumnos_anterior ENABLE ROW LEVEL SECURITY;

--
-- Name: asistencias asis_adm_rec; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asis_adm_rec ON public.asistencias TO authenticated USING ((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text]))) WITH CHECK ((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text])));


--
-- Name: asistencias asis_ent; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asis_ent ON public.asistencias TO authenticated USING (((public.rol_actual() = 'ENT'::text) AND (horario_id IN ( SELECT public.mis_horarios() AS mis_horarios)))) WITH CHECK (((public.rol_actual() = 'ENT'::text) AND (horario_id IN ( SELECT public.mis_horarios() AS mis_horarios))));


--
-- Name: asistencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;

--
-- Name: asistencias_anterior; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asistencias_anterior ENABLE ROW LEVEL SECURITY;

--
-- Name: caja; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caja ENABLE ROW LEVEL SECURITY;

--
-- Name: caja_movimientos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caja_movimientos ENABLE ROW LEVEL SECURITY;

--
-- Name: deportes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deportes ENABLE ROW LEVEL SECURITY;

--
-- Name: deportes_anterior; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deportes_anterior ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_state ENABLE ROW LEVEL SECURITY;

--
-- Name: ajustes esc_ajustes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esc_ajustes ON public.ajustes TO authenticated USING ((public.rol_actual() = 'ADM'::text)) WITH CHECK ((public.rol_actual() = 'ADM'::text));


--
-- Name: alumnos esc_alumnos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esc_alumnos ON public.alumnos TO authenticated USING ((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text]))) WITH CHECK ((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text])));


--
-- Name: deportes esc_deportes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esc_deportes ON public.deportes TO authenticated USING ((public.rol_actual() = 'ADM'::text)) WITH CHECK ((public.rol_actual() = 'ADM'::text));


--
-- Name: horario_profesores esc_horario_profesores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esc_horario_profesores ON public.horario_profesores TO authenticated USING ((public.rol_actual() = 'ADM'::text)) WITH CHECK ((public.rol_actual() = 'ADM'::text));


--
-- Name: horarios esc_horarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esc_horarios ON public.horarios TO authenticated USING ((public.rol_actual() = 'ADM'::text)) WITH CHECK ((public.rol_actual() = 'ADM'::text));


--
-- Name: personal esc_personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esc_personal ON public.personal TO authenticated USING ((public.rol_actual() = 'ADM'::text)) WITH CHECK ((public.rol_actual() = 'ADM'::text));


--
-- Name: sedes esc_sedes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esc_sedes ON public.sedes TO authenticated USING ((public.rol_actual() = 'ADM'::text)) WITH CHECK ((public.rol_actual() = 'ADM'::text));


--
-- Name: horario_profesores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horario_profesores ENABLE ROW LEVEL SECURITY;

--
-- Name: horarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

--
-- Name: horarios_anterior; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horarios_anterior ENABLE ROW LEVEL SECURITY;

--
-- Name: kits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;

--
-- Name: kits_ventas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kits_ventas ENABLE ROW LEVEL SECURITY;

--
-- Name: ajustes lee_ajustes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lee_ajustes ON public.ajustes FOR SELECT TO authenticated USING ((public.rol_actual() IS NOT NULL));


--
-- Name: alumnos lee_alumnos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lee_alumnos ON public.alumnos FOR SELECT TO authenticated USING (((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text])) OR (horario_id IN ( SELECT public.mis_horarios() AS mis_horarios))));


--
-- Name: deportes lee_deportes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lee_deportes ON public.deportes FOR SELECT TO authenticated USING ((public.rol_actual() IS NOT NULL));


--
-- Name: horario_profesores lee_horario_profesores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lee_horario_profesores ON public.horario_profesores FOR SELECT TO authenticated USING ((public.rol_actual() IS NOT NULL));


--
-- Name: horarios lee_horarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lee_horarios ON public.horarios FOR SELECT TO authenticated USING (((public.rol_actual() = ANY (ARRAY['ADM'::text, 'REC'::text])) OR (id IN ( SELECT public.mis_horarios() AS mis_horarios))));


--
-- Name: erp_meta lee_meta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lee_meta ON public.erp_meta FOR SELECT TO authenticated USING ((public.rol_actual() IS NOT NULL));


--
-- Name: personal lee_personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lee_personal ON public.personal FOR SELECT TO authenticated USING ((public.rol_actual() IS NOT NULL));


--
-- Name: sedes lee_sedes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lee_sedes ON public.sedes FOR SELECT TO authenticated USING ((public.rol_actual() IS NOT NULL));


--
-- Name: erp_state leer_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leer_admin ON public.erp_state FOR SELECT TO authenticated USING ((public.rol_actual() = 'ADM'::text));


--
-- Name: perfiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

--
-- Name: personal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;

--
-- Name: personal_anterior; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personal_anterior ENABLE ROW LEVEL SECURITY;

--
-- Name: preregistros pre_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pre_admin ON public.preregistros TO authenticated USING ((public.rol_actual() = 'ADM'::text)) WITH CHECK ((public.rol_actual() = 'ADM'::text));


--
-- Name: preregistros pre_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pre_insert ON public.preregistros FOR INSERT TO authenticated, anon WITH CHECK ((fecha_hora > (now() - '00:05:00'::interval)));


--
-- Name: preregistros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preregistros ENABLE ROW LEVEL SECURITY;

--
-- Name: sedes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;

--
-- Name: sedes_anterior; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sedes_anterior ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles ver_perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ver_perfil ON public.perfiles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (public.rol_actual() = 'ADM'::text)));


--
-- PostgreSQL database dump complete
--


--
-- SEGURIDAD QA: PERMISOS EXPLICITOS
--

-- El esquema public no permite crear objetos a usuarios de la aplicacion.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Retirar permisos amplios heredados en los objetos existentes.
REVOKE ALL ON ALL TABLES IN SCHEMA public
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
FROM PUBLIC, anon, authenticated;

-- Acceso operativo para usuarios autenticados.
-- RLS determina que registros puede consultar o modificar cada rol.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.sedes,
    public.deportes,
    public.personal,
    public.horarios,
    public.horario_profesores,
    public.alumnos,
    public.asistencias,
    public.kits_ventas,
    public.caja_movimientos,
    public.ajustes
TO authenticated;

-- Lectura controlada de tablas auxiliares.
GRANT SELECT ON TABLE
    public.perfiles,
    public.erp_meta,
    public.erp_state
TO authenticated;

-- Gestion de solicitudes de pre-registro.
GRANT SELECT, INSERT, DELETE ON TABLE public.preregistros
TO authenticated;

-- Catalogo publico: solo identificadores y nombres.
GRANT SELECT (id, nombre) ON TABLE public.sedes TO anon;
GRANT SELECT (id, nombre) ON TABLE public.deportes TO anon;

GRANT SELECT ON TABLE public.catalogo_publico
TO anon, authenticated;

-- El formulario publico solo puede insertar los campos necesarios.
GRANT INSERT (
    id,
    modalidad,
    nombres,
    apellidos,
    dni,
    sexo,
    fecha_nacimiento,
    deporte_id,
    sede_id,
    apoderado,
    celular_apoderado,
    correo_apoderado,
    seguro,
    foto,
    doc_dni_frente,
    doc_seguro,
    doc_ficha
)
ON TABLE public.preregistros TO anon;

-- Funciones necesarias para la aplicacion.
GRANT EXECUTE ON FUNCTION public.carnet_publico(text)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rol_actual()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.mi_personal()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.mis_horarios()
TO authenticated;

-- Acceso anonimo limitado al catalogo publico.
CREATE POLICY catalogo_anon_sedes
ON public.sedes
FOR SELECT TO anon
USING (true);

CREATE POLICY catalogo_anon_deportes
ON public.deportes
FOR SELECT TO anon
USING (true);

--
-- STORAGE: bucket privado documentos
--

-- ADM y REC pueden consultar documentos.
CREATE POLICY documentos_adm_rec_select
ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'documentos'
    AND public.rol_actual() IN ('ADM', 'REC')
);

-- ADM y REC pueden subir documentos.
CREATE POLICY documentos_adm_rec_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'documentos'
    AND public.rol_actual() IN ('ADM', 'REC')
);

-- ADM y REC pueden eliminar documentos.
CREATE POLICY documentos_adm_rec_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'documentos'
    AND public.rol_actual() IN ('ADM', 'REC')
);

-- Pre-registro publico: solo archivos en rutas autorizadas.
CREATE POLICY documentos_prereg_anon_insert
ON storage.objects
FOR INSERT TO anon
WITH CHECK (
    bucket_id = 'documentos'
    AND name ~ '^preregistro/[a-z0-9]+/(dni|seguro|ficha)-[0-9]+\.(jpg|png|pdf)$'
);

-- Pre-registro desde una sesion autenticada.
CREATE POLICY documentos_prereg_authenticated_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'documentos'
    AND name ~ '^preregistro/[a-z0-9]+/(dni|seguro|ficha)-[0-9]+\.(jpg|png|pdf)$'
);

-- Registro inicial del control de versiones.
INSERT INTO public.erp_meta (id, ver)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Confirmar toda la importacion en una sola transaccion.
COMMIT;


