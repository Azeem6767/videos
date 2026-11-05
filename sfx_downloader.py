#!/usr/bin/env python3
"""
ElevenLabs SFX Downloader
- Single tab: describe a sound, pick length with a slider, name the file, generate.
- Mass tab: paste/load lots of lines, generate them all (with variations).
Only needs Python 3 + tkinter (no pip packages, no venv).
Linux Mint: sudo apt install python3-tk
"""
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

API_URL = "https://api.elevenlabs.io/v1/sound-generation"
OUTPUT_FORMAT = "mp3_44100_128"
CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".sfx_downloader.json")
MIN_DUR, MAX_DUR = 0.5, 22.0


# ----------------------------------------------------------------- helpers
def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(cfg):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f)
        try:
            os.chmod(CONFIG_PATH, 0o600)
        except Exception:
            pass
    except Exception:
        pass


def safe_name(name):
    name = re.sub(r"[^\w\-. ]+", "", name, flags=re.UNICODE).strip()
    name = re.sub(r"\s+", "_", name)
    if name.lower().endswith(".mp3"):
        name = name[:-4]
    return name[:80] or "sfx"


def unique_path(folder, base):
    path = os.path.join(folder, base + ".mp3")
    n = 2
    while os.path.exists(path):
        path = os.path.join(folder, f"{base}_{n}.mp3")
        n += 1
    return path


def open_folder(path):
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
    except Exception:
        pass


class ApiError(Exception):
    pass


def generate_sfx(api_key, text, duration, influence, stop_event=None):
    """Returns mp3 bytes. duration=None -> let ElevenLabs choose."""
    body = {"text": text, "prompt_influence": influence}
    if duration is not None:
        body["duration_seconds"] = round(max(MIN_DUR, min(MAX_DUR, duration)), 1)
    data = json.dumps(body).encode("utf-8")

    last_err = "unknown error"
    for attempt in range(5):
        if stop_event is not None and stop_event.is_set():
            raise ApiError("stopped")
        req = urllib.request.Request(
            f"{API_URL}?output_format={OUTPUT_FORMAT}",
            data=data,
            method="POST",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            try:
                detail = e.read().decode("utf-8", "replace")[:300]
            except Exception:
                detail = ""
            last_err = f"HTTP {e.code} {detail}"
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 * (attempt + 1))  # back off and retry
                continue
            if e.code == 401:
                raise ApiError("401 - API key rejected (check it / its permissions)")
            raise ApiError(last_err)
        except Exception as e:  # network hiccup
            last_err = str(e)
            time.sleep(2 * (attempt + 1))
    raise ApiError(last_err)


def parse_lines(text, default_dur):
    """Line formats:  description
                      filename | description
                      filename | description | seconds"""
    jobs = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        dur = default_dur
        if len(parts) == 1:
            name, desc = None, parts[0]
        else:
            name, desc = parts[0], parts[1]
            if len(parts) >= 3:
                try:
                    dur = float(parts[2])
                except ValueError:
                    pass
        if not desc:
            continue
        jobs.append((name or desc[:40], desc, dur))
    return jobs


# --------------------------------------------------------------------- app
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ElevenLabs SFX Downloader")
        self.geometry("760x760")
        self.minsize(680, 640)
        self.cfg = load_config()
        self.q = queue.Queue()
        self.stop_event = threading.Event()
        self.busy = False

        self.api_var = tk.StringVar(value=self.cfg.get("api_key") or os.environ.get("ELEVENLABS_API_KEY", ""))
        self.folder_var = tk.StringVar(value=self.cfg.get("folder") or os.path.join(os.path.expanduser("~"), "sfx"))
        self.influence_var = tk.DoubleVar(value=float(self.cfg.get("influence", 0.3)))

        self._build_top()
        self._build_tabs()
        self._build_log()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.after(100, self._poll)

    # ---- layout
    def _build_top(self):
        f = ttk.LabelFrame(self, text="Setup")
        f.pack(fill="x", padx=10, pady=(10, 4))
        f.columnconfigure(1, weight=1)

        ttk.Label(f, text="API key").grid(row=0, column=0, sticky="w", padx=6, pady=4)
        self.api_entry = ttk.Entry(f, textvariable=self.api_var, show="*")
        self.api_entry.grid(row=0, column=1, sticky="ew", padx=6)
        self.show_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(f, text="show", variable=self.show_var, command=self._toggle_key).grid(row=0, column=2, padx=6)

        ttk.Label(f, text="Save to").grid(row=1, column=0, sticky="w", padx=6, pady=4)
        ttk.Entry(f, textvariable=self.folder_var).grid(row=1, column=1, sticky="ew", padx=6)
        bf = ttk.Frame(f)
        bf.grid(row=1, column=2, padx=6)
        ttk.Button(bf, text="Browse", command=self._browse).pack(side="left")
        ttk.Button(bf, text="Open", command=lambda: self._open_out()).pack(side="left", padx=(4, 0))

        ttk.Label(f, text="Prompt influence").grid(row=2, column=0, sticky="w", padx=6, pady=4)
        tk.Scale(f, from_=0.0, to=1.0, resolution=0.05, orient="horizontal", variable=self.influence_var).grid(
            row=2, column=1, sticky="ew", padx=6
        )
        ttk.Label(f, text="higher = sticks closer to your text").grid(row=2, column=2, padx=6)

    def _build_tabs(self):
        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=10, pady=4)

        # ----- single
        t1 = ttk.Frame(nb)
        nb.add(t1, text="  Single SFX  ")
        t1.columnconfigure(0, weight=1)

        ttk.Label(t1, text="Describe the sound you want:").grid(row=0, column=0, sticky="w", padx=8, pady=(8, 2))
        self.desc_text = tk.Text(t1, height=5, wrap="word")
        self.desc_text.grid(row=1, column=0, sticky="ew", padx=8)

        ttk.Label(t1, text="Length (seconds):").grid(row=2, column=0, sticky="w", padx=8, pady=(10, 0))
        self.single_dur = tk.DoubleVar(value=float(self.cfg.get("single_dur", 2.0)))
        self.single_auto = tk.BooleanVar(value=False)
        self.single_scale = tk.Scale(
            t1, from_=MIN_DUR, to=MAX_DUR, resolution=0.1, orient="horizontal", variable=self.single_dur
        )
        self.single_scale.grid(row=3, column=0, sticky="ew", padx=8)
        ttk.Checkbutton(
            t1,
            text="Auto length (let ElevenLabs decide)",
            variable=self.single_auto,
            command=lambda: self._toggle_scale(self.single_auto, self.single_scale),
        ).grid(row=4, column=0, sticky="w", padx=8)

        ttk.Label(t1, text="File name (without .mp3, blank = made from description):").grid(
            row=5, column=0, sticky="w", padx=8, pady=(10, 2)
        )
        self.name_var = tk.StringVar()
        ttk.Entry(t1, textvariable=self.name_var).grid(row=6, column=0, sticky="ew", padx=8)

        self.single_btn = ttk.Button(t1, text="Generate & Save", command=self._run_single)
        self.single_btn.grid(row=7, column=0, pady=14)

        # ----- mass
        t2 = ttk.Frame(nb)
        nb.add(t2, text="  Mass Download  ")
        t2.columnconfigure(0, weight=1)
        t2.rowconfigure(2, weight=1)

        ttk.Label(
            t2,
            text="One SFX per line. Formats:\n"
            "  description\n"
            "  filename | description\n"
            "  filename | description | seconds        (lines starting with # are ignored)",
            justify="left",
        ).grid(row=0, column=0, sticky="w", padx=8, pady=(8, 2))

        opt = ttk.Frame(t2)
        opt.grid(row=1, column=0, sticky="ew", padx=8)
        opt.columnconfigure(1, weight=1)
        ttk.Label(opt, text="Default length").grid(row=0, column=0, sticky="w")
        self.mass_dur = tk.DoubleVar(value=float(self.cfg.get("mass_dur", 2.0)))
        self.mass_auto = tk.BooleanVar(value=False)
        self.mass_scale = tk.Scale(opt, from_=MIN_DUR, to=MAX_DUR, resolution=0.1, orient="horizontal", variable=self.mass_dur)
        self.mass_scale.grid(row=0, column=1, sticky="ew", padx=6)
        ttk.Checkbutton(
            opt,
            text="Auto",
            variable=self.mass_auto,
            command=lambda: self._toggle_scale(self.mass_auto, self.mass_scale),
        ).grid(row=0, column=2)
        ttk.Label(opt, text="Variations per line").grid(row=1, column=0, sticky="w")
        self.var_count = tk.IntVar(value=1)
        ttk.Spinbox(opt, from_=1, to=10, width=5, textvariable=self.var_count).grid(row=1, column=1, sticky="w", padx=6)

        self.mass_text = tk.Text(t2, height=10, wrap="none")
        self.mass_text.grid(row=2, column=0, sticky="nsew", padx=8, pady=6)

        bf = ttk.Frame(t2)
        bf.grid(row=3, column=0, pady=(0, 8))
        ttk.Button(bf, text="Load .txt", command=self._load_txt).pack(side="left", padx=4)
        self.mass_btn = ttk.Button(bf, text="Start Mass Download", command=self._run_mass)
        self.mass_btn.pack(side="left", padx=4)
        self.stop_btn = ttk.Button(bf, text="Stop", command=self._stop, state="disabled")
        self.stop_btn.pack(side="left", padx=4)

        self.progress = ttk.Progressbar(t2, mode="determinate")
        self.progress.grid(row=4, column=0, sticky="ew", padx=8, pady=(0, 8))

    def _build_log(self):
        f = ttk.LabelFrame(self, text="Log")
        f.pack(fill="both", expand=False, padx=10, pady=(4, 10))
        self.log_box = tk.Text(f, height=8, wrap="word", state="disabled")
        self.log_box.pack(fill="both", expand=True, padx=4, pady=4)

    # ---- small UI actions
    def _toggle_key(self):
        self.api_entry.config(show="" if self.show_var.get() else "*")

    def _toggle_scale(self, auto_var, scale):
        scale.config(state="disabled" if auto_var.get() else "normal")

    def _browse(self):
        d = filedialog.askdirectory(initialdir=self.folder_var.get() or os.path.expanduser("~"))
        if d:
            self.folder_var.set(d)

    def _open_out(self):
        folder = self.folder_var.get().strip()
        if folder:
            os.makedirs(folder, exist_ok=True)
            open_folder(folder)

    def _load_txt(self):
        p = filedialog.askopenfilename(filetypes=[("Text files", "*.txt"), ("All files", "*.*")])
        if p:
            try:
                with open(p, "r", encoding="utf-8") as f:
                    self.mass_text.delete("1.0", "end")
                    self.mass_text.insert("1.0", f.read())
            except Exception as e:
                messagebox.showerror("Error", str(e))

    def log(self, msg):
        self.log_box.config(state="normal")
        self.log_box.insert("end", msg + "\n")
        self.log_box.see("end")
        self.log_box.config(state="disabled")

    def _set_busy(self, busy):
        self.busy = busy
        st = "disabled" if busy else "normal"
        self.single_btn.config(state=st)
        self.mass_btn.config(state=st)
        self.stop_btn.config(state="normal" if busy else "disabled")

    def _save_cfg(self):
        self.cfg.update(
            {
                "api_key": self.api_var.get().strip(),
                "folder": self.folder_var.get().strip(),
                "influence": self.influence_var.get(),
                "single_dur": self.single_dur.get(),
                "mass_dur": self.mass_dur.get(),
            }
        )
        save_config(self.cfg)

    def _on_close(self):
        self._save_cfg()
        self.stop_event.set()
        self.destroy()

    def _check_ready(self):
        if not self.api_var.get().strip():
            messagebox.showwarning("Missing", "Paste your ElevenLabs API key first.")
            return None
        folder = self.folder_var.get().strip()
        if not folder:
            messagebox.showwarning("Missing", "Pick a save folder.")
            return None
        try:
            os.makedirs(folder, exist_ok=True)
        except Exception as e:
            messagebox.showerror("Folder error", str(e))
            return None
        return folder

    # ---- single
    def _run_single(self):
        if self.busy:
            return
        desc = self.desc_text.get("1.0", "end").strip()
        if not desc:
            messagebox.showwarning("Missing", "Describe the sound first.")
            return
        folder = self._check_ready()
        if not folder:
            return
        self._save_cfg()
        dur = None if self.single_auto.get() else self.single_dur.get()
        name = safe_name(self.name_var.get().strip() or desc[:40])
        key = self.api_var.get().strip()
        infl = self.influence_var.get()
        self.stop_event.clear()
        self._set_busy(True)
        self.progress.config(mode="indeterminate")
        self.progress.start(15)
        threading.Thread(target=self._single_worker, args=(key, desc, dur, infl, folder, name), daemon=True).start()

    def _single_worker(self, key, desc, dur, infl, folder, name):
        try:
            self.q.put(("log", f"Generating: {desc[:60]}..."))
            audio = generate_sfx(key, desc, dur, infl, self.stop_event)
            path = unique_path(folder, name)
            with open(path, "wb") as f:
                f.write(audio)
            self.q.put(("log", f"Saved: {path}"))
        except Exception as e:
            self.q.put(("log", f"ERROR: {e}"))
        self.q.put(("done", "single"))

    # ---- mass
    def _run_mass(self):
        if self.busy:
            return
        folder = self._check_ready()
        if not folder:
            return
        default_dur = None if self.mass_auto.get() else self.mass_dur.get()
        jobs = parse_lines(self.mass_text.get("1.0", "end"), default_dur)
        if not jobs:
            messagebox.showwarning("Empty", "Add some lines first.")
            return
        n_var = max(1, int(self.var_count.get() or 1))
        total = len(jobs) * n_var
        if total > 20 and not messagebox.askyesno(
            "Heads up", f"This will make {total} sounds and spend ElevenLabs credits on each one. Continue?"
        ):
            return
        self._save_cfg()
        self.stop_event.clear()
        self._set_busy(True)
        self.progress.stop()
        self.progress.config(mode="determinate", maximum=total, value=0)
        key = self.api_var.get().strip()
        infl = self.influence_var.get()
        threading.Thread(target=self._mass_worker, args=(key, jobs, n_var, infl, folder), daemon=True).start()

    def _mass_worker(self, key, jobs, n_var, infl, folder):
        total = len(jobs) * n_var
        done = ok = 0
        for name, desc, dur in jobs:
            base = safe_name(name)
            for v in range(1, n_var + 1):
                if self.stop_event.is_set():
                    self.q.put(("log", "Stopped."))
                    self.q.put(("done", "mass"))
                    return
                fname = base if n_var == 1 else f"{base}_v{v}"
                try:
                    audio = generate_sfx(key, desc, dur, infl, self.stop_event)
                    path = unique_path(folder, fname)
                    with open(path, "wb") as f:
                        f.write(audio)
                    ok += 1
                    self.q.put(("log", f"[{done + 1}/{total}] saved {os.path.basename(path)}"))
                except Exception as e:
                    self.q.put(("log", f"[{done + 1}/{total}] FAILED '{desc[:40]}': {e}"))
                    if "401" in str(e):  # bad key: no point continuing
                        self.q.put(("done", "mass"))
                        return
                done += 1
                self.q.put(("progress", done))
                time.sleep(0.3)
        self.q.put(("log", f"Finished: {ok}/{total} saved."))
        self.q.put(("done", "mass"))

    def _stop(self):
        self.stop_event.set()

    # ---- queue polling (keeps the UI thread-safe)
    def _poll(self):
        try:
            while True:
                kind, payload = self.q.get_nowait()
                if kind == "log":
                    self.log(payload)
                elif kind == "progress":
                    self.progress["value"] = payload
                elif kind == "done":
                    self.progress.stop()
                    self._set_busy(False)
        except queue.Empty:
            pass
        self.after(100, self._poll)


if __name__ == "__main__":
    App().mainloop()
