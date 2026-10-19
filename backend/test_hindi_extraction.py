# -*- coding: utf-8 -*-
import sys
from backend.extractor import parse_options_from_block, extract_answer_keys_from_text

text = """भारत का प्रथम वायसराय कौन था?
(क) लॉर्ड डलहौजी
(ख) लॉर्ड कैनिंग
(ग) लॉर्ड कर्जन
(घ) लॉर्ड माउंटबेटन"""

stem, opts = parse_options_from_block(text)
print("Stem len:", len(stem))
print("Options extracted:", len(opts))
for o in opts:
    print("Label:", o['label'], "Raw text length:", len(o['text']))

ans_key_text = """
उत्तर माला:
1. (ख)
2. (क)
"""
keys = extract_answer_keys_from_text(ans_key_text)
print("Extracted answer keys:", keys)
