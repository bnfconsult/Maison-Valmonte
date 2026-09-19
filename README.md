# Maison Valmonte — site vitrine

Site vitrine de Maison Valmonte : œuvres d'art, luminaires, mobilier et objets d'exception.
HTML, CSS et JavaScript, sans étape de compilation.

## Voir le site en local

```bash
python3 outils/serveur.py
```

puis ouvrir http://localhost:8080 (serveur sans cache : chaque rechargement montre la dernière version).

## Organisation

- `site/` : le site, c'est ce dossier qui est mis en ligne
  - `assets/js/catalogue.js` : les produits, les catégories et le numéro de téléphone de la maison
  - `assets/produits/<dossier>/` : les photos des produits (`<ref>.jpg`, `vignettes/<ref>.jpg`, `presentation-<ref>.jpg`)
  - `assets/images/` : logo, image de la section La Maison, images des univers
- `outils/logo.py` : prépare le logo et l'intro à partir de `BRANDING/` (à relancer si le logo change)
- `outils/serveur.py` : le serveur local
- `BRANDING/` : maquettes et fichiers sources du logo

Les photos en pleine résolution (dossiers `originaux/`) restent sur l'ordinateur et ne sont pas publiées.

## Mise en ligne

Le site est publié par GitHub Pages : **https://bnfconsult.github.io/Maison-Valmonte/**

Chaque envoi sur la branche `main` republie automatiquement le dossier `site`
(`.github/workflows/publier-site.yml`), en une à deux minutes.
