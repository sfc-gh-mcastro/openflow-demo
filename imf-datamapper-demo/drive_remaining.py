#!/usr/bin/env python3
"""Drive remaining demo prompts (2-7) into an existing tmux cortex session."""
import time, random, subprocess, sys, re

TMUX_SESSION = "cortex_demo"
TYPING_SPEED = (0.03, 0.08)
PAUSE_BETWEEN = 5
IDLE_THRESHOLD = 10
ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\[\?[0-9]+[a-z]')

def strip_ansi(t): return ANSI_RE.sub('', t)
def log(msg): print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)
def tmux(*args):
    r = subprocess.run(["tmux"] + list(args), capture_output=True, text=True)
    return r.stdout
def capture_pane():
    return strip_ansi(tmux("capture-pane", "-t", TMUX_SESSION, "-p", "-S", "-200"))
def send_keys(*keys):
    tmux("send-keys", "-t", TMUX_SESSION, *keys)

def type_prompt(text):
    send_keys("Escape")
    time.sleep(0.5)
    for ch in text:
        if ch == " ": send_keys("Space")
        else: send_keys("-l", ch)
        d = random.uniform(*TYPING_SPEED)
        if ch in ".,!?;:": d += random.uniform(0.05, 0.12)
        time.sleep(d)
    time.sleep(random.uniform(0.3, 0.6))
    send_keys("Enter")

def detect_interactive(content):
    if ("❯" in content or "›" in content) and any(m in content for m in ["○","●","◯"]):
        return "radio"
    if any(m in content for m in ["◻","◼","☐","☑","[ ]","[x]"]):
        if "❯" in content or "›" in content: return "checkbox"
    if "1." in content and "2." in content:
        tail = [l.strip() for l in content.strip().splitlines() if l.strip()][-6:]
        lower = "\n".join(tail).lower()
        if "yes" in lower and "no" in lower: return "numbered"
    return None

def wait_for_response():
    MIN_WAIT = 10
    start = time.time()
    last_activity = time.time()
    saw_working = False
    prompt_gone = False
    last_content = ""
    interactions = 0
    stable = 0

    while True:
        time.sleep(1)
        content = capture_pane()

        if not prompt_gone:
            if "Type your message" not in content and "auto-accept" not in content.lower():
                prompt_gone = True
                saw_working = True
                last_activity = time.time()
                log("  Processing...")
            # Also check if it's already showing "esc to interrupt"
            elif "esc to interrupt" in content:
                prompt_gone = True
                saw_working = True
                last_activity = time.time()
                log("  Processing...")
            continue

        if content != last_content:
            last_activity = time.time()
            saw_working = True
        last_content = content

        if "esc to interrupt" in content:
            saw_working = True
            last_activity = time.time()

        # Done check
        ready_indicators = ["Type your message", "auto-accept"]
        is_ready = any(ind in content for ind in ready_indicators)
        if is_ready and "esc to interrupt" not in content:
            elapsed = time.time() - start
            if elapsed >= MIN_WAIT:
                log(f"  Response complete ({elapsed:.0f}s)")
                return True

        # Auto-accept interactive prompts
        if interactions < 50:
            is_outputting = is_ready or "esc to interrupt" in content
            if not is_outputting:
                pt = detect_interactive(content)
                if pt and content == last_content:
                    stable += 1
                else:
                    stable = 0
                if pt and stable >= 2:
                    if pt == "radio":
                        log("  Interactive (radio) -> Enter")
                        time.sleep(0.3); send_keys("Enter")
                    elif pt == "checkbox":
                        log("  Interactive (checkbox) -> Space+Enter")
                        time.sleep(0.3); send_keys("Space"); time.sleep(0.5); send_keys("Enter")
                    elif pt == "numbered":
                        log("  Interactive (numbered) -> 1")
                        time.sleep(0.3); send_keys("1")
                    interactions += 1
                    last_activity = time.time()
                    saw_working = True
                    stable = 0
            else:
                stable = 0

        elapsed = time.time() - start
        idle = time.time() - last_activity
        if saw_working and idle > IDLE_THRESHOLD and elapsed >= MIN_WAIT:
            log(f"  Appears complete (idle {idle:.0f}s, total {elapsed:.0f}s)")
            return True

        if elapsed > 600:
            log("  WARNING: 10min timeout")
            return True

PROMPTS = [
    "Using AI_COMPLETE, generate a brief economic outlook summary for the G7 countries based on their 2024-2030 GDP growth and inflation projections in API_DEMO.PUBLIC.IMF_DATAMAPPER_INDICATORS",
    'Create a semantic view over the IMF economic data in API_DEMO.PUBLIC so analysts can ask questions like "What is India\'s GDP forecast?" or "Compare unemployment rates across Europe"',
    "Build a Cortex Agent that uses the semantic view to answer natural language questions about the world economy",
    "Make this agent available in Snowflake Intelligence",
    "Build a React app that lets users select countries and compare economic indicators like GDP growth, inflation, and unemployment over time using charts. Use the IMF data in API_DEMO.PUBLIC.",
    "Which emerging market economies are projected to overtake current top-10 GDP rankings by 2030?",
]

if __name__ == "__main__":
    log(f"Driving {len(PROMPTS)} remaining prompts into existing tmux session")
    for i, prompt in enumerate(PROMPTS, 2):
        log(f"--- Prompt {i}/7 ---")
        log(f"Typing: {prompt[:80]}{'...' if len(prompt) > 80 else ''}")
        type_prompt(prompt)
        log("Submitted.")
        wait_for_response()
        log(f"Prompt {i} done. Pausing {PAUSE_BETWEEN}s...")
        time.sleep(PAUSE_BETWEEN)
    log("All prompts complete!")
