import sys
text = sys.stdin.read()
# Remove lines matching agent co-authors
lines = text.split('\n')
filtered = [l for l in lines if not (
    l.startswith('Co-authored-by: Copilot') or
    l.startswith('Co-Authored-By: Claude') or
    l.startswith('Co-authored-by: copilot-swe-agent')
)]
sys.stdout.write('\n'.join(filtered))
