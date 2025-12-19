# Data Architecture - CodeGraph

This document describes the separation of responsibilities between the different data sources used by CodeGraph.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   NEO4J GRAPH   │  │   RAG (Specs)   │  │      JIRA       │ │
│  │                 │  │                 │  │                 │ │
│  │  Structure      │  │  BDD Specs      │  │  Tickets        │ │
│  │  Relations      │  │  History        │  │  Workflow       │ │
│  │  Calls          │  │  Estimation     │  │  Notifications  │ │
│  │  Dependencies   │  │                 │  │                 │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │          │
│           └────────────────────┼────────────────────┘          │
│                                │                               │
│                                ▼                               │
│                    ┌─────────────────────┐                     │
│                    │       CLAUDE        │                     │
│                    │                     │                     │
│                    │  PR Analysis        │                     │
│                    │  Brainstorm         │                     │
│                    │  Guidelines         │                     │
│                    └─────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Responsibilities by Source

### Neo4j Graph (Code)

**Role**: Technical source of truth for code

| Data | Description |
|------|-------------|
| Structure | Classes, interfaces, functions, properties |
| Relations | EXTENDS, IMPLEMENTS, CALLS, USES |
| Dependencies | Who uses what, impact analysis |
| Domains | Logical grouping of packages |

**Use cases**:
- Technical feasibility of a feature
- Impact of a modification
- Code navigation
- Anti-pattern detection

### RAG (Specs)

**Role**: Business knowledge base

| Data | Description |
|------|-------------|
| BDD Specs | Given/When/Then for features |
| History | Past features with actual effort |
| Estimation | Data to predict effort |

**Use cases**:
- Estimation based on similar features
- Compliance validation against specs
- Semantic search in specs

### Jira

**Role**: Project workflow management

| Data | Description |
|------|-------------|
| Tickets | Features, bugs, tasks |
| Workflow | Statuses, transitions |
| Notifications | PO alerts on deviations |

**Use cases**:
- BDD ticket creation
- Progress tracking
- Deviation notifications

## Separation Principle

```
┌──────────────────────────────────────────────────────────────┐
│                      DO NOT MIX                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Neo4j = Technical (code structure)                          │
│  RAG   = Business (specs, history)                           │
│  Jira  = Workflow (tickets, notifications)                   │
│                                                              │
│  Claude combines all 3 sources on the fly                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Why this separation?**

1. **Simplicity**: Each source has a clear responsibility
2. **Maintainability**: No data duplication
3. **Flexibility**: Can change one source without impacting others
4. **Performance**: Each source is optimized for its use case

## Data Flow

### PO Brainstorm

```
PO: "I want to add retry logic on payments"
     │
     ▼
┌────────────────────────────────────────────────────────┐
│ CLAUDE                                                  │
│                                                         │
│ 1. Search Neo4j: packages/classes "payment"             │
│ 2. Analyze dependencies and calls                       │
│ 3. Search RAG: similar features                         │
│ 4. Estimate effort based on history                     │
│                                                         │
└────────────────────────────────────────────────────────┘
     │
     ▼
Response: "You'll need to modify PaymentService.processPayment().
           Estimation: 3 SP (based on similar PROJ-123)"
```

### PR Analysis

```
PR created on branch feature/payment-retry
     │
     ▼
┌────────────────────────────────────────────────────────┐
│ CLAUDE                                                  │
│                                                         │
│ 1. Get PR diff                                          │
│ 2. Query RAG: feature specs                             │
│ 3. Query Neo4j: modified relations                      │
│ 4. Check code vs specs compliance                       │
│ 5. Check guidelines (anti-patterns)                     │
│                                                         │
└────────────────────────────────────────────────────────┘
     │
     ├── OK → Approve
     │
     └── Deviation → Notify PO via Jira
```

## Minimal Graph Enrichment

The Neo4j graph remains technical but can include a **minimum of functional context**:

### Domain Node (optional)

```
(d:Domain)-[:OWNS]->(p:Package)
```

**Properties**:
- `name`: Domain name (e.g., "Payment", "User")
- `description`: Description for the PO

**Automatic inference** from package names:
```
com.example.payment.domain → Domain "Payment"
com.example.user.service   → Domain "User"
```

**Override possible** via `codegraph.domains.json`:
```json
{
  "domains": [
    {
      "name": "Payment",
      "packages": ["com.example.payment.*", "com.example.billing.*"]
    }
  ]
}
```

### Inter-domain Relations

```
(d1:Domain)-[:DEPENDS_ON]->(d2:Domain)
```

Automatically calculated from USES/CALLS relations between packages.
