#!/usr/bin/env python3
"""
build_dictionary.py
===================
Converts 26 raw vocab JSON files (a.json - z.json, ~500MB total) into:
1. SQLite Database: `data/dictionary.db`
   - Table `words(word TEXT PRIMARY KEY, phonetic TEXT, pos TEXT, data TEXT)`
   - Fast B-Tree index for < 1ms word lookups and < 2ms prefix search.
2. Prefix Shards: `data/dict/{prefix}.json`
   - Shards grouped by 2-letter prefix (or 1 letter for single letter words)
   - Stored as compact JSON map { [word]: Flashcard } for O(1) in-browser lookup.
   - Usable in static / PWA mode without a backend server.
"""

import os
import glob
import json
import sqlite3
import time
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
VOCAB_DIR = os.path.join(DATA_DIR, 'vocab')
DICT_DIR = os.path.join(DATA_DIR, 'dict')
DB_PATH = os.path.join(DATA_DIR, 'dictionary.db')

def get_prefix(word: str) -> str:
    w = word.strip().lower()
    if len(w) >= 2 and w[:2].isalpha():
        return w[:2]
    if len(w) >= 1 and w[0].isalpha():
        return w[0] + '_'
    return '__'

def main():
    start_time = time.time()
    print("🚀 Starting dictionary build...")

    os.makedirs(DICT_DIR, exist_ok=True)
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    # 1. Connect SQLite
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA synchronous = OFF")
    cur.execute("PRAGMA journal_mode = MEMORY")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS words (
            word TEXT PRIMARY KEY,
            phonetic TEXT,
            pos TEXT,
            data TEXT
        )
    """)

    shards = defaultdict(dict)
    total_words = 0
    vocab_files = sorted(glob.glob(os.path.join(VOCAB_DIR, '[a-z].json')))

    print(f"📁 Found {len(vocab_files)} vocab JSON files in {VOCAB_DIR}")

    db_batch = []
    for filepath in vocab_files:
        filename = os.path.basename(filepath)
        print(f"  Processing {filename}...", end='\r', flush=True)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = json.load(f)
            
            cards = []
            if isinstance(content, dict) and 'state' in content and 'flashcards' in content['state']:
                cards = content['state']['flashcards']
            elif isinstance(content, list):
                cards = content
            elif isinstance(content, dict) and 'flashcards' in content:
                cards = content['flashcards']

            for c in cards:
                raw_word = c.get('sentence', '').strip()
                if not raw_word:
                    continue
                w_key = raw_word.lower()
                phonetic = c.get('phonetic', '') or ''
                pos = c.get('partOfSpeech', '') or ''
                data_json = json.dumps(c, ensure_ascii=False)

                db_batch.append((w_key, phonetic, pos, data_json))
                prefix = get_prefix(w_key)
                shards[prefix][w_key] = c
                total_words += 1

                if len(db_batch) >= 5000:
                    cur.executemany("INSERT OR REPLACE INTO words VALUES (?, ?, ?, ?)", db_batch)
                    db_batch = []

        except Exception as e:
            print(f"\n❌ Error processing {filename}: {e}")

    if db_batch:
        cur.executemany("INSERT OR REPLACE INTO words VALUES (?, ?, ?, ?)", db_batch)
        db_batch = []

    print(f"\n✅ Total {total_words:,} words parsed into memory.")

    # 2. Finalize SQLite index & optimize
    print("⚡ Creating SQLite indexes and optimizing...")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)")
    conn.commit()
    cur.execute("VACUUM")
    conn.close()

    db_size_mb = os.path.getsize(DB_PATH) / (1024 * 1024)
    print(f"📦 SQLite DB created: {DB_PATH} ({db_size_mb:.1f} MB)")

    # 3. Write prefix shard files
    print(f"💾 Writing {len(shards)} prefix shard files to {DICT_DIR}...")
    for prefix, word_map in shards.items():
        shard_path = os.path.join(DICT_DIR, f"{prefix}.json")
        with open(shard_path, 'w', encoding='utf-8') as f:
            json.dump(word_map, f, ensure_ascii=False)

    # 4. Write manifest for shards
    manifest_path = os.path.join(DICT_DIR, "shards_manifest.json")
    shard_info = {
        p: len(words) for p, words in sorted(shards.items())
    }
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(shard_info, f, indent=2)

    elapsed = time.time() - start_time
    print(f"🎉 Done in {elapsed:.1f}s! SQLite + {len(shards)} Shards successfully built.")

if __name__ == '__main__':
    main()
