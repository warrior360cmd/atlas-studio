# Dictionnaire des colonnes — SignalDesk

EXEMPLE DE DÉMONSTRATION — données fictives (domaines .example réservés). Aucun client réel.

| Colonne | Sens |
|---|---|
| `id` | Identifiant stable de la fiche (ne change pas après correction) |
| `priorite` | A = signal récent + indice fort ; B = indice fort sans événement ; C = pertinent mais risque élevé |
| `fait_n` | Observation reformulée, vérifiable à la source |
| `source_n` | URL exacte consultée |
| `date_publication_n` | Date affichée par la source, sinon « non indiquée » (jamais déduite) |
| `date_consultation_n` | Date à laquelle ATLAS a consulté la source |
| `hypothese` | Interprétation commerciale — NON vérifiée |
| `inconnues` | Ce que nous ne savons pas et qui peut invalider l'approche |
| `question_a_poser` | Question à vérifier avec le prospect |
| `critere_*` | Statut de chaque critère convenu : confirmé / observé / non confirmé |

## Mapping HubSpot (objet Company)

| Colonne | Propriété HubSpot |
|---|---|
| entreprise | name |
| domaine | domain |
| ville | city |
| priorite | propriété personnalisée `signaldesk_priority` |
| motif_priorite, fait_1, source_1 | note associée à la fiche |
