**Technical Deep-Dive --- System & Organs**

HELIX

Anatomy of a Living Layer for Software

*One disease, not five problems. Every organ fights divergence; together
they form a closed homeostatic loop.*

  ------------------- ---------------------------------------------------
  **Document**        Technical Deep-Dive v1.0 (companion to the PRD)

  **Scope**           Full detail on every organ: purpose, mechanism,
                      data, stack, demo

  **Event**           graVITas'26, VIT Vellore --- Operation: Doomsday
                      track

  **Team / Chapter**  ISGF VIT Student Chapter

  **Primary sponsor** Sarvam AI

  **Core stack**      Sarvam AI · Google Gemini API · MongoDB · n8n

  **Date**            June 2026
  ------------------- ---------------------------------------------------

Contents

1\. The Unifying Thesis

Every problem developers face with AI-built software --- intent drift,
code drift, security rot, build failures, production crashes, entropy
--- looks like a different problem. It is not. They are all the same
phenomenon: divergence over time between what software is supposed to be
and what it is actually becoming.

  -------------------------------------------------------------------------
  **Symptom**           **Is really divergence from...**
  --------------------- ---------------------------------------------------
  **Intent drift**      purpose --- the code no longer does what was meant.

  **Code drift**        form --- patterns and structure decay from their
                        own conventions.

  **Vulnerabilities**   safe state --- the system slips out of a secure
                        configuration.

  **Production          correct behaviour --- runtime output departs from
  failures**            expected.

  **Entropy**           order --- the system trends toward disorder and the
                        rewrite cliff.
  -------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **Why an organism**                                                   |
|                                                                       |
| Nature already solved "keep a fast-growing system from diverging into |
| death." A living organism has a **genome** that stays                 |
| self-consistent, an **immune system** that fights and remembers       |
| infection, a **metabolism** that digests waste, a **nervous system**  |
| that senses and reacts, and **homeostasis** that holds equilibrium.   |
| Software just gained machine-speed growth with none of these. HELIX   |
| is the missing biology.                                               |
+-----------------------------------------------------------------------+

1.1 The double helix

The name is the architecture. DNA is a double helix: two strands,
base-paired, where each strand templates the other. HELIX models
software as two paired strands --- an intent strand and an
implementation strand --- that must stay matched. A mismatch is a
mutation; the organs are the repair, defence, and digestion machinery
around that spine.

2\. System Topology

HELIX is a continuous autonomic loop. The four sponsor technologies each
own a class of work that plays to their genuine strengths; the
separation of concerns is the engineering story, not a marketing
arrangement.

  --------------------------------------------------------------------------------
  **Layer**        **Biological    **Technology**   **Responsibility**
                   role**                           
  ---------------- --------------- ---------------- ------------------------------
  **Perception**   Senses (wide    Google Gemini    Whole-codebase reads: entropy
                   vision)                          field, intent--code pairing,
                                                    log/UI parsing.

  **Cognition**    Reasoning       Sarvam AI        Root-cause, patch synthesis,
                   brain + voice                    drift judgement; Bulbul TTS +
                                                    Saaras STT briefings;
                                                    sovereign on-prem option.

  **Biology /      Genome + immune MongoDB          Intent genome, vector antibody
  memory**         memory                           library, entropy time-series,
                                                    incident & proof records.

  **Autonomic      Involuntary     n8n              Reflex arcs and scheduled
  wiring**         nervous system                   loops; turns cognition into
                                                    action with no human.
  --------------------------------------------------------------------------------

2.1 Cross-cutting organs

-   **The Shadow** --- a real-traffic twin every organ uses to verify a
    change before promotion.

-   **The Governor (Homeostasis)** --- the budget loop that balances
    generation against repair across all organs.

-   **Vital Signs** --- the single pane every organ reports into.

3\. The Genome --- Paired-Strand Integrity

***Intent drift + code drift, unified***

The problem it owns

Spec-driven tools fail at the one step that matters: produced code does
not faithfully map to spec intent, and the spec is read once then
drifts. Meanwhile every fix-loop iteration risks silently changing
behaviour the intent never sanctioned. The Genome makes intent a
continuously-enforced, living strand rather than a document.

How it works

1.  **Capture the intent strand:** each module gets a structured intent
    record --- goal, invariants, edge-case decisions, constraints ---
    derived from PR descriptions, linked issues, and the prompts/specs
    that generated it.

2.  **Base-pair continuously:** Gemini reads code + intent together
    across files and computes a pairing score per module --- does the
    implementation still satisfy every stated invariant?

3.  **Flag mutations in both directions:** code drifted from intent (a
    fix dropped the refund-approval step) OR intent changed and left
    code unpaired.

4.  **Reason about the mismatch:** Sarvam explains the specific
    divergence and proposes the minimal correction, which is routed to
    the Shadow for verification.

5.  **Compile invariants to checks:** every invariant becomes a
    generated assertion/test so pairing is enforced mechanically, not
    just observed.

Data model (MongoDB)

The intent genome is a document store --- ideal for evolving,
semi-structured specs linked to code locations.

+-----------------------------------------------------------------------+
| **intent_strand (collection)**                                        |
|                                                                       |
| { moduleId, purpose, invariants:\[ {id, rule, rationale, compliance?} |
| \],                                                                   |
|                                                                       |
| edgeDecisions:\[\...\], sourcePrompt, generatedBy:{model,version},    |
|                                                                       |
| pairing:{ score, lastChecked, unpairedInvariants:\[id\] } }           |
+-----------------------------------------------------------------------+

Stack mapping

  ------------------------------------------------------------------------
  **Tool**      **Role in this organ**
  ------------- ----------------------------------------------------------
  **Gemini**    Whole-codebase base-pairing: reads many files + intent at
                once to compute pairing scores.

  **Sarvam**    Mismatch reasoning and minimal-correction proposal;
                sovereign mode for regulated code.

  **MongoDB**   Stores the living intent strand and pairing history per
                module.

  **n8n**       Re-runs pairing on every merge/deploy and on intent edits.
  ------------------------------------------------------------------------

Why it lands (the wow)

+-----------------------------------------------------------------------+
| **DEMO MOMENT**                                                       |
|                                                                       |
| *A silent fix that "improves the error message" and quietly drops a   |
| compliance-mandated approval step lights up instantly as a Genome     |
| mismatch --- invariant #7 unpaired --- instead of surfacing three     |
| weeks later as an audit failure.*                                     |
+-----------------------------------------------------------------------+

4\. The Immune System --- Adversarial Self-Healing Security

***Attach the live site → attack → patch → re-attack → confirm***

The problem it owns

AI chooses the insecure option \~45% of the time; of agent solutions
passing functional tests, only \~10.5% are secure; the fix-loop
increases critical vulnerabilities \~37% over five rounds. Canonical
disasters (exposed keys in client-side code with no row-level security)
keep recurring. Scanners flag and stop --- they do not heal or verify.

How it works

6.  **Attach by URL:** the user points HELIX at a live deployment; no
    deep instrumentation required to begin.

7.  **Continuous red-team:** an attack organism probes the documented
    vibe-coding classes --- SQL injection, XSS, auth bypass, exposed
    secrets, missing row-level security --- on a schedule driven by n8n.

8.  **Guard the agent too:** scans READMEs, issues, and config the
    coding agent is about to ingest for indirect prompt injection before
    it reads them.

9.  **Generate the patch:** on a confirmed finding, Sarvam writes a
    candidate fix targeting the exact vulnerability class.

10. **Heal in the Shadow, then re-attack:** the patch is applied in the
    Shadow and the same attack is replayed; only a fix that demonstrably
    closes the hole is promoted.

11. **Mint an antibody:** the confirmed vulnerability becomes a
    permanent regression test + assertion (see Immune Memory).

Data model (MongoDB)

Findings and their lifecycle are stored so every step --- detection,
patch, re-attack proof --- is auditable.

+-----------------------------------------------------------------------+
| **vulnerability (collection)**                                        |
|                                                                       |
| {                                                                     |
| cla                                                                   |
| ss:\'SQLi\'\|\'XSS\'\|\'authBypass\'\|\'secretLeak\'\|\'missingRLS\', |
|                                                                       |
| endpoint, evidence, patchRef, reAttack:{ before:\'open\',             |
| after:\'closed\' },                                                   |
|                                                                       |
| antibodyId, status:\'healed\', healedAt }                             |
+-----------------------------------------------------------------------+

Stack mapping

  ------------------------------------------------------------------------
  **Tool**      **Role in this organ**
  ------------- ----------------------------------------------------------
  **Sarvam**    Patch synthesis for the specific vulnerability class;
                sovereign on-prem for code that can't leave.

  **n8n**       Schedules continuous attack runs and the re-attack
                confirmation step.

  **MongoDB**   Stores findings, patches, and before/after proofs.

  **Gemini**    Parses responses / DOM / errors to recognise subtle
                vulnerability signatures.
  ------------------------------------------------------------------------

Why it lands (the wow)

+-----------------------------------------------------------------------+
| **DEMO MOMENT**                                                       |
|                                                                       |
| *On stage, point HELIX at a live URL; it finds a real SQL injection,  |
| writes the patch, applies it in the Shadow, re-attacks, confirms the  |
| hole is closed, and mints the antibody --- a vulnerability is caught  |
| red-handed and healed in under a minute.*                             |
+-----------------------------------------------------------------------+

5\. Immune Memory --- Antibodies

***The system can't catch the same disease twice***

The problem it owns

Roughly a quarter of AI-introduced issues still survive in codebases
months later, and the fix-loop churns the same classes of bug back in.
Fixing without remembering is how codebases decay. Acquired immunity is
the inversion: every fix makes the system permanently more resistant.

How it works

12. **Mint on every cure:** each confirmed vulnerability and each
    resolved incident becomes an antibody --- a regression test plus a
    runtime assertion --- injected into the genome.

13. **Embed for recall:** the antibody is vector-embedded so future
    anomalies can be matched semantically: "have we seen this disease
    before?"

14. **Match new threats:** when a new finding or incident appears, HELIX
    searches the antibody library; a near-match short-circuits straight
    to the known cure.

15. **Accumulate immunity:** the antibody count only ever rises --- a
    curve a decaying codebase can never draw.

Data model (MongoDB)

MongoDB Atlas Vector Search makes the antibody library both a permanent
ledger and a semantic recall index.

+-----------------------------------------------------------------------+
| **antibody (collection, vector-indexed)**                             |
|                                                                       |
| { antibodyId, sourceType:\'vuln\'\|\'incident\', signature,           |
| embedding:\[\...\],                                                   |
|                                                                       |
| regressionTest, runtimeAssertion, mintedAt, recurrencesBlocked }      |
+-----------------------------------------------------------------------+

Stack mapping

  ------------------------------------------------------------------------
  **Tool**      **Role in this organ**
  ------------- ----------------------------------------------------------
  **MongoDB**   Vector-searchable antibody library --- the heart of
                acquired immunity.

  **Sarvam**    Synthesises the regression test + assertion from the cured
                failure.

  **n8n**       Runs antibody checks in CI and on each deploy; blocks
                recurrences.
  ------------------------------------------------------------------------

Why it lands (the wow)

+-----------------------------------------------------------------------+
| **DEMO MOMENT**                                                       |
|                                                                       |
| *Re-run the exact attack that was just healed --- the matching        |
| antibody blocks it before it can reach the app. The organism visibly  |
| cannot catch the same disease twice.*                                 |
+-----------------------------------------------------------------------+

6\. The Metabolism --- Entropy Digestion

***Maintenance at machine speed***

The problem it owns

50--70% of generated code is debt on arrival; \~70% of vibe-coded MVPs
need a full rewrite to scale, driven by business logic fused into
infrastructure and 4× duplication. Refactoring has always run at human
speed while generation runs at machine speed --- so disorder wins.

How it works

16. **Measure temperature:** Gemini computes a multi-dimensional entropy
    field --- duplication density, pattern variance, logic/infra
    coupling, vulnerability density, comprehension decay --- reduced to
    one scalar with a trajectory.

17. **Project the cliff:** from the trajectory, estimate 'weeks to
    rewrite threshold' at current generation rate.

18. **Run repair enzymes:** background agents target each decay vector
    --- a consolidator collapses duplicates, a normaliser aligns drifted
    patterns, an annealer incrementally untangles logic from
    infrastructure.

19. **Ship as verified PRs:** every enzyme action is a small
    Shadow-verified change with proof behaviour did not move.

Data model (MongoDB)

Temperature history is naturally a time-series; MongoDB time-series
collections store and trend it.

+-----------------------------------------------------------------------+
| **entropy_timeseries (time-series collection)**                       |
|                                                                       |
| { ts, temperature, dims:{ duplication, patternVariance, coupling,     |
|                                                                       |
| vulnDensity, comprehension }, projectedRewriteWeeks }                 |
+-----------------------------------------------------------------------+

Stack mapping

  ------------------------------------------------------------------------
  **Tool**      **Role in this organ**
  ------------- ----------------------------------------------------------
  **Gemini**    Whole-repo entropy field computation (wide context).

  **Sarvam**    Refactor reasoning for each enzyme; behaviour-preserving
                rewrites.

  **n8n**       Schedules nightly digestion and prioritises the hottest
                zones.

  **MongoDB**   Time-series temperature history and enzyme action log.
  ------------------------------------------------------------------------

Why it lands (the wow)

+-----------------------------------------------------------------------+
| **DEMO MOMENT**                                                       |
|                                                                       |
| *Under a live vibe-coding burst the temperature gauge climbs and the  |
| rewrite countdown ticks down; switch the metabolism on and the curve  |
| bends back down --- the second law of software thermodynamics, defied |
| on screen.*                                                           |
+-----------------------------------------------------------------------+

7\. The Nervous System & Resurrection Reflex

***The 3am deploy crash that fixes itself***

The problem it owns

\~69% of heavy-AI teams hit regular deploy problems and incident
recovery is getting slower, not faster --- machine-speed deploys have
outrun human on-call capacity. When prod breaks at midnight the real
question is not "what might be wrong?" but "what actually happened?" ---
and that evidence evaporates the moment the request finishes. Pasting an
error into a chatbot can only guess; the cure needs captured runtime
truth.

How it works

20. **Detection:** the nervous system learns each signal's baseline and
    feels behavioural divergence --- not a static threshold --- within
    seconds of a bad deploy.

21. **Containment:** correlate the spike to the preceding deploy and
    auto-roll-back to the last genetically-healthy build; users restored
    first.

22. **Diagnosis:** Gemini parses logs; Sarvam reconstructs the causal
    chain --- guilty deploy → triggering request → null from dependency
    → failing line --- from captured evidence.

23. **Cure:** apply the fix in the Shadow, replay the exact failing
    request, confirm the crash is gone and nothing else moved, then
    promote.

24. **Immunise:** mint an antibody so this failure can never reach
    production again.

25. **Report:** emit a one-line morning report; optionally Sarvam Bulbul
    delivers it as a spoken briefing and Saaras answers spoken
    follow-ups.

Data model (MongoDB)

Each incident is preserved as a full causal record --- the evidence, the
chain, the proof, and the antibody minted.

+-----------------------------------------------------------------------+
| **incident (collection)**                                             |
|                                                                       |
| { incidentId, deployId, detectedAt, baselineDelta, rollbackAt,        |
|                                                                       |
| causalChain:\[\...\], failingRequest, shadowProof, fixRef,            |
|                                                                       |
| antibodyId, userImpactSeconds }                                       |
+-----------------------------------------------------------------------+

Stack mapping

  ------------------------------------------------------------------------
  **Tool**      **Role in this organ**
  ------------- ----------------------------------------------------------
  **n8n**       Orchestrates the full reflex arc as a workflow you can
                watch fire.

  **Gemini**    Parses build/runtime logs and broken-UI captures.

  **Sarvam**    Root-cause reasoning, fix synthesis, and the Bulbul/Saaras
                voice briefing.

  **MongoDB**   Stores the causal record, the proof, and the minted
                antibody.
  ------------------------------------------------------------------------

Why it lands (the wow)

+-----------------------------------------------------------------------+
| **DEMO MOMENT**                                                       |
|                                                                       |
| *Deploy a real app on stage, push a 'fix' that breaks it, then take   |
| your hands off the keyboard: HELIX detects, rolls back, diagnoses     |
| with the real failing request on screen, heals in the Shadow,         |
| promotes, mints the antibody, and voice-briefs you --- "resolved: 71  |
| seconds."*                                                            |
+-----------------------------------------------------------------------+

8\. The Shadow --- The Safety Organ

***A trusted surgeon who rehearses on a perfect replica***

The problem it owns

No team will let an AI auto-edit production unless the change is proven
safe first. Autonomy without proof is reckless; proof is what converts
"scary AI" into a trustable surgeon. The Shadow is the precondition for
every other organ's autonomy.

How it works

26. **Mirror real behaviour:** a shadow twin is fed mirrored real
    traffic (v1: a sampled set plus the exact failing request).

27. **Apply in isolation:** every candidate change --- security patch,
    drift fix, enzyme refactor, incident cure --- is applied only in the
    Shadow first.

28. **Verify behaviour-equivalence:** Sarvam judges whether observable
    behaviour changed beyond the intended fix; the failing case must now
    pass and nothing else may regress.

29. **Promote only on proof:** only a change with a stored equivalence
    proof is promoted to production.

Data model (MongoDB)

Proofs are first-class records linked to whatever change they authorise.

+-----------------------------------------------------------------------+
| **shadow_proof (collection)**                                         |
|                                                                       |
| { proofId, changeRef, replayedCases:n, intendedFixPassed:true,        |
|                                                                       |
| regressions:0, verdict:\'promote\'\|\'reject\', verifiedAt }          |
+-----------------------------------------------------------------------+

Stack mapping

  ------------------------------------------------------------------------
  **Tool**      **Role in this organ**
  ------------- ----------------------------------------------------------
  **Shadow      Isolated twin replaying mirrored traffic + the exact
  runtime**     failing request.

  **Sarvam**    Behaviour-diff judgement --- did anything beyond the fix
                change?

  **MongoDB**   Stores promotion proofs linked to each autonomous change.

  **n8n**       Spins the Shadow per reflex and gates promotion on the
                verdict.
  ------------------------------------------------------------------------

Why it lands (the wow)

+-----------------------------------------------------------------------+
| **DEMO MOMENT**                                                       |
|                                                                       |
| *Every dangerous-sounding capability --- 'the AI fixed my production  |
| code' --- is defused by one line: it was proven on a real-traffic     |
| twin first, with the proof on file.*                                  |
+-----------------------------------------------------------------------+

9\. Homeostasis --- The Governor

***How fast can we safely let the AI build?***

The problem it owns

When disorder is created faster than it can be metabolised, immunised,
and re-paired, the codebase slides into incident acceleration and then
velocity collapse. No tool answers the question every engineering leader
silently asks: what is our safe build rate?

How it works

30. **Track two rates:** generation rate (incoming change) versus repair
    rate (drift fixed, vulnerabilities healed, entropy digested).

31. **Enforce an entropy budget:** when generation outpaces repair,
    intervene --- gate merges, reprioritise organ effort onto the
    hottest zones, or recommend throttling.

32. **Report one number:** "you are building 3× faster than this system
    can stay alive" --- the homeostasis signal that unifies the organs
    into one organism.

Data model (MongoDB)

The budget loop reads from the other organs' collections and writes a
rolling balance.

+-----------------------------------------------------------------------+
| **homeostasis (collection)**                                          |
|                                                                       |
| { window, generationRate, repairRate, balance,                        |
|                                                                       |
| action:\'ok\'\|\'reprioritise\'\|\'gate\', hottestZones:\[\...\] }    |
+-----------------------------------------------------------------------+

Stack mapping

  ------------------------------------------------------------------------
  **Tool**      **Role in this organ**
  ------------- ----------------------------------------------------------
  **n8n**       The recurring budget loop and intervention triggers.

  **MongoDB**   Rate history and balance over time.

  **Vital       Surfaces the safe-build-rate verdict to the team.
  Signs**       
  ------------------------------------------------------------------------

Why it lands (the wow)

+-----------------------------------------------------------------------+
| **DEMO MOMENT**                                                       |
|                                                                       |
| *A single honest number on the dashboard --- the first tool that can  |
| tell a CTO exactly how hard they can lean on the AI before the        |
| codebase stops being able to keep itself alive.*                      |
+-----------------------------------------------------------------------+

10\. Vital Signs --- The Single Pane

***Software health as a living thing you can watch***

The problem it owns

Every organ produces signals; without a single, legible view the
organism is invisible. Vital Signs is where health and trajectory become
one screen a founder or a CTO can read in five seconds.

How it works

33. **Temperature:** entropy scalar + trajectory toward the rewrite
    cliff.

34. **Genetic integrity:** intent--code pairing percentage across
    modules.

35. **Immune status:** open vulnerabilities and the ever-rising antibody
    count.

36. **Heart rate:** deploy and incident velocity.

37. **Lifeline:** a projected health curve --- thriving green, or red
    with 'rewrite threshold in 9 weeks'.

Stack mapping

  ------------------------------------------------------------------------
  **Tool**      **Role in this organ**
  ------------- ----------------------------------------------------------
  **Web         Reads aggregated state directly from MongoDB.
  dashboard**   

  **Sarvam**    Optional spoken 'state of the organism' briefing via
                Bulbul; questions via Saaras.

  **MongoDB**   Single source for all displayed vitals and history.
  ------------------------------------------------------------------------

Why it lands (the wow)

+-----------------------------------------------------------------------+
| **DEMO MOMENT**                                                       |
|                                                                       |
| *One screen shows a living organism --- green and thriving, or red    |
| and counting down to a rewrite --- and it can speak its own status    |
| aloud, in the user's language.*                                       |
+-----------------------------------------------------------------------+

11\. End-to-End Walkthrough --- A Day in the Life

How the organs act together across one realistic day, showing the closed
loop.

38. **09:00 ---** A developer vibe-codes three features. Gemini
    re-computes the entropy field; temperature ticks up; the Genome
    re-pairs the new code against intent.

39. **11:30 ---** The Immune System's scheduled attack finds a missing
    row-level-security check on a new endpoint. Sarvam patches it; the
    Shadow confirms via re-attack; an antibody is minted.

40. **14:00 ---** A fix-loop iteration silently drops a refund-approval
    step. The Genome flags invariant #7 unpaired and proposes the
    minimal correction.

41. **18:00 ---** Nightly metabolism digests 4× duplication in a hot
    module into one implementation, shipped as a Shadow-verified PR;
    temperature bends down.

42. **00:47 ---** A late deploy crashes checkout for 3% of users. The
    Resurrection Reflex rolls back in seconds, diagnoses from captured
    evidence, heals in the Shadow, promotes, and mints an antibody ---
    user-facing impact 71 seconds.

43. **07:00 ---** The engineer wakes to a spoken morning briefing from
    Sarvam Bulbul. The Governor notes repair kept pace with generation:
    safe build rate, green.

+-----------------------------------------------------------------------+
| **The loop**                                                          |
|                                                                       |
| **Genome** captures why → **Immune System** defends and remembers →   |
| **Metabolism** digests disorder → **Nervous System** heals failures → |
| **Shadow** proves every change → **Governor** holds equilibrium. The  |
| organism stays alive.                                                 |
+-----------------------------------------------------------------------+

12\. Build Priority --- What Ships First

The wedge is the Immune System + Immune Memory: attach a live URL,
attack it for the documented vibe-coding classes, auto-patch in the
Shadow, re-attack to confirm, and mint a permanent antibody. It is a
complete, jaw-dropping standalone product on the v1 stack (Next.js /
Supabase-class) and the natural open-source beachhead. Every other organ
is the SaaS expansion ladder.

  ------------------------------------------------------------------------
  **Organ**                **v1 (36h)**             **Demo weight**
  ------------------------ ------------------------ ----------------------
  **Immune System +        Build fully              Primary --- live SQLi
  Memory**                                          self-heal

  **Resurrection Reflex**  Build core path          Primary --- midnight
                                                    crash auto-heal +
                                                    voice

  **Genome (drift)**       Build detection          Secondary --- silent
                                                    rule-drop flagged

  **Metabolism**           Temperature gauge        Secondary --- entropy
                                                    curve bends

  **Shadow / Governor /    Minimal / vision         Framing --- the living
  Vital Signs**                                     dashboard
  ------------------------------------------------------------------------

**HELIX** *--- AI made software grow at machine speed. We made it stay
alive at machine speed.*
