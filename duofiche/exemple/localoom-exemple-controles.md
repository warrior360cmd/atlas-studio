# Duofiche — contrôles de l'exemple

Contrôles exécutés le 2026-11-21 par script déterministe (pas par un LLM).

| Contrôle | Résultat | Détail |
|---|---|---|
| audit : conflit, manque et contradiction détectés | OK | 3 points |
| vase-cannele/hauteur_cm_grand : décision client tracée avant rédaction | OK | Client : fiche fournisseur fait foi (mesure 24 cm) — réponse du 2026-11-19 |
| vase-cannele/lave_vaisselle : décision client tracée avant rédaction | OK | Client : inconnu → ne rien affirmer, recommander le lavage à la main |
| mug-gres-emaille : mêmes nombres/unités FR et EN | OK | [('300', 'ml'), ('300', 'ml'), ('9.5', 'cm')] |
| mug-gres-emaille/fr : aucun superlatif non prouvé | OK |  |
| mug-gres-emaille/fr : titre SEO ≤ 70 car., description ≤ 160 | OK | 52/109 |
| mug-gres-emaille/fr : pas de texte alternatif sans photo observée | OK |  |
| mug-gres-emaille/en : aucun superlatif non prouvé | OK |  |
| mug-gres-emaille/en : titre SEO ≤ 70 car., description ≤ 160 | OK | 55/106 |
| mug-gres-emaille/en : pas de texte alternatif sans photo observée | OK |  |
| mug-gres-emaille : « lave-vaisselle » affirmé seulement si la source le dit | OK |  |
| mug-gres-emaille : micro-ondes conforme à la fiche fournisseur | OK |  |
| mug-gres-emaille : glossaire « grès émaillé » → « glazed stoneware » | OK |  |
| mug-gres-emaille : glossaire « tourné à la main » → « hand-thrown » | OK |  |
| mug-gres-emaille : glossaire « Sable » → « Sand » | OK |  |
| mug-gres-emaille : glossaire « Nuit » → « Night » | OK |  |
| assiettes-plates-lot-4 : mêmes nombres/unités FR et EN | OK | [('26', 'cm'), ('26', 'cm')] |
| assiettes-plates-lot-4/fr : aucun superlatif non prouvé | OK |  |
| assiettes-plates-lot-4/fr : titre SEO ≤ 70 car., description ≤ 160 | OK | 63/104 |
| assiettes-plates-lot-4/fr : pas de texte alternatif sans photo observée | OK |  |
| assiettes-plates-lot-4/en : aucun superlatif non prouvé | OK |  |
| assiettes-plates-lot-4/en : titre SEO ≤ 70 car., description ≤ 160 | OK | 58/101 |
| assiettes-plates-lot-4/en : pas de texte alternatif sans photo observée | OK |  |
| assiettes-plates-lot-4 : « lave-vaisselle » affirmé seulement si la source le dit | OK |  |
| assiettes-plates-lot-4 : micro-ondes conforme à la fiche fournisseur | OK |  |
| assiettes-plates-lot-4 : glossaire « grès émaillé » → « glazed stoneware » | OK |  |
| assiettes-plates-lot-4 : glossaire « tourné à la main » → « hand-thrown » | OK |  |
| assiettes-plates-lot-4 : glossaire « filet doré » → « gold rim » | OK |  |
| vase-cannele : mêmes nombres/unités FR et EN | OK | [('18', 'cm'), ('18', 'cm'), ('24', 'cm'), ('24', 'cm')] |
| vase-cannele/fr : aucun superlatif non prouvé | OK |  |
| vase-cannele/fr : titre SEO ≤ 70 car., description ≤ 160 | OK | 60/97 |
| vase-cannele/fr : pas de texte alternatif sans photo observée | OK |  |
| vase-cannele/en : aucun superlatif non prouvé | OK |  |
| vase-cannele/en : titre SEO ≤ 70 car., description ≤ 160 | OK | 58/92 |
| vase-cannele/en : pas de texte alternatif sans photo observée | OK |  |
| vase-cannele : « lave-vaisselle » affirmé seulement si la source le dit | OK |  |
| vase-cannele : glossaire « faïence émaillée » → « glazed earthenware » | OK |  |
| vase : hauteur grande taille = 24 cm (décision client), 25 cm absent | OK |  |
| export : chaque SKU source présent une fois, prix inchangé | OK | 5 lignes |
| export : brouillon (Status=draft, Published=FALSE) — aucune publication implicite | OK |  |
| export : relation parent/variante (1 titre par handle) | OK |  |
| traductions : aucune cellule traduite vide | OK | 17 lignes |
| PDF : ordre de lecture | OK |  |
