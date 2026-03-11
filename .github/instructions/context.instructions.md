---
description: "Global rules for AI agents operating in this repository"
---

# AI Agent Operating Instructions

This repository uses a **CONTEXT.md-driven development model**. CONTEXT.md is the single source of
truth.

---

## Required Behaviours

| Action            | Rule                                                            |
| ----------------- | --------------------------------------------------------------- |
| Before any change | Read CONTEXT.md; check Work In Flight for conflicts             |
| Locked Decisions  | Final. Never propose alternatives without explicit user request |
| Starting work     | Claim in Work In Flight with timestamp; wait if conflict exists |
| Completing work   | Move to Current Reality; remove Work In Flight entry within 24h |
| Discoveries       | Append to Learnings (never edit or delete existing entries)     |
| Contradictions    | CONTEXT.md wins. Flag and resolve immediately                   |

---

## Section Reference

| Section          | Check For                                      |
| ---------------- | ---------------------------------------------- |
| System Intent    | What the system is supposed to do              |
| Current Reality  | What actually exists right now                 |
| Locked Decisions | Patterns you must follow                       |
| Open Decisions   | Unresolved questions that may affect your work |
| Work In Flight   | Parallel work that may conflict with yours     |
| Work Queue       | Prioritised future work                        |
| Learnings        | Historical context and gotchas                 |

---

## Document Hierarchy

1. **CONTEXT.md** — Authoritative source of truth
2. **Code** — Implementation (should match CONTEXT.md)
3. **README.md** — Onboarding only (does not define system state)

When in doubt, CONTEXT.md wins.
