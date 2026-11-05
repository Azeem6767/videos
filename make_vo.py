"""
make_vo.py  -  edge-tts voiceover + word-level SRT, with emotion tags.
(fixed version: retries and falls back when edge-tts returns no audio,
 and tells you exactly which line/style caused it)

Usage:  python make_vo.py script.txt        -> script.txt.wav/.mp3/.srt/_words.json

SCRIPT SYNTAX (one line = one block, blank line = extra pause)
    [style] @voice text...
    Tags can also go in the MIDDLE of a line.

  Style tags:  hook normal excited slow reveal end sad creepy whisper
               scared angry happy
  Pause tags:  [beat] [pause] [long] [dramatic]   [pause:1.5] = exact seconds
  Sound tags:  [laugh] [chuckle] [sigh] [gasp] [gulp]
               (plays sfx/<name>.wav|mp3|ogg if present, else a spoken fallback)
"""
import asyncio, sys, json, re, subprocess, wave, os
import numpy as np
import edge_tts
from edge_tts.exceptions import NoAudioReceived

# ---- settings -------------------------------------------------------------
VOICES = {
    "narrator": "en-US-AndrewMultilingualNeural",
    "second":   "en-US-AvaMultilingualNeural",
}
SPEED = 4             # extra % speed added to every style
PAUSE_SCALE = 0.8     # global pause multiplier
SR = 24000
SFX_DIR = "sfx"

# style: (rate %, pitch Hz, volume %, pause after line, ffmpeg audio filter or None)
STYLES = {
    "hook":    (12,   4,  10, 0.25, None),
    "normal":  (6,    0,   0, 0.15, None),
    "excited": (16,   6,   8, 0.15, None),
    "slow":    (-6,  -2,   0, 0.35, None),
    "reveal":  (-4,  -3,   5, 0.45, None),
    "end":     (-8,  -4,   5, 0.20, None),
    "happy":   (10,   5,   5, 0.15, "equalizer=f=3500:t=q:w=1:g=2"),
    "sad":     (-14, -5,  -6, 0.45, "lowpass=f=5500,volume=0.9"),
    "creepy":  (-12, -3,  -4, 0.30,
                "apad=pad_dur=0.4,lowpass=f=6000,aecho=0.9:0.9:55:0.12,volume=1.0"),
    "whisper": (-8,  -2, -35, 0.30,
                "apad=pad_dur=0.3,highpass=f=250,aecho=0.8:0.5:40:0.2,volume=2.2"),
    "scared":  (14,   6,   0, 0.20, "tremolo=f=7:d=0.15"),
    "angry":   (8,   -2,  15, 0.20, "equalizer=f=2000:t=q:w=1:g=3,acompressor=threshold=-18dB:ratio=4"),
}

PAUSES = {"beat": 0.2, "pause": 0.45, "long": 0.8, "dramatic": 1.5, "breath": 0.3}

SOUNDS = {
    "laugh":   ("Ha! Ha ha ha ha!", "excited"),
    "chuckle": ("Heh heh.",         "happy"),
    "sigh":    ("Haaah.",           "sad"),
    "gasp":    ("Haah!",            "scared"),
    "gulp":    ("Mm.",              "scared"),
}
# --------------------------------------------------------------------------

def warn(msg):
    print(f"warning: {msg}", file=sys.stderr)

def ts(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int((s % 1) * 1000):03}"

def silence(sec):
    return np.zeros(int(SR * sec), dtype=np.int16)

async def _once(text, voice_id, rate, pitch, vol):
    comm = edge_tts.Communicate(text, voice_id,
                                rate=f"{rate:+d}%", pitch=f"{pitch:+d}Hz",
                                volume=f"{vol:+d}%", boundary="WordBoundary")
    audio, words = bytearray(), []
    async for c in comm.stream():
        if c["type"] == "audio":
            audio += c["data"]
        elif c["type"] == "WordBoundary":
            s = c["offset"] / 1e7
            words.append({"word": c["text"], "start": s, "end": s + c["duration"] / 1e7})
    return bytes(audio), words

async def synth(text, style, voice):
    # nothing speakable (only punctuation/quotes) -> skip instead of crashing
    if not re.search(r"\w", text):
        warn(f"skipped line with nothing to say: {text!r}")
        return b"", []
    rate, pitch, vol = STYLES[style][:3]
    voice_id = VOICES.get(voice, VOICES["narrator"])
    attempts = [
        ("full settings",        rate + SPEED, pitch, vol),
        ("full settings (retry)", rate + SPEED, pitch, vol),
        ("speed only",           rate + SPEED, 0, 0),
        ("plain voice",          0, 0, 0),
    ]
    for label, r, p, v in attempts:
        try:
            audio, words = await _once(text, voice_id, r, p, v)
            if audio:
                if label not in ("full settings",):
                    warn(f"[{style}] worked only with '{label}': {text[:60]!r}")
                return audio, words
        except NoAudioReceived:
            warn(f"[{style}] no audio with '{label}' (rate={r:+d}% pitch={p:+d}Hz "
                 f"vol={v:+d}%): {text[:60]!r}")
        await asyncio.sleep(0.5)
    raise RuntimeError(f"edge-tts gave no audio for [{style}] line: {text!r}. "
                       "Check your internet and run: pip install -U edge-tts")

# edge-tts adds extra silence at the end of every chunk, which made pauses
# longer than set. Trim only the END (start untouched, so SRT timing stays
# exact) and keep 0.12s so words never sound cut off.
TRIM_END = ("areverse,silenceremove=start_periods=1:start_threshold=-45dB:"
            "start_silence=0.12,areverse")

def decode(data, af=None, trim=True):
    cmd = ["ffmpeg", "-v", "error", "-i", "pipe:0"]
    chain = ",".join(x for x in (TRIM_END if trim else None, af) if x)
    if chain:
        cmd += ["-af", chain]
    cmd += ["-f", "s16le", "-ar", str(SR), "-ac", "1", "pipe:1"]
    out = subprocess.run(cmd, input=data, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.int16)

def load_sfx(name):
    for ext in ("wav", "mp3", "ogg"):
        p = os.path.join(SFX_DIR, f"{name}.{ext}")
        if os.path.exists(p):
            return decode(open(p, "rb").read(), trim=False)
    return None

TOKEN = re.compile(r"(\[[^\]]+\]|@\w+)")

async def main(script_path):
    name = script_path
    pcm, words, cursor = [], [], 0.0

    def add_audio(a):
        nonlocal cursor
        pcm.append(a); cursor += len(a) / SR

    def add_pause(sec):
        add_audio(silence(sec * PAUSE_SCALE))

    async def speak(text, style, voice, af):
        mp3, w = await synth(text, style, voice)
        if not mp3:
            return
        for x in w:
            words.append({"word": x["word"], "start": x["start"] + cursor,
                          "end": x["end"] + cursor})
        add_audio(decode(mp3, af))

    for n, raw in enumerate(open(script_path, encoding="utf-8"), 1):
        line = raw.strip()
        if not line:
            add_pause(0.3)
            continue
        style, voice = "normal", "narrator"
        for tok in TOKEN.split(line):
            if not tok or not tok.strip():
                continue
            if tok.startswith("@") and tok[1:].lower() in VOICES:
                voice = tok[1:].lower(); continue
            if tok.startswith("["):
                tag, _, arg = tok[1:-1].strip().lower().partition(":")
                if tag in STYLES:
                    style = tag
                elif tag == "pause" and arg:
                    add_pause(float(arg))
                elif tag in PAUSES:
                    add_pause(PAUSES[tag])
                elif tag in SOUNDS:
                    clip = load_sfx(tag)
                    if clip is not None:
                        add_audio(clip)
                    else:
                        txt, st = SOUNDS[tag]
                        await speak(txt, st, voice, STYLES[st][4])
                else:
                    warn(f"line {n}: unknown tag {tok}")
                continue
            await speak(tok.strip(), style, voice, STYLES[style][4])
        add_pause(STYLES[style][3])      # pause after the line, based on last style

    full = np.concatenate(pcm)
    with wave.open(f"{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(full.tobytes())
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", f"{name}.wav",
                    "-b:a", "192k", f"{name}.mp3"], check=True)
    if not words:
        warn("no word timings came back, so the .srt will be empty")
    with open(f"{name}.srt", "w", encoding="utf-8") as f:
        for i, x in enumerate(words, 1):
            f.write(f"{i}\n{ts(x['start'])} --> {ts(x['end'])}\n{x['word']}\n\n")
    json.dump(words, open(f"{name}_words.json", "w"))
    print(f"done: {name}.mp3 + {name}.srt, length {len(full) / SR:.1f}s")

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
