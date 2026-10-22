"""Construit public/index.html : récupère l'export du design (site d'aperçu Netlify, mis à jour
par « Send to Netlify » depuis le canevas) et y ajoute le script de réservation.

Usage : python3 -I tools/build.py            (récupère l'export en ligne)
        python3 -I tools/build.py --offline  (réutilise tools/export-cache.html)"""
import pathlib, re, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW = "https://miyu-site-vitrine-cd-9583b654a7.netlify.app/"
cache = ROOT / "tools" / "export-cache.html"
if "--offline" not in sys.argv:
    with urllib.request.urlopen(PREVIEW) as r:
        cache.write_bytes(r.read())
html = cache.read_text(encoding="utf-8")
html = re.sub(r'<script async src="/\.netlify/scripts/hud[^"]*"[^>]*></script>', "", html)
html = re.sub(r"<!-- This site is hosted on Netlify\..*?-->\n?", "", html, flags=re.S)
client = (ROOT / "tools" / "reservation-client.js").read_text(encoding="utf-8")
i = html.index("</title>") + len("</title>")
html = html[:i] + "\n<script>\n" + client + "\n</script>\n" + html[i:]
out = ROOT / "public" / "index.html"
out.write_text(html, encoding="utf-8")
print("OK", out, len(html), "| champs natifs dans l'export :", "data-resa" in html.split("</script>", 1)[1])
