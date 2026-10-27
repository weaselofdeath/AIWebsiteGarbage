import re,sys,collections
G=sys.argv[1]; T=sys.argv[2].split(',')
lines=open(G+'/decomp.txt',encoding='utf-8').read().split('\n')
def args(s,i):
    depth=0;cur='';out=[]
    while i<len(s):
        c=s[i]
        if c=='(' :depth+=1
        if c==')':
            if depth==0: out.append(cur.strip()); return out
            depth-=1
        if c==',' and depth==0: out.append(cur.strip()); cur=''
        else: cur+=c
        i+=1
    return out
for t in T:
    use=collections.defaultdict(collections.Counter)
    for ln in lines:
        path,_,ex=ln.partition(' :: ')
        for m in re.finditer(rf'\b{t}\.At\(',ex):
            a=args(ex,m.end())
            if len(a)>=2 and a[1].isdigit():
                use[int(a[1])][path.split('/')[-1]]+=1
    print('=====',t)
    for c in sorted(use): print(f'  c{c}:',', '.join(f'{k}({v})' for k,v in use[c].most_common(6)))
