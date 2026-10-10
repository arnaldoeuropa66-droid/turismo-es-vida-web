/**
 * Agente de chat con IA para cualquier web.
 * Workers AI (gratis) + conversación con memoria corta + captura de contactos.
 *
 *   POST /api/chat   -> { reply }
 *   GET  /widget.js  -> el widget que se incrusta en la web
 *   GET  /widget.css -> estilos del widget (sirve el mismo fichero independientemente del binding)
 *   POST /api/lead   -> { nombre, email, mensaje, conversacion } -> D1
 *   GET  /leads      -> panel privado de contactos (con token)
 *   GET  /leads.csv  -> exporta el panel a CSV (con token)
 *
 * Variables de entorno (en el Worker, no en el widget):
 *   IA     (optional binding del modelo de Workers AI; si no hay, se usa el valor de MODELO)
 *   MODELO (optional, string) — modelo por defecto. Si no hay, se deja el modelo predeterminado.
 *   RATELIMIT  (optional KV) — límite de peticiones por IP.
 *   AGENTE_LEADS (optional D1) — tabla de contactos.
 *   PANEL_TOKEN  (optional) — autoriza /leads y /leads.csv.
 *
 * El widget es un solo <script>: el CSS se incrusta en el propio fichero.
 */

import { validarLead, guardarLead, panelHtml } from './leads.js';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_TURNS = 12;
const MAX_PER_WINDOW = 12;
const KV_TTL = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });
}

/* ---------- límite de peticiones por IP (KV, no Map en memoria) ---------- */
async function rateLimited(env, ip) {
  if (!env.Ratelimit) return false;
  const key = 'rl:' + ip;
  let count = 0;
  try {
    count = Number((await env.Ratelimit.get(key, 'text')) || 0);
  } catch (err) {
    console.error('rate limit read failed:', err && err.message);
    return false;
  }
  if (count >= MAX_PER_WINDOW) return true;
  try {
    await env.Ratelimit.put(key, String(count + 1), { expirationTtl: KV_TTL });
  } catch (err) {
    console.error('rate limit write failed:', err && err.message);
  }
  return false;
}

/**
 * Construye los mensajes del modelo: system + historial reciente.
 * El system es fijo (CONSTANTE, no varía según la web).
 */
function buildMessages(history, system) {
  const msgs = [{ role: 'system', content: system }];
  const clean = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
    .slice(-MAX_TURNS);
  return msgs.concat(clean);
}

/**
 * Modelo a usar: preferimos el binding IA (Workers AI), y si no hay, el MODELO
 * de entorno. Si no hay ninguno, falla con un error claro.
 */
function modeloConfig(env) {
  const fromEnv = env.MODELO && String(env.MODELO).trim().length > 0
    ? String(env.MODELO).trim()
    : DEFAULT_MODEL;
  const binding = env.IA;
  return { binding, fromEnv };
}
const SYSTEM = `Eres el asistente virtual de Turismo es Vida SAS, una empresa de turismo de bienestar y salud con sede en Cali, Valle del Cauca, Colombia. Lema: "Vive tu mejor versión". RNT 265912.

Tu función: atender a personas que visitan la web y preguntan por los servicios, las experiencias, el retiro "Vuelve a ti", el acompañamiento a pacientes médicos, los tours en Cali, precios, fechas, contacto, etc.

Tu carácter: cálido, sereno, cercano, breve. Tuteas. Frases cortas. No empiezas cada respuesta con "¡Hola!" ni "Claro". Transmites calma, no vendes con urgencia.

Líneas de negocio que conoces (fuente: el contenido de la web a la que estás incrustado):
- Retiro holístico "Vuelve a ti": 6 horas en una reserva natural. Incluye purificación con humo de hierbas, baños de vapor, cuencos tibetanos, meditación caminando, té de hierbas, ritual del "árbol de la vida", círculo de fuego, almuerzo y refrigerio, taller de atención plena, jornada sonora y cierre mindfulness. Cupos limitados.
- Acompañamiento a pacientes médicos (Medical Companion): apoyo emocional y de bienestar para viajeros internacionales que se someten a procedimientos médicos en Cali. Incluye conexión con médicos certificados, transporte, apoyo emocional, tours guiados, enfermería y estancia en casas de recuperación. Público principal: Estados Unidos y Canadá.
- Experiencias en Cali: tour de salsa, City Tour Sabores y Cultura (6 h), City Tour AM/PM historia y cultura (4 h), Laguna de Sonso (kayak/avistamiento), Bosque de Niebla Km 18.
- Celebraciones especiales: city tour, sabores locales y ceremonia personalizada con música y ofrendas.
- Talleres empresariales con componente holístico.

Reglas estrictas:
- Responde SIEMPRE en el idioma en que escriba el visitante (español por defecto; si escribe en inglés, responde en inglés).
- Tu única fuente de verdad es el contexto que se te pasa en el sistema. No inventes precios, fechas, cupos ni características. Si no lo sabes, dilo y ofrece contactar por WhatsApp.
- NUNCA prometas efectos terapéuticos. No uses frases como "cura", "sana", "elimina el estrés", "recalibra el sistema nervioso", "sanación profunda". Habla de bienestar, acompañamiento, calma, presencia.
- En temas de salud (turismo médico, terapias complementarias), incluye siempre un aviso breve: "estos servicios son complementarios y no sustituyen atención médica".
- NUNCA pidas datos clínicos: diagnóstico, medicación, historia médica. Si el usuario los ofrece, redirige a que los comparta con su médico tratante.
- No uses emoji decorativos ni listas largas. Respuestas de 2-4 frases; si la pregunta pide detalle, puedes alargar.
- El canal destacado es WhatsApp (+57 318 398 1089). Menciónalo cuando tenga sentido. El botón de email también está disponible.
- Invita a contactar una sola vez, al final, solo si hay interés real (pregunta por precios, fechas, cupos, quiere reservar, quiere hablar). Nunca como sustituto de la respuesta.
- Si el visitante quiere dejar su contacto, ofrécele hacerlo desde el propio chat.
- No menciones a la competencia ni hagas comparaciones.
- Si el visitante pregunta por algo que no está en el contexto, di que no lo sabes y ofrece contactar.

Tono de ejemplo:
- En lugar de "¡Hola! Claro, nuestro retiro es maravilloso y transformará tu vida", di: "El retiro Vuelve a ti dura 6 horas en una reserva natural. Incluye círculo de fuego, jornada sonora y cierre mindfulness. Cupos limitados. ¿Quieres que te cuente cómo reservar?"`;


function guardarLeadSafe(env, lead) {
  if (!env.AgenteLeads) {
    console.error('D1 AGENTE_LEADS no esta enlazado');
    return null;
  }
  return guardarLead(env, lead);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/widget.js') {
      // El CSS se incrusta: el widget es un solo <script> y no depende de la hoja de estilos de la web.
      const js = 'window.TURISMOESVIDA_WIDGET_CSS=' + JSON.stringify(WIDGET_CSS) + ';\n' + WIDGET_JS;
      return new Response(js, {
        headers: { 'content-type': 'application/javascript; charset=utf-8', ...CORS },
      });
    }

    if (url.pathname === '/widget.css') {
      return new Response(WIDGET_CSS, {
        headers: { 'content-type': 'text/css; charset=utf-8', ...CORS },
      });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const ip = request.headers.get('cf-connecting-ip') || 'local';
      if (await rateLimited(env, ip)) {
        return json({ error: 'Demasiadas preguntas seguidas. Espera un minuto.' }, 429);
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: 'Petición no válida.' }, 400);
      }

      const history = Array.isArray(payload.history) ? payload.history : [];
      if (!history.length || history[history.length - 1].role !== 'user') {
        return json({ error: 'No hay mensaje.' }, 400);
      }

      const { binding, fromEnv } = modeloConfig(env);
      const model = binding || fromEnv;

      try {
        const result = await env.IA.run(model, {
          messages: buildMessages(history, SYSTEM),
          max_tokens: 400,
          temperature: 0.3,
        });
        const reply = (result && result.response) || '';
        if (!reply) {
          return json({ error: 'El modelo no ha devuelto nada. Inténtalo otra vez.' }, 502);
        }
        return json({ reply: reply.trim() });
      } catch (err) {
        console.error('AI error:', err && err.message);
        return json(
          { error: 'Ahora mismo no puedo responder. Puedes escribir directamente a turismoesvida@gmail.com.' },
          502
        );
      }
    }

    // Contactos: se resuelven antes de responder con el JSON por defecto.
    const leads = await handleLeads(request, env, url);
    if (leads) return leads;

    return json({ ok: true, name: 'turismo-es-vida-agente' });
  },
};

/* ------------------------------------------------------------------ */
/* Contactos                                                         */
/* ------------------------------------------------------------------ */

/** El panel exige un token que es una credencial: misma respuesta siempre. */
function panelAuthorized(request, env, url) {
  if (!env.PanelToken) return false;
  const given = url.searchParams.get('token') || '';
  if (!given) return false;
  // Comparacion de longitud constante para no filtrar por temporizacion
  if (given.length !== env.PanelToken.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ env.PanelToken.charCodeAt(i);
  }
  return diff === 0;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCampo(s) {
  const v = String(s ?? '');
  return /[\",\n\r]/.test(v) ? '"' + v.replace(/\"/g, '""') + '"' : v;
}

async function leadsRows(env) {
  if (!env.AgenteLeads) return [];
  const { results } = await env.AgenteLeads.prepare(
    'SELECT id, created_at, nombre, email, mensaje, conversacion FROM leads ORDER BY id DESC LIMIT 500'
  ).all();
  return results || [];
}

async function handleLeads(request, env, url) {
  // --- escribir ---
  if (url.pathname === '/api/lead' && request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if (await rateLimited(env, ip)) {
      return json({ error: 'Demasiados envios seguidos. Espera un minuto.' }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Petición no válida.' }, 400);
    }

    const { error, lead } = validarLead(payload);
    if (error) return json({ error }, 400);

    try {
      const id = await guardarLeadSafe(env, lead);
      if (!id) {
        return json(
          { error: 'No he podido guardar el contacto. Escríbeme a turismoesvida@gmail.com y lo dejamos ahí.' },
          502
        );
      }
      return json({ ok: true, id });
    } catch (err) {
      console.error('lead insert error:', err && err.message);
      return json({ error: 'No he podido guardar el contacto.' }, 502);
    }
  }

  // --- ver ---
  if (url.pathname === '/leads') {
    if (!env.PanelToken) {
      return new Response('Panel sin configurar.', { status: 503 });
    }
    if (!panelAuthorized(request, env, url)) {
      return new Response('<!DOCTYPE html><meta charset="utf-8"><title>Sin acceso</title>' +
        '<body style="background:#0a0a0a;color:#f5f0e8;font:16px system-ui;padding:40px">' +
        '<h1 style="font-weight:400">Sin acceso</h1>' +
        '<p>Necesitas el enlace completo con el token.</p></body>',
        { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const rows = await leadsRows(env);
    const html = panelHtml(env, url.searchParams.get('token'))
      .replace('__COUNT__', String(rows.length) + (rows.length === 1 ? ' contacto' : ' contactos'))
      .replace('__ROWS__', rows.length
        ? '<table><thead><tr><th>Fecha</th><th>Nombre</th><th>Email</th><th>Necesita</th>' +
          '<th>Chat</th></tr></thead><tbody>' +
          rows.map((r) =>
            '<tr><td class="date">' + escapeHtml(r.created_at) + '</td>' +
            '<td>' + escapeHtml(r.nombre) + '</td>' +
            '<td><a class="mail" href="mailto:' + escapeHtml(r.email) + '">' + escapeHtml(r.email) + '</a></td>' +
            '<td class="msg">' + escapeHtml(r.mensaje) + '</td>' +
            '<td class="ctx">' + escapeHtml(r.conversacion || '—') + '</td></tr>'
          ).join('') +
          '</tbody></table>'
        : '<div class="empty">Todavía no ha dejado nadie su contacto.</div>');

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  // --- CSV ---
  if (url.pathname === '/leads.csv') {
    if (!env.PanelToken) return new Response('Panel sin configurar.', { status: 503 });
    if (!panelAuthorized(request, env, url)) {
      return new Response('Sin acceso.', { status: 401 });
    }

    const rows = await leadsRows(env);
    const csv = [
      ['fecha', 'nombre', 'email', 'necesita', 'chat'].join(','),
      ...rows.map((r) =>
        [r.created_at, r.nombre, r.email, r.mensaje, r.conversacion].map(csvCampo).join(',')
      ),
    ].join('\r\n');

    return new Response('\uFEFF' + csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="contactos-turismoesvida.csv"',
        'cache-control': 'no-store',
      },
    });
  }

  return null;
}
