# Recording the demo GIF

The README references `docs/demo.gif`. Until it exists, the README shows a placeholder.

## Suggested 6–10 second sequence

1. Scroll past 1–2 tweets on `x.com`; auto-translation appears under each.
2. Click **🤖 Explain** on one tweet — bullet summary renders.
3. Open the **Persona** dropdown, pick **Tech Founder**.
4. Click **✍️**, type a one-line prompt, press <kbd>Enter</kbd> — reply renders.
5. Click **Tweet** — native reply box opens with text inserted.

## Recording

Anything that produces a small GIF works. A clean baseline:

```bash
# Record a quick screen capture (macOS)
osascript -e 'tell application "QuickTime Player" to start (new screen recording)'

# Convert .mov → .gif (≤900 px wide, ≤4 MB) with ffmpeg + gifski
ffmpeg -i recording.mov -vf "fps=18,scale=900:-1:flags=lanczos" -f rawvideo -pix_fmt rgba - \
  | gifski -o docs/demo.gif --fps 18 --width 900 --quality 85 -
```

Keep it under 4 MB so GitHub's README renders it inline. After saving, replace the `[ TODO: demo.gif ]` placeholder in `README.md` with:

```markdown
![TweAI demo](docs/demo.gif)
```
