// Validation d'une demande de réservation MIYU et envoi sur WhatsApp (API WhatsApp Cloud de Meta).
//
// Variables d'environnement :
//   WHATSAPP_TOKEN            token d'accès Meta (secret)
//   WHATSAPP_PHONE_NUMBER_ID  identifiant du numéro expéditeur (Meta › API Setup)
//   WHATSAPP_TO               numéro(s) destinataire(s), séparés par des virgules
//   WHATSAPP_TEMPLATE         (optionnel) nom du modèle approuvé, ex. nouvelle_reservation
//   WHATSAPP_TEMPLATE_LANG    (optionnel) langue du modèle, défaut « fr »
//   GRAPH_API_VERSION         (optionnel) défaut « v23.0 »

const ESPACES = ["Restaurant", "Lounge bar", "Rooftop"]
export const PHONE_FALLBACK = "+242 05 773 9999"

const clean = (v, max = 80) =>
  String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)

export function isSpam(body) {
  return Boolean(clean(body?.site, 200))
}

export function validate(body, now = Date.now()) {
  const resa = {
    nom: clean(body?.nom, 60),
    tel: clean(body?.tel, 25),
    date: clean(body?.date, 10),
    heure: clean(body?.heure, 5),
    personnes: clean(body?.personnes, 3),
    espace: clean(body?.espace, 20),
  }
  if (resa.nom.length < 2) return { error: "Merci d'indiquer votre nom." }
  if (resa.tel.replace(/\D/g, "").length < 8) return { error: "Merci d'indiquer un numéro de téléphone valide." }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resa.date)) return { error: "Merci de choisir une date." }
  const today = new Date(now + 3600_000).toISOString().slice(0, 10) // heure de Pointe-Noire (UTC+1)
  if (resa.date < today) return { error: "La date choisie est déjà passée." }
  if (!/^\d{2}:\d{2}$/.test(resa.heure)) return { error: "Merci de choisir une heure." }
  if (!/^\d{1,2}\+?$/.test(resa.personnes)) return { error: "Nombre de personnes invalide." }
  if (!ESPACES.includes(resa.espace)) return { error: "Espace invalide." }
  return { resa }
}

const frDate = (iso) => {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function buildPayload(to, r, template, lang) {
  if (template) {
    const params = [r.nom, r.tel, frDate(r.date), r.heure, r.personnes, r.espace]
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: lang },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
      },
    }
  }
  const body =
    `*Nouvelle réservation MIYU*\n\n` +
    `Nom : ${r.nom}\n` +
    `Téléphone : ${r.tel}\n` +
    `Date : ${frDate(r.date)} à ${r.heure}\n` +
    `Personnes : ${r.personnes}\n` +
    `Espace : ${r.espace}`
  return { messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body } }
}

// Traite une demande. Renvoie { status, body } prêt à être envoyé en JSON.
export async function handleReservation(body, env = process.env, fetchImpl = fetch) {
  if (!body || typeof body !== "object") return { status: 400, body: { ok: false, error: "Requête invalide." } }
  if (isSpam(body)) return { status: 200, body: { ok: true } }

  const { resa, error } = validate(body)
  if (!resa) return { status: 422, body: { ok: false, error } }

  const token = env.WHATSAPP_TOKEN
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID
  const recipients = String(env.WHATSAPP_TO ?? "").split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean)
  if (!token || !phoneId || recipients.length === 0) {
    console.error("Configuration WhatsApp incomplète (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TO)")
    return { status: 503, body: { ok: false, error: `Service de réservation indisponible. Appelez-nous au ${PHONE_FALLBACK}.` } }
  }
  const template = env.WHATSAPP_TEMPLATE || undefined
  const lang = env.WHATSAPP_TEMPLATE_LANG || "fr"
  const version = env.GRAPH_API_VERSION || "v23.0"

  const results = await Promise.all(
    recipients.map(async (to) => {
      try {
        const res = await fetchImpl(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(to, resa, template, lang)),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) console.error("Erreur WhatsApp", to.slice(0, 5) + "…", res.status, JSON.stringify(data?.error ?? data))
        return res.ok
      } catch (e) {
        console.error("Erreur réseau WhatsApp", String(e))
        return false
      }
    })
  )

  if (!results.some(Boolean)) {
    return { status: 502, body: { ok: false, error: `La réservation n'a pas pu être transmise. Appelez-nous au ${PHONE_FALLBACK}.` } }
  }
  console.log("Réservation transmise", resa.date, resa.heure, resa.personnes, resa.espace)
  return { status: 200, body: { ok: true } }
}
