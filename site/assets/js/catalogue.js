/* ==========================================================================
   Catalogue Maison Valmonte — la seule liste à modifier pour les produits.
   La grille, les filtres, le zoom produit et le panier se construisent à partir d'ici.

   Ajouter une pièce : copier un bloc, changer ses valeurs, et déposer ses photos
   dans assets/produits/<dossier>/ en les nommant comme sa « ref » :
     <dossier>/<ref>.jpg                   grande photo (zoom)
     <dossier>/vignettes/<ref>.jpg         petite photo (grille, panier), facultative
     <dossier>/presentation-<ref>.jpg      mise en situation (-2, -3… s'il y en a plusieurs), facultative
   type : 'tableau' = œuvre montrée en entier sur un mur ; 'photo' = photo d'objet.
   statut : 'disponible' ou 'vendu'.   prix : en euros, ou null pour afficher « Prix sur demande ».
   ========================================================================== */

/* Coordonnées de la maison, utilisées par le panier */
window.BOUTIQUE = {
  telephone: '',        // numéro appelé depuis le panier, au format international, ex. '+33612345678'
  telephoneAffiche: ''  // le même, tel qu'il s'affiche, ex. '06 12 34 56 78'
};

window.CATALOGUE = {
  categories: [
    { id: 'objets', nom: 'Objets' },
    { id: 'vases', nom: 'Vases' },
    { id: 'luminaires', nom: 'Luminaires' },
    { id: 'mobilier', nom: 'Mobilier' },
    { id: 'art', nom: 'Art mural' }
  ],

  produits: [
    /* ---- Tableaux d'Arome (textes de présentation provisoires) ---- */
    {
      ref: 'arome-la-chute-du-roi', nom: 'La chute du roi', artiste: 'Arome',
      categorie: 'art', type: 'tableau', statut: 'disponible', prix: 6800,
      photo: 'arome/arome-la-chute-du-roi.jpg', vignette: 'arome/vignettes/arome-la-chute-du-roi.jpg',
      description: "Un crâne bleu aux dents serrées fait face à un roi couronné d'or. Entre « Death » et « Life », Arome met en scène la fragilité du pouvoir dans une explosion de rouge et de jaune.",
      details: [['Artiste', 'Arome'], ['Œuvre', 'Originale, signée']]
    },
    {
      ref: 'arome-ocean-de-fleurs', nom: 'Océan de fleurs', artiste: 'Arome',
      categorie: 'art', type: 'tableau', statut: 'disponible', prix: 5900,
      photo: 'arome/arome-ocean-de-fleurs.jpg', vignette: 'arome/vignettes/arome-ocean-de-fleurs.jpg',
      description: "« Perdu dans un océan de fleurs » : un visage rêveur, une fleur à la main, au milieu d'une prairie bleue où la pluie croise le soleil.",
      details: [['Artiste', 'Arome'], ['Œuvre', 'Originale, signée']]
    },
    {
      ref: 'arome-supporte-moi', nom: 'Supporte-moi', artiste: 'Arome',
      categorie: 'art', type: 'tableau', statut: 'disponible', prix: 7500,
      photo: 'arome/arome-supporte-moi.jpg', vignette: 'arome/vignettes/arome-supporte-moi.jpg',
      description: "Deux visages qui se tiennent l'un l'autre, une main posée sur les yeux. Sur la toile brute, le bleu électrique répond à l'orange : une œuvre sur le soutien et l'abandon.",
      details: [['Artiste', 'Arome'], ['Œuvre', 'Originale, signée']]
    },
    {
      ref: 'arome-titans', nom: 'Titans', artiste: 'Arome',
      categorie: 'art', type: 'tableau', statut: 'disponible', prix: 4700,
      photo: 'arome/arome-titans.jpg', vignette: 'arome/vignettes/arome-titans.jpg',
      description: "« Urbain Brain », « Titan City » : deux géants s'interpellent au-dessus des immeubles, un papillon bleu entre eux. La ville comme un cri.",
      details: [['Artiste', 'Arome'], ['Œuvre', 'Originale, signée']]
    },
    {
      ref: 'arome-le-bain', nom: 'Le bain', artiste: 'Arome',
      categorie: 'art', type: 'tableau', statut: 'disponible', prix: 3900,
      photo: 'arome/arome-le-bain.jpg', vignette: 'arome/vignettes/arome-le-bain.jpg',
      description: "Une baigneuse auréolée s'abandonne dans une baignoire sur pieds, sous la pluie bleue de la douche. « Clean, clean, clean » : une scène d'intimité ironique, d'un trait vif sur fond blanc.",
      details: [['Artiste', 'Arome'], ['Œuvre', 'Originale, signée']]
    },
    {
      ref: 'arome-umbrella', nom: 'Umbrella', artiste: 'Arome',
      categorie: 'art', type: 'tableau', statut: 'disponible', prix: 5200,
      photo: 'arome/arome-umbrella.jpg', vignette: 'arome/vignettes/arome-umbrella.jpg',
      description: "Un parapluie rouge et blanc tendu sous un ciel de nuages qui ruissellent, face à deux crânes. L'humour noir d'Arome, en plein ciel bleu.",
      details: [['Artiste', 'Arome'], ['Œuvre', 'Originale, signée']]
    },
    {
      ref: 'arome-please', nom: 'Please', artiste: 'Arome',
      categorie: 'art', type: 'tableau', statut: 'disponible', prix: 2500,
      photo: 'arome/arome-please.jpg', vignette: 'arome/vignettes/arome-please.jpg',
      description: "Un visage couronné, bouche ouverte, auréolé de traits jaunes. Sur le côté, un mot griffonné : « Please ». Un portrait brut et direct.",
      details: [['Artiste', 'Arome'], ['Œuvre', 'Originale, signée']]
    },

    /* ---- Luminaires (texte de présentation provisoire) ---- */
    {
      ref: 'lampe-1920', nom: 'Lampe 1920',
      categorie: 'luminaires', type: 'photo', statut: 'disponible', prix: null, // prix à confirmer
      photo: 'luminaires/lampe-1920.jpg', vignette: 'luminaires/vignettes/lampe-1920.jpg',
      presentations: ['luminaires/presentation-lampe-1920.jpg'],
      description: "Une lampe de table au charme des années 1920 : dôme d'opaline crème cerclé de laiton, colonne de bois sombre, cheminée de verre. Allumée, elle diffuse une lumière douce et dorée.",
      details: [['Matières', 'Laiton, bois, opaline et verre']]
    }
  ]
};
