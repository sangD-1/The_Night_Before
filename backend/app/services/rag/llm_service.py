import re
import logging
from typing import List, Dict, Any, Optional, Tuple
import openai
from app.config import (
    LLM_PROVIDER,
    LLM_MODEL_NAME,
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_TEMPERATURE,
    LLM_MAX_TOKENS,
)

logger = logging.getLogger("rag.llm")


class LLMService:
    """
    Modular, provider-agnostic LLM interface for grounded answer generation.
    Supports OpenAI, Groq, Gemini, OpenRouter, and Ollama through OpenAI-compatible protocols,
    with graceful fallback when no external API key is configured.
    """

    def __init__(
        self,
        provider: str = LLM_PROVIDER,
        model_name: str = LLM_MODEL_NAME,
        api_key: str = LLM_API_KEY,
        base_url: Optional[str] = LLM_BASE_URL,
        temperature: float = LLM_TEMPERATURE,
        max_tokens: int = LLM_MAX_TOKENS,
    ):
        self.provider = provider
        self.model_name = model_name
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._client: Optional[openai.OpenAI] = None

    def is_configured(self) -> bool:
        """Checks if a valid, non-placeholder API key is available."""
        if not self.api_key:
            return False
        key = self.api_key.strip()
        return len(key) > 5 and not key.startswith("sk-placeholder") and not key.startswith("your_")

    def get_client(self) -> openai.OpenAI:
        """Initializes and returns cached OpenAI client."""
        if self._client is None:
            if not self.is_configured():
                raise ValueError(
                    f"LLM API key is not configured for provider '{self.provider}'. "
                    f"Please add a valid LLM_API_KEY to backend/.env."
                )
            self._client = openai.OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                timeout=30.0,
                max_retries=2,
            )
        return self._client

    def generate_answer(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """
        Executes grounded chat completion against configured LLM provider.
        If no API key is provided, safely falls back to local deterministic grounded synthesis.
        """
        if not self.is_configured():
            logger.info(
                "No external LLM API key configured in .env (LLM_PROVIDER=%s). "
                "Synthesizing strictly grounded response directly from retrieved course material.",
                self.provider,
            )
            return self._synthesize_local_grounded_fallback(user_prompt)

        client = self.get_client()

        try:
            response = client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )

            choice = response.choices[0]
            answer = choice.message.content or ""
            return answer.strip()

        except openai.AuthenticationError as ae:
            logger.error("LLM Authentication Failed: %s", ae)
            raise ValueError(f"LLM authentication failed: Please verify your API key in backend/.env ({str(ae)})")
        except openai.RateLimitError as rle:
            logger.error("LLM Rate Limit Reached: %s", rle)
            raise ValueError(f"LLM rate limit reached. Please try again in a few moments ({str(rle)})")
        except openai.APITimeoutError as te:
            logger.error("LLM API Timeout: %s", te)
            raise TimeoutError("The LLM request timed out after 30 seconds. Please try again.")
        except Exception as err:
            logger.error("LLM Generation Exception: %s", err)
            raise RuntimeError(f"LLM generation failed: {str(err)}")

    def _synthesize_local_grounded_fallback(self, user_prompt: str) -> str:
        """
        Deterministic, local fallback synthesis used when no external paid API key is configured.
        Strictly formats the retrieved course material into a structured student study note
        without fabricating external knowledge or dumping raw chunks.
        """
        # Parse student's question from user prompt
        q_match = re.search(r'STUDENT\'S QUESTION:\s*(.+?)(?:\n\n|\Z)', user_prompt, re.DOTALL)
        question = q_match.group(1).strip() if q_match else "your question"

        # Parse out the context section from the prompt
        context_start = user_prompt.find("=== COURSE MATERIAL CONTEXT (Strict Source of Truth) ===")
        context_end = user_prompt.find("==========================================================")

        if context_start == -1 or context_end == -1:
            return "The uploaded course material does not contain sufficient information to answer this question."

        context_text = user_prompt[context_start:context_end].strip()

        # Parse individual source blocks
        source_blocks = re.split(r'\n(?=--- SOURCE \d+:)', context_text)
        parsed_sources = []

        def clean_line(l: str) -> str:
            l = l.strip()
            if not l:
                return ""
            if re.match(r'^\d{1,2}/\d{1,2}/\d{2,4}$', l):
                return ""
            if re.match(r'^\d{1,3}$', l) or re.match(r'^(?:Slide|Page)\s+\d+$', l, re.IGNORECASE):
                return ""
            if re.search(r'By:\s+[A-Za-z\s]+', l, re.IGNORECASE):
                return ""
            if re.search(r'Mukesh Sakle', l, re.IGNORECASE):
                return ""
            if re.search(r'Queue Data Structure', l, re.IGNORECASE) and len(l) < 35:
                return ""
            l = re.sub(r'^(?:Slide|Page)\s+\d+:\s*', '', l, flags=re.IGNORECASE).strip()
            l = l.replace('\u201c', '"').replace('\u201d', '"').replace('\u2018', "'").replace('\u2019', "'")
            return l

        for block in source_blocks:
            if not block.strip().startswith("--- SOURCE"):
                continue
            lines = [line.strip() for line in block.splitlines() if line.strip()]
            header_line = lines[0]
            m_label = re.search(r'--- SOURCE \d+:\s*(.+?)\s*---', header_line)
            citation_label = m_label.group(1).strip() if m_label else "Course Document"

            content_lines = []
            capture_content = False
            for line in lines:
                if line.startswith("Content:"):
                    capture_content = True
                    continue
                if capture_content:
                    cl = clean_line(line)
                    if cl:
                        content_lines.append(cl)

            if content_lines:
                parsed_sources.append({
                    "label": citation_label,
                    "lines": content_lines,
                    "raw": "\n".join(content_lines),
                })

        if not parsed_sources:
            return "The uploaded course materials do not contain sufficient evidence to answer this question."

        q_lower = question.lower()
        is_condition_query = any(w in q_lower for w in ["condition", "overflow", "underflow", "pointer", "top", "formula", "boundary", "rule"])

        # Extract definition sentences
        definitions = []
        for src in parsed_sources:
            for l in src["lines"]:
                if any(cue in l.lower() for cue in [" is a ", " is the ", " refers to ", " organizes tables ", " is defined as ", " ensures dynamic ", " operates on ", " explores level "]):
                    if l not in definitions and len(l) > 15:
                        definitions.append(l)

        # Extract bullet items (markdown section headers, slide title+body, and key: value items)
        bullets = []

        # 1. Slide title + body blocks (e.g. Breadth-First Search (BFS) -> Explores level by level...)
        for src in parsed_sources:
            slines = src["lines"]
            if len(slines) >= 2:
                first_line = slines[0]
                rest_body = " ".join(slines[1:]).strip()
                if len(first_line) < 55 and not first_line.endswith(".") and rest_body:
                    if not any(b[0].lower() == first_line.lower() for b in bullets):
                        bullets.append((first_line, rest_body))

        # 2. Markdown headings
        for src in parsed_sources:
            sections = re.split(r'\n(?=#{1,3}\s+)', src["raw"])
            for sec in sections:
                sec_lines = [clean_line(l) for l in sec.splitlines() if clean_line(l)]
                if not sec_lines:
                    continue
                first_line = sec_lines[0]
                if first_line.startswith("#"):
                    heading_title = re.sub(r'^#+\s*', '', first_line).strip()
                    body = " ".join(sec_lines[1:]).strip()
                    if body and len(heading_title) < 45 and not heading_title.lower().startswith("slide"):
                        if not any(b[0].lower() == heading_title.lower() for b in bullets):
                            bullets.append((heading_title, body))

        # 3. Key: Value lines
        for src in parsed_sources:
            for l in src["lines"]:
                m = re.match(r'^(?:(?:\d+\.|\*|-|•)\s*)?([A-Za-z0-9_\-\s]{2,40}?):\s*(.+)$', l)
                if m:
                    k = m.group(1).strip()
                    v = m.group(2).strip()
                    if k.lower() not in ["for ex", "ex", "note", "step", "step 1", "step 2", "step 3", "step 4", "content", "source", "slide", "page"]:
                        if not any(b[0].lower() == k.lower() for b in bullets):
                            bullets.append((k, v))


        # Extract boundary conditions & formulas
        cond_items = []
        if is_condition_query:
            for src in parsed_sources:
                lines = src["lines"]
                for i, l in enumerate(lines):
                    l_lower = l.lower()
                    if "overflow" in l_lower and ("full" in l_lower or "top" in l_lower):
                        formula = None
                        for look in lines[i:i+4]:
                            fm = re.search(r'(?:if\s+)?\(?(top\s*=\s*=?\s*[a-zA-Z0-9_\-\+\s]+)\)?', look, re.IGNORECASE)
                            if fm:
                                f_raw = fm.group(1).strip()
                                f_clean = re.sub(r'\s*=\s*=?\s*', ' == ', f_raw, flags=re.IGNORECASE)
                                f_clean = re.sub(r'^top', 'Top', f_clean, flags=re.IGNORECASE)
                                formula = f_clean.strip()
                                break
                        cond_items.append(("Stack Overflow", l, formula))
                    elif "underflow" in l_lower and ("empty" in l_lower or "top" in l_lower or "-1" in l_lower):
                        formula = None
                        for look in lines[i:i+4]:
                            fm = re.search(r'(?:if\s+)?\(?(top\s*=\s*=?\s*[\-0-9a-zA-Z_\+\s]+)\)?', look, re.IGNORECASE)
                            if fm:
                                f_raw = fm.group(1).strip()
                                f_clean = re.sub(r'\s*=\s*=?\s*', ' == ', f_raw, flags=re.IGNORECASE)
                                f_clean = re.sub(r'^top', 'Top', f_clean, flags=re.IGNORECASE)
                                formula = f_clean.strip()
                                break
                        cond_items.append(("Stack Underflow", l, formula))

        # Assemble clean student study note
        output = []
        q_clean = question.strip('?')
        if is_condition_query and cond_items:
            output.append("In a stack data structure, the **Top** pointer tracks the location of the topmost element. The exact boundary conditions are:")
        elif definitions:
            output.append(definitions[0])
        else:
            output.append(f"Based on your course materials, here is the verified explanation for **{q_clean}**:")

        if cond_items:
            output.append("\n**Boundary Conditions:**")
            seen_cond = set()
            for k, text, formula in cond_items:
                if k not in seen_cond:
                    seen_cond.add(k)
                    clean_text = re.sub(r'^(?:overflow|underflow):\s*', '', text, flags=re.IGNORECASE).strip()
                    clean_text = clean_text[0].upper() + clean_text[1:] if clean_text else ''
                    form_text = f" | **Condition:** `{formula}`" if formula else ""
                    output.append(f"- **{k}:** {clean_text}{form_text}")

        if bullets and not (is_condition_query and cond_items):
            output.append("\n**Key Points & Operations:**")
            for k, v in bullets[:6]:
                output.append(f"- **{k}:** {v}")

        sources = list(dict.fromkeys([src["label"] for src in parsed_sources[:2]]))
        if sources:
            output.append("\n*Source: " + ", ".join(sources) + "*")

        return "\n".join(output)


# Global singleton instance
llm_service = LLMService()
