import re

with open('/Users/mac/go/src/emoji/frontweb/src/app/create/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to hide the footer. Since the footer is in layout.tsx, and we can't easily conditionally hide it from a page component without context or passing props, the standard way in Next.js App Router to hide a layout component on a specific route is to use Route Groups or a separate layout.
# Alternatively, we can make the page absolutely positioned and overlay the footer, or set its height to calc(100vh - headerHeight) and overflow hidden on body.
# Easiest way to hide footer just for this page without changing layout:
# We can just add a global style inside this page.

style_block = """
      <style dangerouslySetInnerHTML={{ __html: `
        footer { display: none !important; }
        body { overflow: hidden; }
      `}} />
"""

# Insert right after `return (`
idx = content.find('return (')
if idx != -1:
    idx += len('return (')
    content = content[:idx] + style_block + content[idx:]

with open('/Users/mac/go/src/emoji/frontweb/src/app/create/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
