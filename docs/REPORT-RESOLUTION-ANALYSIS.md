# Rapport d'analyse de résolution - h-backend

**Date:** 2025-12-16
**Projet testé:** `/Users/bikach/workspace/h-backend`
**Commande:** `npx tsx src/test-index.ts --dry-run --exclude-tests --show-unresolved`

---

## Résumé exécutif

| Métrique | Valeur |
|----------|--------|
| Appels non résolus | 185 (après exclusion tests) |
| Catégories identifiées | 4 |
| **Priorité haute** | "Other" (910 appels) - code métier non résolu |

---

## Logs bruts

### Appels non résolus par catégorie

```
┌─ Unresolved Calls Analysis ─────────────────────────────────┐

  📦 Kotlin stdlib (39 unique, 224 calls):
    listOf (32x)
    let (24x) [receivers: existingDevice, existingOtp, filter.category...]
    map (22x) [receivers: roles, categories, videos...]
    find (17x) [receivers: ContentDuration.entries]
    mapOf (15x)
    add (10x) [receivers: conditions, entryConditions, allCriteria]
    toString (9x) [receivers: userId, video.id.value, audio.id.value...]
    error (8x) [receivers: logger]
    apply (8x) [receivers: entity]
    mutableListOf (8x)
    joinToString (7x) [receivers: roles, user.roles, exception.constraintViolations...]
    copy (6x) [receivers: user]
    list (6x)
    isNotEmpty (4x) [receivers: it, slotConfigurations]
    startsWith (3x) [receivers: duration]
    ... and 24 more

  📦 Java stdlib (14 unique, 59 calls):
    emptyList (22x)
    valueOf (13x) [receivers: Role, AccountStatus, Pillar...]
    now (9x) [receivers: dateTimeProvider, LocalDateTime]
    plusDays (3x) [receivers: now]
    isAfter (2x) [receivers: currentTime, now]
    between (2x) [receivers: Duration]
    plusMinutes (1x) [receivers: sentAt]
    toHours (1x)
    toDays (1x)
    matches (1x) [receivers: BcryptUtil]
    from (1x) [receivers: Date]
    toInstant (1x)
    atZone (1x) [receivers: notification.scheduledDateTime]
    of (1x) [receivers: LocalDateTime]

  📦 Framework (Spring, etc.) (2 unique, 6 calls):
    Email (5x)
    verify (1x) [receivers: passwordHasher]

  📦 Other (238 unique, 910 calls):
    forSlot (88x)
    audio (85x)
    equalsTo (52x)
    build (51x)
    video (41x)
    greaterOrEqual (36x)
    pdfNutrition (24x)
    toDomain (20x) [receivers: status, existingEntity, newEntity...]
    create (20x) [receivers: Question]
    entity (15x)
    status (15x) [receivers: Response]
    ContentFilters (15x)
    info (12x) [receivers: logger]
    execute (11x) [receivers: loginUseCase, registerPatientUseCase, refreshAccessTokenUseCase...]
    toRestResponse (11x) [receivers: result, response, it]
    ... and 223 more
```

---

## Analyse détaillée

### 1. Kotlin stdlib (39 unique, 224 appels) ⚠️

**Statut:** Le `StdlibProvider` existe mais ne résout pas ces appels.

| Fonction | Appels | Type | Notes |
|----------|--------|------|-------|
| `listOf` | 32x | Collection factory | Devrait être résolu |
| `let` | 24x | Scope function | Avec receiver |
| `map` | 22x | Extension function | Sur collections |
| `find` | 17x | Extension function | Sur collections/entries |
| `mapOf` | 15x | Collection factory | Devrait être résolu |
| `add` | 10x | Mutable collection | Extension |
| `toString` | 9x | Any method | Avec receiver |
| `error` | 8x | Logging/Exception | `logger.error` vs `error()` |
| `apply` | 8x | Scope function | Avec receiver |
| `mutableListOf` | 8x | Collection factory | Devrait être résolu |
| `joinToString` | 7x | Extension function | Sur collections |
| `copy` | 6x | Data class | Generated method |
| `list` | 6x | ? | À investiguer |
| `isNotEmpty` | 4x | Extension function | Sur collections |
| `startsWith` | 3x | String extension | Sur String |

**Action requise:** Vérifier pourquoi le `StdlibProvider` ne marque pas ces appels comme résolus.

---

### 2. Java stdlib (14 unique, 59 appels) ⚠️

**Statut:** Le `StdlibProvider` devrait couvrir ces cas.

| Fonction | Appels | Type | Notes |
|----------|--------|------|-------|
| `emptyList` | 22x | Collections factory | `Collections.emptyList()` ou Kotlin |
| `valueOf` | 13x | Enum/Static factory | `Role.valueOf()`, `AccountStatus.valueOf()` |
| `now` | 9x | LocalDateTime factory | `LocalDateTime.now()` ou provider |
| `plusDays` | 3x | Temporal method | Sur dates |
| `isAfter` | 2x | Temporal comparison | Sur dates |
| `between` | 2x | Duration factory | `Duration.between()` |
| `plusMinutes` | 1x | Temporal method | Sur dates |
| `toHours` | 1x | Duration conversion | |
| `toDays` | 1x | Duration conversion | |
| `matches` | 1x | Regex/BCrypt | `BcryptUtil.matches` |
| `from` | 1x | Conversion factory | `Date.from()` |
| `toInstant` | 1x | Temporal conversion | |
| `atZone` | 1x | Temporal conversion | |
| `of` | 1x | Factory method | `LocalDateTime.of()` |

**Action requise:** Étendre le `StdlibProvider` pour Java ou créer un `JavaStdlibProvider`.

---

### 3. Framework (2 unique, 6 appels) ✅

**Statut:** Normal - les frameworks externes ne sont pas indexés.

| Fonction | Appels | Framework | Notes |
|----------|--------|-----------|-------|
| `Email` | 5x | Validation (Jakarta?) | Annotation ou classe |
| `verify` | 1x | Test/Mock | `passwordHasher.verify()` |

**Action requise:** Aucune - comportement attendu.

---

### 4. Other (238 unique, 910 appels) 🔴 PRIORITÉ HAUTE

**Statut:** Ce sont des fonctions du projet h-backend qui devraient être résolues !

#### 4.1 Builders / DSL (patterns métier)

| Fonction | Appels | Pattern probable | Notes |
|----------|--------|------------------|-------|
| `forSlot` | 88x | Content DSL | Builder de slots de contenu |
| `audio` | 85x | Content builder | `ContentBuilder.audio()` |
| `video` | 41x | Content builder | `ContentBuilder.video()` |
| `pdfNutrition` | 24x | Content builder | `ContentBuilder.pdfNutrition()` |
| `build` | 51x | Builder pattern | `.build()` terminal |
| `entity` | 15x | Entity builder | Probablement DSL Exposed |

**Hypothèse:** Ces fonctions sont définies comme extensions ou dans des lambdas avec receiver implicite. Le resolver ne trace pas le type du receiver.

#### 4.2 Query DSL / Critères

| Fonction | Appels | Pattern probable | Notes |
|----------|--------|------------------|-------|
| `equalsTo` | 52x | Query DSL | Critère d'égalité |
| `greaterOrEqual` | 36x | Query DSL | Critère de comparaison |
| `ContentFilters` | 15x | Filter factory | Construction de filtres |

**Hypothèse:** DSL de requêtes (Exposed, Ktorm, ou custom). Fonctions d'extension sur des colonnes/champs.

#### 4.3 Mappers

| Fonction | Appels | Pattern probable | Notes |
|----------|--------|------------------|-------|
| `toDomain` | 20x | Entity → Domain | Mapping layer |
| `toRestResponse` | 11x | Domain → DTO | Response mapping |

**Hypothèse:** Fonctions d'extension définies sur les entities/DTOs. Le resolver ne connaît pas le type du receiver.

#### 4.4 Use Cases / Business Logic

| Fonction | Appels | Pattern probable | Notes |
|----------|--------|------------------|-------|
| `create` | 20x | Factory method | `Question.create()` |
| `execute` | 11x | Use case pattern | `loginUseCase.execute()` |
| `status` | 15x | Response builder | `Response.status()` |

**Hypothèse:** Méthodes sur des classes du projet. Si elles ne sont pas résolues, c'est que :
- La classe n'est pas trouvée dans la symbol table
- L'appel est qualifié mais le type n'est pas inféré

#### 4.5 Logging

| Fonction | Appels | Pattern probable | Notes |
|----------|--------|------------------|-------|
| `info` | 12x | Logger method | `logger.info()` |

**Hypothèse:** `logger` est probablement de type `Logger` (SLF4J/Logback) qui n'est pas indexé.

---

## Diagnostic des causes racines

### Cause 1: Fonctions d'extension non résolues

Les fonctions comme `toDomain`, `toRestResponse`, `equalsTo` sont probablement des **fonctions d'extension** :

```kotlin
fun UserEntity.toDomain(): User = User(...)
fun Column<T>.equalsTo(value: T): Op<Boolean> = ...
```

**Problème:** Le resolver doit connaître le type du receiver pour résoudre l'appel. Si `entity.toDomain()` est appelé et que le type de `entity` n'est pas inféré, l'appel ne peut pas être résolu.

### Cause 2: DSL avec lambda receiver

Les builders comme `forSlot`, `audio`, `video` sont probablement dans des DSL :

```kotlin
content {
    forSlot(SlotType.MORNING) {
        audio { ... }
        video { ... }
    }
}
```

**Problème:** Ces fonctions sont définies dans le scope d'un `ContentBuilder.() -> Unit`. Sans analyse de flux de données, le resolver ne sait pas que `forSlot` est une méthode de `ContentBuilder`.

### Cause 3: Stdlib non marquée comme résolue

Les appels comme `listOf`, `map`, `let` sont reconnus par le `StdlibProvider` mais ne sont pas marqués comme résolus dans le résultat final.

**Problème potentiel:** Le provider retourne les informations mais le resolver ne les utilise pas correctement pour mettre à jour `resolvedFqn`.

---

## Actions recommandées

### Priorité 1: Investiguer le StdlibProvider

- [ ] Vérifier que `StdlibProvider.resolveCall()` est bien appelé
- [ ] Vérifier que le `resolvedFqn` est bien assigné après résolution
- [ ] Ajouter des logs de debug pour tracer le flux

### Priorité 2: Améliorer la résolution des extensions

- [ ] Implémenter l'inférence de type basique pour les receivers
- [ ] Indexer les fonctions d'extension avec leur type de receiver
- [ ] Matcher les appels `receiver.method()` avec les extensions `Type.method()`

### Priorité 3: Support des DSL builders

- [ ] Détecter les lambdas avec receiver (`Type.() -> Unit`)
- [ ] Propager le type du receiver dans le scope de la lambda
- [ ] Résoudre les appels non qualifiés dans ce contexte

### Priorité 4: Étendre la couverture stdlib

- [ ] Ajouter les méthodes Java stdlib manquantes
- [ ] Ajouter les méthodes générées (`copy`, `component1`, etc.)
- [ ] Gérer les cas `Enum.valueOf()` et `Enum.entries`

---

## Métriques cibles

| Métrique | Actuel | Cible | Notes |
|----------|--------|-------|-------|
| Résolution globale | ~85% | >95% | Après corrections |
| Stdlib Kotlin | 0% résolu | 100% | Provider à fixer |
| Code métier ("Other") | 0% résolu | >80% | Extensions + DSL |

---

## Fichiers à investiguer

```
mcp-server/src/indexer/
├── resolver/
│   ├── index.ts          # Logique de résolution principale
│   └── types.ts          # SymbolTable, ResolutionContext
├── stdlib/
│   └── provider.ts       # StdlibProvider (à vérifier)
└── parsers/kotlin/
    └── extractor.ts      # Extraction des appels
```

---

## Commandes utiles

```bash
# Relancer l'analyse
cd /Users/bikach/personalWorkspace/codegraph/mcp-server
npx tsx src/test-index.ts --dry-run --exclude-tests --show-unresolved /Users/bikach/workspace/h-backend

# Lancer les tests du resolver
npm test -- --grep "resolver"

# Vérifier le typecheck
npm run typecheck
```
