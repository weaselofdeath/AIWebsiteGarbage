# Rough decompiler: renders every event-sheet expression as readable text, one per line, with event path context.
import json,re,sys
G=sys.argv[1]
s=open(G+'/scripts/c3runtime.js',encoding='utf-8').read()
i=s.rfind('self.C3_ExpressionFuncs = [')
body=s[i:s.find('\n];',i)]
starts=[m.start() for m in re.finditer(r'\n\t\t(?:\(\) =>|p => \{)',body)]
funcs=[body[a+1:b] for a,b in zip(starts,starts[1:]+[len(body)])]
print('funcs',len(funcs),file=sys.stderr)
d=json.load(open(G+'/data.json',encoding='utf-8'))
P=d['project']
ot=[o[0] for o in P[3]]
# variable SID -> name: any list like [1,name,type,init,...,sid,...] ; collect [1|0, str, int, ..., sid]
sid={}
def scan(x):
    if isinstance(x,list):
        if len(x)>=7 and x[0] in (0,1) and isinstance(x[1],str) and isinstance(x[6],int) and x[6]>10**9:
            sid[x[6]]=x[1]
        for y in x: scan(y)
scan(P[6])
# local vars inside function params also use [1,name,0,0,false,false,sid,false,n]
def render(e):
    idx=e[0]; nodes=e[1:]
    f=funcs[idx]
    m=re.search(r'return \(\) => (.*?);\n\t\t\}$',f,re.S) or re.search(r'\(\) => (.*?),?$',f,re.S)
    expr=m.group(1).strip().rstrip(',') if m else f
    for k,n in enumerate(nodes):
        if n[0]==1: name=ot[n[1]] if n[1]<len(ot) else f'obj{n[1]}'
        elif n[0]==3: name=sid.get(n[1],f'var{n[1]}')
        elif n[0]==5: name='Fn:'+str(n[1])
        else: name=f'N{n}'
        expr=re.sub(rf'\b[nvf]{k}\.(ExpObject|ExpInstVar|GetValue|ExpBehavior)\(\)',name+('' if n[0]!=1 else '.'+'X'),expr)
        expr=re.sub(rf'\bn{k}\.ExpObject\(',name+'.At(',expr)
        expr=re.sub(rf'\b[nvf]{k}\.(\w+)\(',name+r'.\1(',expr)
        expr=re.sub(rf'\bf{k}\(',name+'(',expr)
    return expr
out=[]
def walk(x,path):
    if isinstance(x,list):
        if len(x)==2 and x[0]==7 and isinstance(x[1],list) and x[1] and isinstance(x[1][0],int):
            try: out.append(path+' :: '+render(x[1]))
            except Exception as ex: out.append(path+' :: ERR '+str(ex))
            return
        # group/function names for context
        newp=path
        if len(x)>=2 and x[0] in (3,4) and isinstance(x[1],list) and x[1] and isinstance(x[1][1] if x[0]==3 else x[1][0],str):
            newp=path+'/'+(x[1][1] if x[0]==3 else x[1][0])
        for y in x: walk(y,newp)
for sh in P[6]: walk(sh[1],sh[0])
open(G+'/decomp.txt','w',encoding='utf-8').write('\n'.join(out))
print(len(out),file=sys.stderr)
