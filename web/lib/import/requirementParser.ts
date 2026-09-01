// Lifted verbatim from app/scripts/build-data.mjs (tokenize / parseExpr /
// collectCourseCodes), typed. This is now the single source of truth for the
// requirement-expression grammar; the old build script is retired.
//
// Grammar (recursive descent):
//   parseOr  := parseAnd ( "O" parseAnd )*      -- "O" binds looser than "Y"
//   parseAnd := parseAtom ( "Y" parseAtom )*
//   parseAtom := "(" parseOr ")" | code | <skip one token, recurse>
// A trailing "*" on a code marks it "soft" (informational / co-requisite-ish);
// availability.ts treats soft the same as hard, requirementText.ts renders the "*".

import type { ReqNode } from "../types";

type Token =
  | { kind: "paren"; value: "(" | ")" }
  | { kind: "and" }
  | { kind: "or" }
  | { kind: "code"; value: string; soft: boolean };

export function tokenize(expr: string): Token[] {
  const spaced = expr.replace(/\(/g, " ( ").replace(/\)/g, " ) ");
  const raw = spaced.split(/\s+/).filter(Boolean);

  const tokens: Token[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t === "(" || t === ")") {
      tokens.push({ kind: "paren", value: t });
      continue;
    }
    if (t === "Y") {
      tokens.push({ kind: "and" });
      continue;
    }
    if (t === "O") {
      tokens.push({ kind: "or" });
      continue;
    }
    if (t === "-" || t === "*") continue; // stray separators
    // department letters, e.g. "MATE" followed by a number token "1207[*]"
    if (/^[A-ZÑ]{2,6}$/.test(t) && raw[i + 1] && /^\d{1,5}[A-Z]?\*?$/.test(raw[i + 1])) {
      const numTok = raw[i + 1];
      i++;
      const soft = numTok.endsWith("*");
      const code = t + numTok.replace(/\*$/, "");
      tokens.push({ kind: "code", value: code, soft });
      continue;
    }
    // already-fused code, e.g. "ENGL7", "EXMA1", "EXDO1"
    if (/^[A-ZÑ]+\d+[A-Z]?\*?$/.test(t)) {
      const soft = t.endsWith("*");
      tokens.push({ kind: "code", value: t.replace(/\*$/, ""), soft });
      continue;
    }
    // unrecognized token (rare) - ignore silently, expression stays best-effort
  }
  return tokens;
}

export function parseExpr(tokens: Token[]): ReqNode | null {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseOr(): ReqNode | null {
    let left = parseAnd();
    while (peek() && peek().kind === "or") {
      consume();
      const right = parseAnd();
      left = { op: "OR", items: [left as ReqNode, right as ReqNode] };
    }
    return left;
  }
  function parseAnd(): ReqNode | null {
    let left = parseAtom();
    while (peek() && peek().kind === "and") {
      consume();
      const right = parseAtom();
      left = { op: "AND", items: [left as ReqNode, right as ReqNode] };
    }
    return left;
  }
  function parseAtom(): ReqNode | null {
    const t = peek();
    if (!t) return null;
    if (t.kind === "paren" && t.value === "(") {
      consume();
      const node = parseOr();
      if (peek() && peek().kind === "paren" && (peek() as { value: string }).value === ")") consume();
      return node;
    }
    if (t.kind === "code") {
      consume();
      return { op: "COURSE", code: t.value, soft: !!t.soft };
    }
    // skip anything unexpected
    consume();
    return parseAtom();
  }

  if (tokens.length === 0) return null;
  return parseOr();
}

export function collectCourseCodes(node: ReqNode | null, set = new Set<string>()): Set<string> {
  if (!node) return set;
  if (node.op === "COURSE") {
    if (node.code) set.add(node.code);
  } else {
    for (const item of node.items ?? []) collectCourseCodes(item, set);
  }
  return set;
}

/** Convenience: raw Spanish expression -> parsed tree (or null). */
export function parseRequirement(text: string | null | undefined): ReqNode | null {
  if (!text || !text.trim() || text.trim() === "-") return null;
  return parseExpr(tokenize(text));
}
