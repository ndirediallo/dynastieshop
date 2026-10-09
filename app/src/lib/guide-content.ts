import type { Module } from "@/lib/permissions";

export interface GuideTopic {
  slug: string;
  title: string;
  steps: string[];
  // Chemin sous /public/guide-assets/<module>/... (jamais /guide/... tout
  // court : collision avec la route protégée /guide/[module], voir
  // src/proxy.ts) — captures réelles de l'app, pas des maquettes, pour
  // rester fidèles au jour de la capture (voir discussion avec
  // l'utilisateur : à regénérer après un gros changement visuel plutôt que
  // de laisser une capture obsolète).
  screenshot: string;
}

export interface GuideModule {
  key: Module;
  label: string;
  description: string;
  topics: GuideTopic[];
}

// Construit module par module (voir discussion avec l'utilisateur) — un
// module absent d'ici n'apparaît simplement pas encore dans /guide, plutôt
// que d'y figurer vide ou "à venir".
export const GUIDE_MODULES: GuideModule[] = [
  {
    key: "ventes",
    label: "Vendre",
    description: "Enregistrer une vente, appliquer une remise, ajouter une livraison, vendre à crédit et gérer les reçus.",
    topics: [
      {
        slug: "vente-simple",
        title: "Faire une vente simple",
        steps: [
          "Ouvrez « Vendre » dans le menu de gauche.",
          "Cliquez sur les produits à ajouter au panier (choisissez la variante si le produit en propose plusieurs, comme une couleur ou une taille).",
          "Vérifiez le panier et le total à droite, puis cliquez sur « Encaisser ».",
          "Choisissez le moyen de paiement (espèces, Orange Money, etc.) et validez.",
          "Le reçu s'affiche automatiquement : vous pouvez l'imprimer ou le partager.",
        ],
        screenshot: "/guide-assets/ventes/vente-simple.png",
      },
      {
        slug: "remise",
        title: "Appliquer une remise",
        steps: [
          "Dans le panier, ouvrez le bloc « Remise ».",
          "Choisissez le mode : en pourcentage (%) ou en montant fixe (GNF).",
          "Saisissez la valeur, ou utilisez un des boutons rapides (5 %, 10 %...).",
          "Le total se met à jour automatiquement avant l'encaissement.",
        ],
        screenshot: "/guide-assets/ventes/remise.png",
      },
      {
        slug: "livraison",
        title: "Ajouter une livraison",
        steps: [
          "Dans le panier, cochez la case « Livraison ».",
          "Un montant par défaut se remplit automatiquement (réglable dans Paramètres).",
          "Modifiez-le si besoin pour ce client précis (zone plus loin, livraison offerte...).",
          "Ce montant s'ajoute au total encaissé et apparaît comme une ligne séparée sur le reçu.",
        ],
        screenshot: "/guide-assets/ventes/livraison.png",
      },
      {
        slug: "vente-credit",
        title: "Faire une vente à crédit",
        steps: [
          "Constituez le panier normalement, puis sélectionnez un client existant (ou créez-en un).",
          "Passez en mode « Crédit » au moment de l'encaissement.",
          "Saisissez l'acompte versé maintenant (0 si rien n'est payé tout de suite).",
          "Le reste à payer apparaît dans le module « Crédits », où le remboursement se fera plus tard.",
        ],
        screenshot: "/guide-assets/ventes/vente-credit.png",
      },
      {
        slug: "recu",
        title: "Imprimer ou partager le reçu",
        steps: [
          "Une fois la vente validée, le reçu s'ouvre automatiquement.",
          "Utilisez « Imprimer » pour une imprimante thermique, ou téléchargez-le en PDF.",
          "Le bouton WhatsApp permet d'envoyer directement le reçu au client.",
          "Vous pouvez retrouver ce reçu plus tard depuis l'historique des ventes.",
        ],
        screenshot: "/guide-assets/ventes/recu.png",
      },
      {
        slug: "signaler-erreur",
        title: "Signaler une erreur sur une vente déjà enregistrée",
        steps: [
          "Ouvrez la vente concernée depuis « Historique des ventes ».",
          "Cliquez sur « Signaler une erreur » et expliquez le problème.",
          "Un Caissier ne peut pas corriger lui-même une vente déjà enregistrée : seul le Super Admin peut valider la correction, pour éviter les erreurs ou abus.",
          "Le Super Admin voit la demande et effectue le retour ou l'ajustement nécessaire.",
        ],
        screenshot: "/guide-assets/ventes/signaler-erreur.png",
      },
    ],
  },
  {
    key: "stocks",
    label: "Stock",
    description: "Vérifier la disponibilité d'un produit, consulter le stock par emplacement, faire un inventaire et comprendre les alertes.",
    topics: [
      {
        slug: "repartition-produit",
        title: "Vérifier la disponibilité d'un produit par emplacement",
        steps: [
          "Ouvrez « Produits » dans le menu de gauche.",
          "Sur la ligne du produit concerné, cliquez sur l'icône de répartition du stock.",
          "La fenêtre affiche la quantité disponible dans chaque boutique et à l'entrepôt, variante par variante.",
        ],
        screenshot: "/guide-assets/stocks/repartition-produit.png",
      },
      {
        slug: "consulter-stock",
        title: "Consulter le stock de l'entrepôt ou d'une boutique",
        steps: [
          "Ouvrez « Stock » dans le menu de gauche : vous voyez par défaut le stock de l'entrepôt central.",
          "Utilisez le sélecteur de boutique en haut de page pour voir le stock d'un emplacement précis.",
          "Un Caissier ou Logistique ne voit que le stock de sa propre boutique.",
        ],
        screenshot: "/guide-assets/stocks/consulter-stock.png",
      },
      {
        slug: "inventaire",
        title: "Faire un inventaire",
        steps: [
          "Depuis « Stock », cliquez sur « Faire un inventaire » (réservé au Super Admin et à Logistique).",
          "Comptez physiquement chaque article et saisissez la quantité réelle trouvée.",
          "Cliquez sur « Valider l'inventaire » : les écarts avec le stock théorique sont ajustés automatiquement.",
          "Chaque inventaire reste consultable plus tard dans l'historique des inventaires.",
        ],
        screenshot: "/guide-assets/stocks/inventaire.png",
      },
      {
        slug: "alertes",
        title: "Comprendre les alertes de stock faible ou en rupture",
        steps: [
          "Sur le tableau de bord, la carte « Produits en alerte » indique combien d'articles sont sous le seuil d'alerte ou en rupture.",
          "Cliquez dessus pour voir la liste complète, avec la boutique concernée pour chaque article.",
          "Le seuil d'alerte par défaut se règle dans Paramètres, et peut être ajusté produit par produit.",
        ],
        screenshot: "/guide-assets/stocks/alertes.png",
      },
    ],
  },
  {
    key: "transferts",
    label: "Transferts",
    description: "Demander un réapprovisionnement, créer un transfert entre l'entrepôt et une boutique, et confirmer une réception.",
    topics: [
      {
        slug: "demander-reapprovisionnement",
        title: "Demander un réapprovisionnement",
        steps: [
          "Depuis « Produits », repérez l'article à faible stock et cliquez sur l'icône « Demander un réapprovisionnement ».",
          "Indiquez la quantité souhaitée, puis envoyez la demande.",
          "Le Super Admin ou Logistique voit la demande arriver dans « Transferts » et peut la transformer en transfert réel.",
        ],
        screenshot: "/guide-assets/transferts/demander-reapprovisionnement.png",
      },
      {
        slug: "creer-transfert",
        title: "Créer un transfert",
        steps: [
          "Ouvrez « Transferts » puis « Nouveau transfert » (réservé au Super Admin et à Logistique).",
          "Choisissez l'origine (en général l'entrepôt central) et la destination (une boutique).",
          "Ajoutez les produits et les quantités à envoyer, puis validez.",
          "Le stock ne bouge pas tout de suite : il attend la confirmation de réception côté destination.",
        ],
        screenshot: "/guide-assets/transferts/creer-transfert.png",
      },
      {
        slug: "confirmer-reception",
        title: "Confirmer la réception d'un transfert",
        steps: [
          "Ouvrez le transfert concerné depuis « Transferts ».",
          "Une fois la marchandise physiquement arrivée, cliquez sur « Confirmer la réception ».",
          "Le stock se met à jour automatiquement dans les deux emplacements (retiré de l'origine, ajouté à la destination).",
        ],
        screenshot: "/guide-assets/transferts/confirmer-reception.png",
      },
    ],
  },
  {
    key: "produits",
    label: "Produits",
    description: "Ajouter un produit avec ses variantes, gérer les catégories et désactiver un produit obsolète.",
    topics: [
      {
        slug: "ajouter-produit",
        title: "Ajouter un produit",
        steps: [
          "Ouvrez « Produits » puis « Nouveau produit ».",
          "Renseignez le nom, la catégorie et une photo.",
          "Ajoutez une ou plusieurs variantes (couleur, taille...) avec leur prix et la quantité reçue — elle entre directement dans le stock de l'entrepôt.",
          "Enregistrez : le produit est immédiatement disponible en Caisse.",
        ],
        screenshot: "/guide-assets/produits/ajouter-produit.png",
      },
      {
        slug: "categories",
        title: "Gérer les catégories",
        steps: [
          "Depuis « Produits », cliquez sur « Gérer les catégories ».",
          "Créez, renommez ou supprimez une catégorie ou une sous-catégorie.",
          "Une catégorie encore utilisée par un produit ne peut pas être supprimée.",
        ],
        screenshot: "/guide-assets/produits/categories.png",
      },
      {
        slug: "desactiver-produit",
        title: "Désactiver un produit",
        steps: [
          "Sur la liste des produits, utilisez l'interrupteur à côté du produit concerné.",
          "Un produit désactivé disparaît de la Caisse mais garde tout son historique (ventes, achats, stock).",
          "Réactivez-le à tout moment avec le même interrupteur.",
        ],
        screenshot: "/guide-assets/produits/desactiver-produit.png",
      },
    ],
  },
  {
    key: "fournisseurs",
    label: "Fournisseurs",
    description: "Ajouter un fournisseur, passer une commande, réceptionner la marchandise et suivre les dettes.",
    topics: [
      {
        slug: "ajouter-fournisseur",
        title: "Ajouter un fournisseur",
        steps: [
          "Ouvrez « Fournisseurs » puis « Ajouter un fournisseur ».",
          "Renseignez son nom et ses coordonnées de contact.",
          "Il est ensuite disponible lors de la création d'une commande.",
        ],
        screenshot: "/guide-assets/fournisseurs/ajouter-fournisseur.png",
      },
      {
        slug: "passer-commande",
        title: "Passer une commande",
        steps: [
          "Ouvrez « Fournisseurs » → « Commandes » → « Nouvelle commande ».",
          "Choisissez le fournisseur, puis ajoutez les produits et quantités commandés.",
          "Cliquez sur « Créer la commande ». Elle apparaît en attente de réception.",
        ],
        screenshot: "/guide-assets/fournisseurs/passer-commande.png",
      },
      {
        slug: "reception-commande",
        title: "Réceptionner une commande",
        steps: [
          "Ouvrez la commande concernée depuis « Commandes ».",
          "Indiquez les quantités réellement reçues pour chaque article (elles peuvent différer de la commande initiale).",
          "Cliquez sur « Enregistrer la réception » : le stock de l'entrepôt augmente automatiquement, et la dette fournisseur se met à jour.",
        ],
        screenshot: "/guide-assets/fournisseurs/reception-commande.png",
      },
      {
        slug: "dettes-paiements",
        title: "Suivre les dettes et paiements fournisseurs",
        steps: [
          "Ouvrez « Fournisseurs » → « Dettes » pour voir le solde dû à chaque fournisseur.",
          "Cliquez sur « Enregistrer un paiement » pour noter un règlement, partiel ou total.",
          "L'historique des paiements reste consultable pour chaque fournisseur.",
        ],
        screenshot: "/guide-assets/fournisseurs/dettes-paiements.png",
      },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    description: "Créer une fiche client et la retrouver en caisse.",
    topics: [
      {
        slug: "creer-fiche-client",
        title: "Créer une fiche client",
        steps: [
          "Ouvrez « Clients » puis « Ajouter un client ».",
          "Renseignez au minimum son nom (le téléphone est utile pour le retrouver vite).",
          "Enregistrez : le client est désormais disponible lors d'une vente.",
        ],
        screenshot: "/guide-assets/clients/creer-fiche-client.png",
      },
      {
        slug: "utiliser-client-caisse",
        title: "Utiliser un client en caisse",
        steps: [
          "Pendant une vente, ouvrez la liste « Client (optionnel) » et sélectionnez-le, ou créez-le directement depuis ce menu.",
          "C'est obligatoire pour une vente à crédit — le solde dû doit être rattaché à quelqu'un.",
          "Pour un client de passage ponctuel, laissez « Client de passage » : rien n'oblige à créer une fiche.",
        ],
        screenshot: "/guide-assets/clients/utiliser-client-caisse.png",
      },
    ],
  },
  {
    key: "credits",
    label: "Crédits",
    description: "Comprendre une vente à crédit et enregistrer les remboursements d'un client.",
    topics: [
      {
        slug: "comprendre-vente-credit",
        title: "Comprendre une vente à crédit",
        steps: [
          "Une vente à crédit est une vente où le client ne paie pas tout (ou rien) le jour même.",
          "Le solde restant dû apparaît dans « Crédits », rattaché au client.",
          "Aucune échéance n'est imposée par le système : le client rembourse quand il peut, en une ou plusieurs fois.",
        ],
        screenshot: "/guide-assets/credits/comprendre-vente-credit.png",
      },
      {
        slug: "enregistrer-remboursement",
        title: "Enregistrer un remboursement",
        steps: [
          "Ouvrez « Crédits » et sélectionnez la vente concernée.",
          "Cliquez sur « Enregistrer un remboursement ».",
          "Indiquez le montant versé et la méthode de paiement : le solde dû diminue immédiatement.",
        ],
        screenshot: "/guide-assets/credits/enregistrer-remboursement.png",
      },
    ],
  },
  {
    key: "depenses",
    label: "Dépenses",
    description: "Enregistrer une dépense ponctuelle et mettre en place les dépenses fixes récurrentes.",
    topics: [
      {
        slug: "depense-ponctuelle",
        title: "Enregistrer une dépense ponctuelle",
        steps: [
          "Ouvrez « Dépenses » puis « Ajouter une dépense ».",
          "Indiquez le montant, une description et la boutique concernée.",
          "Enregistrez : elle apparaît immédiatement dans le total des dépenses de la période.",
        ],
        screenshot: "/guide-assets/depenses/depense-ponctuelle.png",
      },
      {
        slug: "depense-fixe",
        title: "Mettre en place une dépense fixe récurrente",
        steps: [
          "Ouvrez « Dépenses » puis « Dépenses fixes » pour configurer un montant récurrent (loyer, salaires...).",
          "Chaque mois, cliquez sur « Enregistrer ce mois » à côté de la dépense fixe concernée pour la comptabiliser.",
          "Une dépense fixe non enregistrée un mois donné ne compte simplement pas dans les totaux de ce mois-là.",
        ],
        screenshot: "/guide-assets/depenses/depense-fixe.png",
      },
    ],
  },
  {
    key: "boutiques",
    label: "Boutiques",
    description: "Créer, modifier et activer ou désactiver un emplacement (boutique ou entrepôt).",
    topics: [
      {
        slug: "creer-boutique",
        title: "Créer une boutique ou un entrepôt",
        steps: [
          "Ouvrez « Boutiques » puis « Ajouter une boutique ».",
          "Renseignez le nom, le type (boutique ou entrepôt) et l'adresse.",
          "Enregistrez : l'emplacement est immédiatement disponible pour les ventes, le stock et les transferts.",
        ],
        screenshot: "/guide-assets/boutiques/creer-boutique.png",
      },
      {
        slug: "activer-desactiver-boutique",
        title: "Activer ou désactiver une boutique",
        steps: [
          "Sur la liste des boutiques, utilisez l'interrupteur à côté de l'emplacement concerné.",
          "Une boutique désactivée disparaît des listes de vente et de transfert, mais garde tout son historique.",
          "Réactivez-la à tout moment avec le même interrupteur.",
        ],
        screenshot: "/guide-assets/boutiques/activer-desactiver-boutique.png",
      },
    ],
  },
  {
    key: "utilisateurs",
    label: "Utilisateurs",
    description: "Créer un compte, choisir le bon rôle, accorder un accès supplémentaire et suivre l'activité d'un utilisateur.",
    topics: [
      {
        slug: "creer-compte",
        title: "Créer un compte utilisateur",
        steps: [
          "Ouvrez « Utilisateurs » puis « Ajouter un utilisateur ».",
          "Renseignez le nom, le numéro de téléphone (c'est l'identifiant de connexion), le rôle et la boutique.",
          "Le mot de passe par défaut est 0000 — la personne devra en choisir un autre dès sa première connexion.",
        ],
        screenshot: "/guide-assets/utilisateurs/creer-compte.png",
      },
      {
        slug: "acces-supplementaire",
        title: "Donner un accès supplémentaire ponctuel",
        steps: [
          "Dans la fiche de l'utilisateur, cochez un module dans « Accès supplémentaires » (ex. Stock pour un Caissier qui doit aussi vérifier les quantités).",
          "Cet accès vient s'ajouter au rôle, jamais le remplacer, et reste limité à la boutique de la personne.",
          "Paramètres, Utilisateurs, Journal d'activité et Boutiques ne peuvent jamais être accordés ainsi : ce sont des pouvoirs réservés au Super Admin.",
        ],
        screenshot: "/guide-assets/utilisateurs/acces-supplementaire.png",
      },
      {
        slug: "activite-utilisateur",
        title: "Consulter l'activité d'un utilisateur",
        steps: [
          "Depuis « Utilisateurs », cliquez sur « Voir le profil et l'activité » pour la personne concernée.",
          "Filtrez par mot-clé ou par période pour retrouver une action précise.",
          "Exportez l'historique affiché en PDF avec le bouton dédié.",
        ],
        screenshot: "/guide-assets/utilisateurs/activite-utilisateur.png",
      },
    ],
  },
  {
    key: "rapports",
    label: "Rapports",
    description: "Lire les chiffres clés de l'activité, changer de période et exporter un rapport.",
    topics: [
      {
        slug: "lire-chiffres",
        title: "Lire les chiffres clés",
        steps: [
          "Ouvrez « Rapports » pour voir le chiffre d'affaires, le nombre de ventes, les dépenses et l'état du stock.",
          "La marge et le détail par boutique ne sont visibles que par le Super Admin.",
          "Un Caissier ou Logistique ne voit que les chiffres de sa propre boutique.",
        ],
        screenshot: "/guide-assets/rapports/lire-chiffres.png",
      },
      {
        slug: "changer-periode",
        title: "Changer de période",
        steps: [
          "Utilisez les boutons rapides (Aujourd'hui, 7 derniers jours, Ce mois, Cette année).",
          "Ou choisissez une plage personnalisée avec les champs « Du » et « Au », utile pour archiver un rapport précis.",
        ],
        screenshot: "/guide-assets/rapports/changer-periode.png",
      },
      {
        slug: "exporter-rapport",
        title: "Exporter un rapport",
        steps: [
          "Cliquez sur « Exporter (PDF) » ou « Exporter (Excel) » en haut de la page.",
          "Le fichier reprend exactement la période et les chiffres affichés à l'écran au moment de l'export.",
        ],
        screenshot: "/guide-assets/rapports/exporter-rapport.png",
      },
    ],
  },
  {
    key: "parametres",
    label: "Paramètres",
    description: "Coordonnées de l'entreprise, logo, méthodes de paiement et réglages de sécurité.",
    topics: [
      {
        slug: "coordonnees-entreprise",
        title: "Mettre à jour les coordonnées de l'entreprise",
        steps: [
          "Ouvrez « Paramètres ».",
          "Modifiez le nom, l'adresse, le téléphone, l'e-mail ou la devise de l'entreprise.",
          "Changez le logo depuis le bloc « Logo » : il apparaît sur les reçus, factures et rapports exportés.",
        ],
        screenshot: "/guide-assets/parametres/coordonnees-entreprise.png",
      },
      {
        slug: "methodes-paiement",
        title: "Choisir les méthodes de paiement actives",
        steps: [
          "Dans « Méthodes de paiement actives », cochez ou décochez chaque méthode (espèces, Orange Money, Wave...).",
          "Une méthode décochée disparaît des formulaires de vente, de remboursement et de paiement fournisseur.",
        ],
        screenshot: "/guide-assets/parametres/methodes-paiement.png",
      },
      {
        slug: "securite-comptes",
        title: "Régler la sécurité des comptes",
        steps: [
          "Dans « Sécurité des comptes », réglez le nombre d'essais avant blocage et la durée du blocage.",
          "Cette protection évite qu'on essaie de deviner le mot de passe à 4 chiffres de quelqu'un.",
          "Réglez aussi la remise maximale autorisée en Caisse et le frais de livraison par défaut depuis cette même page.",
        ],
        screenshot: "/guide-assets/parametres/securite-comptes.png",
      },
    ],
  },
];
