---
name: model-domains
description: Model an application's domains, paths, views and layouts from its personas, jobs and journeys, comparing several domain designs; also runs as a guided tutorial on a worked example
---

# Model Domains

Decide how an application is organised: its domains, its paths, its views and the
layout of each view. The input is the output of `map-journeys`: personas, jobs and
journeys. This skill adds the views, and notes on each job the views where it gets
done.

**Nothing skips the chain: domain, then path, then view, then layout. And the domains
are never one guess: several designs are laid out, and the journeys choose between
them.** That is what following domain-driven design strictly means here.

- **A domain** is a part of the application people name as one: Apps, Settings,
  Onboarding. It is named with a word people say. Not every domain holds a kind of
  thing.
- **A path** is an address: `/apps/lxd-ui`. A `:name` in a path stands for one object,
  one thing you can point at.
- **A view** answers one question at one path, for at least one job.
- **A layout** is the view's shape. It comes from the design-system graph.

How a URL is spelled, and which layout a view takes, are defaults a person may change.
The chain is not.

In a fresh session, orient first:

```bash
pragma capabilities
```

## Working mode: assistant to a design authority

Most of the time this skill runs with an operator: a designer, an engineer or a product
lead who knows the application. They are the authority. You are the assistant whose job
is to make them successful:

- Say which step comes next and why.
- Do the legwork yourself. Draft the designs, walk the journeys, compute the scores,
  look the layouts up.
- Bring each decision as a recommendation plus a question, never as a fait accompli.
  Ask about one concrete view or path at a time, and say what each option would mean.
  A question about an abstract rule gets no useful answer.

Full autonomy is the exception. Run the whole flow alone only when explicitly asked to.
Then no gate can be passed: run to the end, record every gate decision as a guess,
leave every row `not reviewed`, and list each judgment call in the final report.

Decision gates — pause at each and resolve it WITH the operator:

1. Create or update, whenever the signs leave any doubt.
2. Which domain design is taken.
3. What one of each `:name` is.
4. Each row of the views table.
5. Each new layout.

## When to Use

- Personas, jobs and journeys exist, and the application's structure has to be decided
- An existing application's routes and pages need checking against its journeys
- The personas, jobs or journeys changed, and the views built on them need updating
- An earlier views table needs updating after a new domain or a cut view

## When NOT to Use

- No personas, jobs or journeys yet — use `map-journeys` first
- Specifying a component or a pattern a view needs — use `specify-component` or
  `specify-pattern`
- Drawing wireframes or building pages — that comes after the views table is approved

## Opening move: ask, or offer the tutorial

Unless the first message already names the work, ask for the starting point as a
suggestion carrying an example, not as a form to fill in:

> To get started, point me at the personas, jobs and journeys for the application: a
> file in the repository, or a link to the page. If they do not exist yet, we start
> with `map-journeys`.

If the message already carries the starting point, say what you took it to be, and go.

Offer the tutorial in the same breath:

> Or if you'd rather see the flow first, I can run it as a tutorial on a worked
> example: a tracker that measures design-system adoption across four apps.

Tutorial mode runs the same steps on the worked example at the end of this skill, with
the reasoning at each gate spelled out. It publishes and writes nothing unless the
operator asks to keep what was built.

## Read the situation: new or existing, create or update

Work out two things from context before step 1, and say what you took them to be in
one line.

- **New or existing application.** Existing when there is application code where you
  are running, or the operator names an application or a repository.
- **Create or update.** Update when the earlier output already holds views. That
  includes the case where only the journeys changed: the views were built on them.

**When in doubt about create or update, ask in one plain line with two options. Never
guess, and never change earlier output on a guess.**

> `journeys.json` already has views. Do I update them, or lay out the domains afresh?

| | Create | Update |
|---|---|---|
| **New application** | Lay out several designs from the jobs alone. | Change only what the request touches. |
| **Existing application** | Today's routes are the first design in the comparison. | Also report where today's routes and the earlier views have drifted apart. |

## Every step is narrated: outcome, path, conclusion

Open every step by telling the operator what it is FOR and how you will get there.
Close it with what it established and what that means for the next step. One sentence
each is enough. The operator can only steer a step they saw coming.

Do:

> **Step 4 — score and choose.** The outcome is one domain design, chosen with the
> numbers in front of you. I walk each journey through each design, job by job, and
> price every move.
>
> …
>
> So: two domains are cheaper for the steward, 2.0 against 2.75 per job. You still took
> three, because the facts about a run had no home otherwise. Step 5 writes the paths.

Don't:

> Step 4 — Scoring
>
> Design B: 2.0. Design C: 2.75. Going with C.

## Asked about the skill: methodology and outcomes first

Asked what this skill does, give the method and the outcome before the list of steps:

> It decides how an application is organised, and never in one guess. It lays out
> several domain designs, walks every persona's journey through each, and prices what
> each move costs them. You pick one. You end holding a views table in which every view
> has a job, a path and a layout.

## The output

This skill adds to the output `map-journeys` wrote, in the same form and the same
place. It never starts a second document. In a decision record, the designs are the
alternatives and the operator's choice is the decision.

With the recommended form, `journeys.json` gains four lists, and each job gains its
views. The page embeds a copy of the data, so refill its data block from the file, and
add a views table drawn from it.

```json
{
  "words": [{ "word": "", "meaning": "" }],
  "designs": [{ "name": "", "paths": [""], "perJob": 0, "setAside": "why, if so",
                "chosen": true }],
  "domains": [{ "name": "", "holds": "one sentence" }],
  "views": [{ "id": "", "domain": "", "name": "", "path": "", "question": "",
              "decision": "", "layout": "", "status": "" }],
  "jobs": [{ "id": "J1", "views": [""] }],
  "scores": { "date": "", "overall": 0, "journeys": [{ "question": "", "perJob": 0 }] }
}
```

The link between a job and its views is stored once, on the job. A view's jobs, and
the views of a journey, are worked out from it. The designs and the scores are recorded
so that a later update can tell what was compared, and whether the journeys or the
views have moved since.

Where the output is committed, that repository's rules and the `git` standards apply
(`pragma standard categories` lists the current set). A new layout is a design-system
block, so its spec follows the `turtle` and `ui-blocks` standards.

## The seven steps

### 1. Start from the journeys

Read the personas, jobs and journeys. If any is missing, stop and go to `map-journeys`.
Do not invent personas or jobs here.

Ask two things early, because both shape the views:

- **A product to learn from.** "Is there a product whose way of showing this you
  like?"
- **Where state lives.** "Is there a backend, or does this run in the browser alone?"
  Without a backend, nothing saved can be shared, and a filter in the address is the
  only shareable form.

Outcome gate: **the three lists are in hand, and the two answers are recorded.**

### 2. The application's words

Collect the nouns from the job stories and define each in one line, in the operator's
words. One word has one meaning, and the jobs, the paths and the views all use it that
way.

Outcome gate: **a short word list, each word defined once.**

### 3. Several domain designs

Lay out at least two designs. A design is a list of domains and the tree of paths
under them:

```
/apps                   all apps
/apps/:app              one app
/components             all components
/components/:component  one component across apps
```

Designs differ in which parts are domains of their own, and which sit under another.
"Is a component its own domain, or does it live under each app?" gives two designs.

Not every domain holds a kind of thing. Many do: Instances holds instances. Some are
one of a kind, such as settings or a colophon. Some are a way through several kinds,
such as onboarding. Some are a mix. There is no need to sort them into classes. Let
each be what people call it.

Give each domain one sentence saying what belongs in it (`holds`). If the sentence
needs "and" to join unrelated things, it may be two domains.

**For an existing application, today's routes are the first design**, written as they
are and scored like any other.

**Only real domains make a design.** A domain names things. Some tempting cuts do not,
and each becomes something else:

| Cut by | Why it is not a domain | What it becomes |
|---|---|---|
| Persona | A view shared by two personas has two homes. | Nothing in the structure. |
| Question | One object is spread over several domains. | The question each view answers. |
| Measure | Every list exists once per measure. | Columns. |
| Zoom | Some things have no home. | Path depth. |
| Time | Every view exists twice. | A sub-path such as `/history`. |

So a domain is never named after a persona, a question, a layout or a menu heading.
Views are shared freely: one view can serve several jobs and several personas.

For each design, write the shortest way to do each job, as the views the persona
opens. It is usually one view, sometimes two. A design that cannot serve a job is set
aside before scoring, and you say which job it failed.

Outcome gate: **at least two designs, each a path tree with a sentence per domain and
the shortest way to do every job.**

### 4. Score and choose

Walk every journey through every design, job by job, and price each move by what the
persona keeps:

| Cost | The move keeps | Example |
|---|---|---|
| 1 | the view | Filtering the instances list |
| 2 | the object, in another view | One instance, then that instance's history |
| 3 | the domain, with another object | The instances list, then one instance |
| 4 | nothing: another domain, or outside the application | One instance, then a network |

A journey's score is the total cost of its moves divided by its number of jobs. A
design's score is the total over all journeys divided by all their jobs. Lower is
better. Dividing by jobs matters: the jobs are the same in every design, so extra
views for a job make a score worse, never better.

Price by meaning, not by how a path is spelled. Use judgment, and say how you priced
anything unusual. A few things that come up:

- A view opened twice in one job is priced once. A picker in a dialog is not a view.
- A list filtered to one object keeps that object, wherever the list lives.
- A leading part every domain shares, such as a project, is a scope and not a domain.
- One large view does not score 1 everywhere: a view answers one question, so a view
  that needs two is priced as two.

Show the designs side by side: the score per journey and overall, the number of views,
and the moves that cost 4. Give a recommendation, a fallback, and what would change
your mind.

The score is a guide, not a verdict. It compares designs on the same journeys, and it
mostly reflects the order of the jobs, so different designs can tie and a merge of two
domains can look like a win. Say so when you see it. The operator chooses, sometimes
for a reason the score cannot see, and that reason is written down. A journey that
stays costly in every design goes back to `map-journeys` as a question.

Outcome gate: **the operator picks one design, with the comparison in front of them,
and its scores are recorded with the date.**

### 5. Paths

Write the full path tree of the chosen design.

**Before a path gets a `:name`, say in one sentence what one of them is.** "A run is
one app analyzed on one night" gives `/runs/:app/:date`. If nobody can say what one is,
it is a filter, and a filter lives in the address:
`/apps/:app/usages?folder=src/pages`.

**A need with no home is a missing domain.** When a job fits no domain, consider a new
domain before adding more to an existing view. A new domain brings a job, which goes
back to `map-journeys`.

Defaults for spelling a path:

- A domain is the first segment, after any scope that all domains share.
- Depth is zoom: all of them, then one, then something about that one.
- Time is a sub-path of the object it describes.
- Sibling views of one object are tabs, each with its own path.
- A key can have two parts.

An existing application may spell paths another way, such as a prefix before the
domain. Keep its spelling.

Only when the application uses the Pragma router: `:name` is the whole grammar, a
trailing `*` matches the rest of the path without capturing it, and routes are
navigated by name, so every path needs a stable route name. With any other router,
keep what the application already does.

Outcome gate: **a full path tree; every `:name` has its one-sentence definition.**

### 6. Views

Write the views table before any wireframe, and review it with the operator row by
row. Its columns are the fields of a view in the output, plus the jobs done there.

- **Question** is the one question the view answers. A view that needs two is two
  views.
- **Decision** is what the persona decides once it is answered.
- **Status** is `not reviewed`, `approved`, `changed`, `new` or `deferred`. Every row
  starts as `not reviewed`.

Rules for a row:

- **Every view has a job.** The exception is a view or a part the operator keeps for a
  stated reason, such as exercising a design-system component. The reason goes in the
  row.
- **Each fact goes on the view of the thing it describes.** The commit a run analyzed
  belongs on the run's view, not the app's.
- **One view of a list, reused.** When several views would list the same things, make
  one view with filters in the address, and show it pre-filtered elsewhere.
- **Detail is another path, not more on the page.**

Outcome gate: **the operator has ruled on every row; every job is done in a view,
outside the application, or deferred.**

### 7. Layouts

Each view takes one layout. Look the layouts up live, from the application's folder:

```bash
pragma graph query "SELECT ?l ?name WHERE { ?l a ds:Layout ; ds:name ?name }"
pragma block lookup --tier all <name>        # one layout in full, with its guidance
pragma ontology lookup ds --class Layout     # what a layout declares
```

The query lists every layout in every tier. If it answers `STORE_UNAVAILABLE`, run
`pragma sources update` in that folder first. A lookup that prints only a tier is not
an error: that layout is a name with no guidance yet.

> The covered set is whatever the graph answers today. Query it live — never copy its
> output into documentation, PRs, or this skill.

Choose in this order:

1. A layout whose guidance fits the view's question.
2. A layout that fits by name, said to be unproven.
3. A new layout, only when none fits. It is labelled new.

A layout may come from another product's tier. Label it "borrowed from `<tier>`" and
list it as a candidate to move to a shared tier.

A new layout gets a short proposal: its purpose in one sentence; the parts of the page
it has, and for each optional part the job that brings it in; its grid; the category of
content it organises (`ds:domain`, in the graph's own words: read the values existing
layouts carry before choosing one); and its tier. Its spec is then written with
`specify-component`, as a layout, and its anatomy with `anatomy-author`. Never write
into the design system's `data/`.

This skill stops at the layout. It draws no wireframes.

Outcome gate: **every view has a layout; the operator has seen every new layout's
proposal.**

Then read every outcome gate again against the finished lists, check that every view
sits in exactly one domain, and write the output. Only in an application made with
`pragma create application`: each domain becomes a domain folder, and each approved
view is later added with `pragma create page <domain>/<name>`.

## Running as an update

The domain model rests on the journeys. When they change, it changes with them.

**Start every update by finding what moved.** Compute the scores again and compare them
with the recorded ones. Then compare the lists: a job with no view that is neither
deferred nor done outside the application, a view whose job is gone or deferred, a
persona or a journey the scores do not cover. Tell the operator what you found before
changing anything.

| What changed in the journeys | What to do |
|---|---|
| A job was added | Find the view where it gets done (step 6). If no domain holds it, it is a need with no home (step 5). Score again. |
| A job was reworded | Check that its views still answer it, and that the words still match (steps 2 and 6). |
| A job was deferred or removed | Look at each of its views. A view left with no job is marked deferred, unless it has a stated reason to stay. |
| A journey's order changed, or a job joined or left a journey | Score again (step 4). Nothing else moves unless the result does. |
| A persona or a journey was added | Score again with it. Check that every one of its jobs gets done somewhere. |
| A persona or a journey was removed | Score again without it. Check each view that only its jobs used. |

**Patch, or reopen the design?** Most changes are a patch: the domains stand, and only
paths, views or layouts move (steps 5 to 7). Reopen the comparison of designs (steps 3
and 4) when:

- a job fits no existing domain,
- a journey gains a move that costs 4, or the overall score gets clearly worse,
- another design would now score better than the one in use,
- or the operator asks.

Never reopen the design silently. Say why, show the old and new scores, and ask.

Changes that start on this side follow the same care:

- A change to a view is traced back to its jobs first. Say which jobs it touches before
  changing the row.
- Nothing is removed silently. A view that is real but not for now is marked deferred.
- A changed or new row is marked, with the date of the round.
- A word that changes meaning is changed everywhere it is used, and `map-journeys`
  rewords any story that named it.
- A layout proposed as new is checked against the graph again. Once the graph has it,
  the row loses its "new" label.

## Response format

```markdown
Situation: <new | existing> application, <create | update>
Output: <form> at <place>

- [ ] 1. Journeys read: <n> personas, <n> jobs, <n> journeys
- [ ] 2. Words: <n> defined
- [ ] 3. Designs: <n> compared (set aside: … because …)
- [ ] 4. Chosen: <design>, score <x> per job (fallback: …; would change if: …)
- [ ] 5. Paths: <n>; every :name defined
- [ ] 6. Views: <n> approved, <n> not reviewed, <n> deferred
- [ ] 7. Layouts: <n> from the graph (<n> unproven, <n> borrowed), <n> new (proposals: …)

On an update, what moved: … (patched | design reopened, because …)
Jobs handed back to map-journeys: …
Judgment calls made without the operator: …
```

## Worked example: the adoption tracker

This continues the example of `map-journeys`. Its personas, jobs and journeys are the
data block of `journey-graph.example.html` in that skill's folder.

**Three designs.**

- **A: Apps only.** Components sit under each app.
- **B: Apps and Components.** Facts about the last run sit on the app's page.
- **C: Apps, Components and Runs.**

A is set aside before scoring. "See which components are in use" needs one list across
all apps, and A can only answer it one app at a time.

**The score.** The other journeys cost the same in B and C, so the steward's journey
decides:

| Job | B | C |
|---|---|---|
| Check the nightly run | free: the apps list shows each app's last run | free: the runs list |
| See where every app stands | 1: the view is kept | 4: Runs to Apps |
| See which components are in use | 4: Apps to Components | 4: Apps to Components |
| Trace a number to its evidence | 3: the domain is kept, one component | 3: the same |
| **Per job** | **2.0** | **2.75** |

**The choice.** B is cheaper, and the operator took C: the commit, the scope and the
errors of a run describe a run, not an app, and in B they had no home. The score still
paid off. C kept B's cheap move, and its apps list shows each app's last run.

**What else the tutorial should bring out:**

- **Step 5.** An earlier draft had `/apps/:app/slices/:slice`. Nobody could say what
  one slice was, so slices became a filter on folders.
- **Step 6.** One usages list serves three places: its own path under an app, and
  pre-filtered on a component's view and on a folder.
- **Step 7.** Two views found no layout in the graph and became proposals: a report
  (one measure over time) and an explorer (a structure to move through).
- **Wireframes came too early.** In the real project, detailed frames were drawn before
  any view was agreed, and had to be redone.

## Related skills

- `map-journeys` — what comes first; new jobs found here go back to it
- `specify-component` and `anatomy-author` — to specify a new layout proposed in step 7
- `specify-pattern` — for a recurring arrangement inside a view

## Support

If this skill leads somewhere broken — a command that errors, guidance that
contradicts what the live system answers, a gap the flow cannot cover — you are not
stuck:

- Raise an issue in the pragma-core repo: https://github.com/canonical/pragma-core/issues —
  include the skill name, what was run, and expected vs. actual outcome.
- Or contact the design-system team owners directly through your organization's
  professional messaging channels for assistance.
