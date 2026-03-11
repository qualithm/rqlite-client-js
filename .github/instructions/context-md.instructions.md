---
applyTo: "**/CONTEXT.md"
description: "Rules for maintaining the project's working memory"
---

# CONTEXT.md Maintenance Rules

These rules are non-negotiable.

---

## Core Invariants

1. **CONTEXT.md Is Authoritative** — When CONTEXT.md conflicts with any other document, CONTEXT.md
   is correct. Update other documents to match.

2. **Learnings Are Append-Only** — Never edit, delete, or reorder. Only append new rows.

3. **Current Reality Contains Only Present Facts** — Describe what exists now. Forbidden: "will be",
   "planned for", "should support", "eventually".

4. **No Future Tense in Reality Sections** — System Intent, Current Reality, and Locked Decisions
   use present/past tense only. Future work goes in Work Queue or Open Decisions.

5. **Contradictions Must Be Resolved** — Stop, determine reality, fix the incorrect section, add a
   Learning entry.

---

## Section Rules

### System Intent

- 1-2 paragraph summary + "Key capabilities" bullet list
- Present tense, rarely changes
- Optional "Scope" boundary statement

### Current Reality

- Must match actual codebase; update immediately when code changes
- Tables only (no bullet lists for inventories)
- No commentary paragraphs (warnings go in Risks or Learnings)
- Status values: `Complete` | `Partial` | `Operational` | `Stub` | `Not started`

**Subsection order** (include only applicable):

| Subsection                | Format                     |
| ------------------------- | -------------------------- |
| Architecture              | Component \| Technology    |
| File Structure            | Directory \| Purpose       |
| Components/Modules/Crates | Name \| Purpose            |
| Features                  | Feature \| Status \| Notes |
| API Endpoints             | Category \| Endpoints      |
| Security Configuration    | Feature \| Status \| Notes |

### Locked Decisions

- Format: `N. **Topic** — Rationale`
- Numbered sequentially, no intro paragraph
- Removal requires explicit approval

### Open Decisions & Risks

- Use unique IDs: OD-1, OD-2..., R-1, R-2...
- Move resolved decisions to Locked Decisions; remove mitigated risks
- Empty section placeholder: `| — | None | — |`

| Table          | Columns                            |
| -------------- | ---------------------------------- |
| Open Decisions | ID \| Question \| Context          |
| Risks          | ID \| Risk \| Impact \| Mitigation |

### Work In Flight

- Claim before starting with timestamp
- Remove within 24 hours of completion
- Format: `ID | Agent | Started | Task | Files`

### Work Queue

- Ordered by priority, semantic names (e.g., "Core Protocol", not "M1")
- Format: `### Semantic Title` with `- [ ]` task checklists
- Optional `Acceptance:` line with measurable criteria
- Move completed items to Current Reality

### Learnings

- **Append-only** — never edit or delete
- Intro line: `> Append-only. Never edit or delete existing entries.`
- Format: `Date | Learning`

---

## Required Sections (in order)

1. Header block (title, authority statement)
2. System Intent
3. Current Reality
4. Locked Decisions
5. Open Decisions & Risks
6. Work In Flight
7. Work Queue
8. Learnings

---

## Forbidden Content

- External Dependencies sections (use package.json/Cargo.toml)
- Environment Variables sections (use env-example)
- References to non-existent files
- Future tense in Current Reality
- Emoji in status values
- Likelihood columns in Risks
- Commentary paragraphs in Current Reality

---

## Template

```markdown
# CONTEXT.md

> **This is the single source of truth for this repository.** When CONTEXT.md conflicts with any
> other document, CONTEXT.md is correct.

---

## System Intent

[1-2 paragraph summary]

**Key capabilities:**

- [Capability]

**Scope:** [Optional boundary]

---

## Current Reality

### Architecture

| Component | Technology |
| --------- | ---------- |

### Features

| Feature | Status | Notes |
| ------- | ------ | ----- |

---

## Locked Decisions

1. **[Topic]** — [Rationale]

---

## Open Decisions & Risks

### Open Decisions

| ID  | Question | Context |
| --- | -------- | ------- |

### Risks

| ID  | Risk | Impact | Mitigation |
| --- | ---- | ------ | ---------- |

---

## Work In Flight

> Claim before starting. Remove within 24h of completion.

| ID  | Agent | Started | Task | Files |
| --- | ----- | ------- | ---- | ----- |

---

## Work Queue

### [Semantic Title]

- [ ] [Task]

Acceptance: [Criteria]

---

## Learnings

> Append-only. Never edit or delete existing entries.

| Date | Learning |
| ---- | -------- |
```

---

## Compaction

**Triggers**: >400 lines, >30 learnings, >3 completed work items, risks unreviewed >90 days

**Actions**:

- Archive to `CONTEXT-ARCHIVE.md`: learnings >6 months old (keep 10 recent), deferred decisions >6
  months
- Delete: completed work items (after verified in Current Reality), mitigated risks, resolved
  decisions (after moving to Locked), stale Work In Flight
- Consolidate: granular tables → summary rows, related learnings → single entry

**Log**: `YYYY-MM-DD | Compacted CONTEXT.md; archived N learnings, removed M work items`
