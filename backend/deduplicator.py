import re
import hashlib
from typing import Tuple, Optional, Dict, Any, List
from .database import get_db

def normalize_text(text: str) -> str:
    """Normalizes text by removing non-alphanumeric chars, lowercasing, and stripping whitespace."""
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", text.lower())
    return cleaned

def compute_hash(text: str) -> str:
    """Returns SHA256 of normalized text for indexing."""
    normalized = normalize_text(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

def get_tokens(text: str) -> set:
    words = re.findall(r"\b[a-zA-Z0-9]{3,}\b", text.lower())
    return set(words)

def jaccard_similarity(set1: set, set2: set) -> float:
    if not set1 or not set2:
        return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0.0

def find_duplicate(question_text: str, current_q_id: Optional[str] = None) -> Tuple[bool, Optional[str], float]:
    """
    Checks the database for duplicate questions.
    Returns (is_duplicate, duplicate_of_id, score).
    """
    norm_hash = compute_hash(question_text)
    tokens = get_tokens(question_text)

    conn = get_db()
    # 1. First check exact normalized hash
    query_exact = "SELECT id, question_text FROM questions WHERE normalized_hash = ?"
    params_exact = [norm_hash]
    if current_q_id:
        query_exact += " AND id != ?"
        params_exact.append(current_q_id)

    match = conn.execute(query_exact, params_exact).fetchone()
    if match:
        conn.close()
        return (True, match["id"], 1.0)

    # 2. Token overlap similarity check against existing questions (limit sample to recent 500)
    query_sim = "SELECT id, question_text FROM questions"
    params_sim = []
    if current_q_id:
        query_sim += " WHERE id != ?"
        params_sim.append(current_q_id)
    query_sim += " ORDER BY created_at DESC LIMIT 500"

    candidates = conn.execute(query_sim, params_sim).fetchall()
    conn.close()

    for cand in candidates:
        cand_tokens = get_tokens(cand["question_text"])
        sim = jaccard_similarity(tokens, cand_tokens)
        if sim >= 0.85:
            return (True, cand["id"], round(sim, 2))

    return (False, None, 0.0)
