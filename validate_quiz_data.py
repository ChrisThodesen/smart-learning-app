#!/usr/bin/env python3
"""
validate_quiz_data.py

Validates the quiz data layer for the BG Smart Metering Quiz App:
  - data/index.json (the quiz registry)
  - every question-bank JSON file referenced by it

Exit code 0  = all checks passed (warnings are allowed)
Exit code 1  = at least one error was found

Usage:
    python3 validate_quiz_data.py [--root .]
"""

import json
import sys
import argparse
from pathlib import Path

REQUIRED_INDEX_KEYS = {"id", "title", "subtitle", "icon", "passmark", "practiceCount", "testCount"}
REQUIRED_QUESTION_KEYS = {"question", "answers", "correct"}

# Any data files not matching desired format
KNOWN_EXCEPTIONS = {}


class Result:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    @property
    def ok(self):
        return len(self.errors) == 0


def load_json(path: Path, result: Result):
    if not path.exists():
        result.error(f"Missing file: {path}")
        return None
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        result.error(f"Invalid JSON in {path}: {e}")
        return None


def validate_index_entry(entry, idx, root: Path, result: Result, seen_ids: set, question_counts: dict):
    label = entry.get("id", f"<entry #{idx}>")
    source_required = entry.get("requireSourceAndExplanation",True)

    missing = REQUIRED_INDEX_KEYS - entry.keys()
    if missing:
        result.error(f"[index.json] '{label}': missing required key(s): {sorted(missing)}")

    qid = entry.get("id")
    if qid:
        if qid in seen_ids:
            result.error(f"[index.json] duplicate id '{qid}'")
        seen_ids.add(qid)

    has_file = "file" in entry
    has_generator = "generator" in entry
    if has_file == has_generator:
        result.error(f"[index.json] '{label}': must have exactly one of 'file' or 'generator' (has file={has_file}, generator={has_generator})")

    passmark = entry.get("passmark")
    if passmark is not None and not (isinstance(passmark, (int, float)) and 0 <= passmark <= 100):
        result.error(f"[index.json] '{label}': passmark must be a number 0-100, got {passmark!r}")

    for count_key in ("practiceCount", "testCount"):
        count_val = entry.get(count_key)
        if count_val is not None and not (isinstance(count_val, int) and count_val > 0):
            result.error(f"[index.json] '{label}': {count_key} must be a positive integer, got {count_val!r}")

    if has_generator:
        gen = entry["generator"]
        if not isinstance(gen, dict) or "script" not in gen or "global" not in gen:
            result.error(f"[index.json] '{label}': generator must have 'script' and 'global' keys")
        else:
            script_path = root / gen["script"].lstrip("./")
            if not script_path.exists():
                result.error(f"[index.json] '{label}': generator script not found at {script_path}")
        # Generators produce questions dynamically -- question-count checks don't apply.
        return

    if has_file:
        file_rel = entry["file"]
        file_path = root / file_rel.lstrip("./")
        questions = load_json(file_path, result)
        if questions is None:
            return
        if not isinstance(questions, list):
            result.error(f"[{file_rel}] expected a JSON array of questions, got {type(questions).__name__}")
            return

        question_counts[label] = len(questions)
        validate_question_bank(questions, file_rel, source_required, result)

        for count_key in ("practiceCount", "testCount"):
            count_val = entry.get(count_key)
            if isinstance(count_val, int) and count_val > len(questions):
                result.error(
                    f"[index.json] '{label}': {count_key}={count_val} exceeds available questions "
                    f"({len(questions)}) in {file_rel}"
                )


def validate_question_bank(questions, file_rel, source_required, result: Result):
    seen_question_text = {}

    for i, q in enumerate(questions):
        qnum = i + 1
        loc = f"[{file_rel}] question #{qnum}"

        if not isinstance(q, dict):
            result.error(f"{loc}: expected an object, got {type(q).__name__}")
            continue

        missing = REQUIRED_QUESTION_KEYS - q.keys()
        if missing:
            result.error(f"{loc}: missing required key(s): {sorted(missing)}")
            continue

        question_text = q.get("question")
        if not isinstance(question_text, str) or not question_text.strip():
            result.error(f"{loc}: 'question' must be a non-empty string")

        answers = q.get("answers")
        if not isinstance(answers, list) or len(answers) < 2:
            result.error(f"{loc}: 'answers' must be a list with at least 2 items")
            answers = []
        else:
            for ai, a in enumerate(answers):
                if not isinstance(a, str) or not a.strip():
                    result.error(f"{loc}: answer #{ai + 1} must be a non-empty string")

        correct = q.get("correct")
        if not isinstance(correct, int):
            result.error(f"{loc}: 'correct' must be an integer index, got {correct!r}")
        elif answers and not (0 <= correct < len(answers)):
            file_name = file_rel.split("/")[-1]
            if (file_name, qnum) in KNOWN_EXCEPTIONS:
                result.warn(f"{loc}: 'correct'={correct} out of range -- known exception ({KNOWN_EXCEPTIONS[(file_name, qnum)]})")
            else:
                result.error(f"{loc}: 'correct'={correct} is out of range for {len(answers)} answers")

        if source_required:
            source = q.get("source")
            if not isinstance(source, str) or not source.strip():
                result.error(f"{loc}: 'source' must be a non-empty string")

            explanation = q.get("explanation")
            if not isinstance(explanation, str) or not explanation.strip():
                result.error(f"{loc}: 'explanation' must be a non-empty string")

        # Duplicate question detection (exact text match) within the same file
        if isinstance(question_text, str):
            normalised = " ".join(question_text.strip().lower().split())
            if normalised in seen_question_text:
                file_name = file_rel.split("/")[-1]
                key = (file_name, qnum)
                if key in KNOWN_EXCEPTIONS:
                    result.warn(f"{loc}: duplicate of question #{seen_question_text[normalised]} -- known exception")
                else:
                    result.warn(
                        f"{loc}: question text duplicates question #{seen_question_text[normalised]} "
                        f"in the same file (flagged, not auto-removed)"
                    )
            else:
                seen_question_text[normalised] = qnum


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Path to the repo root (where data/index.json lives)")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    index_path = root / "data" / "index.json"

    result = Result()
    registry = load_json(index_path, result)

    if registry is not None:
        if not isinstance(registry, list):
            result.error(f"[index.json] expected a JSON array, got {type(registry).__name__}")
        else:
            seen_ids = set()
            question_counts = {}
            for idx, entry in enumerate(registry):
                if not isinstance(entry, dict):
                    result.error(f"[index.json] entry #{idx} is not an object")
                    continue
                validate_index_entry(entry, idx, root, result, seen_ids, question_counts)

    print(f"\nChecked: {index_path}\n")

    if result.warnings:
        print(f"WARNINGS ({len(result.warnings)}):")
        for w in result.warnings:
            print(f"  ⚠ {w}")
        print()

    if result.errors:
        print(f"ERRORS ({len(result.errors)}):")
        for e in result.errors:
            print(f"  ✗ {e}")
        print(f"\n❌ Validation FAILED with {len(result.errors)} error(s).")
        sys.exit(1)
    else:
        print(f"✅ Validation passed ({len(result.warnings)} warning(s)).")
        sys.exit(0)


if __name__ == "__main__":
    main()