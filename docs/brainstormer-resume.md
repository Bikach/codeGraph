# CodeGraph - AI Assistant for Product Owners

## Vision

CodeGraph est une extension Jira qui permet aux Product Owners de dialoguer avec une IA pour élaborer des features en se basant sur le **code comme source de vérité**.

## Problème résolu

| Aujourd'hui | Avec CodeGraph |
|-------------|----------------|
| PO demande aux devs si une feature est faisable | PO demande à l'IA qui connait le code |
| Réunion + attente 2-3 jours | Réponse immédiate |
| Estimation approximative | Estimation basée sur l'historique (RAG) |
| Ticket mal spécifié | Ticket BDD avec exemples validés |
| Specs figées | Specs vivantes, mises à jour au merge |

## Fonctionnalités

### 1. Brainstorm PO + IA
- PO dialogue avec l'IA pour élaborer une feature
- IA se base sur le **Code Graph (Neo4j)** comme source de vérité
- IA confirme si la feature est faisable
- IA estime la feature en se basant sur les **specs historiques (RAG)**

### 2. Génération de ticket
- PO valide la feature
- Extension crée un ticket Jira au format **BDD** (Given/When/Then)
- Exemples validés par le PO inclus

### 3. Analyse des PR
Une fois le ticket en "In Progress" et la PR créée, l'extension fait **deux analyses** :

| Analyse | But | Si problème |
|---------|-----|-------------|
| **Specs** | Code respecte les specs ? | PO notifié pour valider ou non l'écart |
| **Guidelines** | Code respecte les bonnes pratiques ? | Commentaire pour le dev |

- Si PO valide l'écart → OK
- Si PO rejette → Dev corrige
- Commentaires IA sur la PR

### 4. MAJ automatique au merge
- **Code Graph (Neo4j)** mis à jour avec le nouveau code
- **Specs (RAG)** mises à jour si écarts validés par le PO

### 5. Outils PO supplémentaires
- Générer de la **documentation** à partir du code
- Générer des **diagrammes** (séquence, architecture)
- Créer des **roadmaps** basées sur l'historique des features

## But final

L'IA développe la feature, le dev review la PR. L'IA corrige jusqu'au merge.

```
Aujourd'hui                         Demain
──────────                          ──────
PO brainstorm avec IA               PO brainstorm avec IA
Dev code                            IA code
IA review                           Dev review
                                    IA corrige
Merge                               Merge
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    JIRA CLOUD                           │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │           Extension Forge (CodeGraph)           │   │
│   │                                                 │   │
│   │  • Chat PO + IA                                 │   │
│   │  • Génération tickets BDD                       │   │
│   │  • Analyse PR (specs + guidelines)              │   │
│   │  • Génération docs, diagrammes, roadmaps        │   │
│   │                                                 │   │
│   └───────────────────────┬─────────────────────────┘   │
│                           │                             │
└───────────────────────────┼─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      BACKEND                            │
│                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐   │
│   │   Neo4j     │    │    RAG      │    │  LLM API  │   │
│   │ Code Graph  │    │   Specs     │    │ (Claude)  │   │
│   │             │    │ historiques │    │           │   │
│   └─────────────┘    └─────────────┘    └───────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Stockage

| Donnée | Stockage | Usage |
|--------|----------|-------|
| Code (classes, méthodes, relations) | **Neo4j** | Source de vérité, faisabilité |
| Specs historiques | **RAG (ChromaDB)** | Estimation, validation |

---

## Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. BRAINSTORM                                           │
│                                                         │
│    👤 PO ◄────► 🤖 IA                                   │
│                  │                                      │
│                  ├── Consulte Neo4j (faisabilité)       │
│                  └── Consulte RAG (estimation)          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 2. TICKET                                               │
│                                                         │
│    👤 PO valide ──► 📋 Ticket Jira (BDD + exemples)     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 3. DÉVELOPPEMENT                                        │
│                                                         │
│    👨‍💻 Dev code ──► PR créée                             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 4. ANALYSE PR                                           │
│                                                         │
│    🤖 Analyse 1 : Specs                                 │
│         │                                               │
│         └── Écart ? ──► 🔔 Notifie PO                   │
│                              │                          │
│                    ┌─────────┴─────────┐                │
│                    │                   │                │
│               ✅ Valide           ❌ Rejette            │
│                    │                   │                │
│                    │              Dev corrige           │
│                    │                                    │
│    🤖 Analyse 2 : Guidelines                            │
│         │                                               │
│         └── 💬 Commentaires PR                          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 5. MERGE                                                │
│                                                         │
│    ✅ Merge ──► 🤖 MAJ Neo4j (code)                     │
│                🤖 MAJ RAG (specs si écarts validés)     │
└─────────────────────────────────────────────────────────┘
```

---

## Phases de développement

### Phase 1 - MVP
- Chat PO + IA (Neo4j + RAG)
- Génération ticket BDD
- MAJ Neo4j au merge

### Phase 2 - Analyse PR
- Analyse specs à chaque push
- Analyse guidelines
- Commentaires PR
- Notification PO si écarts
- MAJ RAG au merge si écarts validés

### Phase 3 - Outils PO
- Génération documentation
- Génération diagrammes
- Roadmaps basées sur l'historique

### Phase 4 - IA Developer
- IA code la feature
- Dev review la PR
- IA corrige jusqu'au merge

---

## Concurrents (Atlassian Marketplace)

| App | Lien code | Estimation | Validation specs |
|-----|-----------|------------|------------------|
| Smart AI for Jira | ❌ | ❌ | ❌ |
| MyAgileCopilot | ❌ | ❌ | ❌ |
| AI Agents for Jira | ❌ | ❌ | ❌ |
| **CodeGraph** | ✅ Neo4j | ✅ RAG | ✅ |

**Aucun concurrent ne fait le lien Code ↔ Jira avec validation.**
