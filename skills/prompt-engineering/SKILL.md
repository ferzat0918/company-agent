---
name: prompt-engineering
description: "Master prompt engineering for AI agents and LLM applications. Use when: designing system prompts, writing tool descriptions, debugging agent decisions. CRITICAL: Use when calling a subagent to issue instructions, or when calling the draw_image tool (you must read this skill in its entirety to learn how to communicate with the LLM)."
department: common
---

# Prompt Engineering for AI Agents

**Role**: Prompt Engineering Expert & Agent Optimizer

You understand that prompts are the #1 lever for agent quality — better than more compute, bigger models, or more tools. You approach prompts empirically: write, measure, iterate. You know that vague prompts produce inconsistent results and that showing is always better than telling. You have deep expertise in Claude-specific prompt patterns and understand how agent system prompts differ fundamentally from single-turn prompts.

## When to Use This Skill

- 在调用 subagent 并给 subagent 下达指令的时候（必须完整阅读此 Skill 以学习如何与 LLM 沟通）
- 在调用 `draw_image` 工具的时候（必须完整阅读此 Skill 以学习如何编写高水准提示词并与 LLM 沟通）
- Writing or optimizing agent system prompts
- Designing tool descriptions for LLM agents
- Debugging wrong/inconsistent agent decisions
- Implementing Chain-of-Thought or ReAct reasoning
- Building few-shot example libraries from real interactions
- Preventing hallucinations and improving factual accuracy
- Setting up LLM-as-a-Judge evaluation pipelines
- A/B testing prompt variants with statistical rigor
- Integrating Constitutional AI self-correction loops
- Optimizing prompts for specific Claude model versions

---

## Core Principle: The Prompt Hierarchy

Every effective agent prompt follows this structure. Order matters — later sections override earlier ones.

```
[1] Role & Identity         ← Who the agent IS (expertise, personality, constraints)
[2] Task & Objective        ← What the agent DOES (mission, scope, success criteria)  
[3] Context & Knowledge     ← What the agent KNOWS (domain info, facts, rules)
[4] Tools & Capabilities    ← What the agent CAN DO (tools + when to use each)
[5] Few-Shot Examples       ← What GOOD looks like (input → reasoning → output)
[6] Output Format           ← How to RESPOND (structure, length, style)
[7] Constitutional Rules    ← What the agent must NEVER do (safety guardrails)
```

---

## Part 1: System Prompt Design for Agents

### Role Definition Template

The role definition sets the agent's identity. Be specific — vague roles produce inconsistent behavior.

```markdown
You are [SPECIFIC ROLE] with [YEARS/LEVEL] of expertise in [DOMAIN].

Your core mission: [ONE SENTENCE — what you accomplish for users]

Your expertise includes:
- [Specific knowledge area 1]
- [Specific knowledge area 2]
- [Specific knowledge area 3]

Your interaction style:
- [Tone: direct/warm/formal/casual]
- [When uncertain: ask vs. proceed]
- [When wrong: acknowledge and correct]

What you do NOT do:
- [Explicit constraint 1 — prevents scope creep]
- [Explicit constraint 2]
```

**Example — Good vs. Bad:**

```markdown
# ❌ Bad (vague, no constraints, no style)
You are a helpful assistant that answers questions about software.

# ✅ Good (specific, constrained, clear success criteria)
You are a senior backend engineer specializing in Python and distributed systems,
with 10+ years of production experience.

Your mission: Help engineers write correct, scalable, maintainable backend code.

You excel at: API design, async patterns, database optimization, debugging, code review.

Your style:
- Direct and concise — no preamble like "Great question!" or "Certainly!"
- Show the fix first, explain after
- Flag security and performance risks immediately
- Admit uncertainty rather than guess

You do NOT: write frontend code, speculate about business strategy, or debug
issues outside the provided code context.
```

### Claude-Specific Techniques

Claude responds differently from GPT models. These patterns are Claude-specific:

```markdown
# 1. XML Tag Structure — Claude is trained on XML-heavy data; use tags for clarity
<role>Senior Data Analyst</role>
<task>Analyze the provided CSV and identify anomalies</task>
<context>This data is from our production database, updated daily</context>
<output_format>JSON with anomalies array, each containing: row, column, value, expected_range</output_format>

# 2. Thinking Tags — Encourage Claude to reason before answering
Before answering, think through this in <thinking> tags:
- What information do I have?
- What is the user actually asking?
- What could go wrong with my answer?
Then provide your response.

# 3. Prefilling — Start Claude's response to constrain format
User: Classify this email as SPAM or NOT_SPAM.
Assistant: <classification>  ← Claude continues from here, forced into XML

# 4. Signed Reasoning — Ask Claude to show commitments
Provide your answer, then add:
<confidence>high/medium/low</confidence>
<reasoning>Why I'm this confident: ...</reasoning>
<caveats>What could make me wrong: ...</caveats>
```

---

## Part 2: Tool Description Engineering

**Tool descriptions ARE prompt engineering.** They are the primary mechanism controlling when and how agents call tools. Most agent failures trace back to bad tool descriptions.

### The 4-Question Rule

Every tool description must answer:
1. **What** does it do? (specific, not vague)
2. **When** should it be used? (triggers + non-triggers)
3. **What** does it accept? (parameter constraints + examples)
4. **What** does it return? (output format + error cases)

```python
# ❌ Bad — answers none of the 4 questions
@tool
def search(query: str) -> str:
    """Search the database."""
    ...

# ✅ Good — answers all 4 questions
@tool
def search_internal_knowledge_base(
    query: str,
    category: str = "all",
    max_results: int = 5
) -> str:
    """
    Search the company's internal knowledge base for policies, procedures,
    and product documentation.

    USE THIS WHEN:
    - User asks about internal company processes or policies
    - User needs product documentation or technical specs
    - User asks "how do we handle X" or "what is our policy on Y"

    DO NOT USE THIS FOR:
    - General internet searches (use web_search instead)
    - Real-time data like prices or stock levels (use inventory_api instead)

    Args:
        query: Natural language search query. Be specific.
               Example: "refund policy enterprise customers 2026"
               Example: "onboarding process new engineers"
        category: Filter by category. Options: "policy", "product", "engineering", "all"
        max_results: Number of results to return (1-10). Default 5.

    Returns:
        JSON string with list of matching documents, each containing:
        - title: document title
        - excerpt: relevant passage (max 500 chars)
        - url: full document URL
        - last_updated: ISO date string

    Errors:
        "NO_RESULTS": No documents match the query — try broader terms
        "RATE_LIMITED": Too many requests — wait 10 seconds
    """
    ...
```

### Tool Naming Conventions

| Pattern | Example | Why |
|---|---|---|
| `verb_noun` | `search_database` | Action-oriented, clear intent |
| `namespace_action` | `github_create_issue` | Prevents collision in multi-MCP setup |
| `domain_specific` | `get_customer_by_id` | Specific beats generic |
| ❌ Avoid | `search`, `get`, `process` | Too vague, agent won't know when to use |

---

## Part 3: Chain-of-Thought & Reasoning Patterns

### Zero-Shot Chain-of-Thought

```markdown
Analyze this bug report. Think step by step:

1. What is the expected behavior?
2. What is the actual behavior?
3. What recent changes could cause this?
4. What components are involved?
5. What is the most likely root cause?

Bug report: {report}
```

### ReAct Pattern (Reason-Act-Observe)

Best for multi-step agent tasks:

```markdown
You solve tasks using this loop:
Thought: [Reason about what to do next]
Action: [Tool name and parameters]
Observation: [What the tool returned]
... repeat until task complete ...
Final Answer: [Your conclusion]

Rules:
- Always show your Thought before taking an Action
- If a tool returns an error, Thought about whether to retry or take a different approach
- Stop after maximum {max_steps} steps and explain what you were unable to complete
```

### Self-Verification Checkpoint

```markdown
After generating your response, verify before sending:

<verification>
1. Does my response actually answer what was asked? [Yes/No + reason]
2. Have I made any claims I'm not certain about? [List them or "None"]
3. Is the format correct for what was requested? [Yes/No]
4. Are there any risks or caveats I should mention? [List or "None"]
</verification>

If any check fails, revise your response before outputting it.
```

---

## Part 4: Few-Shot Example Design

### Anatomy of a High-Quality Example

Don't just show input → output. Show the **reasoning** and explain **why it works**.

```markdown
## Example 1: [Descriptive title of what this shows]

**Input**: [Realistic user message, not a toy example]

**Reasoning** (internal, not shown to user):
- Step 1: Identified the user needs X, not Y
- Step 2: Chose tool A over tool B because...
- Step 3: Formatted as Z because the user is a developer

**Output**: [Full, realistic agent response]

**Why this works**: The response directly addresses the user's actual need
(X), proactively mentions caveat Y, and uses code formatting because the
user is technical.

---

## Negative Example: What NOT to do

**Input**: [Same or similar input]

**Bad Output**: [Failed response]

**Why this fails**:
1. [Specific issue 1]
2. [Specific issue 2]

**Correct approach**: [One-line fix]
```

### Example Selection Strategy

| Priority | What to include |
|---|---|
| 1️⃣ | Most common use cases (cover 60% of real traffic) |
| 2️⃣ | Previously failed cases (regression prevention) |
| 3️⃣ | Edge cases where the agent made wrong tool choices |
| 4️⃣ | Boundary cases (what you do vs. don't handle) |
| ❌ Avoid | Toy/obvious examples that won't improve decisions |
| ❌ Avoid | More than 5-6 examples (diminishing returns, eats context) |

---

## Part 5: Anti-Hallucination Techniques

### Epistemic Hedging System Prompt

```markdown
Confidence and accuracy rules:
1. If you are highly confident (>90%): State the fact directly
2. If moderately confident (60-90%): Prefix with "I believe..." and add a caveat
3. If uncertain (<60%): Say "I'm not confident about this, but..." or ask the user
4. If you don't know: Say "I don't have reliable information on this" — never guess
5. For time-sensitive facts (prices, availability, news): Always caveat with
   "This may be outdated — please verify at [source]"
```

### Grounded Response Template (for RAG agents)

```markdown
Answer the question using ONLY information from the provided context.

Rules:
1. If the answer is in the context, cite it: "According to [source]..."
2. If the answer is not in the context, say: "The provided documents don't
   contain information about X. You may want to check [suggested source]."
3. Never combine context information with your training knowledge without
   clearly separating them

Context:
{retrieved_documents}

Question: {user_question}
```

---

## Part 6: Constitutional AI Self-Correction

Add a critique-and-revise loop that makes the agent check its own outputs.

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

llm = ChatAnthropic(model="claude-sonnet-4-6")

CONSTITUTIONAL_PRINCIPLES = """
Review your response against these principles:
1. ACCURACY: Are all factual claims verifiable? Flag uncertain ones.
2. COMPLETENESS: Does it fully answer what was asked? Not more, not less.
3. FORMAT: Does it match the requested output format?
4. SAFETY: Does it avoid harmful, biased, or inappropriate content?
5. CONSISTENCY: Is it consistent with earlier responses in this conversation?
"""

async def constitutional_response(user_message: str, history: list) -> str:
    """Generate response, then self-critique and revise."""

    # Step 1: Generate initial response
    initial = await llm.ainvoke(history + [HumanMessage(content=user_message)])

    # Step 2: Self-critique
    critique_prompt = f"""You wrote this response:
<response>{initial.content}</response>

{CONSTITUTIONAL_PRINCIPLES}

For each principle, write:
- PASS: if the response satisfies it
- FAIL [reason]: if it doesn't

Then write REVISED_RESPONSE: with your improved version, or ORIGINAL_RESPONSE_IS_FINE
if all principles pass."""

    critique = await llm.ainvoke([HumanMessage(content=critique_prompt)])

    # Step 3: Extract revised response
    if "REVISED_RESPONSE:" in critique.content:
        return critique.content.split("REVISED_RESPONSE:")[-1].strip()
    return initial.content
```

**When to use Constitutional AI**: For high-stakes domains (medical, legal, financial advice), customer-facing agents where hallucinations damage trust, or compliance-sensitive applications.

---

## Part 7: LLM-as-a-Judge Evaluation

Use Claude to objectively evaluate your agent's outputs at scale.

### Direct Scoring (for objective criteria)

```python
DIRECT_SCORING_PROMPT = """You are an expert evaluator assessing AI agent response quality.

## Original User Request
{prompt}

## Agent Response to Evaluate
{response}

## Evaluation Criteria

For each criterion, find specific evidence, assign a score (1-5), and suggest one improvement.

**Criteria:**
1. ACCURACY (weight: 0.4): Are all factual claims correct and verifiable?
2. RELEVANCE (weight: 0.3): Does it directly answer what was asked?
3. COMPLETENESS (weight: 0.2): Is necessary information present without excess?
4. FORMAT (weight: 0.1): Does the format match what was requested?

## Chain-of-Thought Requirement
Think through each criterion with evidence BEFORE assigning scores.

## Output Format (JSON)
{
  "scores": {
    "accuracy": {"score": 1-5, "evidence": "...", "improvement": "..."},
    "relevance": {"score": 1-5, "evidence": "...", "improvement": "..."},
    "completeness": {"score": 1-5, "evidence": "...", "improvement": "..."},
    "format": {"score": 1-5, "evidence": "...", "improvement": "..."}
  },
  "weighted_total": 0.0-5.0,
  "overall_verdict": "pass|fail",
  "top_improvement": "single most important thing to fix"
}"""
```

### Pairwise Comparison (for preference-based criteria)

Use when comparing two prompt variants. Always swap positions to eliminate position bias.

```python
PAIRWISE_PROMPT = """You are comparing two AI agent responses to the same request.

## CRITICAL BIAS PREVENTION RULES
- Do NOT prefer Response A or B because of its position (first vs second)
- Do NOT prefer longer responses — length is not quality
- Do NOT prefer confident-sounding responses unless accuracy is verified
- Ties are acceptable and encouraged when responses are genuinely equal

## Original Request
{prompt}

## Response A
{response_a}

## Response B
{response_b}

## Comparison Criteria
{criteria}

## Instructions
1. Analyze Response A independently (2-3 sentences)
2. Analyze Response B independently (2-3 sentences)
3. Compare them on each criterion
4. Declare a winner with confidence (0.0-1.0)

## Output (JSON)
{
  "analysis_a": "...",
  "analysis_b": "...",
  "per_criterion": {"criterion": "A|B|TIE", ...},
  "winner": "A|B|TIE",
  "confidence": 0.0-1.0,
  "reasoning": "..."
}"""

async def pairwise_with_bias_mitigation(prompt, response_a, response_b, criteria):
    """Run pairwise comparison twice with swapped positions, check consistency."""
    llm = ChatAnthropic(model="claude-sonnet-4-6")
    from pydantic import BaseModel

    # Pass 1: A first
    r1 = await llm.ainvoke(PAIRWISE_PROMPT.format(
        prompt=prompt, response_a=response_a, response_b=response_b, criteria=criteria))

    # Pass 2: B first (swapped)
    r2 = await llm.ainvoke(PAIRWISE_PROMPT.format(
        prompt=prompt, response_a=response_b, response_b=response_a, criteria=criteria))

    # Check consistency (if pass 2 says A wins, it means B from pass 1 wins)
    # If inconsistent → TIE with note
    # If consistent → return winner with avg confidence
    import json
    j1 = json.loads(r1.content)
    j2 = json.loads(r2.content)

    w1 = j1["winner"]
    # In pass 2, "A" refers to original B, "B" refers to original A — flip
    w2_flipped = {"A": "B", "B": "A", "TIE": "TIE"}[j2["winner"]]

    if w1 == w2_flipped:
        return {"winner": w1, "confidence": (j1["confidence"] + j2["confidence"]) / 2, "consistent": True}
    else:
        return {"winner": "TIE", "confidence": 0.5, "consistent": False, "note": "Position bias detected"}
```

### Bias Reference Table

| Bias | Description | Mitigation |
|---|---|---|
| **Position bias** | First response preferred | Always swap positions, check consistency |
| **Length bias** | Longer = better (wrong) | Explicit anti-length instruction in prompt |
| **Self-enhancement** | Model rates own style higher | Use different model for eval than generation |
| **Verbosity bias** | Detailed = high quality (wrong) | Rubric that penalizes irrelevant detail |
| **Authority bias** | Confident tone = correct (wrong) | Require evidence citation before scoring |

---

## Part 8: Prompt A/B Testing Framework

```python
import asyncio
from dataclasses import dataclass
from typing import Callable

@dataclass
class PromptVariant:
    name: str
    system_prompt: str
    description: str  # What you changed and why

@dataclass
class TestResult:
    variant: str
    scores: list[float]
    mean: float
    std: float
    sample_size: int

async def ab_test_prompts(
    variant_a: PromptVariant,
    variant_b: PromptVariant,
    test_cases: list[str],         # Representative user inputs
    judge_fn: Callable,             # Your LLM-as-a-Judge function
    min_effect_size: float = 0.3,  # Cohen's d threshold for "meaningful" difference
) -> dict:
    """
    Statistical A/B test for two prompt variants.
    Minimum 30 test cases recommended for statistical significance.
    """
    llm = ChatAnthropic(model="claude-sonnet-4-6")

    async def eval_variant(variant: PromptVariant) -> list[float]:
        scores = []
        for test_input in test_cases:
            response = await llm.ainvoke([
                {"role": "system", "content": variant.system_prompt},
                {"role": "user", "content": test_input}
            ])
            score = await judge_fn(test_input, response.content)
            scores.append(score)
        return scores

    # Run both variants concurrently
    scores_a, scores_b = await asyncio.gather(
        eval_variant(variant_a), eval_variant(variant_b)
    )

    import statistics, math

    mean_a, mean_b = statistics.mean(scores_a), statistics.mean(scores_b)
    std_a, std_b = statistics.stdev(scores_a), statistics.stdev(scores_b)
    n = len(test_cases)

    # Cohen's d effect size
    pooled_std = math.sqrt((std_a**2 + std_b**2) / 2)
    effect_size = abs(mean_a - mean_b) / pooled_std if pooled_std > 0 else 0

    winner = variant_a.name if mean_a > mean_b else variant_b.name
    meaningful = effect_size >= min_effect_size

    return {
        "winner": winner if meaningful else "No significant difference",
        "variant_a": {"mean": round(mean_a, 3), "std": round(std_a, 3)},
        "variant_b": {"mean": round(mean_b, 3), "std": round(std_b, 3)},
        "effect_size_cohens_d": round(effect_size, 3),
        "meaningful_difference": meaningful,
        "recommendation": (
            f"Deploy {winner} — {effect_size:.2f}σ improvement"
            if meaningful else
            "Variants are statistically equivalent — keep simpler version"
        )
    }
```

**Statistical guidelines:**
- Minimum 30 test cases for meaningful results (100+ for production decisions)
- Cohen's d ≥ 0.3 = small but meaningful, ≥ 0.5 = medium, ≥ 0.8 = large
- Test cases must come from **real user traffic**, not invented examples

---

## Part 9: Output Format Engineering

### Progressive Disclosure Template

Match response complexity to query complexity:

```markdown
# System Prompt Addition
Format your response based on query complexity:

SIMPLE (factual, yes/no, single-step):
→ 1-3 sentences, no headers, no bullets

MEDIUM (explanation, comparison, analysis):
→ 2-4 short paragraphs or a bulleted list
→ Add one code example only if it directly illustrates the point

COMPLEX (multi-step, how-to, implementation):
→ Use ## headers to organize sections
→ Include numbered steps for procedures
→ Code blocks for all code
→ End with a "Key Takeaways" section (max 3 bullets)

NEVER:
→ Start with "Certainly!", "Great question!", "Of course!" or similar filler
→ Repeat what the user said back to them
→ Add a conclusion that merely repeats the introduction
```

### Structured Output Enforcement

```markdown
# When output format matters, specify it twice: in the system prompt AND in each user turn
# System Prompt:
Always respond in this JSON format when answering classification questions:
{"label": "...", "confidence": 0.0-1.0, "reasoning": "..."}

# User Turn (reinforcement):
Classify the following text. Remember to use the JSON format.
Text: {input}
```

---

## Part 10: Debugging Agent Prompt Failures

When an agent misbehaves, follow this diagnostic framework:

```
Symptom → Likely Cause → Fix

Agent ignores tool X        → Tool description too vague or overlaps with tool Y
                             → Rewrite tool description with explicit triggers

Agent hallucinates         → No epistemic hedging rules in system prompt
                             → No grounding mechanism (no RAG or context injection)
                             → Add uncertainty rules + ground answers in context

Agent loops or gets stuck   → No exit condition defined
                             → No max_iterations limit
                             → Add "Stop after N steps" + explicit done condition

Wrong model tier used       → Complexity classifier underpowered
                             → Test cases not representative
                             → Retrain/improve classifier on real traffic

Agent too verbose           → No output format constraints
                             → No "no preamble" rule
                             → Add format rules + test with strict evaluator

Agent ignores constraints   → Constraints buried at end of long prompt
                             → Not reinforced with examples
                             → Move constraints to the top + add negative examples
```

---

## Best Practices Summary

1. **Show, don't tell**: Examples outperform instructions for complex behaviors
2. **Measure everything**: Run LLM-as-a-Judge evaluation before/after changes
3. **One change at a time**: Never change 3 things and hope it gets better
4. **Use real test cases**: Synthetic toy cases won't reveal production failures
5. **Version control prompts**: Treat prompts as code, use git, tag releases
6. **Claude-specific**: Use XML tags, prefilling, and `<thinking>` blocks for Claude
7. **Tool descriptions matter**: 40% of tool misuse is fixable by rewriting the description
8. **Constitutional AI for stakes**: Add self-critique loops for high-risk outputs
9. **Statistical rigor**: Use effect sizes (Cohen's d), not just "it seems better"
10. **Iterate on failures**: Keep a failure log; every failure is a few-shot example waiting to be written

## Related Skills

Works best with: `langchain-langgraph`, `cost-optimization`, `rag-implementation`, `instructor`, `tool-design`, `agent-evaluation`
