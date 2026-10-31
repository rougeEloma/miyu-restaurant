import { test } from "node:test"
import assert from "node:assert/strict"
import { handleReservation, validate, buildEmail, frDateLong } from "../lib/reservation.mjs"

const tomorrow = new Date(Date.now() + 86400e3).toISOString().slice(0, 10)
const ok = { nom: "Jean Test", tel: "+242 06 000 0000", email: "jean@example.com", date: tomorrow, heure: "20:00", personnes: "2", espace: "Rooftop", message: "Anniversaire" }
const mail = { RESEND_API_KEY: "re_x", MAIL_TO: "miyu@example.com" }
const wa = { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_TO: "+243 829 793 378" }
const mockFetch = (statusFor = () => 200) => {
  const calls = []
  const f = async (url, opts) => { calls.push([url, JSON.parse(opts.body)]); return new Response("{}", { status: statusFor(url) }) }
  f.calls = calls
  return f
}

test("envoie l'e-mail via Resend avec réponse au client", async () => {
  const f = mockFetch()
  const r = await handleReservation(ok, mail, f)
  assert.equal(r.status, 200)
  assert.equal(f.calls.length, 1)
  const [url, payload] = f.calls[0]
  assert.equal(url, "https://api.resend.com/emails")
  assert.deepEqual(payload.to, ["miyu@example.com"])
  assert.equal(payload.reply_to, "jean@example.com")
  assert.match(payload.from, /onboarding@resend\.dev/)
  assert.match(payload.subject, /Jean Test/)
  assert.match(payload.text, /Anniversaire/)
})

test("échappe le HTML dans l'e-mail", () => {
  const e = buildEmail({ ...ok, nom: "<b>X</b>" }, { from: "a", to: ["b"] })
  assert.ok(!e.html.includes("<b>X</b>"))
  assert.ok(e.html.includes("&lt;b&gt;X&lt;/b&gt;"))
})

test("date en toutes lettres", () => assert.equal(frDateLong("2026-11-07"), "samedi 7 novembre 2026"))

test("e-mail et WhatsApp ensemble ; succès si un canal passe", async () => {
  const f = mockFetch((url) => (url.includes("graph.facebook") ? 400 : 200))
  const r = await handleReservation(ok, { ...mail, ...wa }, f)
  assert.equal(r.status, 200)
  assert.equal(f.calls.length, 2)
})

test("WhatsApp : texte au bon numéro, ou modèle", async () => {
  let f = mockFetch()
  await handleReservation(ok, wa, f)
  assert.equal(f.calls[0][1].to, "243829793378")
  f = mockFetch()
  await handleReservation(ok, { ...wa, WHATSAPP_TEMPLATE: "nouvelle_reservation" }, f)
  assert.equal(f.calls[0][1].template.components[0].parameters.length, 6)
})

test("refuse les données invalides", () => {
  assert.ok(validate({ ...ok, nom: "" }).error)
  assert.ok(validate({ ...ok, tel: "123" }).error)
  assert.ok(validate({ ...ok, email: "pas-un-mail" }).error)
  assert.ok(validate({ ...ok, date: "2020-01-01" }).error)
  assert.ok(validate({ ...ok, espace: "Cave" }).error)
  assert.ok(validate({ ...ok, email: "", personnes: "20+" }).resa)
})

test("ignore les robots (champ piège)", async () => {
  const f = mockFetch()
  const r = await handleReservation({ ...ok, site: "x" }, mail, f)
  assert.equal(r.status, 200); assert.equal(f.calls.length, 0)
})

test("aucun canal configuré → 503 ; tous en échec → 502", async () => {
  assert.equal((await handleReservation(ok, {}, mockFetch())).status, 503)
  assert.equal((await handleReservation(ok, mail, mockFetch(() => 500))).status, 502)
})
