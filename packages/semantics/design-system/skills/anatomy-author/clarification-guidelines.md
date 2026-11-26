# Clarification Guidelines for Anatomy Authoring

## Purpose

Use these guidelines during **Stage 3 — Gather Structural Requirements** of the `anatomy-author` workflow. Resolve missing or ambiguous **visual anatomy and structural** requirements identified by the completeness audit before generating Anatomy DSL.

The person using the skill is the **design authority** for the current task unless the conversation identifies another responsible decision-maker. Present uncertain structural choices as a **recommendation plus a question**, not as a finished decision. Preserve the existing skill's decision gates for node boundaries, slot names, cardinality, and what the anatomy fixes versus leaves configurable.

This is a conversational clarification process, **not a separate form, fixed questionnaire, or design approval process**. Do not ask questions when the required decisions are already established.

## 1. Determine the authoring scenario

Use one of the following contexts to guide evidence priority and question volume:

| Scenario | Evidence and questioning approach |
| --- | --- |
| **Create from design** | Examine Figma components, variants, properties, constraints, annotations, and Pragma context. The design plus designer-confirmed decisions are authoritative for structural intent. Ask when Figma is silent or ambiguous. |
| **Document existing implementation** | Examine the implementation and Pragma graph/standards when no Figma design exists. Ask when structural intent is unclear. |
| **Document design and implementation** | Examine both sources. When they conflict, ask the design authority to resolve or explicitly defer each discrepancy. Record confirmed decisions, explicitly deferred discrepancies, and any differences from the implementation. |
| **Create from scratch** | Use any existing component definition, requirements, graph context, and Pragma conventions. If there is no design or implementation, skip unavailable source analysis and ask the minimum foundational questions needed to define anatomy. Do not fabricate a structure. |

**Always consult the applicable Pragma semantic context before inventing reusable component identities, slot names, symbols, or tier assignments.** Respect the skill's existing discovery and decision-gate instructions. Distinguish documentation of visual anatomy from the broader component-definition work handled elsewhere.

## 2. Classify the evidence before asking

For each applicable consideration in `completeness-checklist.md`, maintain a short internal record:

- **Consideration:** What visual or structural decision is at issue?
- **Source/evidence:** Where is it shown or defined (design, implementation, existing Pragma specification, approved convention, or user answer)?
- **Status:** `confirmed`, `inferred/ambiguous`, `missing`, `conflicting`, or `not applicable`.
- **Impact:** Would the missing answer change nodes, hierarchy, slot structure, cardinality, layout, state presentation, or other implementable visual structure?
- **Question:** Ask only when resolution requires a decision from the design authority.

Do **not** equate technical properties with design intent unless the intent is clear. Examples:

- Figma **Clip content** establishes a frame setting, not necessarily the intended truncation/overflow rule.
- A short sample label does not establish a maximum label length or single-line policy.
- A hidden Figma layer, even when hidden in every variant, does not establish whether it is a supported optional part, an unused layer, or an obsolete design artifact. Check component properties, annotations, other available evidence, and designer-confirmed decisions before classifying it. If its intended role remains unclear, ask the design authority. Do not treat hidden layers as visually verified configurations.
- An observed implementation layout is evidence of current behaviour, but may conflict with design intent.
- Do not assume that Figma parts and Pragma properties are equivalent or different based on their names alone. Before asking about their relationship, inspect the available Figma component properties, layer structure, and relevant Pragma graph definitions or documentation. Compare their roles, structure, and supported configurations. If the relationship remains unclear, explain what the evidence establishes, what is still unknown, and what specific decision is needed from the design authority. Do not offer answer options based on unsupported assumptions.
- Before proposing which Figma wrappers to preserve or remove, evaluate each wrapper's structural purpose, including grouping, layout, spacing, and conditional content. Do not preserve a wrapper solely because it exists in Figma or remove one solely because its children can be represented without it. Verify that the proposed hierarchy retains all meaningful structural relationships and visual requirements. Ask the design authority about any unresolved boundaries.
- When a Figma element appears to correspond to a named Pragma component, verify its identity using available component-instance metadata, Pragma definitions, or other reliable evidence. Do not treat matching names or visual roles alone as confirmation. If the identity remains uncertain and affects the anatomy, ask the design authority before assigning a named component URI.
- When additional component documentation is available, compare its requirements and component relationships with Figma, implementation, and Pragma definitions. Identify conflicting requirements and resolve material discrepancies with the design authority. For documented subcomponents missing from the Pragma graph, do not assume their identities are invalid or invent URIs. Confirm their intended identity, structural role, and relationship to the parent before authoring.

If a convention explicitly settles the issue and applies to this component, use it without asking again; do not generalise from another component's one-off decision.

## 3. Decide which questions to ask

**Ask a question when all are true:**

1. The consideration is relevant to the component.
2. The required visual/structural outcome is missing, ambiguous, or conflicting.
3. Available sources and applicable approved Pragma conventions do not resolve it reliably.
4. Its answer could materially change the generated anatomy or result in an undocumented design decision.

Before asking a clarification question, check the proposed configuration against available Figma evidence, Pragma graph constraints, approved conventions, and decisions already confirmed in the conversation. If reliable evidence establishes the answer, record it without asking. Do not offer choices that established requirements rule out. If the sources conflict or do not reliably establish the visual requirement, ask about the specific ambiguity instead of treating unsupported configurations as equally plausible.

**Prioritise blocking questions** before authoring the final DSL: component identity/boundaries, required versus optional parts, supported variants, cardinality, conditional structures, constraints that materially alter composition, and conflicting sources of truth.

Skip questions about irrelevant or already answered considerations. When the component specification explicitly leaves a detail configurable, record that as an intentional design choice rather than an unresolved gap. Do not independently defer material missing or ambiguous requirements; ask the design authority to resolve or explicitly defer them.

Questions on **UX behaviour** (what click/keyboard action changes a state, focus movement, validation algorithms, business rules, state machines) are out of scope. You may ask what a particular *visual state looks like*; do not ask how the application enters that state.

## 4. Ask concisely and in context

- First state the relevant evidence or gap in one sentence.
- Ask **one clear decision question**, ideally with a small number of plausible options when that reduces effort.
- Each question must address one independent design decision. Do not combine multiple decisions into a single confirmation, even when they concern the same component part. For example, slot names for different parts, structural wrappers, and optional-part appearance must be decided separately. Multiple-choice options must be mutually exclusive and address only that decision.
- Offer a suggested answer only when grounded in a relevant Pragma convention or the available design; mark it as a proposal.
- Group related questions into small batches when useful, but give each independent decision its own question and answer field. A batch must not use one shared confirmation for multiple decisions.
- Always allow the design authority to provide an answer outside the suggested choices. When the question interface supports free-text input, enable it and do not add a separate **Other / specify** option. When free-text input is unavailable, explicitly invite a custom answer.
- Do not offer **Defer to the designer** or equivalent options when the person answering is already the design authority. The design authority may explicitly choose to leave a decision unresolved, but do not present deferral as a substitute for answering the question or claim that an unresolved gap will be encoded in the DSL.
- Accept partial answers; ask only the follow-up needed to resolve a still-blocking ambiguity.
- Never ask for information explicitly present in the conversation, approved specification, or source evidence.
- Do not ask the user to confirm every item in the checklist; it is a diagnostic framework.
- Respect the existing skill's collaboration and narration conventions without adding long process explanations.

### Examples

**Ambiguous overflow (create from design)**

> Figma has `Clip content` enabled, but it does not establish what should happen to a long label. Should the label wrap, truncate with an ellipsis, or follow another rule?

**Optional-part combination (any scenario)**

> The leading icon and trailing action are shown separately. Can both appear together?

**Conflict (document design and implementation)**

> The implementation keeps the description visible at narrow widths, while the design hides it. Should the Anatomy DSL specify that the description remains visible, is hidden, or follows another rule?

**Foundational anatomy (create from scratch)**

> What are the component's essential visual parts, and which of them should be optional? For example, should this notification always have a message and optionally include an icon and close action?

**Visual state, not interaction logic**

> In the loading presentation, should the spinner replace the label, sit beside it, or preserve the label's space while hiding it?

**Structural edge case**

> When the tabs no longer fit in one row, should they wrap, scroll horizontally, or use an overflow region?

## 5. Record decisions and avoid re-asking

After an answer:

1. Record the **confirmed structural decision**, including applicable state/variant/condition and any exceptions.
2. Update related checklist statuses; resolve contradictory interpretations before proceeding.
3. Check only directly affected considerations for newly revealed gaps (for example, deciding to truncate may raise a question about the truncation boundary).
4. Do not repeat answered or explicitly deferred questions, even if the same decision is relevant to several checklist categories. Revisit a deferred question only when new evidence materially changes what needs to be decided.
5. Distinguish **component-specific decisions** from **approved Pragma-wide conventions**. Never promote one component's rule to a universal convention automatically.

If the design authority explicitly chooses to leave a decision open, record it as **unresolved** and report its effect on DSL completeness. Do not invent an answer. If the user requests full autonomous authoring, follow the existing skill's autonomy exception and clearly identify unilateral judgments rather than presenting them as confirmed.

## 6. Hand off to DSL generation

Once all material requirements satisfy the exit criteria in Section 7, generate Anatomy DSL from the consolidated Stage 3 specification using:

1. Confirmed design/implementation evidence appropriate to the authoring scenario.
2. Applicable and verified Pragma standards, graph definitions, and conventions.
3. Explicit decisions obtained through clarification.

Follow the existing `SKILL.md` authoring rules and the unchanged normative `ANATOMY_DSL_SPEC.md` for valid notation. This file does **not** expand the DSL grammar or modify formal prop/modifier definitions.

### When a confirmed requirement cannot be expressed

- First check whether an existing DSL construct actually expresses the requirement (for example, cardinality, `switch`, or a state-scoped style). Do not assume that a general limitation rules out all related constructs.
- Write every supported part of the specification using **valid existing DSL**.
- **Report the unrepresentable requirement separately in the response, outside the YAML**, explaining why the current DSL cannot express it.
- Do not invent keys, switches, states, or other unsupported syntax; do not silently omit confirmed requirements.

Keep **source references and URLs out of YAML comments**, as required by the existing commenting guidelines. If sources or outstanding decisions must be reported, put them in accompanying prose instead of comments.

## 7. Scope and exit criteria

Before declaring Stage 3 complete, reconcile every missing, ambiguous, or conflicting requirement identified during the completeness audit or subsequent clarification. For each requirement, establish one of the following outcomes:

1. **Confirmed by evidence:** Cite the reliable evidence that resolves it.
2. **Confirmed by the design authority:** Record the explicit decision.
3. **Explicitly deferred by the design authority:** Record the unresolved requirement and its impact on DSL completeness.
4. **Not applicable or outside scope:** Explain why it does not require a design decision.

Do not independently classify a material requirement as deferred, resolved, or non-applicable without justification. In particular, do not assume that optional parts automatically establish their supported combinations, placement, or behaviour under constraints. If a material requirement remains unaddressed, Stage 3 is incomplete; ask the outstanding question before proceeding.

Proceed to DSL generation only after every material requirement has one of the outcomes above. **Validation remains a later stage** using the existing skill's validation instructions; these guidelines do not introduce a separate scenario-testing or approval step.

At the end of Stage 3, consolidate the confirmed visual and structural requirements into a component-specific specification. Include the intended anatomy, supported configurations, dimensions, spacing, visual states, colours, content constraints, and responsive behaviour where applicable. Record requirements with their conditions and exceptions, not just the answers to clarification questions. Keep the specification independent of the current DSL's capabilities.

Before handing the consolidated specification to Stage 4, cross-check it against the completed completeness checklist. Confirm that every core and applicable conditional consideration has a documented outcome, and that all confirmed requirements, conditions, exceptions, and constraints are preserved. If a material requirement was omitted or its outcome remains unclear, return to clarification before proceeding. Do not leave missing design decisions for Stage 4 to resolve implicitly.