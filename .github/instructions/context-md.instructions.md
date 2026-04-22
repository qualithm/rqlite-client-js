---
applyTo: "**/CONTEXT.md"
description: "CONTEXT.md maintenance rules for AI agents"
---

# CONTEXT.md Rules

## Mandatory Behaviours

BEFORE editing any file in this repository:

1. Read CONTEXT.md
2. Check Work In Flight for conflicts
3. Add claim to Work In Flight with timestamp
4. Re-read CONTEXT.md immediately before writing (detect concurrent edits)

AFTER completing work:

1. Update Current Reality if new capability exists
2. Remove your Work In Flight entry
3. Verify no contradictions introduced

## Authority

CONTEXT.md > Code > README > Comments

When conflict detected: CONTEXT.md is correct. Update the other source.

## Section Formats

| Section         | Format                                    | Tense   |
| --------------- | ----------------------------------------- | ------- |
| System Intent   | Paragraphs + bullet list                  | Present |
| Current Reality | Tables only                               | Present |
| Locked          | `N. **Topic** — Rationale`                | Present |
| Open Decisions  | `ID \| Question \| Context`               | —       |
| Risks           | `ID \| Risk \| Impact \| Mitigation`      | —       |
| Work In Flight  | `ID \| Agent \| Started \| Task \| Files` | —       |
| Work Queue      | `### Title` + `- [ ] Task`                | —       |

## System Intent Formula

**Sentence 1**: `[Type] [technology] for [runtime/platform].` **Sentence 2**:
`Implements/Provides [specific protocols/capabilities] for [use cases].`

## Current Reality Rules

- Listed = complete (no status columns)
- Tables only, no bullet lists
- No commentary, progress remarks, or qualifiers
- Update immediately when code changes

Forbidden in Current Reality:

- "in progress", "partially", "mostly", "almost"
- "needs", "should", "TODO", "WIP"
- Percentages or completion indicators
- Explanatory notes about state
- Future tense ("will", "planned", "eventually")

Valid: `| Authentication | OAuth 2.0 PKCE |` Invalid:
`| Authentication | OAuth 2.0 PKCE (90% done) |` Invalid:
`| Authentication | OAuth 2.0 PKCE — needs token refresh |`

## Work In Flight Protocol

```
IF Work In Flight contains entry touching same files:
  THEN wait or coordinate — do not proceed

CLAIM format:
  | WIF-N | AgentName | YYYY-MM-DD HH:MM | Task description | file1.rs, file2.rs |

REMOVE immediately upon completion
```

## Forbidden Content

- External Dependencies section (use package.json/Cargo.toml)
- Environment Variables section (use env-example)
- References to non-existent files
- Status columns
- Likelihood columns in Risks
- Commentary paragraphs

## IDs

- Open Decisions: OD-1, OD-2, ...
- Risks: R-1, R-2, ...
- Work In Flight: WIF-1, WIF-2, ...

## Required Sections (in order)

1. Header (title, authority statement)
2. System Intent
3. Current Reality
4. Locked Decisions
5. Open Decisions & Risks
6. Work In Flight
7. Work Queue

## Template

```markdown
# CONTEXT.md

> **Single source of truth.** CONTEXT.md > Code > README > Comments.

---

## System Intent

[1-2 paragraphs]

**Key capabilities:**

- [Capability]

---

## Current Reality

### Architecture

| Component | Technology |
| --------- | ---------- |

### Features

| Feature | Notes |
| ------- | ----- |

---

## Locked Decisions

1. **[Topic]** — [Rationale]

---

## Open Decisions & Risks

| ID  | Question | Context |
| --- | -------- | ------- |

| ID  | Risk | Impact | Mitigation |
| --- | ---- | ------ | ---------- |

---

## Work In Flight

| ID  | Agent | Started | Task | Files |
| --- | ----- | ------- | ---- | ----- |

---

## Work Queue

### [Title]

- [ ] [Task]

Acceptance: [Criteria]
```

## Compaction

**Trigger**: CONTEXT.md exceeds 300 lines

**Rules**:

- Delete completed Work Queue sections (after verified in Current Reality)
- Delete mitigated Risks
- Delete resolved Open Decisions (after moving to Locked)
- Delete abandoned Work In Flight entries
- Merge related Current Reality rows into single capability
- Combine similar Work Queue items

**Prevention**:

- One row per capability, not per file
- No granular feature breakdowns
- Notes column: brief or empty (detail belongs in code)
