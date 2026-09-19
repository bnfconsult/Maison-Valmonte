#!/usr/bin/env python3
"""Prépare le logo Maison Valmonte pour le site (Python pur, aucune dépendance).

Source : BRANDING/logo blanc fond transp.png (logo blanc sur fond transparent)
         (BRANDING/logo noir fond transp.png sert seulement de contrôle : même dessin attendu)

Produit dans site/assets/images/marque/ :
  valmonte-logo-noir.png     logo noir, fond transparent, recadré — en-tête, pied de page, menu
  valmonte-logo-blanc.png    logo blanc, fond transparent, recadré — zoom produit, fonds sombres
  intro/*.png                chaque partie du logo en blanc (ovale, lettres, tirets, monogramme, signature)
  favicon-32.png, favicon-48.png, apple-touch-icon.png   monogramme VM sur parchemin
  og-valmonte.jpg            image d'aperçu des liens partagés (1200 × 630)
et site/assets/js/logo.js : proportions du logo et position de chaque partie, pour l'intro.

À relancer si le logo change :  python3 outils/logo.py   (depuis le dossier VENTE EN LIGNE)
"""
import json, os, shutil, struct, subprocess, sys, tempfile, zlib
from collections import deque

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, 'BRANDING', 'logo blanc fond transp.png')
CONTROLE = os.path.join(RACINE, 'BRANDING', 'logo noir fond transp.png')
SORTIE = os.path.join(RACINE, 'site', 'assets', 'images', 'marque')
SORTIE_INTRO = os.path.join(SORTIE, 'intro')
FICHIER_JS = os.path.join(RACINE, 'site', 'assets', 'js', 'logo.js')
PARCHEMIN = (233, 228, 220)
NOIR, BLANC = (0, 0, 0), (255, 255, 255)
TMP = tempfile.mkdtemp(prefix='logo-')


def sips(*args):
    subprocess.run(['sips', *args], check=True, capture_output=True)


def lire_alpha_png(chemin):
    """Décode un PNG 8 bits RGBA non entrelacé et renvoie (largeur, hauteur, canal alpha)."""
    d = open(chemin, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        sys.exit('Pas un PNG : ' + chemin)
    pos, idat = 8, bytearray()
    while pos < len(d):
        n = struct.unpack('>I', d[pos:pos + 4])[0]
        t, data = d[pos + 4:pos + 8], d[pos + 8:pos + 8 + n]
        pos += 12 + n
        if t == b'IHDR':
            w, h, profondeur, couleur, _, _, entrelace = struct.unpack('>IIBBBBB', data)
            if profondeur != 8 or couleur != 6 or entrelace:
                sys.exit('PNG attendu : RGBA 8 bits non entrelacé (' + chemin + ')')
        elif t == b'IDAT':
            idat += data
        elif t == b'IEND':
            break
    brut = zlib.decompress(bytes(idat))
    bpp, ligne = 4, w * 4
    prec = bytearray(ligne)
    alpha = bytearray(w * h)
    i = 0
    for y in range(h):
        filtre = brut[i]
        cur = bytearray(brut[i + 1:i + 1 + ligne])
        i += 1 + ligne
        if filtre == 1:
            for x in range(bpp, ligne):
                cur[x] = (cur[x] + cur[x - bpp]) & 255
        elif filtre == 2:
            for x in range(ligne):
                cur[x] = (cur[x] + prec[x]) & 255
        elif filtre == 3:
            for x in range(ligne):
                cur[x] = (cur[x] + ((cur[x - bpp] if x >= bpp else 0) + prec[x]) // 2) & 255
        elif filtre == 4:
            for x in range(ligne):
                a = cur[x - bpp] if x >= bpp else 0
                b = prec[x]
                c = prec[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                cur[x] = (cur[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        alpha[y * w:(y + 1) * w] = cur[3::4]
        prec = cur
    return w, h, alpha


def ecrire_png(chemin, w, h, alpha, couleur):
    """PNG d'une seule couleur, dont la transparence est donnée par alpha (0-255)."""
    brut = bytearray()
    r, g, b = couleur
    for y in range(h):
        brut.append(0)
        rangee = bytearray(w * 4)
        rangee[0::4] = bytes([r]) * w
        rangee[1::4] = bytes([g]) * w
        rangee[2::4] = bytes([b]) * w
        rangee[3::4] = alpha[y * w:(y + 1) * w]
        brut += rangee
    def bloc(t, data):
        return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n' + bloc(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + bloc(b'IDAT', zlib.compress(bytes(brut), 9)) + bloc(b'IEND', b''))
    open(chemin, 'wb').write(png)


def ecrire_bmp(chemin, w, h, rgb):
    ligne = ((w * 3 + 3) // 4) * 4
    corps = bytearray()
    for y in range(h):
        rangee = bytearray(ligne)
        rangee[0:w * 3:3] = rgb[y * w * 3 + 2:(y + 1) * w * 3:3]
        rangee[1:w * 3:3] = rgb[y * w * 3 + 1:(y + 1) * w * 3:3]
        rangee[2:w * 3:3] = rgb[y * w * 3:(y + 1) * w * 3:3]
        corps += rangee
    tete = struct.pack('<2sIHHI', b'BM', 54 + len(corps), 0, 0, 54)
    info = struct.pack('<IiiHHIIiiII', 40, w, -h, 1, 24, 0, len(corps), 2835, 2835, 0, 0)
    open(chemin, 'wb').write(tete + info + corps)


def composantes(masque, w, h):
    """Taches connexes (8-voisinage) : liste de listes d'indices de pixels."""
    vu = bytearray(w * h)
    groupes = []
    for depart in range(w * h):
        if not masque[depart] or vu[depart]:
            continue
        vu[depart] = 1
        file, pixels = deque([depart]), []
        while file:
            p = file.popleft()
            pixels.append(p)
            x, y = p % w, p // w
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        q = ny * w + nx
                        if masque[q] and not vu[q]:
                            vu[q] = 1
                            file.append(q)
        groupes.append(pixels)
    return groupes


def main():
    os.makedirs(SORTIE, exist_ok=True)
    shutil.rmtree(SORTIE_INTRO, ignore_errors=True)
    os.makedirs(SORTIE_INTRO)

    W, H, alpha = lire_alpha_png(SOURCE)
    if os.path.exists(CONTROLE):
        wc, hc, ac = lire_alpha_png(CONTROLE)
        if (wc, hc) == (W, H):
            ecarts = sum(1 for a, b in zip(alpha, ac) if abs(a - b) > 40)
            print('contrôle logo noir : %d pixels différents sur %d' % (ecarts, W * H))

    # 1. Taches (les poussières isolées sont retirées) et étiquette par pixel, halo compris.
    taches = [t for t in composantes(bytearray(1 if a > 100 else 0 for a in alpha), W, H) if len(t) >= 25]
    etiquette = [-1] * (W * H)
    for n, t in enumerate(taches):
        for p in t:
            etiquette[p] = n
    for _ in range(3):  # le halo d'anticrénelage fait jusqu'à 3 px
        ajouts = []
        for i in range(W + 1, W * H - W - 1):
            if alpha[i] and etiquette[i] < 0:
                for v in (i - 1, i + 1, i - W, i + W):
                    if etiquette[v] >= 0:
                        ajouts.append((i, etiquette[v]))
                        break
        for i, n in ajouts:
            etiquette[i] = n

    # 2. Recadrage serré autour de l'ovale, avec une petite marge.
    boites = []
    for t in taches:
        xs = [p % W for p in t]
        ys = [p // W for p in t]
        boites.append([min(xs), min(ys), max(xs) + 1, max(ys) + 1])
    marge = round(0.01 * (max(b[2] for b in boites) - min(b[0] for b in boites)))
    x0 = max(0, min(b[0] for b in boites) - marge)
    y0 = max(0, min(b[1] for b in boites) - marge)
    x1 = min(W, max(b[2] for b in boites) + marge)
    y1 = min(H, max(b[3] for b in boites) + marge)
    w, h = x1 - x0, y1 - y0

    def image(etiquettes, cadre=None):
        """Alpha du logo recadré, limité à certaines taches (None = tout) et à une zone."""
        cx0, cy0, cx1, cy1 = cadre or (0, 0, w, h)
        out = bytearray((cx1 - cx0) * (cy1 - cy0))
        for y in range(cy0, cy1):
            for x in range(cx0, cx1):
                i = (y + y0) * W + (x + x0)
                if etiquette[i] >= 0 and (etiquettes is None or etiquette[i] in etiquettes):
                    out[(y - cy0) * (cx1 - cx0) + (x - cx0)] = alpha[i]
        return out

    # 3. Classement des taches : ovale, tirets, MAISON (haut), signature (bas),
    #    monogramme (centre, sous l'arc), et les lettres de VALMONTE (le reste).
    el = []
    for n, b in enumerate(boites):
        b = [b[0] - x0, b[1] - y0, b[2] - x0, b[3] - y0]
        el.append({'n': n, 'b': b, 'cx': (b[0] + b[2]) / 2, 'cy': (b[1] + b[3]) / 2})
    anneaux = [e for e in el if e['b'][2] - e['b'][0] > 0.7 * w]
    tirets = [e for e in el if e not in anneaux and e['b'][3] - e['b'][1] < 0.02 * h and e['b'][2] - e['b'][0] > 0.06 * w]
    reste = [e for e in el if e not in anneaux and e not in tirets]
    signature = [e for e in reste if e['cy'] > 0.72 * h]
    maison = [e for e in reste if e['cy'] < 0.30 * h]
    monogramme = [e for e in reste if e not in signature and e not in maison
                  and abs(e['cx'] - w / 2) < 0.12 * w and e['b'][1] > 0.40 * h]
    nom = [e for e in reste if e not in signature and e not in maison and e not in monogramme]
    print('ovale %d | tirets %d | MAISON %d | VALMONTE %d | monogramme %d | signature %d taches'
          % (len(anneaux), len(tirets), len(maison), len(nom), len(monogramme), len(signature)))
    if not anneaux or len(tirets) != 2 or len(maison) != 6 or len(nom) != 8 or not monogramme or not signature:
        sys.exit('Structure du logo inattendue : vérifier le classement des taches.')

    # 4. Une image blanche par partie, recadrée sur elle (chaque image ne contient que ses taches).
    pad = max(3, round(0.006 * w))
    parties = []

    def partie(type_, liste, fichier):
        cadre = (max(0, min(e['b'][0] for e in liste) - pad), max(0, min(e['b'][1] for e in liste) - pad),
                 min(w, max(e['b'][2] for e in liste) + pad), min(h, max(e['b'][3] for e in liste) + pad))
        ecrire_png(os.path.join(SORTIE_INTRO, fichier), cadre[2] - cadre[0], cadre[3] - cadre[1],
                   image({e['n'] for e in liste}, cadre), BLANC)
        parties.append({'type': type_, 'fichier': fichier,
                        'b': [round(100 * cadre[0] / w, 3), round(100 * cadre[1] / h, 3),
                              round(100 * (cadre[2] - cadre[0]) / w, 3), round(100 * (cadre[3] - cadre[1]) / h, 3)]})

    partie('anneau', anneaux, 'anneau.png')
    for i, e in enumerate(sorted(maison, key=lambda e: e['cx']), 1):
        partie('maison', [e], 'maison-%d.png' % i)
    for i, e in enumerate(sorted(nom, key=lambda e: e['cx']), 1):
        partie('nom', [e], 'nom-%d.png' % i)
    for i, e in enumerate(sorted(tirets, key=lambda e: e['cx']), 1):
        partie('tiret', [e], 'tiret-%d.png' % i)
    # Le monogramme VM : une image par lettre, pour les construire l'une après l'autre ;
    # triées de haut en bas : le V (au-dessus) puis le M
    for i, e in enumerate(sorted(monogramme, key=lambda e: e['b'][1]), 1):
        partie('monogramme', [e], 'monogramme-%d.png' % i)
    partie('signature', signature, 'signature.png')

    # 5. Logo complet en noir et en blanc.
    logo = image(None)
    ecrire_png(os.path.join(SORTIE, 'valmonte-logo-noir.png'), w, h, logo, NOIR)
    ecrire_png(os.path.join(SORTIE, 'valmonte-logo-blanc.png'), w, h, logo, BLANC)
    ancien = os.path.join(SORTIE, 'valmonte-logo.png')
    if os.path.exists(ancien):
        os.remove(ancien)

    # 6. Icônes (monogramme) et image de partage, noir sur parchemin.
    def composer(largeur, hauteur, cadre):
        bx0, by0, bx1, by1 = cadre
        toile = bytearray(bytes(PARCHEMIN) * (largeur * hauteur))
        ox, oy = (largeur - (bx1 - bx0)) // 2, (hauteur - (by1 - by0)) // 2
        for y in range(by0, by1):
            for x in range(bx0, bx1):
                a = logo[y * w + x] / 255
                if a:
                    j = ((y - by0 + oy) * largeur + (x - bx0 + ox)) * 3
                    for k in range(3):
                        toile[j + k] = int(PARCHEMIN[k] * (1 - a) + 0.5)
        return toile

    m = (min(e['b'][0] for e in monogramme), min(e['b'][1] for e in monogramme),
         max(e['b'][2] for e in monogramme), max(e['b'][3] for e in monogramme))
    cote = int(max(m[2] - m[0], m[3] - m[1]) * 1.55)
    fav = os.path.join(TMP, 'favicon.bmp')
    ecrire_bmp(fav, cote, cote, composer(cote, cote, m))
    for taille, fichier in ((180, 'apple-touch-icon.png'), (48, 'favicon-48.png'), (32, 'favicon-32.png')):
        sips('-s', 'format', 'png', '-z', str(taille), str(taille), fav, '--out', os.path.join(SORTIE, fichier))

    lo = max(2400, int(w * 2.1))
    ho = int(lo * 630 / 1200)
    og = os.path.join(TMP, 'og.bmp')
    ecrire_bmp(og, lo, ho, composer(lo, ho, (0, 0, w, h)))
    sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '86', '-z', '630', '1200', og,
         '--out', os.path.join(SORTIE, 'og-valmonte.jpg'))

    with open(FICHIER_JS, 'w', encoding='utf-8') as f:
        f.write('/* Généré par outils/logo.py à partir du logo : ne pas modifier à la main.\n'
                '   Parties du logo pour l\'intro ; b = [gauche, haut, largeur, hauteur] en % du logo. */\n')
        f.write('window.LOGO = ' + json.dumps({'ratio': round(w / h, 5), 'dossier': 'assets/images/marque/intro/',
                                               'parties': parties}, ensure_ascii=False) + ';\n')
    shutil.rmtree(TMP, ignore_errors=True)
    print('logo : %d x %d px (ratio %.5f)' % (w, h, w / h))


if __name__ == '__main__':
    main()
