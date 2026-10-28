# Wraps the artifact page (site/index.html) into the standalone document hosted on GitHub Pages.
import sys
art, hosted, out = sys.argv[1:4]
a = open(art, encoding='utf-8').read().splitlines()
h = open(hosted, encoding='utf-8').read().splitlines()
head = h[:next(i for i, l in enumerate(h) if l.startswith('/* Layout: lacquered'))]
body = a[next(i for i, l in enumerate(a) if l.startswith('/* Layout: lacquered')):]
k = body.index('</style>')
res = head + body[:k + 1] + ['', '</head>', '<body>'] + body[k + 1:] + ['', '</body>', '</html>', '']
open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(res))
