# MIYU — Restaurant & Lounge Bar (Pointe-Noire)

Site vitrine de MIYU. Le bouton « Réserver » ouvre une fenêtre de réservation ; chaque demande
est envoyée par e-mail à MIYU (Resend) et, si configuré, sur WhatsApp au gérant.

## Fonctionnement

- `public/index.html` : la page du site, exportée depuis le design (canevas Claude) puis complétée
  par `tools/reservation-client.js` (envoi du formulaire de réservation).
- `server.mjs` : petit serveur Node sans dépendance. Sert la page et reçoit `POST /api/reservation`.
- `lib/reservation.mjs` : vérifie la demande et l'envoie par e-mail (Resend) et/ou WhatsApp (API Cloud de Meta).

## Variables d'environnement (Render › Environment)

| Clé | Rôle |
|---|---|
| `RESEND_API_KEY` | Clé API Resend (secret) |
| `MAIL_TO` | Adresse(s) e-mail qui reçoivent les réservations |
| `MAIL_FROM` | (optionnel) expéditeur ; défaut `MIYU Réservations <onboarding@resend.dev>`. Avec le domaine vérifié dans Resend : `MIYU Réservations <reservations@domaine>` |
| `WHATSAPP_TOKEN` | Token d'accès Meta (secret, jamais dans le code) |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifiant du numéro expéditeur (Meta › WhatsApp › API Setup) |
| `WHATSAPP_TO` | Numéro(s) qui reçoivent les réservations, séparés par des virgules |
| `WHATSAPP_TEMPLATE` | (production) nom du modèle approuvé, ex. `nouvelle_reservation` |
| `WHATSAPP_TEMPLATE_LANG` | (optionnel) langue du modèle, défaut `fr` |

Chaque canal n'est actif que si ses variables sont renseignées.

WhatsApp : sans modèle, le message part en texte libre : cela ne fonctionne que si le destinataire
a écrit au numéro WhatsApp Business dans les 24 dernières heures (pratique pour les tests).

## Mettre à jour le design

1. Modifier le design dans le canevas, puis « Send to Netlify » (site d'aperçu).
2. `python3 -I tools/build.py` pour régénérer `public/index.html` depuis l'aperçu.
3. Commit + push : Render redéploie automatiquement.

## Commandes

```bash
npm start     # lance le site sur http://localhost:10000
npm test      # tests de la logique de réservation
```
