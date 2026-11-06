/**
 * Intelligent Web Search Classifier for Zline AI
 * Determines whether a user prompt requires real-time web retrieval.
 */

export type SearchMode = "auto" | "always" | "off";

export interface SearchDecision {
  shouldSearch: boolean;
  reason: string;
  extractedQuery: string;
  directUrl?: string;
}

const URL_EXTRACTION_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;

/**
 * Extracts a direct HTTP/HTTPS URL from the user prompt if present
 */
export function extractUrlFromPrompt(prompt: string): string | null {
  const match = prompt.match(URL_EXTRACTION_REGEX);
  if (!match) return null;
  try {
    const parsed = new URL(match[0]);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return match[0].replace(/[.,;:!?]+$/, ""); // Remove trailing punctuation
    }
  } catch {
    return null;
  }
  return null;
}

// Regex patterns for conversational greetings & chit-chat
const GREETINGS_REGEX =
  /^(hi|hello|hey|howdy|sup|greetings|good\s+(morning|afternoon|evening|night)|how\s+are\s+you|how's\s+it\s+going|what's\s+up|thank(s|\s+you)?|bye|goodbye|who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do)[\s!.?]*$/i;

// Regex patterns for math, calculations, and logic comparison
const MATH_LOGIC_REGEX =
  /\b(calculate|solve|evaluate|square\s+root|\d+\s*[\+\-\*\/\^%]\s*\d+|9\.11\s+(or|vs|and)\s+9\.8|larger,\s*9\.11|smaller,\s*9\.11)\b/i;

// Regex patterns for stable coding explanations & algorithms
const CODE_EXPLANATION_REGEX =
  /\b(explain\s+(binary\s+search|quicksort|merge\s*sort|bubble\s*sort|breadth\s*first|depth\s*first|dijkstra|recursion|polymorphism|inheritance|closure|hoisting|event\s*loop|promises)|how\s+(does|do)\s+(binary\s+search|quicksort|useeffect|usestate|async\/await)\s+work|what\s+is\s+(binary\s+search|big\s*o\s*notation|a\s+closure|a\s+promise|a\s+linked\s+list|a\s+binary\s+tree)|difference\s+between\s+(let\s+and\s+const|interface\s+and\s+type|var\s+and\s+let|null\s+and\s+undefined))\b/i;

// Creative writing & drafting
const CREATIVE_DRAFTING_REGEX =
  /^(write|compose|draft|generate)\s+(a\s+)?(poem|haiku|story|joke|song|riddle|limerick|polite\s+email|apology|letter)\b/i;

// Stable historical facts
const HISTORICAL_FACTS_REGEX =
  /\b(who\s+was\s+(george\s+washington|abraham\s+lincoln|julius\s+caesar|napoleon|albert\s+einstein|isaac\s+newton)|when\s+did\s+(world\s+war\s+(1|2|i|ii)\s+(start|end)|the\s+titanic\s+sink)|what\s+is\s+the\s+capital\s+of\s+(france|germany|japan|italy|canada|spain))\b/i;

// Zline internal platform queries
const ZLINE_INTERNAL_REGEX =
  /\b(how\s+does\s+zline|what\s+is\s+zline|zline\s+(encryption|e2ee|architecture)|how\s+do\s+i\s+use\s+zline)\b/i;

// High-confidence dynamic & temporal triggers
const TEMPORAL_TRIGGERS_REGEX =
  /\b(latest|recent|recently|currently|current|newest|breaking|upcoming|updated|today|yesterday|this\s+(week|month|year)|now|live|as\s+of\s+today|right\s+now|2024|2025|2026)\b/i;

const DYNAMIC_ENTITIES_REGEX =
  /\b(vulnerabilit(y|ies)|cve-\d+|zero-day|exploit|security\s+advisory|version|release\s*date|patch\s*notes|changelog|ballon\s+d'?or|who\s+won|winner\s+of|super\s+bowl|world\s+cup|olympics|champions\s+league|stock\s+price|crypto\s+price|weather\s+in|is\s+.*(down|broken|offline)|flight\s+status|what\s+happened\s+(to|with|in))\b/i;

/**
 * Clean and extract search keywords from the user prompt
 */
export function extractSearchQuery(prompt: string): string {
  return prompt
    .replace(/^(can\s+you\s+)?(please\s+)?(search\s+(the\s+web\s+for|for)?|look\s+up|find\s+information\s+on|tell\s+me\s+about)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
}

/**
 * Determines whether a search should be executed based on the user's mode and query.
 */
export function classifySearchIntent(
  rawPrompt: string,
  mode: SearchMode = "auto"
): SearchDecision {
  const prompt = rawPrompt.trim();
  const directUrl = extractUrlFromPrompt(prompt);
  const extractedQuery = directUrl ? prompt : extractSearchQuery(prompt);

  // 1. If mode is off, never search
  if (mode === "off") {
    return {
      shouldSearch: false,
      reason: "Search is disabled by user preference.",
      extractedQuery,
      directUrl: directUrl || undefined,
    };
  }

  // If user provided a direct URL to summarize or browse, prioritize immediate browsing
  if (directUrl) {
    return {
      shouldSearch: true,
      reason: "Direct URL detected in user prompt for browsing and extraction.",
      extractedQuery,
      directUrl,
    };
  }

  // 2. If prompt is empty or too short, do not search
  if (!prompt || prompt.length < 3) {
    return {
      shouldSearch: false,
      reason: "Query too short for search.",
      extractedQuery,
    };
  }

  // 3. If mode is "always", search for all eligible queries
  if (mode === "always") {
    return {
      shouldSearch: true,
      reason: "Always Search mode is enabled.",
      extractedQuery,
    };
  }

  // 4. AUTO MODE:
  // First, check explicit negative exclusions
  if (GREETINGS_REGEX.test(prompt)) {
    return {
      shouldSearch: false,
      reason: "Conversational greeting or chit-chat.",
      extractedQuery,
    };
  }

  if (MATH_LOGIC_REGEX.test(prompt)) {
    return {
      shouldSearch: false,
      reason: "Mathematical calculation or logic reasoning.",
      extractedQuery,
    };
  }

  if (CODE_EXPLANATION_REGEX.test(prompt)) {
    return {
      shouldSearch: false,
      reason: "Standard algorithm or programming concept explanation.",
      extractedQuery,
    };
  }

  if (CREATIVE_DRAFTING_REGEX.test(prompt)) {
    return {
      shouldSearch: false,
      reason: "Creative text generation or drafting.",
      extractedQuery,
    };
  }

  if (HISTORICAL_FACTS_REGEX.test(prompt)) {
    return {
      shouldSearch: false,
      reason: "Stable historical or geographical fact.",
      extractedQuery,
    };
  }

  if (ZLINE_INTERNAL_REGEX.test(prompt)) {
    return {
      shouldSearch: false,
      reason: "Zline platform and internal architecture query.",
      extractedQuery,
    };
  }

  // Check positive triggers
  if (TEMPORAL_TRIGGERS_REGEX.test(prompt) || DYNAMIC_ENTITIES_REGEX.test(prompt)) {
    return {
      shouldSearch: true,
      reason: "Contains temporal qualifiers or time-sensitive entities.",
      extractedQuery,
    };
  }

  // Question patterns looking for real-world information
  const infoSeekingRegex =
    /^(who\s+is\s+(the\s+)?(president|ceo|prime\s+minister|current|latest|new)|what\s+is\s+(the\s+)?(latest|current|status|price|score)|when\s+is\s+(the\s+)?(next|upcoming|release)|where\s+is\s+the\s+next)\b/i;

  if (infoSeekingRegex.test(prompt)) {
    return {
      shouldSearch: true,
      reason: "Information-seeking query about current real-world status.",
      extractedQuery,
    };
  }

  // Default in auto mode: do not search unless evidence suggests dynamic needs
  return {
    shouldSearch: false,
    reason: "General knowledge or static conceptual query.",
    extractedQuery,
  };
}

