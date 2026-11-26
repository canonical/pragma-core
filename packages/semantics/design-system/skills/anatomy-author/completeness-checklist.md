# Visual Anatomy and Structural Completeness Checklist

## Purpose and scope

Use this checklist during **Stage 2 — Audit completeness** of the `anatomy-author` workflow. Its purpose is to identify visual and structural information required for a reliable Anatomy DSL, including details that Figma may omit, imply, or be unable to encode as structured component data.

This checklist applies to all four authoring scenarios:

- **Create from design:** Use the design and designer-confirmed decisions as the structural source of truth.
- **Document existing implementation:** Use the existing implementation and Pragma context when no Figma design exists.
- **Document design and implementation:** Analyse both sources. When they conflict, ask the design authority to resolve or explicitly defer each discrepancy. Record confirmed decisions, explicitly deferred discrepancies, and any differences from the implementation.
- **Create from scratch:** Use available requirements and ask the design authority to establish missing structural decisions.

**In scope:** Visual parts, hierarchy, variants, optional/conditional parts, representation of visual states, content presentation, sizing, overflow, responsive composition, layout, and structural edge cases.

**Out of scope:** UX interaction rules, keyboard behaviour, event triggers, state transitions, validation/business logic, formal prop-surface or modifier definitions, implementation algorithms, and approval of the design. Appearance associated with a state is in scope; the process that produces the state is not.

**Do not restrict this audit to the current DSL syntax.** The purpose is to establish what the specification needs, then determine what the current notation can represent.

### How to assess each consideration

- **[Core]** — Consider for every component, even if the documented outcome is *not applicable*.
- **[Conditional]** — Consider when the component or its supported configurations make the item relevant.
- For each applicable item, classify the available evidence as **confirmed**, **inferred/ambiguous**, **missing**, or **conflicting**. Record *not applicable* when justified.
- A Figma setting is evidence of a design decision only when its intended meaning is clear. For example, `Clip content` does not necessarily establish the intended treatment of long text in implementation.
- Do not ask about information already confirmed by reliable evidence or approved Pragma conventions. Refer unresolved design decisions to `clarification-guidelines.md`.
- **Do not turn this checklist into a mandatory fixed questionnaire.** Assess applicability first and ask only necessary questions.

---

## 1. Component anatomy and hierarchy

- [ ] **[Core] Root element.** Identify the component's main structural container.
- [ ] **[Core] Constituent parts.** Identify visual and structural parts: labels, icons, containers, backgrounds, dividers, indicators, and other relevant elements.
- [ ] **[Core] Parent-child relationships.** Identify which elements contain others.
- [ ] **[Core] Hierarchy and nesting.** Specify the structure of nested groups and containers.
- [ ] **[Core] Element ordering.** Define the order of parts within the component.
- [ ] **[Core] Required and optional parts.** Distinguish always-present parts from optional ones; Section 3 covers their conditional combinations.
- [ ] **[Conditional] Hidden or unused design layers.** Identify layers hidden across the inspected configurations and establish whether they represent supported optional anatomy, unused elements, or obsolete artifacts. Do not infer their intended status from visibility alone.
- [ ] **[Conditional] Repeated elements.** Describe the structural pattern of tabs, list items, table rows, etc., including meaningful count constraints.
- [ ] **[Conditional] Decorative or implicit parts.** Include structural decorations even if they are not separate Figma layers or DOM nodes (for example, separators or pseudo-elements).
- [ ] **[Conditional] Nested components.** Identify documented parent-child component relationships, including named subcomponents not yet registered in Pragma. Distinguish reusable components and subcomponents from anonymous structural nodes. Verify existing identities against the Pragma graph and flag missing or ambiguous definitions for clarification.

*Example:* A text field may contain a label, input region, leading icon, trailing action, helper text, and status indicator. Identify their hierarchy before describing variations.

## 2. Variants and structural configurations

- [ ] **[Core] Default configuration.** Identify the component's intended default visual presentation, including which optional parts are visible. Compare defaults defined in Figma, the Pragma graph, and other applicable sources. If they conflict, ask the design authority to establish the intended default, even when the underlying anatomy remains unchanged. Record discrepancies without assuming that either source is correct.
- [ ] **[Core] Supported variants.** Identify named or formally supported variants without treating every optional-content configuration as a variant.
- [ ] **[Conditional] Size variants.** Define structural differences among supported sizes.
- [ ] **[Conditional] Structural alternatives.** Describe orientation or arrangement differences when they are explicitly supported variants (for example, horizontal vs. vertical tabs).
- [ ] **[Conditional] Variant-specific parts and hierarchy.** Identify parts that exist only in particular variants and changes to nesting, ordering, or grouping.
- [ ] **[Conditional] Variant restrictions and source-only configurations.** Identify unsupported structural combinations and variants or states documented in the Pragma graph or other specifications but absent from Figma. Investigate whether they are supported and affect visual anatomy. If their status or intended presentation remains unclear, ask the design authority rather than silently excluding them. Record purely behavioural restrictions as outside the Anatomy DSL's scope.

*Boundary:* Optional content combinations belong to Section 3; responsive rearrangements caused by available space belong to Section 8.

## 3. Conditional anatomy and composition

- [ ] **[Core] Conditional parts.** Identify which optional elements can be included or omitted based on content or component configuration.
- [ ] **[Conditional] Content configurations.** Describe supported combinations such as icon-only, label-only, and icon-with-label.
- [ ] **[Conditional] Optional-element combinations.** Establish which combinations of optional parts are supported and define their resulting layout when parts coexist or are absent. Do not assume that independently optional parts can appear in every combination. Verify relevant combinations using reliable evidence or designer-confirmed decisions, without re-asking questions already resolved by existing constraints.
- [ ] **[Conditional] Visibility conditions.** Define the *visual condition* under which each optional part is rendered; do not define the UX event that creates it.
- [ ] **[Conditional] Hidden-element treatment.** Specify whether an absent/hidden part is removed from layout, retains its space, or is only visually concealed.
- [ ] **[Conditional] Hidden-part appearance.** For supported optional parts that are never shown in the inspected variants, establish their intended appearance, placement, styling, and state-dependent presentation from other reliable evidence or designer-confirmed decisions. Do not treat hidden-layer properties alone as verification of their rendered appearance.
- [ ] **[Conditional] Conditional replacement.** Define when one visual part replaces another due to configuration.
- [ ] **[Conditional] Layout redistribution.** Define how siblings resize, move, or realign when optional parts are added or removed.
- [ ] **[Conditional] Slot composition.** Define permitted content and structural constraints for configurable slots; do not redefine the component's formal prop surface.
- [ ] **[Conditional] Simultaneous conditions.** Establish the resulting anatomy and visual presentation when multiple conditions apply together. Record relevant combinations explicitly, including differences in layout, spacing, sizing, and visibility. Do not assume that independently confirmed rules produce the intended result when combined.
- [ ] **[Conditional] Unsupported optional combinations.** Identify unsupported combinations of optional parts (distinct from variant restrictions in Section 2).


*Example:* A field may support a leading icon, a trailing action, both, or neither. Record the placement of the input region in every supported combination.

## 4. State-dependent visual structure

- [ ] **[Conditional] State-specific anatomy.** Identify parts present in each supported visual state (such as selected, checked, expanded, or disabled).
- [ ] **[Conditional] State-specific visibility.** Define parts shown or hidden in each state.
- [ ] **[Conditional] State-specific arrangement.** Specify structural changes in positioning, order, or layout across states.
- [ ] **[Conditional] State targets across configurations.** Identify which elements receive each visual state and whether the target changes with component configuration. Record both the elements that change and those that remain unchanged.
- [ ] **[Conditional] State-specific indicators.** Specify presence and placement of checkmarks, chevrons, and similar indicators.
- [ ] **[Conditional] Colours across variants and states.** Establish the intended background, border, text, icon, and nested-part colours for applicable combinations of semantic variants and visual states. Include customisable colour configurations when supported. Record the visual requirements without requiring token mapping or DSL representation at this stage.
- [ ] **[Conditional] State combinations.** Identify supported simultaneous states that alter structure, and the resulting presentation.
- [ ] **[Conditional] Structural stability.** Identify elements and dimensions that should remain unchanged across states.

*Example:* A checkbox uses an empty indicator, checkmark, or indeterminate mark. Record the visual differences; do not define the interaction that changes its state. Loading and other exceptional presentations are in Section 11.

## 5. Content structure and presentation

- [ ] **[Conditional] Content regions.** Identify where text, icons, images, and other content appear.
- [ ] **[Conditional] Content arrangement.** Define the order and grouping of content within a region.
- [ ] **[Conditional] Content-dependent geometry.** Describe how changing content affects the component's size or the sizes of its parts.
- [ ] **[Conditional] Absent content.** Define the structure when an individual content field is empty or omitted.
- [ ] **[Conditional] Placeholder presentation.** Specify the position and layout effect of placeholders.
- [ ] **[Conditional] Content priority.** Identify content or parts that retain space, shrink, or disappear when constrained.
- [ ] **[Conditional] Mixed content.** Define the arrangement of text, images, icons, and nested content in the same region.

*Boundary:* Text wrapping, line limits, truncation, and clipping belong to Section 7; empty datasets and no-results presentations belong to Section 11.

## 6. Dimensions and resizing

- [ ] **[Core] Width model.** Specify fixed, intrinsic, flexible, or container-dependent width.
- [ ] **[Core] Height model.** Specify fixed, content-driven, flexible, or constrained height.
- [ ] **[Core] Minimum and maximum dimensions.** Establish meaningful size limits or confirm that no explicit limits apply. Do not infer the absence of minimum or maximum dimensions solely from content-hugging, flexible sizing, or truncation behaviour. Resolve missing constraints through reliable evidence or designer-confirmed decisions.
- [ ] **[Core] Growth and shrinkage.** Define which regions grow or shrink as available space changes.
- [ ] **[Conditional] Child sizing.** Identify fixed-size versus flexible children and their size relationships.
- [ ] **[Conditional] Aspect ratios.** Define proportional constraints of relevant parts.
- [ ] **[Conditional] Dimension relationships.** Specify matching or dependent widths/heights between parts.
- [ ] **[Conditional] Configuration-dependent dimensions and spacing.** Record differences in sizes, padding, gaps, and other dimensional constraints across supported variants and optional-part combinations.
- [ ] **[Conditional] Resizable components.** Describe supported resized geometries and hard boundaries, not resize-event behaviour.

*Example:* A textarea may grow with text up to a maximum height, while a trailing icon stays fixed-size.

## 7. Overflow, wrapping, and truncation

- [ ] **[Core] Horizontal overflow.** Define the visual outcome when content exceeds available width.
- [ ] **[Core] Vertical overflow.** Define the visual outcome when content exceeds available height.
- [ ] **[Conditional] Text wrapping.** Define single-line/multiline presentation and where wrapping is permitted or prohibited.
- [ ] **[Conditional] Truncation.** Specify whether text truncates, and at the start, middle, or end.
- [ ] **[Conditional] Line limits.** Specify maximum visible lines and resulting presentation.
- [ ] **[Conditional] Unbreakable strings.** Address long URLs, identifiers, paths, or other content lacking natural breakpoints.
- [ ] **[Conditional] Clipping.** Identify clipping boundaries and which parts, decorations, or effects may be clipped.
- [ ] **[Conditional] Scrollable regions.** Identify the scrolling container(s) and non-scrolling parts; not the interaction mechanics.
- [ ] **[Conditional] Overflow indicators.** Define ellipses, fades, scroll cues, or other visual indicators.
- [ ] **[Conditional] Overflow reorganisation.** Define alternate structural presentations such as wrapping items to a new row or placing them in an overflow container.

*Example:* A tab bar may show a scrollable tab region plus fixed controls. Do not infer this solely from Figma's `Clip content` property.

## 8. Responsive and adaptive structure

- [ ] **[Core] Container responsiveness.** Define structural adaptation as available width or height changes.
- [ ] **[Conditional] Breakpoint-specific structure.** Identify changes at specified viewport thresholds.
- [ ] **[Conditional] Container-dependent adaptations.** Identify changes governed by the component's own container rather than the viewport.
- [ ] **[Conditional] Orientation changes.** Describe reorientation caused by available space (distinct from the explicit variants in Section 2).
- [ ] **[Conditional] Element reordering.** Record changes in visual order at supported sizes.
- [ ] **[Conditional] Responsive visibility.** Define parts that appear or disappear under size constraints.
- [ ] **[Conditional] Compact presentation.** Specify alternate compositions for constrained spaces.
- [ ] **[Conditional] Short-viewport constraints.** Define the presentation when vertical space is limited.
- [ ] **[Conditional] Responsive child constraints.** Define how nested regions adapt together.

*Example:* A toolbar may expose all actions at wide widths and move secondary actions into an overflow area at narrow widths.

## 9. Alignment, positioning, and layout

- [ ] **[Core] Layout direction.** Identify horizontal, vertical, grid, or other baseline arrangement.
- [ ] **[Core] Alignment.** Define positioning of parts relative to their container and one another.
- [ ] **[Core] Distribution.** Define how space is distributed between children.
- [ ] **[Conditional] Baseline alignment.** Specify alignment of text, icons, and inline elements.
- [ ] **[Conditional] Child wrapping.** Define whether groups of children form additional rows or columns.
- [ ] **[Conditional] Relative positioning.** Describe how badges, handles, indicators, and counters are anchored.
- [ ] **[Conditional] Fixed or sticky positioning.** Identify fixed/sticky elements and their structural containing context.
- [ ] **[Conditional] Structural separators.** Specify where dividers occur in groups or repeated items.
- [ ] **[Conditional] Nested layout constraints.** Specify how parent and child layout rules interact.
- [ ] **[Conditional] Alignment to surroundings.** Record relationships to adjacent content when part of the component contract.

*Boundary:* Identify relevant visual and layout requirements here; map supported styles to valid DSL style keys using verified Pragma tokens or permitted literals during Stage 4 (`Apply Styles`).

## 10. Floating and layered components

- [ ] **[Conditional] Overlay anatomy.** Define the parts of popovers, menus, tooltips, dialogs, and floating panels.
- [ ] **[Conditional] Anchor relationship.** Identify the anchor for positioned content.
- [ ] **[Conditional] Preferred placement.** Specify the intended placement relative to the anchor.
- [ ] **[Conditional] Alternative placement.** Specify alternative visual placements if the preferred one does not fit.
- [ ] **[Conditional] Viewport/container constraints.** Define dimensions and clipping boundaries of floating regions.
- [ ] **[Conditional] Internal scrolling structure.** Identify fixed headers, scrollable bodies, or fixed footers.
- [ ] **[Conditional] Layer order.** Define the relative visual order of backdrop, surface, indicators, and other layers.
- [ ] **[Conditional] Nested overlays.** Define relevant structural relationships among overlapping floating elements.

*Example:* A popover can appear above or below its trigger depending on available space. Do not specify triggers, dismissal, or focus management here.

## 11. Loading, empty, and exceptional presentations

- [ ] **[Conditional] Loading structure.** Define parts rendered during loading.
- [ ] **[Conditional] Skeleton presentation.** Define placeholders and their relationship to final content.
- [ ] **[Conditional] Empty collection/dataset.** Describe the presentation when a collection has no items (distinct from missing optional content in Section 5).
- [ ] **[Conditional] No-results presentation.** Specify a distinct visual structure when search/filter yields no matches.
- [ ] **[Conditional] Error presentation.** Define placement and structure of status text, icons, and indicators.
- [ ] **[Conditional] Success and warning presentations.** Define added or replaced visual parts.
- [ ] **[Conditional] Unavailable media/data.** Specify visual placeholders or fallback parts for missing resources.
- [ ] **[Conditional] Placeholder-to-content geometry.** Specify whether placeholders reserve the final content's space.

*Example:* A data table may present skeleton rows, regular rows, or an empty-state region. Specify each visible structure but not the loading/error logic.

## 12. Internationalisation and text scaling

- [ ] **[Conditional] Text expansion.** Allow for translation length changes and relevant constraints.
- [ ] **[Conditional] Right-to-left layout.** Define mirroring of order, placement, and alignment.
- [ ] **[Conditional] Direction-independent parts.** Identify elements that must not mirror.
- [ ] **[Conditional] Bidirectional text.** Define layout when mixed writing directions occur.
- [ ] **[Conditional] Font metrics.** Account for relevant writing-system metrics that change geometry.
- [ ] **[Conditional] Text zoom and scaling.** Define reflow and containment with enlarged text.
- [ ] **[Conditional] Alternative writing orientations.** Specify structural changes if vertical writing is supported.

*Example:* A leading icon may move to the opposite inline side in RTL, while a brand mark retains its orientation.

## 13. Media, graphics, and specialised structures

- [ ] **[Conditional] Media containers.** Define image/video positioning and geometric boundaries.
- [ ] **[Conditional] Media fitting.** Specify crop, contain, fill, and aspect-ratio rules.
- [ ] **[Conditional] Fallback graphics.** Define visual replacements for missing media.
- [ ] **[Conditional] Icon containers.** Define the relationship of icons to surrounding content.
- [ ] **[Conditional] Masks and shapes.** Specify structural clipping or nonrectangular boundaries.
- [ ] **[Conditional] Chart anatomy.** Identify plot, axes, gridlines, labels, legend, and data-mark regions.
- [ ] **[Conditional] Specialised parts.** Identify tracks, handles, segments, connectors, markers, etc.
- [ ] **[Conditional] Structural decorations.** Include meaningful parts rendered through backgrounds, pseudo-elements, or other mechanisms.

*Example:* A slider's anatomy may include a track, filled region, thumb, and optional ticks/labels.

## 14. Completeness and consistency review

- [ ] **[Core] Parts accounted for.** Every meaningful visual or structural part has an intentional representation.
- [ ] **[Core] Supported configurations accounted for.** Variants, sizes, optional parts, and content configurations are understood.
- [ ] **[Core] Visibility rules accounted for.** Relevant conditions for showing, hiding, or replacing parts are known.
- [ ] **[Core] Structural changes accounted for.** Changes caused by content, state, or available space have intended outcomes.
- [ ] **[Core] Boundary cases considered.** Assess short/long content, constrained/large containers, and minimum/maximum meaningful item counts.
- [ ] **[Core] Structural conflicts identified.** Check combinations likely to overlap, clip, misalign, or lose content.
- [ ] **[Conditional] Source anomalies and outliers.** Investigate unexpected differences in properties, token bindings, or layout values across otherwise equivalent configurations. Establish whether they represent intentional design decisions, source errors, or irrelevant artifacts. Do not dismiss them solely because the current examples appear visually unchanged. Record relevant discrepancies and ask the design authority only when their intended visual or structural outcome remains materially uncertain.
- [ ] **[Core] Intentional omissions identified.** Distinguish deliberately unsupported configurations from unconsidered ones.
- [ ] **[Core] Outstanding decisions collected.** Route unresolved or contradictory structural decisions to the clarification stage rather than guessing.

### Completion of the audit

The audit is complete when all **applicable considerations have a documented status**, and all unresolved points have been identified for targeted questions. This is **not** approval of the component design and is **not** the final DSL validation stage.

Ask whether an engineer can understand *what parts exist, how they are arranged, how they appear in each supported configuration, and what happens structurally at relevant boundaries*—without needing the skill to define UX behaviour.
