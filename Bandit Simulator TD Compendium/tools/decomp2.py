# Structured decompiler: renders event blocks as an indented tree of conditions,
# actions and sub-events, with ACE names from C3_GetObjectRefTable and every
# expression parameter rendered as text.
# usage: decomp2.py <gamedir> <path-substring> [maxlen]
import json, re, sys

G, FILT = sys.argv[1], sys.argv[2]
MAXLEN = int(sys.argv[3]) if len(sys.argv) > 3 else 100000
s = open(G + '/scripts/c3runtime.js', encoding='utf-8').read()

i = s.rfind('self.C3_ExpressionFuncs = [')
body = s[i:s.find('\n];', i)]
starts = [m.start() for m in re.finditer(r'\n\t\t(?:\(\) =>|p => \{)', body)]
funcs = [body[a + 1:b] for a, b in zip(starts, starts[1:] + [len(body)])]

i = s.find('self.C3_GetObjectRefTable = function () {')
ref = re.findall(r'\n\t\t(C3\.[\w.]+)', s[i:s.find('\n\t];', i)])
def ace(k):
	n = ref[k] if 0 <= k < len(ref) else f'ace{k}'
	return re.sub(r'^C3\.(Plugins|Behaviors)\.', '', n).replace('.Cnds.', '.').replace('.Acts.', '.').replace('.Exps.', '.')

P = json.load(open(G + '/data.json', encoding='utf-8'))['project']
ot = [o[0] for o in P[3]]
def obj(k):
	return 'System' if k == -1 else (ot[k] if 0 <= k < len(ot) else f'obj{k}')

sid = {}
def scan(x):
	if isinstance(x, list):
		if len(x) >= 7 and x[0] in (0, 1) and isinstance(x[1], str) and isinstance(x[6], int) and x[6] > 10**9:
			sid[x[6]] = x[1]
		for y in x: scan(y)
scan(P[6])
# instance variable names per object type: P[3][o][3] = [[sid, type, name, ...]]
ivars = {k: [v[2] for v in (o[3] or [])] for k, o in enumerate(P[3]) if isinstance(o[3], list)}

def render(e):
	idx, nodes = e[0], e[1:]
	f = funcs[idx]
	m = re.search(r'return \(\) => (.*?);\n\t\t\}$', f, re.S) or re.search(r'\(\) => (.*?),?$', f, re.S)
	expr = m.group(1).strip().rstrip(',') if m else f
	for k, n in enumerate(nodes):
		if n[0] == 1:
			name = obj(n[1]) + '.' + ace(n[2]).split('.')[-1]
		elif n[0] == 2:
			name = obj(n[1]) + '.' + ace(n[3]).split('.')[-1] if len(n) > 3 else f'beh{n}'
		elif n[0] == 3:
			name = sid.get(n[1], f'var{n[1]}')
		elif n[0] == 5:
			name = 'Fn:' + str(n[1])
		else:
			name = f'N{n}'
		expr = re.sub(rf'\b[nvf]{k}\.(ExpObject|ExpInstVar|GetValue|ExpBehavior)\(\)', name, expr)
		expr = re.sub(rf'\bn{k}\.ExpObject\(', name + '(', expr)
		expr = re.sub(rf'\b[nvf]{k}\.(\w+)\(', name + r'.\1(', expr)
		expr = re.sub(rf'\bf{k}\(', name + '(', expr)
	return re.sub(r';\s*\}\s*$', '', expr.replace('\n', ' ')).strip()

CMP = ['=', '≠', '<', '≤', '>', '≥']
def param(p, o):
	t, v = p[0], p[1]
	if isinstance(v, list) and v and isinstance(v[0], int) and t in (0, 1, 2, 5, 6, 7, 15):
		try: return render(v)
		except Exception as ex: return f'ERR{ex}'
	if t == 4: return obj(v)
	if t == 8: return CMP[v] if 0 <= v < 6 else f'cmp{v}'
	if t == 10:
		names = ivars.get(o, [])
		return names[v] if 0 <= v < len(names) else f'iv{v}'
	if t == 11: return sid.get(v, f'var{v}')
	return json.dumps(v, ensure_ascii=False)

def params(ps, o):
	return ', '.join(param(p, o) for p in (ps or []))

def cond(c):
	o = c[0]
	inv = 'NOT ' if len(c) > 5 and c[5] is True else ''
	return f'{inv}{obj(o)}.{ace(c[1]).split(".")[-1]}({params(c[9] if len(c) > 9 else None, o)})'

def act(a):
	if a[0] == -2:
		return f'call {a[1]}({params(a[6] if len(a) > 6 else None, None)})'
	if a[0] == -3 or not isinstance(a[1], int):
		return 'script ' + json.dumps(a, ensure_ascii=False)[:200]
	return f'{obj(a[0])}.{ace(a[1]).split(".")[-1]}({params(a[6] if len(a) > 6 else None, a[0])})'

out = []
def line(depth, text):
	out.append('  ' * depth + (text if len(text) <= MAXLEN else text[:MAXLEN] + '…'))

def event(x, depth):
	k = x[0]
	if k == 1:  # variable
		line(depth, f'var {x[1]} = {json.dumps(x[3], ensure_ascii=False)}')
		return
	if k == 2:
		line(depth, f'include {x[1]}')
		return
	if k == 3:  # group
		line(depth, f'group "{x[1][1]}"')
		for y in x[8] if len(x) > 8 and isinstance(x[8], list) else []:
			event(y, depth + 1)
		return
	if k == 4:
		h = x[1]
		ps = ', '.join(p[1] for p in h[2]) if isinstance(h[2], list) else ''
		line(depth, f'function {h[0]}({ps})')
	conds = x[6] if len(x) > 6 else []
	acts = x[7] if len(x) > 7 else []
	subs = x[8] if len(x) > 8 else []
	if k == 0:
		isor = x[2] is True
		line(depth, ('if ANY ' if isor else 'if ') + (' & '.join(cond(c) for c in conds) if conds else '(else/always)'))
	for a in acts or []:
		line(depth + 1, '→ ' + act(a))
	for y in subs or []:
		event(y, depth + 1)

def find(x, path):
	if not isinstance(x, list) or not x:
		return
	if x[0] == 3 and len(x) > 8 and isinstance(x[1], list):
		p = path + '/' + str(x[1][1])
		if FILT in p:
			out.append(f'### {p}')
			event(x, 0)
			return
		for y in x[8] or []:
			find(y, p)
	elif x[0] == 4 and isinstance(x[1], list) and FILT in path + '/' + str(x[1][0]):
		out.append(f'### {path}')
		event(x, 0)
	elif x[0] == 0 and len(x) > 8 and isinstance(x[8], list):
		for y in x[8]:
			find(y, path)

for sh in P[6]:
	for y in sh[1]:
		find(y, sh[0])
sys.stdout.reconfigure(encoding='utf-8')
print('\n'.join(out))
