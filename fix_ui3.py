import re

with open('/Users/mac/go/src/emoji/frontweb/src/app/create/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make the page take full height and remove scroll from body if possible
# Or just let it fill the screen
# And change blue to emerald

content = content.replace('bg-blue-600', 'bg-emerald-600')
content = content.replace('bg-blue-700', 'bg-emerald-700')
content = content.replace('text-blue-600', 'text-emerald-600')
content = content.replace('text-blue-500', 'text-emerald-500')
content = content.replace('text-blue-700', 'text-emerald-700')
content = content.replace('text-blue-800', 'text-emerald-800')
content = content.replace('text-blue-100', 'text-emerald-100')
content = content.replace('bg-blue-50', 'bg-emerald-50')
content = content.replace('bg-blue-100', 'bg-emerald-100')
content = content.replace('bg-blue-200', 'bg-emerald-200')
content = content.replace('border-blue-500', 'border-emerald-500')
content = content.replace('border-blue-300', 'border-emerald-300')
content = content.replace('border-blue-200', 'border-emerald-200')
content = content.replace('border-blue-100', 'border-emerald-100')
content = content.replace('ring-blue-500', 'ring-emerald-500')

with open('/Users/mac/go/src/emoji/frontweb/src/app/create/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
