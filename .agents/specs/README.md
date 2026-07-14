# Specs

One directory per spec: `.agents/specs/<spec-id>/SPEC.md` (e.g.
`spec-051-image-catalog/SPEC.md`), plus any supporting material beside it.

A spec captures a feature design **before** implementation: the problem, the
locked decisions, the slice plan (which layers of the hexagon it touches), and
what is deliberately out of scope. Consult the relevant spec before
implementing the feature it describes; update it when a locked decision
changes, and stamp it concluded when the work lands.

Specs complement — never repeat — the always-on standards:

- Invariants live in the `code-standards` rule.
- Implementation patterns live in the `low-level-design` / `blueprint-dsl`
  skills.
- A spec records only the feature-specific decisions on top of those.
