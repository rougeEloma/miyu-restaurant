import { test } from "node:test"
import assert from "node:assert/strict"
import { handleReservation, validate } from "../lib/reservation.mjs"

const tomorrow = new Date(Date.now() + 86400e3).toISOString().slice(0, 10)
const ok = { nom: "Jean Test", tel: "+242 06 000 0000", date: tomorrow, heure: "20:00", personnes: "2", espace: "Rooftop" }
const env = { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_TO: "+243 829 793 378" }
const mockFetch = (status = 200) => {
  const calls = []
  const f = async (url, opts) => { calls.push([url, JSON.parse(opts.body)]); return new Response("{}", { status }) }
  f.calls = calls
  return f
}

test("envoie un message texte au bon numéro", async () => {
  const f = mockFetch()
  const r = await handleReservation(ok, env, f)
  assert.equal(r.status, 200)
  assert.equal(f.calls[0][0], "https://graph.facebook.com/v23.0/123/messages")
  assert.equal(f.calls[0][1].to, "243829793378")
  assert.match(f.calls[0][1].text.body, /Nom : Jean Test/)
})

test("utilise le modèle quand il est configuré", async () => {
  const f = mockFetch()
  await handleReservation(ok, { ...env, WHATSAPP_TEMPLATE: "nouvelle_reservation" }, f)
  const t = f.calls[0][1].template
  assert.equal(t.name, "nouvelle_reservation")
  assert.equal(t.components[0].parameters.length, 6)
})

test("refuse les données invalides", () => {
  assert.ok(validate({ ...ok, nom: "" }).error)
  assert.ok(validate({ ...ok, tel: "123" }).error)
  assert.ok(validate({ ...ok, date: "2020-01-01" }).error)
  assert.ok(validate({ ...ok, espace: "Cave" }).error)
  assert.ok(validate({ ...ok, personnes: "8+" }).resa)
})

test("ignore les robots (champ piège)", async () => {
  const f = mockFetch()
  const r = await handleReservation({ ...ok, site: "x" }, env, f)
  assert.equal(r.status, 200); assert.equal(f.calls.length, 0)
})

test("signale une configuration manquante ou une erreur Meta", async () => {
  assert.equal((await handleReservation(ok, {}, mockFetch())).status, 503)
  assert.equal((await handleReservation(ok, env, mockFetch(400))).status, 502)
})
