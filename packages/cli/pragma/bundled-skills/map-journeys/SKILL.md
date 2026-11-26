---
name: map-journeys
description: Map who uses an application, what each of them needs, and in what order, as personas, jobs and journeys; also runs as a guided tutorial on a worked example
---

# Map Journeys

Write down who uses an application, what each of them needs, and in what order. The
result is three lists: personas, jobs and journeys. They are written before anything is
designed, and they are what a design is later judged against.

**A persona is real people with real interests, said in the organisation's own words
and recognised by the operator.** Jobs come from a persona's interests, and a journey
puts a persona's jobs in order. If the personas are wrong, everything after them is
misaligned.

In a fresh session, orient first:

```bash
pragma capabilities
```

The design-system graph holds no personas, jobs or journeys. This skill is interview
work.

## Working mode: assistant to a design authority

Most of the time this skill runs with an operator: a designer, an engineer or a product
lead who knows the application and the people around it. They are the authority. You
are the assistant whose job is to make them successful:

- Say which step comes next and why.
- Do the legwork yourself. Read the application, draft the candidates, write the lists.
- Bring each decision as a recommendation plus a question, never as a fait accompli.
  Who really uses the application, and what they care about, is in no file.

Full autonomy is the exception. Run the whole flow alone only when explicitly asked to.
Then every persona and every journey's order stays marked as a guess, and the final
report lists each judgment call.

Decision gates — pause at each and resolve it WITH the operator:

1. Create or update, whenever the signs leave any doubt.
2. The output form, and where it is saved.
3. The personas.
4. The jobs, and which are deferred.
5. The journeys.

## When to Use

- A new application is being planned and nobody has written down who it is for
- An existing application needs its personas, jobs and journeys made explicit
- Earlier personas, jobs or journeys need updating after design decisions

## When NOT to Use

- Choosing domains, paths, views or layouts — use `model-domains`, which starts from
  this skill's lists
- Specifying a component or a pattern — use `specify-component` or `specify-pattern`
- Confirming jobs with real users — that is separate research

## Opening move: ask, or offer the tutorial

Unless the first message already names the work, ask for the starting point as a
suggestion carrying an example, not as a form to fill in:

> To get started, tell me which application this is about and what it is for, in a
> sentence. Something like "a tracker that shows how far each of our apps has moved to
> the new design system".

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
- **Create or update.** Update when earlier output exists: a file in the repository, or
  a page the operator links. A published page lives outside the repository, so you only
  find one when it is linked.

**When in doubt about create or update, ask. Never guess, and never change earlier
output on a guess.** Doubt is a request that sounds like an update with no earlier
output found, a request that sounds like a fresh start with earlier output found, or
more than one earlier output. Ask in one plain line with two options:

> I found `journeys.json` in `docs/`. Do I update it, or start a new one?

| | Create | Update |
|---|---|---|
| **New application** | Interview from scratch. | Change only what the request touches. |
| **Existing application** | Read the application for candidates, then interview. | Also report where the application and the earlier output have drifted apart. |

## Every step is narrated: outcome, path, conclusion

Open every step by telling the operator what it is FOR and how you will get there.
Close it with what it established and what that means for the next step. One sentence
each is enough. The operator can only steer a step they saw coming.

Do:

> **Step 3 — personas.** The outcome is a short list of the people this application is
> for, each one in your own words. I read the application for candidates, then ask you
> about each one.
>
> …
>
> So: three personas, and the steward and the project manager are sometimes the same
> person. They care about different things in each role, which is what step 4 needs.

Don't:

> Step 3 — Personas
>
> Steward, project manager, app owner.

## Asked about the skill: methodology and outcomes first

Asked what this skill does, give the method and the outcome before the list of steps:

> It maps who an application is for. You confirm each persona, in your organisation's
> own words. Jobs come from what each persona cares about and never name a solution. A
> journey is one persona's jobs in order. You end holding three lists that any design
> can be judged against.

## The output

The operator picks one of three forms. The content is the same in all of them.

- **A page with its data (recommended).** Two files: `journeys.json` holds the lists,
  and `journeys.html` draws them as a graph and as tables. `model-domains` reads and
  extends the same JSON.
- **A decision record.** Context, alternatives, decision, in the convention of the
  repository that holds it. The graph is a Mermaid flowchart.
- **A markdown plan.** One table per list, and the graph as Mermaid.

**The lists are written once.** Every table and the graph are drawn from them. A link
that is stored twice drifts.

```json
{
  "name": "the application's name",
  "goal": "one sentence",
  "personas": [{ "id": "", "name": "", "description": "", "interests": [""],
                 "guess": true }],
  "jobs": [{ "id": "J1", "name": "", "personas": [""], "story": "",
             "outside": ["a command, a file or another tool"], "deferred": true }],
  "journeys": [{ "persona": "", "question": "", "jobs": ["J1"], "guess": true }]
}
```

`outside`, `deferred` and `guess` appear only where they apply. `guess` marks a persona
the operator has not confirmed, or a journey whose order they have not confirmed. The
page shows it as a tag.

**The graph** has personas on the left, journeys in the middle and jobs on the right.
A journey's jobs are numbered in order. Overlap is shown, not hidden: a job shared by
two journeys is one box with a numbered link from each, and dots on every job show all
the personas that hold it. Jobs a persona holds outside its journeys hang off a dashed
"off the journey" box. A deferred job is dashed.

`journey-graph.example.html` is a complete example on the worked example's data. It
sits in this skill's folder, which is the `sourcePath` that
`pragma skill lookup map-journeys --format json` reports. Start the page from it. Its
title, heading and everything else are drawn from the data.

The page reads `journeys.json` from its own folder, or the same JSON placed in its data
block. Use the block when the page must stand alone: published as a single page, or
opened from disk, where a browser will not read a second file. The JSON file stays the
source: copy it into the block whole, and never edit the block by hand.

Where the output is committed, that repository's rules and the `git` standards apply
(`pragma standard categories` lists the current set).

## The six steps

### 1. Output form

On an update, keep the form already in use. On a create, the operator picks the form
and names where it is saved. Do not assume a folder.

Outcome gate: **one form, and one named place.**

### 2. Goal

Ask what the application is for, in one sentence. For an existing application, read
its README and landing page, propose the sentence, and let the operator correct it. A
job that does not serve the goal is deferred, not designed.

Outcome gate: **one sentence the operator agrees with.**

### 3. Personas

This is the centre of the skill. Take the time it needs.

- **A persona is a hat, not a person.** It names a way of using the application. One
  person can wear several hats, and several roles can share one. Never split or merge
  personas to make roles tidy.
- **It is a sentence or two in the organisation's own words.** It says who usually
  wears the hat. It need not be a job title, but it points at real people: "design
  system steward" is not a position, and it maps to the managers who work on the design
  system. Record a loose answer as given ("usually the managers, sometimes an
  engineer"). Never push it into a formal definition.
- **Its interests are what the persona cares about while wearing the hat.** The same
  person cares about different things when reporting progress than when fixing their
  own application.
- **It is nothing else.** No skill levels, no permissions. A persona never becomes a
  domain, a menu or an access rule.

**New application.** Ask who will use it and what each of them cares about.

**Existing application.** Read first, and bring candidates with their evidence, each
marked as a guess:

- permission roles in the code,
- navigation and pages, for who each area seems to be for,
- the README and the documentation, for who the product says it is for.

The code cannot say who these people are or what they care about. A permission role
says what someone may do. People who never log in, such as someone who only reads a
report, are not in the code at all. So always go on to the interview.

**The interview.** One candidate at a time:

1. Who usually wears this hat here?
2. What do they care about when they do?
3. Does the name sound like how you would say it?
4. Who is missing?

Outcome gate: **the operator recognises each persona and would say it that way.** You
never confirm a persona yourself. In an unattended run every persona stays marked as a
guess.

### 4. Jobs

A job is one thing a persona needs, written as a four-part story:

> When [situation], I want [capability], so I can [outcome], without [what I do today].

It has an id (`J1`, `J2`, …) that is never reused or renumbered, a short name written
as an instruction, and one or more personas.

**Jobs are shared.** When two personas need the same thing, it is one job with two
personas. Never copy or split a job to give each persona its own. List a persona on a
job when the job serves one of its interests; a job everyone passes through, such as
signing in, lists those who care how it goes.

**Jobs stay put while the solution moves.** A story never names a page, a screen or a
feature. That is why the same jobs can judge several designs. For an existing
application, do not read jobs off its pages. Ask what each persona is trying to get
done.

Do:

> When I pick up adoption work, I want the usages in one folder with file and line, so
> I can fix them in one pull request, without searching the codebase.

Don't:

> When I open the findings tab, I want to filter the evidence list by slice.

**Every job serves an interest of its persona.** Say which one when you present the
job. "Spot stalled apps" serves the project manager's interest in seeing stalls early.
An interest with no job is a gap to raise.

Mark two things where they apply:

- **Deferred.** A need that is real but not for now is written in full and marked. It
  stays visible and gets no view.
- **Outside the application.** A job done anywhere else, with a command, a file or
  another tool, names that place as people call it, and gets no view.

Jobs are drafts until real users confirm them. Say so in the output.

Outcome gate: **every story names no solution and serves an interest; deferred jobs and
jobs done outside the application are marked.**

### 5. Journeys

A journey is one persona's jobs, in the order they do them, under one question: "What
do I fix next in my app?"

- The order is what people really do. Never rearrange it to flatter a design.
- One journey per persona is the default. A persona with two questions gets two.
- A job can be on several journeys, at its own place in each. Journeys overlap wherever
  the work does. Never keep them apart artificially.
- A journey names no views. `model-domains` adds those.

List every job that is on no journey and ask whether that is meant. Some jobs are
occasional. Others reveal a second question.

Outcome gate: **each persona has a question and its jobs in order, and the operator has
ruled on every job that is on no journey.**

### 6. Check and hand on

Read every outcome gate again against the finished lists. Each must still hold. A job
on a persona's journey is one of that persona's jobs: where the job does not list the
persona yet, add it. Then write the output.

`model-domains` takes it from there. It lays out several domain designs, walks every
journey through each one job by job, and scores what each move costs the persona. It
adds the views to the same output and may hand back a job it found missing.

Outcome gate: **the gates hold and the output is written.**

## Running as an update

An update runs the same steps on the earlier output and touches only what changed.

- Nothing is removed silently. A job that no longer applies now is marked deferred.
- A story is reworded only when it names a solution that was dropped.
- A changed or new row is marked, with the date of the round.
- Personas rarely change, because design decisions change what is shown, not who uses
  the application. Revisit them when a new group of people appears.
- A journey that stays costly in every design `model-domains` scores may hold two
  questions, or its persona may be two hats. Raise it. Force nothing.

Update after each round of design decisions, when a new domain appears, and when a view
is cut, merged or reshaped.

**Say what else may now be out of date.** Other work was built on these lists. Before
you finish an update, tell the operator briefly what changed and what it may touch.
Name the things; do not update them yourself.

> Two jobs changed and the app owner's journey has a new order. The domain model was
> built on the earlier lists: three views serve those jobs, and the scores no longer
> match. Run `model-domains` as an update next.

Look for the domain model first: the views in the same output. Then anything the
operator has mentioned that rests on the jobs, such as wireframes or built pages.

## Response format

```markdown
Situation: <new | existing> application, <create | update>
Output: <form> at <place>

- [ ] 1. Output form: …
- [ ] 2. Goal: "<one sentence>"
- [ ] 3. Personas: <n>, each recognised by the operator (or: marked as guesses)
- [ ] 4. Jobs: <n> drafts, <n> deferred, <n> done outside the application
- [ ] 5. Journeys: <n>; jobs on no journey: …
- [ ] 6. Gates re-read: hold (or: what failed)

On an update, what else may need updating: … (for instance the domain model)
Judgment calls made without the operator: …
```

## Worked example: the adoption tracker

An application that shows how far four apps have moved to a new design system. Its
goal, three personas, fifteen jobs and three journeys are the data block of
`journey-graph.example.html`. Read them there for the tutorial.

What the tutorial should bring out:

- **Step 3.** The steward and the project manager can be the same person. They stay two
  personas because their interests differ.
- **Step 4.** Two needs were real but not for now. They are written in full and
  deferred.
- **Step 5.** Two jobs sit on two journeys each, at a different place in each. Four of
  the steward's jobs are on no journey: two are deferred, one is occasional, and one
  may be a second question.
- **Scope with no job.** In the real project, work was planned that no job asked for.
  It was found only in a later audit. Run the gates early.

## Related skills

- `model-domains` — what comes next: domains, paths, views and layouts, judged against
  these journeys
- `specify-component` and `specify-pattern` — for a component or pattern gap that the
  later design work uncovers

## Support

If this skill leads somewhere broken — a command that errors, guidance that
contradicts what the live system answers, a gap the flow cannot cover — you are not
stuck:

- Raise an issue in the pragma-core repo: https://github.com/canonical/pragma-core/issues —
  include the skill name, what was run, and expected vs. actual outcome.
- Or contact the design-system team owners directly through your organization's
  professional messaging channels for assistance.
