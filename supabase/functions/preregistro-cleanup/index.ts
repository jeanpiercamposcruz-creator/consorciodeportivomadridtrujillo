import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let prefixes: unknown;
  try {
    const body = await req.json();
    prefixes = body?.prefixes;
  } catch {
    return new Response(JSON.stringify({ error: "Solicitud inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (
    !Array.isArray(prefixes) ||
    prefixes.length < 1 ||
    prefixes.length > 3 ||
    prefixes.some((p) => typeof p !== "string")
  ) {
    return new Response(JSON.stringify({ error: "Rutas inválidas" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rutas = prefixes as string[];
  const match = /^preregistro\/([a-f0-9]{32})\/(dni|seguro|ficha)-\d{10,13}\.(jpg|png|pdf)$/;
  const first = match.exec(rutas[0]);
  const id = first?.[1];

  if (
    !id ||
    new Set(rutas).size !== rutas.length ||
    rutas.some((ruta) => {
      const parsed = match.exec(ruta);
      return !parsed || parsed[1] !== id;
    })
  ) {
    return new Response(JSON.stringify({ error: "Rutas no autorizadas" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Servicio no configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(
      supabaseUrl.replace(/\/+$/, "") + "/storage/v1/object/documentos",
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: "Bearer " + serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: rutas }),
      },
    );

    if (!response.ok) {
      console.error("Storage cleanup failed with status", response.status);
      return new Response(JSON.stringify({ error: "No se pudieron limpiar los archivos" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ deleted: rutas.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Storage cleanup request failed", error);
    return new Response(JSON.stringify({ error: "No se pudieron limpiar los archivos" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
