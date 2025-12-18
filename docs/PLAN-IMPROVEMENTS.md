# Plan d'Amélioration MCP Server

> Objectif: Améliorer le score qualité de 5.4/10 à 8+/10 tout en maintenant les gains de coût/performance.

## Baseline Benchmark (2025-12-18)

| Scénario | MCP Score | Native Score | MCP Cost | Problème Principal |
|----------|-----------|--------------|----------|-------------------|
| Find Callers | 7/10 | 8/10 | $0.19 | Coût 112% plus élevé |
| Find Implementations | 8/10 | 8/10 | $0.04 | OK |
| Impact Analysis | 3/10 | 7/10 | $0.26 | Sortie insuffisante |
| Dependency Analysis | 8/10 | 8/10 | $0.13 | OK |
| Call Chain | 1/10 | 3/10 | $0.19 | Hallucination totale |

**Cible après améliorations**: Score moyen MCP >= 8/10

---

## Phase 1: Corrections Critiques (Call Chain + Impact Analysis)

### 1.1 Améliorer `find_path` - Résolution de noms fuzzy

**Fichier**: `src/tools/find-path/handler.ts`

**Problème**: L'outil cherche par nom exact (`from.name = $from_node`) mais les utilisateurs donnent souvent des noms partiels ou descriptifs.

**Changements requis**:

```typescript
// 1. Ajouter une recherche fuzzy pour résoudre les noms
async function resolveNodeName(client: Neo4jClient, name: string): Promise<string[]> {
  const cypher = `
    MATCH (n)
    WHERE n.name =~ $pattern
      AND any(label IN labels(n) WHERE label IN ['Class', 'Interface', 'Function', 'Object'])
    RETURN DISTINCT n.name AS name, labels(n) AS labels
    LIMIT 5
  `;
  // Recherche: exact -> contient -> fuzzy
  const pattern = `(?i).*${escapeRegex(name)}.*`;
  const results = await client.query(cypher, { pattern });
  return results.map(r => r.name);
}

// 2. Améliorer la réponse quand aucun chemin n'est trouvé
if (records.length === 0) {
  // Chercher les nœuds candidats pour aider le LLM
  const fromCandidates = await resolveNodeName(client, from_node);
  const toCandidates = await resolveNodeName(client, to_node);

  return {
    content: [{
      type: 'text',
      text: `PATH: No path found from "${from_node}" to "${to_node}" within depth ${max_depth}

SUGGESTIONS:
- Similar nodes matching "${from_node}": ${fromCandidates.join(', ') || 'none found'}
- Similar nodes matching "${to_node}": ${toCandidates.join(', ') || 'none found'}

TIP: Try using exact function names from the suggestions above.`
    }]
  };
}
```

**Nouveau paramètre à ajouter dans `definition.ts`**:
```typescript
fuzzy_match: z.boolean().optional().default(true)
  .describe('Enable fuzzy name matching to find similar nodes')
```

**Tests à ajouter**:
- [ ] Test avec nom exact -> trouve le chemin
- [ ] Test avec nom partiel -> suggère des alternatives
- [ ] Test avec nom inexistant -> message d'aide clair

---

### 1.2 Enrichir `get_impact` - Sortie structurée avec contexte

**Fichier**: `src/tools/get-impact/handler.ts`

**Problème**: La sortie actuelle liste les impactés mais manque de contexte et de priorisation.

**Changements requis**:

```typescript
// 1. Ajouter un résumé en début de réponse
function buildImpactSummary(impacts: ImpactResult[]): string {
  const byType = impacts.reduce((acc, i) => {
    acc[i.impactType] = (acc[i.impactType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byDepth = impacts.reduce((acc, i) => {
    acc[i.depth] = (acc[i.depth] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const riskLevel = impacts.length > 20 ? 'HIGH' : impacts.length > 10 ? 'MEDIUM' : 'LOW';

  return `IMPACT SUMMARY:
Risk Level: ${riskLevel}
Total Affected: ${impacts.length}
By Type: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}
By Depth: ${Object.entries(byDepth).map(([k, v]) => `depth${k}=${v}`).join(', ')}
`;
}

// 2. Grouper par catégorie dans la sortie
function formatImpactByCategory(impacts: ImpactResult[]): string {
  const callers = impacts.filter(i => i.impactType === 'caller');
  const dependents = impacts.filter(i => i.impactType === 'dependent');
  const implementors = impacts.filter(i => i.impactType === 'implementor');
  const children = impacts.filter(i => i.impactType === 'child');

  let output = '';

  if (callers.length > 0) {
    output += `\nCALLERS (${callers.length}):\n${callers.map(formatImpact).join('\n')}\n`;
  }
  if (dependents.length > 0) {
    output += `\nDEPENDENTS (${dependents.length}):\n${dependents.map(formatImpact).join('\n')}\n`;
  }
  if (implementors.length > 0) {
    output += `\nIMPLEMENTORS (${implementors.length}):\n${implementors.map(formatImpact).join('\n')}\n`;
  }
  if (children.length > 0) {
    output += `\nCHILD CLASSES (${children.length}):\n${children.map(formatImpact).join('\n')}\n`;
  }

  return output;
}

// 3. Ajouter les fichiers de tests impactés
const testsCypher = `
  MATCH (test:Function)-[:CALLS*1..3]->(target)
  WHERE target.name = $node_name
    AND test.filePath CONTAINS '/test/'
  RETURN DISTINCT
    test.name AS name,
    'function' AS type,
    'test' AS impactType,
    1 AS depth,
    test.filePath AS filePath,
    coalesce(test.lineNumber, 0) AS lineNumber
  ORDER BY name
  LIMIT 20
`;
```

**Nouvelle structure de sortie**:
```
IMPACT SUMMARY:
Risk Level: HIGH
Total Affected: 25
By Type: caller=10, dependent=8, implementor=2, child=5
By Depth: depth1=15, depth2=7, depth3=3

CALLERS (10):
1 | LoginUseCase.execute() | src/usecase/LoginUseCase.kt:35
2 | RefreshTokenUseCase.execute() | src/usecase/RefreshTokenUseCase.kt:40
...

DEPENDENTS (8):
1 | class | UserService | src/service/UserService.kt:10
...

TESTS IMPACTED (5):
LoginUseCaseTest.shouldLogin | src/test/LoginUseCaseTest.kt:25
...

RECOMMENDATIONS:
- Update 10 callers in use case layer
- Verify 5 test files after changes
- Check 2 implementations for interface compatibility
```

**Tests à ajouter**:
- [ ] Test avec classe ayant beaucoup de dépendants -> résumé correct
- [ ] Test avec interface -> liste les implementors
- [ ] Test avec fonction -> liste les callers par profondeur

---

## Phase 2: Optimisations (Find Callers)

### 2.1 Améliorer `get_callers` - Recherche intégrée

**Fichier**: `src/tools/get-callers/handler.ts`

**Problème**: Le LLM fait souvent `search_nodes` avant `get_callers`, doublant les appels.

**Changements requis**:

```typescript
// 1. Ajouter une recherche intégrée si la fonction n'est pas trouvée exactement
export async function handleGetCallers(
  client: Neo4jClient,
  params: GetCallersParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { function_name, class_name, depth = 2 } = params;

  // D'abord essayer la recherche exacte
  let records = await executeCallerQuery(client, function_name, class_name, depth);

  // Si aucun résultat, essayer une recherche fuzzy
  if (records.length === 0) {
    const candidates = await findSimilarFunctions(client, function_name);

    if (candidates.length === 1) {
      // Un seul candidat -> l'utiliser automatiquement
      records = await executeCallerQuery(client, candidates[0].name, candidates[0].className, depth);
      // Ajouter une note dans la sortie
    } else if (candidates.length > 1) {
      // Plusieurs candidats -> demander clarification
      return {
        content: [{
          type: 'text',
          text: `CALLERS: Function "${function_name}" not found exactly.

DID YOU MEAN:
${candidates.map(c => `- ${c.className ? c.className + '.' : ''}${c.name} (${c.filePath})`).join('\n')}

TIP: Use class_name parameter to disambiguate.`
        }]
      };
    }
  }

  // ... reste du code
}

async function findSimilarFunctions(client: Neo4jClient, name: string): Promise<FunctionCandidate[]> {
  const cypher = `
    MATCH (f:Function)
    WHERE f.name =~ $pattern
    OPTIONAL MATCH (owner)-[:DECLARES]->(f)
    WHERE owner:Class OR owner:Interface OR owner:Object
    RETURN f.name AS name, owner.name AS className, f.filePath AS filePath
    LIMIT 5
  `;
  return client.query(cypher, { pattern: `(?i).*${escapeRegex(name)}.*` });
}
```

**Mise à jour de la description dans `definition.ts`**:
```typescript
description: `Find all functions that call the specified function.
Supports fuzzy matching: if the exact function is not found, similar functions will be suggested.
Use class_name to disambiguate when multiple functions have the same name.`
```

**Tests à ajouter**:
- [ ] Test avec nom exact -> résultats directs
- [ ] Test avec nom partiel + 1 match -> auto-résolution
- [ ] Test avec nom ambigu -> liste des candidats

---

### 2.2 Améliorer `get_callees` - Même pattern

**Fichier**: `src/tools/get-callees/handler.ts`

Appliquer les mêmes changements que pour `get_callers`.

---

## Phase 3: Améliorations de Robustesse

### 3.1 Ajouter `get_neighbors` - Meilleure gestion des erreurs

**Fichier**: `src/tools/get-neighbors/handler.ts`

**Changements**:
- Ajouter validation du `node_name` avant la requête
- Suggérer des alternatives si le nœud n'existe pas

### 3.2 Ajouter `get_implementations` - Support indirect

**Fichier**: `src/tools/get-implementations/handler.ts`

**Changements**:
- S'assurer que `include_indirect` fonctionne correctement
- Ajouter le nombre d'implémentations dans le résumé

### 3.3 Validation globale des paramètres

**Nouveau fichier**: `src/tools/validation.ts`

```typescript
export async function validateNodeExists(
  client: Neo4jClient,
  name: string,
  type?: string
): Promise<{ exists: boolean; suggestions: string[] }> {
  const cypher = `
    MATCH (n)
    WHERE n.name = $name
      ${type ? `AND n:${capitalize(type)}` : ''}
    RETURN n.name AS name
    LIMIT 1
  `;
  const exact = await client.query(cypher, { name });

  if (exact.length > 0) {
    return { exists: true, suggestions: [] };
  }

  // Chercher des suggestions
  const fuzzyCypher = `
    MATCH (n)
    WHERE n.name =~ $pattern
      ${type ? `AND n:${capitalize(type)}` : ''}
    RETURN DISTINCT n.name AS name
    LIMIT 5
  `;
  const fuzzy = await client.query(fuzzyCypher, { pattern: `(?i).*${name}.*` });

  return { exists: false, suggestions: fuzzy.map(r => r.name) };
}
```

---

## Phase 4: Tests et Validation

### 4.1 Tests unitaires pour chaque amélioration

```
src/tools/__tests__/
├── find-path.test.ts      # Tests fuzzy matching + suggestions
├── get-impact.test.ts     # Tests résumé structuré
├── get-callers.test.ts    # Tests auto-résolution
└── validation.test.ts     # Tests validation globale
```

### 4.2 Tests d'intégration avec le benchmark

Créer des scénarios de test isolés:

```typescript
// src/benchmark/scenarios/__tests__/
const testCases = [
  {
    name: 'find-path-fuzzy',
    prompt: 'Find path from findById to save',
    expectedBehavior: 'Should suggest exact function names',
  },
  {
    name: 'impact-structured',
    prompt: 'Analyze impact of User class',
    expectedBehavior: 'Should return summary with risk level',
  },
];
```

---

## Checklist de Validation

### Avant de relancer le benchmark:

- [ ] **Phase 1.1**: `find_path` avec fuzzy matching implémenté
- [ ] **Phase 1.1**: Tests pour `find_path` passent
- [ ] **Phase 1.2**: `get_impact` avec résumé structuré implémenté
- [ ] **Phase 1.2**: Tests pour `get_impact` passent
- [ ] **Phase 2.1**: `get_callers` avec auto-résolution implémenté
- [ ] **Phase 2.1**: Tests pour `get_callers` passent
- [ ] **Phase 3**: Validation globale ajoutée
- [ ] `npm run typecheck` passe
- [ ] `npm test` passe (tous les tests)

### Métriques cibles post-amélioration:

| Scénario | Score Actuel | Score Cible |
|----------|--------------|-------------|
| Find Callers | 7/10 | 9/10 |
| Find Implementations | 8/10 | 9/10 |
| Impact Analysis | 3/10 | 8/10 |
| Dependency Analysis | 8/10 | 9/10 |
| Call Chain | 1/10 | 7/10 |
| **Moyenne** | **5.4/10** | **8.4/10** |

---

## Ordre d'implémentation recommandé

1. **Jour 1**: Phase 1.1 (find_path) - Impact le plus visible sur Call Chain
2. **Jour 1**: Phase 1.2 (get_impact) - Score le plus bas à corriger
3. **Jour 2**: Phase 2.1 (get_callers) - Optimisation coût
4. **Jour 2**: Phase 3 (validation) - Robustesse globale
5. **Jour 3**: Phase 4 (tests) - Validation avant benchmark

---

## Notes techniques

### Dépendances existantes à utiliser:
- `escapeRegex()` dans `search-nodes/handler.ts` - réutiliser
- `buildCompactOutput()` dans `formatters.ts` - étendre si besoin

### Patterns à suivre:
- Chaque handler retourne `{ content: [{ type: 'text', text: string }] }`
- Format compact: `HEADER (count):\nfield1 | field2 | field3`
- Toujours inclure `filePath:lineNumber` pour navigation
