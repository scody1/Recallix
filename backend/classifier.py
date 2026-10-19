import re
from typing import Tuple, Optional

# Keyword dictionaries mapping subjects to (topics, keywords)
RULES = {
    "Quantitative Aptitude": {
        "Geometry & Mensuration": [
            "triangle", "circle", "radius", "diameter", "hypotenuse", "quadrilateral", "cylinder",
            "cone", "sphere", "hemisphere", "tangent", "secant", "chord", "perimeter", "area",
            "volume", "surface area", "rhombus", "trapezium", "parallelogram", "equilateral",
            "isosceles", "angle", "degree", "centroid", "inradius", "circumradius", "cm²", "m²", "cm³"
        ],
        "Trigonometry": [
            "sin", "cos", "tan", "cot", "sec", "cosec", "theta", "θ", "elevation", "depression",
            "radian", "trigonometric"
        ],
        "Arithmetic": [
            "cost price", "selling price", "profit", "loss", "discount", "marked price",
            "simple interest", "compound interest", "ratio and proportion", "average", "percentage",
            "speed", "distance", "time and work", "pipe", "cistern", "train", "boat", "stream",
            "mixture", "alligation", "partnership", "km/h", "m/s"
        ],
        "Algebra & Number System": [
            "polynomial", "roots", "quadratic", "hcf", "lcm", "divisible", "remainder", "prime number",
            "factor", "indices", "surds", "simplification", "algebraic", "x²", "y²", "value of x"
        ]
    },
    "Reasoning": {
        "Verbal Reasoning": [
            "analogy", "syllogism", "statement and conclusion", "statement and assumption",
            "blood relation", "mother", "father", "brother", "sister", "maternal", "paternal",
            "direction", "north", "south", "east", "west", "turned left", "turned right",
            "ranking", "seating arrangement", "row", "bench", "circular table"
        ],
        "Non-Verbal & Pattern Reasoning": [
            "mirror image", "water image", "paper folding", "paper cutting", "embedded figure",
            "cube", "dice", "opposite face", "venn diagram", "matrix", "figure series"
        ],
        "Series & Coding": [
            "coding-decoding", "coded as", "letter series", "number series", "odd one out",
            "classification", "missing number", "pattern"
        ]
    },
    "English": {
        "Vocabulary": [
            "synonym", "antonym", "most similar in meaning", "opposite in meaning",
            "idiom", "phrase", "one word substitution", "one-word substitute",
            "correctly spelt", "misspelt", "spelling"
        ],
        "Grammar & Usage": [
            "grammatical error", "error detection", "fill in the blank", "sentence improvement",
            "active voice", "passive voice", "direct speech", "indirect speech", "reported speech",
            "preposition", "conjunction", "tense", "subject-verb agreement", "clause"
        ],
        "Comprehension": [
            "cloze test", "comprehension", "passage", "para jumble", "jumbled sentence",
            "according to the passage", "author suggests"
        ]
    },
    "General Studies": {
        "History & Culture": [
            "dynasty", "mughal", "maurya", "gupta", "delhi sultanate", "british", "viceroy",
            "governor-general", "revolt of 1857", "freedom struggle", "gandhi", "congress", "vedas",
            "indus valley", "harappa", "temple architecture", "classical dance", "folk dance", "unesco"
        ],
        "Polity & Governance": [
            "constitution", "article", "fundamental rights", "directive principles", "amendment",
            "parliament", "lok sabha", "rajya sabha", "supreme court", "high court", "president",
            "prime minister", "governor", "election commission", "finance commission", "panchayat"
        ],
        "Geography": [
            "tributary", "river", "himalayas", "plateau", "western ghats", "eastern ghats",
            "monsoon", "climate", "soil", "alluvial", "black soil", "national park", "wildlife sanctuary",
            "biosphere reserve", "strait", "equator", "tropic of cancer"
        ],
        "Science": [
            "photosynthesis", "cell", "mitochondria", "dna", "rna", "enzyme", "hormone", "deficiency",
            "vitamin", "bacteria", "virus", "newton", "gravitation", "kinetic energy", "velocity",
            "refraction", "reflection", "lens", "wavelength", "periodic table", "atomic number",
            "isotope", "acid", "base", "ph value", "chemical formula"
        ],
        "Economy & Current Affairs": [
            "gdp", "inflation", "cpi", "rpi", "rbi", "repo rate", "reverse repo", "fiscal deficit",
            "budget", "monetary policy", "five year plan", "census", "headquarters", "olympics"
        ]
    }
}

MATH_SYMBOLS_REGEX = re.compile(r"[√πθ±²³°∠△∫∑≈≠≤≥]")

def classify_question(text: str, options: list = None) -> Tuple[Optional[str], Optional[str], float]:
    """
    Classifies a question into (Subject, Topic, Confidence).
    Returns (None, None, 0.0) if ambiguous or below match threshold.
    """
    full_text = text.lower()
    if options:
        for opt in options:
            if isinstance(opt, dict) and "text" in opt:
                full_text += " " + opt["text"].lower()

    # Math symbol boost
    math_symbols_count = len(MATH_SYMBOLS_REGEX.findall(text))

    scores = {
        "Quantitative Aptitude": 0.0,
        "Reasoning": 0.0,
        "English": 0.0,
        "General Studies": 0.0
    }
    matched_topics = {}

    for subject, topics in RULES.items():
        for topic, keywords in topics.items():
            for kw in keywords:
                if kw in full_text:
                    # Longer keyword matches are stronger indicators
                    weight = 1.0 + (len(kw.split()) * 0.5)
                    scores[subject] += weight
                    if subject not in matched_topics or weight > matched_topics[subject][1]:
                        matched_topics[subject] = (topic, weight)

    if math_symbols_count > 0:
        scores["Quantitative Aptitude"] += math_symbols_count * 2.0

    # Pattern checks for reasoning analogies (e.g., A : B :: C : ?)
    if "::" in text or re.search(r"\b[A-Za-z0-9]+\s*:\s*[A-Za-z0-9]+\b", text):
        scores["Reasoning"] += 3.0

    # Pattern checks for English quotes or grammar blanks
    if re.search(r"select the (most appropriate|synonym|antonym|option that)", full_text):
        scores["English"] += 4.0

    best_subject = max(scores, key=scores.get)
    best_score = scores[best_subject]

    # If score is too low or barely higher than competitor, remain uncategorised
    if best_score < 2.0:
        return (None, None, 0.0)

    # Check for margin
    sorted_scores = sorted(scores.values(), reverse=True)
    if len(sorted_scores) > 1 and sorted_scores[0] - sorted_scores[1] < 1.0 and sorted_scores[1] > 3.0:
        # Ambiguous between top two categories
        confidence = 0.55
    else:
        confidence = min(0.95, 0.60 + (best_score * 0.05))

    best_topic = matched_topics.get(best_subject, (None, 0))[0]
    return (best_subject, best_topic, round(confidence, 2))
