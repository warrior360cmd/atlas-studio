# Rouagia — recette du démonstrateur (2026-11-22)

App B = simulateur avec injection de pannes (environnement de test, pas une installation client).

| Scénario | Résultat |
|---|---|
| nominal | OK |
| duplicate submission | OK |
| concurrency single claim | OK |
| invalid input no write | OK |
| outage bounded retries | OK |
| access revoked | OK |
| lost response reconcilable | OK |
| lost response uncertain goes to review | OK |
| pause resume | OK |
| isolated restore | OK |
