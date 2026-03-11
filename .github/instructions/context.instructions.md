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
| Completing work   | Update Current Reality; remove Work In Flight entry immediately |
| Contradictions    | CONTEXT.md wins. Flag and resolve immediately                   |

---

## Section Reference

| Section          | Check For                                      |
| ---------------- | ---------------------------------------------- |
| System Intent    | What the system is supposed to do              |
| Current Reality  | What actually exists right now (listed = done) |
| Locked Decisions | Patterns you must follow                       |
| Open Decisions   | Unresolved questions that may affect your work |
| Risks            | Known risks with impact and mitigation         |
| Work In Flight   | Parallel work that may conflict with yours     |
| Work Queue       | Prioritised future work                        |

---

## Document Hierarchy

CONTEXT.md > Code > README > Comments

When conflict detected: CONTEXT.md is correct. Update the other source.
