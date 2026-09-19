/* ==========================================================================
   Maison Valmonte — comportements de la page
   Grille construite depuis catalogue.js, sélection, filtres et tri,
   zoom produit, en-tête, menu mobile, apparitions, intro de première visite.
   ========================================================================== */

(function () {
  'use strict';

  var CATALOGUE = window.CATALOGUE || { categories: [], produits: [] };
  var DOSSIER = 'assets/produits/';
  var LENT = 'cubic-bezier(.16,1,.3,1)';     // expo out : lent et souverain
  var TRAJET = 'cubic-bezier(.76,0,.24,1)';  // quart in-out : les grands déplacements
  var mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var site = document.querySelector('.site');

  function creer(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte) e.textContent = texte;
    return e;
  }
  function prixFormate(prix) {
    return prix == null ? 'Prix sur demande' : new Intl.NumberFormat('fr-FR').format(prix) + ' €';
  }
  function produit(ref) {
    for (var i = 0; i < CATALOGUE.produits.length; i++) if (CATALOGUE.produits[i].ref === ref) return CATALOGUE.produits[i];
    return null;
  }
  function nomCategorie(id) {
    for (var i = 0; i < CATALOGUE.categories.length; i++) if (CATALOGUE.categories[i].id === id) return CATALOGUE.categories[i].nom;
    return '';
  }
  function tout(anims) { return Promise.all(anims.map(function (a) { return a.finished; })); }
  function decoder(src) {
    var im = new Image();
    im.src = src;
    return im.decode ? im.decode().catch(function () {}) : Promise.resolve();
  }

  /* ---------- Sélection = le panier (pas de paiement en ligne) ----------
     Chaque ligne : { ref, qte }. Les quantités se cumulent ; les œuvres (type « tableau »)
     sont des pièces uniques, toujours en un exemplaire. Ajouter ouvre la boîte du panier. */

  var CLE = 'selection';
  function lire() {
    try {
      return (JSON.parse(localStorage.getItem(CLE)) || [])
        .map(function (l) { return typeof l === 'string' ? { ref: l, qte: 1 } : l; }) // ancien format
        .filter(function (l) { return l && produit(l.ref) && l.qte > 0; });
    } catch (e) { return []; }
  }
  function ecrire() { try { localStorage.setItem(CLE, JSON.stringify(selection)); } catch (e) { /* stockage indisponible */ } }
  var selection = lire();
  var ecouteursSelection = [];

  function ligneSelection(ref) {
    for (var i = 0; i < selection.length; i++) if (selection[i].ref === ref) return selection[i];
    return null;
  }
  function estUnique(p) { return p.type === 'tableau'; }
  function estSelectionne(ref) { return !!ligneSelection(ref); }
  function nombrePieces() { return selection.reduce(function (n, l) { return n + l.qte; }, 0); }
  function ajouter(ref) {
    var p = produit(ref);
    if (!p || p.statut === 'vendu') return;
    var l = ligneSelection(ref);
    if (!l) selection.push({ ref: ref, qte: 1 });
    else if (!estUnique(p)) l.qte++;
    ecrire();
    majSelection();
    ouvrirPanier();
  }
  function changerQuantite(ref, ecart) {
    var l = ligneSelection(ref);
    if (!l) return;
    l.qte += ecart;
    if (l.qte <= 0) selection.splice(selection.indexOf(l), 1);
    ecrire();
    majSelection();
  }
  function retirer(ref) {
    var l = ligneSelection(ref);
    if (!l) return;
    selection.splice(selection.indexOf(l), 1);
    ecrire();
    majSelection();
  }
  function majSelection() {
    var n = nombrePieces();
    var compteur = document.querySelector('[data-compteur]');
    var lien = document.querySelector('[data-lien-selection]');
    if (compteur) compteur.textContent = '(' + n + ')';
    if (lien) lien.setAttribute('aria-label', 'Ma sélection : ' + n + (n > 1 ? ' pièces' : ' pièce'));
    ecouteursSelection.forEach(function (f) { f(); });
  }

  var toastEl = document.querySelector('[data-toast]');
  var minuteurToast;
  function toast(texte, action) {
    if (!toastEl) return;
    toastEl.textContent = texte;
    if (action) {
      var bouton = creer('button', 'toast-action', action.libelle);
      bouton.type = 'button';
      bouton.addEventListener('click', function () { toastEl.classList.remove('est-visible'); action.faire(); });
      toastEl.appendChild(bouton);
    }
    toastEl.classList.add('est-visible');
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(function () { toastEl.classList.remove('est-visible'); }, 2600);
  }

  /* ---------- Boutons « appeler » (panier, contact) : numéro défini dans catalogue.js ---------- */

  var BOUTIQUE = window.BOUTIQUE || {};
  document.querySelectorAll('[data-appel]').forEach(function (a) {
    if (BOUTIQUE.telephone) {
      a.href = 'tel:' + BOUTIQUE.telephone.replace(/[^\d+]/g, '');
      var numero = a.querySelector('[data-numero]');
      if (numero) numero.textContent = BOUTIQUE.telephoneAffiche || BOUTIQUE.telephone;
    } else {
      a.addEventListener('click', function (e) { e.preventDefault(); toast('Numéro de téléphone bientôt disponible'); });
    }
  });

  /* ---------- Grille ---------- */

  var grille = document.querySelector('[data-grille]');
  var cartes = [];

  function carte(p, i) {
    var vendu = p.statut === 'vendu';
    var li = creer('li', 'carte-produit' + (p.type === 'tableau' ? ' carte-produit--tableau' : '') + (vendu ? ' est-vendue' : ''));
    li.dataset.ref = p.ref;
    li.dataset.categorie = p.categorie;
    li.dataset.prix = p.prix == null ? '' : p.prix; // vide = prix sur demande
    li.dataset.ordre = i;

    var visuel = creer('div', 'carte-produit-visuel');
    visuel.setAttribute('data-ouvrir', '');
    if (vendu) visuel.appendChild(creer('span', 'badge', 'Vendu'));
    var img = creer('img');
    img.src = DOSSIER + (p.vignette || p.photo);
    img.alt = '';
    img.decoding = 'async';
    if (i > 7) img.loading = 'lazy';
    visuel.appendChild(img);

    var texte = creer('div', 'carte-produit-texte');
    if (p.artiste) texte.appendChild(creer('p', 'carte-produit-auteur', p.artiste));
    var nom = creer('button', 'carte-produit-nom', p.nom);
    nom.type = 'button';
    nom.setAttribute('data-ouvrir', '');
    nom.setAttribute('aria-haspopup', 'dialog');
    texte.appendChild(nom);
    texte.appendChild(vendu ? creer('p', 'carte-produit-statut', 'Pièce vendue') : creer('p', 'carte-produit-prix', prixFormate(p.prix)));

    var ajout = creer('button', 'bouton-ajout', '+');
    ajout.type = 'button';
    if (vendu) {
      ajout.disabled = true;
      ajout.setAttribute('aria-label', p.nom + ' : pièce vendue');
    } else {
      ajout.setAttribute('aria-label', 'Ajouter ' + p.nom + ' à ma sélection');
    }

    var infos = creer('div', 'carte-produit-infos');
    infos.appendChild(texte);
    infos.appendChild(ajout);
    li.appendChild(visuel);
    li.appendChild(infos);
    return li;
  }

  if (grille) {
    CATALOGUE.produits.forEach(function (p, i) { grille.appendChild(carte(p, i)); });
    cartes = Array.prototype.slice.call(grille.children);

    grille.addEventListener('click', function (e) {
      var ajout = e.target.closest('.bouton-ajout');
      if (ajout) {
        if (!ajout.disabled) ajouter(ajout.closest('.carte-produit').dataset.ref);
        return;
      }
      var declencheur = e.target.closest('[data-ouvrir]');
      if (declencheur) ouvrirZoom(declencheur.closest('.carte-produit'));
    });

    ecouteursSelection.push(function () {
      cartes.forEach(function (c) {
        var b = c.querySelector('.bouton-ajout');
        if (!b.disabled) b.setAttribute('aria-pressed', String(estSelectionne(c.dataset.ref)));
      });
    });
  }

  /* ---------- Filtres par catégorie et tri ---------- */

  var boitePastilles = document.querySelector('[data-pastilles]');
  var compte = document.querySelector('[data-compte]');
  var vide = document.querySelector('[data-vide]');

  if (boitePastilles) {
    // Seules les catégories qui ont des pièces ont leur pastille.
    var categoriesPleines = CATALOGUE.categories.filter(function (c) {
      return CATALOGUE.produits.some(function (p) { return p.categorie === c.id; });
    });
    [{ id: 'tout', nom: 'Tout' }].concat(categoriesPleines).forEach(function (c) {
      var b = creer('button', 'pastille', c.nom);
      b.type = 'button';
      b.dataset.filtre = c.id;
      b.setAttribute('aria-pressed', String(c.id === 'tout'));
      b.addEventListener('click', function () { filtrer(c.id); });
      boitePastilles.appendChild(b);
    });
  }

  function filtrer(valeur) {
    var n = 0;
    cartes.forEach(function (c) {
      var ok = valeur === 'tout' || c.dataset.categorie === valeur;
      c.hidden = !ok;
      if (ok) n++;
    });
    document.querySelectorAll('.pastille').forEach(function (p) { p.setAttribute('aria-pressed', String(p.dataset.filtre === valeur)); });
    if (compte) compte.textContent = n + (n > 1 ? ' pièces' : ' pièce');
    if (vide) vide.hidden = n > 0;
  }
  filtrer('tout');

  document.querySelectorAll('[data-filtre-lien]').forEach(function (a) {
    a.addEventListener('click', function () { filtrer(a.dataset.filtreLien); });
  });

  var tri = document.getElementById('tri');
  if (tri) {
    tri.addEventListener('change', function () {
      var mode = tri.value;
      cartes.slice().sort(function (a, b) {
        if (mode === 'selection') return a.dataset.ordre - b.dataset.ordre;
        var va = a.classList.contains('est-vendue'), vb = b.classList.contains('est-vendue');
        if (va !== vb) return va ? 1 : -1; // pièces vendues en dernier
        var sa = a.dataset.prix === '', sb = b.dataset.prix === '';
        if (sa !== sb) return sa ? 1 : -1; // puis celles « sur demande »
        return mode === 'prix-asc' ? a.dataset.prix - b.dataset.prix : b.dataset.prix - a.dataset.prix;
      }).forEach(function (c) { grille.appendChild(c); });
    });
  }

  /* ---------- Zoom produit ----------
     Un clic sur un produit : son image s'envole de la grille jusqu'au centre de l'écran,
     le titre se lève à gauche sur l'image, le logo s'y pose en haut, la fiche se déplie
     dessous sur fond sombre. Les miniatures montrent l'œuvre et ses présentations.
     Un clic n'importe où ailleurs (ou Échap) : l'image revient se poser à sa place. */

  var zoom = document.querySelector('[data-zoom]');
  var etat = 'ferme';
  var fermerApres = false;
  var animsZoom = [];
  var courant = null;
  var retourFocus = null;
  var jetonVue = 0;

  if (zoom) {
    var fond = zoom.querySelector('.zoom-fond');
    var panneau = zoom.querySelector('.zoom-panneau');
    var zImage = zoom.querySelector('.zoom-image');
    var zMarque = zoom.querySelector('.zoom-marque');
    var zVues = zoom.querySelector('.zoom-vues');
    var zLegende = zoom.querySelector('.zoom-legende');
    var zSurtitre = zoom.querySelector('.zoom-surtitre');
    var zTitre = zoom.querySelector('.zoom-titre > span');
    var zInfos = zoom.querySelector('.zoom-infos');
    var zContenu = zoom.querySelector('.zoom-infos-contenu');
    var zDescription = zoom.querySelector('.zoom-description');
    var zDetails = zoom.querySelector('.zoom-details');
    var zPrix = zoom.querySelector('.zoom-prix');
    var zCta = zoom.querySelector('.zoom-cta');
    var zNote = zoom.querySelector('.zoom-note');
    var zFermer = zoom.querySelector('.zoom-fermer');

    fond.addEventListener('click', fermerZoom);
    zFermer.addEventListener('click', fermerZoom);
    zCta.addEventListener('click', function () {
      if (courant && !zCta.disabled) ajouter(courant.produit.ref);
    });
    zVues.addEventListener('click', function (e) {
      var b = e.target.closest('.zoom-vue');
      if (b) montrerVue(Number(b.dataset.vue));
    });
    ecouteursSelection.push(majCta);

    document.addEventListener('keydown', function (e) {
      if (etat === 'ferme' || etatPanier !== 'ferme') return; // le panier, s'il est ouvert, passe devant
      if (e.key === 'Escape') { e.preventDefault(); fermerZoom(); return; }
      if (e.key !== 'Tab') return;
      var focusables = Array.prototype.filter.call(panneau.querySelectorAll('button, a[href]'), function (x) { return !x.disabled && !x.closest('[hidden]'); });
      if (!focusables.length) return;
      var premier = focusables[0], dernier = focusables[focusables.length - 1];
      if (!panneau.contains(document.activeElement)) { e.preventDefault(); premier.focus(); }
      else if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    });
  }

  function majCta() {
    if (!courant || !zCta) return;
    var p = courant.produit;
    if (p.statut === 'vendu') return;
    var choisi = estSelectionne(p.ref);
    zCta.setAttribute('aria-pressed', String(choisi));
    zCta.textContent = !choisi ? "Cet article m'intéresse"
      : estUnique(p) ? 'Dans votre sélection ✓' : 'Ajouter un exemplaire de plus';
  }

  function remplirZoom(p) {
    var vendu = p.statut === 'vendu';
    zoom.classList.toggle('zoom--tableau', p.type === 'tableau');
    zImage.src = DOSSIER + (p.vignette || p.photo);
    zImage.classList.remove('est-presentation');
    zImage.alt = p.nom + (p.artiste ? ', ' + p.artiste : '');
    zSurtitre.textContent = [nomCategorie(p.categorie), p.artiste].filter(Boolean).join(' · ');
    zTitre.textContent = p.nom;
    zDescription.textContent = p.description || '';
    zDetails.innerHTML = '';
    (p.details || []).forEach(function (d) {
      var ligne = creer('div');
      ligne.appendChild(creer('dt', '', d[0]));
      ligne.appendChild(creer('dd', '', d[1]));
      zDetails.appendChild(ligne);
    });

    // Miniatures : la pièce, puis ses images de présentation
    var presentations = p.presentations || [];
    zVues.innerHTML = '';
    zVues.hidden = !presentations.length;
    [p.vignette || p.photo].concat(presentations).forEach(function (src, i) {
      var b = creer('button', 'zoom-vue');
      b.type = 'button';
      b.dataset.vue = i;
      b.setAttribute('aria-pressed', String(i === 0));
      b.setAttribute('aria-label', i === 0
        ? (p.type === 'tableau' ? "Voir l'œuvre" : 'Voir la pièce')
        : 'Voir la présentation' + (presentations.length > 1 ? ' ' + i : ''));
      var im = creer('img');
      im.src = DOSSIER + src;
      im.alt = '';
      b.appendChild(im);
      zVues.appendChild(b);
    });

    zPrix.textContent = vendu ? 'Pièce vendue' : prixFormate(p.prix);
    zCta.disabled = vendu;
    zCta.removeAttribute('aria-pressed');
    zCta.textContent = vendu ? 'Pièce vendue' : "Cet article m'intéresse";
    zNote.textContent = vendu
      ? "Cette pièce a trouvé preneur. Écrivez-nous pour être informé d'une œuvre proche."
      : 'Ajoutez-la à votre sélection, puis envoyez-nous votre demande : nous vous répondons personnellement.';
    majCta();
  }

  function montrerVue(i) {
    if (!courant || etat !== 'ouvert' || i === courant.vue) return;
    var p = courant.produit;
    var src = i === 0 ? courant.oeuvre : DOSSIER + p.presentations[i - 1];
    var jeton = ++jetonVue;
    courant.vue = i;
    zVues.querySelectorAll('.zoom-vue').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.vue) === i)); });
    var d = mouvementReduit ? 0 : 1;
    var sortie = zImage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 * d, easing: 'ease', fill: 'forwards' });
    Promise.all([sortie.finished, decoder(src)]).then(function () {
      if (jeton !== jetonVue) return;
      zImage.src = src;
      zImage.classList.toggle('est-presentation', i > 0);
      sortie.cancel();
      zImage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320 * d, easing: 'ease' });
    });
  }

  // Rectangle réellement occupé par l'image (en « contain », l'œuvre ne remplit pas toute sa boîte).
  function rectAffiche(img, largeur, hauteur) {
    var r = img.getBoundingClientRect();
    largeur = largeur || img.naturalWidth;
    hauteur = hauteur || img.naturalHeight;
    if (getComputedStyle(img).objectFit !== 'contain' || !largeur || !hauteur) {
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    var e = Math.min(r.width / largeur, r.height / hauteur);
    return { left: r.left + (r.width - largeur * e) / 2, top: r.top + (r.height - hauteur * e) / 2, width: largeur * e, height: hauteur * e };
  }
  function rectCarte(c) {
    // Tableau : l'œuvre elle-même ; photo : la zone visible de la carte.
    return c.produit.type === 'tableau' ? rectAffiche(c.img) : rectAffiche(c.img.parentNode);
  }
  function cadre(r) { return { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }; }
  function volant(src, r, tableau) {
    var v = creer('div', 'zoom-vol' + (tableau ? ' zoom-vol--tableau' : ''));
    var i = creer('img');
    i.src = src;
    i.alt = '';
    v.appendChild(i);
    var c = cadre(r);
    for (var k in c) v.style[k] = c[k];
    document.body.appendChild(v);
    return v;
  }

  function ouvrirZoom(carteEl) {
    if (!zoom || etat !== 'ferme' || !carteEl) return;
    var p = produit(carteEl.dataset.ref);
    if (!p) return;
    var img = carteEl.querySelector('.carte-produit-visuel img');
    courant = { produit: p, carte: carteEl, img: img, vue: 0, oeuvre: DOSSIER + (p.vignette || p.photo) };
    retourFocus = carteEl.querySelector('.carte-produit-nom');
    remplirZoom(p);

    etat = 'ouverture';
    fermerApres = false;
    history.replaceState(null, '', '#' + p.ref); // lien partageable vers la pièce
    zoom.hidden = false;
    document.documentElement.classList.add('zoom-ouvert');
    if (site) site.inert = true;

    var depart = rectCarte(courant);
    var arrivee = rectAffiche(zImage, img.naturalWidth, img.naturalHeight);
    var vol = volant(img.currentSrc || img.src, depart, p.type === 'tableau');
    img.style.visibility = 'hidden';
    zImage.style.opacity = '0';

    var d = mouvementReduit ? 0 : 1;
    animsZoom = [
      fond.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 * d, easing: 'ease', fill: 'both' }),
      panneau.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380 * d, delay: 180 * d, easing: 'ease', fill: 'both' }),
      vol.animate([cadre(depart), cadre(arrivee)], { duration: 720 * d, easing: LENT, fill: 'both' }),
      zSurtitre.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 600 * d, delay: 380 * d, easing: LENT, fill: 'both' }),
      zTitre.animate([{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], { duration: 750 * d, delay: 420 * d, easing: LENT, fill: 'both' }),
      zMarque.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700 * d, delay: 450 * d, easing: 'ease', fill: 'both' }),
      zVues.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600 * d, delay: 520 * d, easing: LENT, fill: 'both' }),
      zInfos.animate([{ clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }], { duration: 700 * d, delay: 300 * d, easing: LENT, fill: 'both' }),
      zContenu.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 650 * d, delay: 480 * d, easing: LENT, fill: 'both' })
    ];

    tout(animsZoom).then(function () {
      zImage.style.opacity = '';
      vol.remove();
      animsZoom.forEach(function (a) { a.cancel(); });
      animsZoom = [];
      etat = 'ouvert';
      if (fermerApres) { fermerZoom(); return; }
      zFermer.focus({ preventScroll: true });
      // Photo grand format chargée ensuite, puis substituée sans à-coup.
      if (p.vignette) {
        var hd = DOSSIER + p.photo;
        decoder(hd).then(function () {
          if (!courant || courant.produit !== p) return;
          courant.oeuvre = hd;
          if (courant.vue === 0) zImage.src = hd;
        });
      }
    });
  }

  function fermerZoom() {
    if (etat === 'ouverture') {
      fermerApres = true;
      animsZoom.forEach(function (a) { try { a.finish(); } catch (e) { /* déjà terminée */ } });
      return;
    }
    if (etat !== 'ouvert') return;
    etat = 'fermeture';
    history.replaceState(null, '', location.pathname + location.search);

    var c = courant;
    jetonVue++;
    if (c.vue !== 0) { // on repart de l'œuvre, pas d'une image de présentation
      zImage.getAnimations().forEach(function (a) { a.cancel(); });
      zImage.src = c.oeuvre;
      zImage.classList.remove('est-presentation');
      c.vue = 0;
    }
    var depart = rectAffiche(zImage, c.img.naturalWidth, c.img.naturalHeight);
    var arrivee = rectCarte(c);
    var vol = volant(c.oeuvre, depart, c.produit.type === 'tableau');
    zImage.style.opacity = '0';

    var d = mouvementReduit ? 0 : 1;
    animsZoom = [
      zLegende.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 * d, easing: 'ease', fill: 'both' }),
      zMarque.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 * d, easing: 'ease', fill: 'both' }),
      zVues.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 * d, easing: 'ease', fill: 'both' }),
      zInfos.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 * d, easing: 'ease', fill: 'both' }),
      panneau.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320 * d, delay: 80 * d, easing: 'ease', fill: 'both' }),
      fond.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480 * d, delay: 60 * d, easing: 'ease', fill: 'both' }),
      vol.animate([cadre(depart), cadre(arrivee)], { duration: 640 * d, easing: LENT, fill: 'both' })
    ];

    tout(animsZoom).then(function () {
      c.img.style.visibility = '';
      vol.remove();
      animsZoom.forEach(function (a) { a.cancel(); });
      animsZoom = [];
      zImage.style.opacity = '';
      zoom.hidden = true;
      document.documentElement.classList.remove('zoom-ouvert');
      if (site && etatPanier === 'ferme') site.inert = false;
      etat = 'ferme';
      courant = null;
      if (retourFocus && document.contains(retourFocus)) retourFocus.focus({ preventScroll: true });
    });
  }

  /* ---------- Panier : la sélection, dans une boîte qui s'ouvre à l'écran ----------
     Les pièces choisies s'y cumulent avec leur total ; un bouton permet d'appeler la maison.
     Clic à côté, croix ou Échap : la boîte se referme. */

  var panier = document.querySelector('[data-panier]');
  var etatPanier = 'ferme';
  var retourPanier = null;

  if (panier) {
    var pBoite = panier.querySelector('.panier-boite');
    var pFond = panier.querySelector('.panier-fond');
    var pListe = panier.querySelector('[data-panier-liste]');
    var pVide = panier.querySelector('[data-panier-vide]');
    var pPied = panier.querySelector('[data-panier-pied]');
    var pCompte = panier.querySelector('[data-panier-compte]');
    var pTotal = panier.querySelector('[data-panier-total]');
    var pNote = panier.querySelector('[data-panier-note]');

    document.querySelectorAll('[data-lien-selection]').forEach(function (lien) {
      lien.addEventListener('click', function (e) { e.preventDefault(); ouvrirPanier(); });
    });
    panier.querySelectorAll('[data-fermer-panier]').forEach(function (b) { b.addEventListener('click', fermerPanier); });
    pListe.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.retirer) retirer(b.dataset.retirer);
      else if (b.dataset.plus) changerQuantite(b.dataset.plus, 1);
      else if (b.dataset.moins) changerQuantite(b.dataset.moins, -1);
    });
    ecouteursSelection.push(function () { if (etatPanier !== 'ferme') remplirPanier(); });

    document.addEventListener('keydown', function (e) {
      if (etatPanier !== 'ouvert') return;
      if (e.key === 'Escape') { e.preventDefault(); fermerPanier(); return; }
      if (e.key !== 'Tab') return;
      var focusables = Array.prototype.filter.call(pBoite.querySelectorAll('button, a[href]'), function (x) { return !x.closest('[hidden]'); });
      var premier = focusables[0], dernier = focusables[focusables.length - 1];
      if (!pBoite.contains(document.activeElement)) { e.preventDefault(); premier.focus(); }
      else if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    });
  }

  function remplirPanier() {
    var total = 0, surDemande = 0;
    pListe.innerHTML = '';
    selection.forEach(function (l) {
      var p = produit(l.ref);
      if (!p) return;
      if (p.prix == null) surDemande += l.qte; else total += p.prix * l.qte;
      var li = creer('li', 'panier-ligne');
      var img = creer('img', 'panier-vignette' + (p.type === 'tableau' ? ' panier-vignette--tableau' : ''));
      img.src = DOSSIER + (p.vignette || p.photo);
      img.alt = '';

      var texte = creer('div', 'panier-texte');
      if (p.artiste) texte.appendChild(creer('p', 'panier-auteur', p.artiste));
      texte.appendChild(creer('p', 'panier-nom', p.nom));
      texte.appendChild(creer('p', 'panier-prix', p.prix == null ? prixFormate(null)
        : l.qte > 1 ? l.qte + ' × ' + prixFormate(p.prix) + ' = ' + prixFormate(p.prix * l.qte) : prixFormate(p.prix)));
      if (estUnique(p)) {
        texte.appendChild(creer('p', 'panier-unique', 'Pièce unique'));
      } else {
        var quantite = creer('div', 'panier-quantite');
        var moins = creer('button', '', '−');
        moins.type = 'button';
        moins.dataset.moins = p.ref;
        moins.setAttribute('aria-label', 'Un exemplaire de moins');
        var nombre = creer('span', '', String(l.qte));
        nombre.setAttribute('aria-label', 'Quantité : ' + l.qte);
        var plus = creer('button', '', '+');
        plus.type = 'button';
        plus.dataset.plus = p.ref;
        plus.setAttribute('aria-label', 'Un exemplaire de plus');
        quantite.appendChild(moins);
        quantite.appendChild(nombre);
        quantite.appendChild(plus);
        texte.appendChild(quantite);
      }

      var boutonRetirer = creer('button', 'panier-retirer');
      boutonRetirer.type = 'button';
      boutonRetirer.dataset.retirer = p.ref;
      boutonRetirer.setAttribute('aria-label', 'Retirer ' + p.nom + ' de la sélection');
      boutonRetirer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
      li.appendChild(img);
      li.appendChild(texte);
      li.appendChild(boutonRetirer);
      pListe.appendChild(li);
    });
    var n = nombrePieces();
    pCompte.textContent = n + (n > 1 ? ' pièces' : ' pièce');
    pListe.hidden = n === 0;
    pVide.hidden = n > 0;
    pPied.hidden = n === 0;
    pTotal.textContent = total ? prixFormate(total) : 'Sur demande';
    pNote.textContent = surDemande && total
      ? (surDemande > 1 ? 'Hors ' + surDemande + ' pièces au prix sur demande.' : 'Hors la pièce au prix sur demande.')
      : '';
  }

  function ouvrirPanier() {
    if (!panier || etatPanier !== 'ferme') return;
    retourPanier = document.activeElement;
    remplirPanier();
    etatPanier = 'ouverture';
    panier.hidden = false;
    document.documentElement.classList.add('panier-ouvert');
    if (site) site.inert = true;
    if (zoom && etat !== 'ferme') zoom.inert = true;
    var d = mouvementReduit ? 0 : 1;
    var anims = [
      pFond.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 * d, easing: 'ease', fill: 'both' }),
      pBoite.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: 650 * d, easing: LENT, fill: 'both' })
    ];
    tout(anims).then(function () {
      anims.forEach(function (a) { a.cancel(); });
      etatPanier = 'ouvert';
      panier.querySelector('.panier-fermer').focus({ preventScroll: true });
    });
  }

  function fermerPanier() {
    if (etatPanier !== 'ouvert') return;
    etatPanier = 'fermeture';
    var d = mouvementReduit ? 0 : 1;
    var anims = [
      pFond.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380 * d, easing: 'ease', fill: 'both' }),
      pBoite.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { duration: 480 * d, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'both' })
    ];
    tout(anims).then(function () {
      anims.forEach(function (a) { a.cancel(); });
      panier.hidden = true;
      document.documentElement.classList.remove('panier-ouvert');
      if (zoom && etat !== 'ferme') zoom.inert = false;
      else if (site) site.inert = false;
      etatPanier = 'ferme';
      if (retourPanier && document.contains(retourPanier)) retourPanier.focus({ preventScroll: true });
    });
  }

  /* ---------- En-tête : fond au défilement ---------- */

  var entete = document.getElementById('entete');
  function majEntete() { if (entete) entete.classList.toggle('est-defile', window.scrollY > 8); }
  majEntete();
  window.addEventListener('scroll', majEntete, { passive: true });

  /* ---------- Menu mobile ---------- */

  var menu = document.getElementById('menu-mobile');
  var boutonMenu = document.querySelector('.bouton-menu');
  if (menu && boutonMenu) {
    var fermerMenu = menu.querySelector('[data-fermer-menu]');
    var menuOuvert = function (ouvert) {
      menu.classList.toggle('est-ouvert', ouvert);
      boutonMenu.setAttribute('aria-expanded', String(ouvert));
      document.body.style.overflow = ouvert ? 'hidden' : '';
      (ouvert ? fermerMenu : boutonMenu).focus();
    };
    boutonMenu.addEventListener('click', function () { menuOuvert(true); });
    fermerMenu.addEventListener('click', function () { menuOuvert(false); });
    menu.querySelectorAll('nav a').forEach(function (a) { a.addEventListener('click', function () { menuOuvert(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('est-ouvert')) menuOuvert(false);
    });
  }

  /* ---------- Apparition douce au défilement ---------- */

  if ('IntersectionObserver' in window) {
    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('est-visible'); observateur.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    // Ce qui est déjà à l'écran au chargement s'affiche tout de suite (et reste net dans l'intro).
    var transformSite = site ? site.style.transform : '';
    if (site) site.style.transform = 'none';
    var limite = window.innerHeight;
    var aAnimer = Array.prototype.filter.call(document.querySelectorAll('.carte-produit, .carte-univers'), function (el) {
      return el.getBoundingClientRect().top > limite;
    });
    if (site) site.style.transform = transformSite;
    aAnimer.forEach(function (el, i) {
      el.classList.add('apparait');
      el.style.transitionDelay = (i % 5) * 70 + 'ms';
      observateur.observe(el);
    });
  }

  majSelection();

  // Lien direct vers une pièce (index.html#<ref>) : on ouvre son zoom dès le chargement.
  var refInitiale = decodeURIComponent(location.hash.slice(1));
  if (grille && refInitiale && produit(refInitiale)) {
    var carteInitiale = grille.querySelector('[data-ref="' + CSS.escape(refInitiale) + '"]');
    carteInitiale.scrollIntoView({ block: 'center' });
    requestAnimationFrame(function () { ouvrirZoom(carteInitiale); });
  }

  /* ---------- Intro de première visite ----------
     1. Sur fond noir, le logo se construit : l'ovale s'ouvre, MAISON s'écrit une lettre
        à la fois, les lettres de VALMONTE se lèvent, le monogramme et la signature suivent.
        Il reste affiché, entier, un court instant.
     2. Mode « défilé » (par défaut) : le logo s'efface et les univers de la section
        Catégories défilent en grand ; puis le noir s'efface sur le site.
        (Mode « miniature » : le logo vole dans l'en-tête, le site apparaît réduit puis se déploie.)
     Passer, scroller, toucher ou taper une touche accélère jusqu'à la fin. */

  (function intro() {
    var racine = document.documentElement;
    if (!racine.classList.contains('avec-intro')) return;
    clearTimeout(window.__introSecours);

    var marqueEntete = document.querySelector('.entete .logo-marque');
    var LOGO = window.LOGO;
    if (!marqueEntete || !LOGO || !site) { racine.classList.remove('avec-intro'); return; }

    var anims = [];
    var fini = false;
    var passee = false;

    // Le logo blanc de l'intro est reconstruit partie par partie (images dans assets/images/marque/intro/).
    var scene = creer('div', 'intro-scene');
    var logo = creer('div', 'intro-logo');
    var parties = { anneau: [], maison: [], nom: [], tiret: [], monogramme: [], signature: [] };
    var sources = [];
    LOGO.parties.forEach(function (p) {
      var bloc = creer('span', 'intro-partie intro-partie--' + p.type);
      bloc.style.left = p.b[0] + '%';
      bloc.style.top = p.b[1] + '%';
      bloc.style.width = p.b[2] + '%';
      bloc.style.height = p.b[3] + '%';
      var url = new URL(LOGO.dossier + p.fichier, document.baseURI).href;
      var encre = creer('img', 'intro-encre');
      encre.src = url;
      encre.alt = '';
      bloc.appendChild(encre);
      logo.appendChild(bloc);
      (parties[p.type] = parties[p.type] || []).push(bloc);
      sources.push(url);
    });
    var passer = creer('button', 'intro-passer', 'Passer');
    passer.type = 'button';
    var barre = creer('span', 'intro-passer-barre');
    barre.appendChild(creer('span'));
    passer.appendChild(barre);
    scene.setAttribute('aria-hidden', 'true');
    logo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(scene);
    document.body.appendChild(logo);
    document.body.appendChild(passer);

    // Mode défilé : les univers de la section Catégories, reconstruits en grand.
    var modeDefile = racine.getAttribute('data-intro-mode') !== 'miniature';
    var defile = null, piste = null;
    if (modeDefile) {
      var cartesUnivers = Array.prototype.slice.call(document.querySelectorAll('.univers-grille .carte-univers'));
      if (cartesUnivers.length) {
        defile = creer('div', 'intro-defile');
        piste = creer('div', 'intro-piste');
        cartesUnivers.forEach(function (c, i) {
          var u = creer('div', 'intro-univers' + (c.classList.contains('carte-univers--tableau') ? ' intro-univers--tableau' : ''));
          var im = creer('img');
          im.src = c.querySelector('img').src;
          im.alt = '';
          u.appendChild(im);
          u.appendChild(creer('span', 'intro-univers-index', '0' + (i + 1) + ' / 0' + cartesUnivers.length));
          u.appendChild(creer('span', 'intro-univers-titre', c.querySelector('.carte-univers-titre').textContent));
          u.appendChild(creer('span', 'intro-univers-accroche', c.querySelector('.carte-univers-accroche').textContent));
          piste.appendChild(u);
          sources.push(im.src);
        });
        defile.appendChild(piste);
        defile.setAttribute('aria-hidden', 'true');
        document.body.appendChild(defile);
      } else {
        modeDefile = false;
        racine.setAttribute('data-intro-mode', 'miniature');
      }
    }

    function accelerer() {
      if (fini || passee) return;
      passee = true;
      if (!anims.length) { terminer(); return; }
      anims.forEach(function (a) { try { a.updatePlaybackRate(8); } catch (e) { a.finish(); } });
    }
    function clic(e) {
      if (passer.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      accelerer();
    }
    passer.addEventListener('click', accelerer);
    document.addEventListener('click', clic, true);
    ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.addEventListener(t, accelerer, { passive: true }); });

    function terminer() {
      if (fini) return;
      fini = true;
      anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* déjà terminée */ } });
      racine.classList.remove('avec-intro');
      [scene, logo, passer].forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
      if (defile && defile.parentNode) defile.parentNode.removeChild(defile);
      document.removeEventListener('click', clic, true);
      ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.removeEventListener(t, accelerer); });
      try { localStorage.setItem('intro-vue', '1'); } catch (e) { /* stockage indisponible */ }
      // Prêt pour la mesure du taux de « Passer » quand un outil de statistiques sera branché.
      document.dispatchEvent(new CustomEvent('intro:fin', { detail: { passee: passee } }));
    }

    function demarrer() {
      if (fini) return;
      try {
        var vw = document.documentElement.clientWidth;
        var vh = window.innerHeight;

        // Le logo au centre : 27 % de la largeur (42 % sur mobile), 400 px au plus.
        var largeur = Math.min(vw * (vw < 600 ? 0.42 : 0.27), vh * 0.36 * LOGO.ratio, 400);
        var hauteur = largeur / LOGO.ratio;
        var L = (vw - largeur) / 2;
        var T = (vh - hauteur) / 2;
        logo.style.left = L + 'px';
        logo.style.top = T + 'px';
        logo.style.width = largeur + 'px';
        logo.style.height = hauteur + 'px';

        // Destination : le logo de l'en-tête, site à taille réelle.
        site.style.transform = 'none';
        var cible = marqueEntete.getBoundingClientRect();
        site.style.transform = '';
        var s = cible.width / largeur;

        function anim(el, images, options) { var a = el.animate(images, options); anims.push(a); return a; }
        var flou = 'blur(' + Math.max(1, largeur * 0.004).toFixed(1) + 'px)';

        // 1. L'ovale s'ouvre
        parties.anneau.forEach(function (b) {
          anim(b, [{ clipPath: 'inset(50% 0% 50% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }],
            { duration: 1000, delay: 150, easing: LENT, fill: 'both' });
        });
        // 2. MAISON s'écrit une lettre à la fois
        parties.maison.forEach(function (b, i) {
          anim(b, [
            { opacity: 0, transform: 'translateY(30%)', filter: flou },
            { opacity: 1, transform: 'none', filter: 'blur(0px)' }
          ], { duration: 420, delay: 450 + i * 75, easing: LENT, fill: 'both' });
        });
        // 3. Les lettres de VALMONTE se lèvent, une à une
        parties.nom.forEach(function (b, i) {
          anim(b.firstChild, [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }],
            { duration: 800, delay: 750 + i * 65, easing: LENT, fill: 'both' });
        });
        // 4. Les tirets se tracent depuis le monogramme, qui apparaît
        parties.tiret.forEach(function (b, i) {
          b.style.transformOrigin = i === 0 ? '100% 50%' : '0% 50%';
          anim(b, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
            { duration: 650, delay: 1350, easing: LENT, fill: 'both' });
        });
        parties.monogramme.forEach(function (b) {
          anim(b, [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'none' }],
            { duration: 700, delay: 1400, easing: LENT, fill: 'both' });
        });
        // 5. La signature s'écrit de gauche à droite
        parties.signature.forEach(function (b) {
          anim(b, [{ clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }],
            { duration: 800, delay: 1550, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'both' });
        });

        // Fin de la construction du logo
        var FIN_LOGO = Math.max.apply(null, anims.map(function (a) { return a.effect.getComputedTiming().endTime; }));
        var FIN, DISPARITION_PASSER;
        if (modeDefile) {
          // 6. Le logo reste entier un instant, bien visible, puis s'efface doucement
          var EFFACEMENT = FIN_LOGO + 850;
          anim(logo, [
            { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
            { opacity: 0, transform: 'scale(0.96)', filter: flou }
          ], { duration: 650, delay: EFFACEMENT, easing: 'ease', fill: 'both' });

          // 7. Les univers de la section Catégories défilent en grand, de droite à gauche
          var H = Math.min(vh * 0.72, 760);
          var W = H * 0.62;
          var G = Math.max(24, vw * 0.03);
          var n = piste.children.length;
          piste.style.top = (vh - H) / 2 + 'px';
          piste.style.gap = G + 'px';
          Array.prototype.forEach.call(piste.children, function (u) { u.style.width = W + 'px'; u.style.height = H + 'px'; });
          var debutPiste = vw * 0.5 - W / 2;                         // le 1er univers commence au centre
          var finPiste = vw * 0.5 - ((n - 1) * (W + G) + W / 2);     // le dernier finit au centre
          var DEBUT_DEFILE = EFFACEMENT + 300;
          var DUREE_DEFILE = 3500;
          anim(defile, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: DEBUT_DEFILE, easing: 'ease', fill: 'both' });
          anim(piste, [{ transform: 'translateX(' + debutPiste + 'px)' }, { transform: 'translateX(' + finPiste + 'px)' }],
            { duration: DUREE_DEFILE, delay: DEBUT_DEFILE, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' });

          // 8. Le noir et le défilé s'effacent : le site apparaît, le logo de l'en-tête avec lui
          var REVELATION = DEBUT_DEFILE + DUREE_DEFILE - 450;
          anim(defile, [{ opacity: 1 }, { opacity: 0 }], { duration: 750, delay: REVELATION, easing: 'ease', fill: 'forwards' });
          anim(scene, [{ opacity: 1 }, { opacity: 0 }], { duration: 750, delay: REVELATION, easing: 'ease', fill: 'forwards' });
          anim(marqueEntete.parentNode, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: REVELATION + 300, easing: 'ease', fill: 'both' });
          FIN = REVELATION + 1000;
          DISPARITION_PASSER = REVELATION - 250;
        } else {
          var VOL = FIN_LOGO + 150;
          var DEPLOIEMENT = VOL + 1500;
          // 6. Le logo rétrécit jusqu'à sa place dans l'en-tête. Blanc pur sur le noir ; à l'arrivée,
          //    très légèrement atténué pour qu'en « différence » il soit noir sur le parchemin,
          //    exactement comme le logo de l'en-tête qui prend le relais.
          anim(logo, [
            { transform: 'translate(0px, 0px) scale(1)', filter: 'brightness(1)' },
            { transform: 'translate(' + (cible.left - L) + 'px, ' + (cible.top - T) + 'px) scale(' + s + ')', filter: 'brightness(0.894)' }
          ], { duration: 1000, delay: VOL, easing: TRAJET, fill: 'both' });
          // 7. Le site apparaît en entier sur le fond, à 80 % de sa taille : il s'ouvre depuis le centre
          anim(site, [{ clipPath: 'inset(50% 0% 50% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }],
            { duration: 900, delay: VOL + 300, easing: LENT, fill: 'forwards' });
          // 8. Il se déploie en plein écran
          anim(site, [{ transform: 'scale(0.8)' }, { transform: 'scale(1)' }],
            { duration: 1050, delay: DEPLOIEMENT, easing: TRAJET, fill: 'forwards' });
          FIN = DEPLOIEMENT + 1050;
          DISPARITION_PASSER = DEPLOIEMENT - 150;
        }
        // Bouton « Passer » : sa barre suit la durée, il s'efface avant la fin
        anim(barre.firstChild, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
          { duration: FIN, easing: 'linear', fill: 'both' });
        anim(passer, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: DISPARITION_PASSER, easing: 'ease', fill: 'forwards' });

        tout(anims).then(terminer, terminer);
      } catch (e) {
        terminer();
      }
    }

    // On attend les parties du logo et les polices (1,6 s au plus).
    var attentes = sources.map(decoder);
    attentes.push(decoder(new URL('assets/images/marque/valmonte-logo-noir.png', document.baseURI).href));
    if (document.fonts && document.fonts.load) {
      attentes.push(document.fonts.load('400 1em "Cormorant Garamond"'), document.fonts.load('400 1em "EB Garamond"'));
    }
    Promise.race([
      Promise.all(attentes).catch(function () {}),
      new Promise(function (ok) { setTimeout(ok, 1600); })
    ]).then(demarrer);
  })();
})();
