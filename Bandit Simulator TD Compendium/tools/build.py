# Builds site/compendium.json + icon atlases from the extracted game tables.
# Usage: python -I -X utf8 build.py <game_dir> <site_dir>
import json, math, re, sys, os
from PIL import Image

G, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def T(name):
    d = json.load(open(f'{G}/{name}.json', encoding='utf-8-sig'))['data']
    return [[(c[0] if len(c) == 1 else c) for c in r] for r in d]

LAU = {r[1]: r[2] for r in T('lau')[1:] if isinstance(r[1], str)}

# Strings the game never localized (translated by hand).
MANUAL = {
 # achievements
 '占山为王':'King of the Mountain','连城之势':'Linked Cities','威震邻城':'Feared by Neighbors','雄踞一方':'Regional Power','纵横九州':'Across the Nine Provinces','天下一统':'Unify the Realm',
 '割据一方':'Warlord','开疆拓土':'Expand the Frontier','虎踞龙盘':'Crouching Tiger','纵横天下':'Roam the World','威震四方':'Renowned Everywhere',
 '草创山寨':'Humble Hideout','寨门初盛':'Growing Stronghold','山寨扩张':'Stronghold Expansion','雄踞山林':'Lord of the Forest','兵强马壮':'Strong Army',
 '名士来投':'Notables Arrive','人才济济':'Wealth of Talent','群英聚义':'Gathering of Heroes','英雄满堂':'Hall of Heroes','群星云集':'Constellation of Stars','天下群英':'Heroes of the Realm',
 '初识套装':'First Set','百战衣冠':'Battle Attire','甲胄如云':'Sea of Armor','武备齐全':'Fully Armed','锦绣武库':'Splendid Armory','披挂成军':'Armored Legion',
 '初识丹道':'Alchemy Novice','丹道入门':'Alchemy Initiate','丹道有成':'Alchemy Adept','丹道精深':'Alchemy Expert','丹道通玄':'Alchemy Mystic','丹道大成':'Alchemy Master',
 '初获至宝':'First Treasure','琳琅满目':'Dazzling Hoard','珍宝如林':'Forest of Treasures','奇珍满库':'Vault of Wonders','异宝争辉':'Rival Treasures','万宝归藏':'All Treasures Gathered',
 '初窥门径':'First Steps','博采众长':'Jack of All Trades','兼修诸艺':'Many Disciplines','融会贯通':'Mastery Integrated','触类旁通':'Broad Insight','万法归宗':'All Paths as One',
 '初入魂塔':'Enter the Soul Tower','百魂退散':'Hundred Souls Banished','千魂辟易':'Thousand Souls Repelled','群魂俯首':'Souls Bow Down','镇压群魂':'Soul Suppressor','万魂之巅':'Peak of the Soul Tower',
 '筑基立道':'Foundation Laid','金丹初成':'Golden Core Formed','元婴出世':'Nascent Soul Born','化神入圣':'Spirit Transformation','炼虚悟道':'Void Refinement','合体归一':'Body Integration','大乘圆满':'Great Ascension','渡劫涅槃':'Tribulation Rebirth',
 '占领城市':'Conquest','占领城市数量':'Cities captured','解锁名将':'Heroes','解锁名将数量':'Heroes unlocked','解锁套装':'Sets','解锁套装数量':'Set pieces unlocked',
 '解锁内丹':'Cores','解锁内丹数量':'Cores unlocked','解锁宝物':'Treasures','解锁宝物数量':'Treasures unlocked','解锁职业':'Classes','解锁职业数量':'Classes unlocked',
 '万魂塔':'Soul Tower','万魂塔通关层数':'Soul Tower floors cleared','山寨扩张等级':'Stronghold level','角色渡劫':'Tribulation','角色渡劫境界':'Heroes at realm',
 # materials
 '一阶兽丹':'Beast Pill T1','二阶兽丹':'Beast Pill T2','三阶兽丹':'Beast Pill T3','四阶兽丹':'Beast Pill T4','五阶兽丹':'Beast Pill T5','六阶兽丹':'Beast Pill T6','七阶兽丹':'Beast Pill T7','八阶兽丹':'Beast Pill T8','九阶兽丹':'Beast Pill T9','十阶兽丹':'Beast Pill T10',
 '彼岸莲花':'Higanbana Lotus','混沌灵芝':'Chaos Lingzhi','辰泪兰':'Dawn-Tear Orchid','雾隐参':'Mist Ginseng',
 '<中毒>':'<Poison>','<破甲I>':'<Armor Break I>','<破甲II>':'<Armor Break II>','中毒':'Poison','减速':'Slow','眩晕':'Stun',
 '挑战':'Challenge','我方':'Ally','敌方':'Enemy','地面':'Ground','路径':'Path','挑战路径':'Challenge Path','特殊路径':'Special Path','自然':'Nature','聚魂塔':'Soul Gathering Tower',
 '制药额外加成':'Extra Brewing Bonus','自动召唤':'Auto Summon','自动挑战':'Auto Challenge','解锁装饰物建造':'Unlock Decorations',
 '灵器':'Spirit Relic','灵晶':'Spirit Crystal','灵木':'Spirit Wood','灵核':'Spirit Core','灵液':'Spirit Fluid','灵焰':'Spirit Flame','灵牙':'Spirit Fang','灵珠':'Spirit Pearl','灵甲':'Spirit Scale','灵纹':'Spirit Pattern','灵绒':'Spirit Down','灵绫':'Spirit Silk','灵羽':'Spirit Feather','灵鬃':'Spirit Mane',
 '前往':'Travel','图纸':'Blueprint','引导':'Tutorial','探索':'Explore','杀怪':'Slay','特殊招募':'Special Recruit',
 # facilities
 '教席':'Teaching Mat','木席':'Wooden Mat','秘法标靶':'Arcane Target','加固木靶':'Reinforced Target','铁箍桩人':'Iron-Banded Dummy','陪练假人':'Sparring Dummy','符文木桩':'Rune Post','星辰训练像':'Star Training Statue','影武者傀儡':'Shadow Puppet','虚空镜像体':'Void Mirror','不朽试炼桩':'Immortal Trial Post',
 '青铜火炉':'Bronze Furnace','粗铁熔炉':'Rough Iron Smelter','钢火锻炉':'Steelfire Forge','秘银熔炉':'Mithril Smelter','符文炽炉':'Rune Blaze Forge','星辰锻炉':'Star Forge','龙焰熔炉':'Dragonflame Smelter','秘银匠炉':'Mithril Smithy','星辰熔炼炉':'Star Smelter','创世神锻炉':'Genesis Forge',
 '简易工作桌':'Simple Workbench','精密木工桌':'Precision Workbench','加固工艺台':'Reinforced Craft Table','附魔工作台':'Enchanting Table','符文工艺桌':'Rune Craft Table','星辰刻造桌':'Star Carving Desk','大师精工台':'Master Craft Table','不朽者工坊':'Immortal Workshop','创世之工匠台':'Genesis Artisan Table',
 '青铜药鼎':'Bronze Cauldron','秘银丹炉':'Mithril Elixir Furnace','符文萃取釜':'Rune Extractor','流光煅烧炉':'Streamlight Kiln','元素反应釜':'Elemental Reactor','翡翠玲珑鼎':'Jade Cauldron','造化洪炉':'Creation Furnace','不朽药王鼎':'Immortal Medicine Cauldron',
 '青铜工棚':'Bronze Work Shed','粗铁工棚':'Rough Iron Shed','钢火工棚':'Steelfire Shed','秘银工棚':'Mithril Shed','符文工棚':'Rune Shed','星辰工棚':'Star Shed','龙焰工棚':'Dragonflame Shed','创世工棚':'Genesis Shed',
 '最高工艺等阶':'Max craft tier','最高建造等阶':'Max build tier','最高炼丹等阶':'Max alchemy tier','最高科技等阶':'Max tech tier','最高职业等级':'Max class level','最高锻造等阶':'Max forge tier',
 '树木类型':'Tree type','矿石类型':'Ore type','种植类型':'Crop type',
 # stat groups
 '基础攻击':'Base Attack','天资':'Aptitude','天资成长':'Aptitude Growth','战斗基础':'Combat Base','战斗附加':'Combat Bonus','收益加成':'Yield Bonus','生产力':'Work Power','生产基础':'Work Base','生产附加':'Work Bonus','资质上限':'Aptitude Cap',
 '法术系':'Spell','通用':'General','战斗型':'Combat','生产型':'Production','通用型':'General','战斗':'Combat','生产':'Production',
}
for t in range(2, 11):
    for a, b in (('林地', 'Woodland'), ('田地', 'Farmland'), ('矿场', 'Mine')):
        MANUAL[f'{t}阶{a}'] = f'Tier {t} {b}'
for k, b in (('研究', 'Study Mat'),):
    for t in range(1, 11):
        MANUAL.setdefault(f'{k}{t}', f'{b} {t}')

# Typos in the game's official English text.
TYPOS = [('WorK ', 'Work '), ('Strategem', 'Stratagem')]

def en(s):
    if not isinstance(s, str) or not s:
        return s
    v = LAU.get(s)
    if not (v and v != s):
        v = MANUAL.get(s, v or s)
    for a, b in TYPOS:
        v = v.replace(a, b)
    return v

def clean(s):  # strip BBCode tags used by the game
    return re.sub(r'\[/?(?:color|size)[^\]]*\]', '', s) if isinstance(s, str) else s

def rich(s):  # keep colour spans as simple markup for the page: {c:color|text}
    if not isinstance(s, str):
        return s
    s = re.sub(r'\[size=[^\]]*\]', '', s)
    return s

sx, mc, wp, cl, lw, tz, js, zy, jn, tf, dr, zddt = (T(n) for n in
    ['sx', 'mc', 'wp', 'cl', 'lw', 'tz', 'js', 'zy', 'jn', 'tf', 'dr', 'zddt'])
jz, ss, kj, rw, cj, buff, debuff = (T(n) for n in ['jz', 'ss', 'kj', 'rw', 'cj', 'buff', 'debuff'])

def M(col, i):
    try:
        v = mc[i][col]
    except (IndexError, TypeError):
        return ''
    return en(clean(v)) if v else ''

STAT_FMT = {'百分比': 'pct', '整数': 'int', '小数': 'dec', '倍率': 'mult'}
stats = {}
for r in sx[1:]:
    stats[r[0]] = dict(id=r[0], n=en(r[1]), cn=r[1], grp=en(r[2]), fmt=STAT_FMT.get(r[4], 'int'),
                       base=r[5], desc=clean(en(r[9])) if r[9] else '', scope=en(r[13]),
                       notes=[rich(x) for x in r[24:27] if x])

TIER = {i: M(14, i) for i in range(1, 10)}  # realm names (Qi Refining ... Tribulation)
SLOT = {i: M(16, i) for i in range(1, 7)}
DMG = {i: M(5, i) for i in range(0, 8)}
ELEM = {i: M(12, i) for i in range(0, 6)}
CLASSTYPE = {i: M(17, i) for i in range(1, 5)}
REGION = {i: M(9, i) for i in range(1, 12)}
HERO_RARITY = {0: 'Special', 1: 'Common', 2: 'Fine', 3: 'Elite', 4: 'Hero', 5: 'Legend', 6: 'Mythic'}
ITEM_QUALITY = {1: 'Mundane', 2: 'Fine', 3: 'Exquisite', 4: 'Peerless', 5: 'Legendary', 6: 'Mythic'}
SKILL_QUALITY = {1: 'Basic', 2: 'Intermediate', 3: 'Advanced', 4: 'Ultimate', 5: 'Divine'}
SKILL_TYPE = {'普攻': 'Basic attack', '技能': 'Active', '被动': 'Passive'}
CAT = {'普通': 'Equipment', '套装': 'Set piece', '宝物': 'Treasure', '内丹': 'Core', '普通丹药': 'Elixir'}
SKILLS9 = ['Chop', 'Mine', 'Farm', 'Forge', 'Craft', 'Alchemy', 'Build', 'Research', 'Drill']

# ---------- icons ----------
P = json.load(open(f'{G}/data.json', encoding='utf-8'))['project']
OT = {o[0]: o for o in P[3]}

def frames(objname):
    o = OT[objname]
    out = {}
    for a in o[7]:
        if isinstance(a, list) and a and isinstance(a[0], str) and len(a) > 7 and a[7]:
            out[a[0]] = a[7][0]
    return out

_sheets = {}
def crop(fr):
    path, x, y, w, h = fr[0], fr[2], fr[3], fr[4], fr[5]
    if path not in _sheets:
        _sheets[path] = Image.open(f'{G}/{path}').convert('RGBA')
    return _sheets[path].crop((x, y, x + w, y + h))

class Atlas:
    def __init__(self, name, cw, ch, cols, fit='contain', top=False):
        self.name, self.cw, self.ch, self.cols, self.fit, self.top = name, cw, ch, cols, fit, top
        self.imgs, self.index = [], {}
    def add(self, key, img):
        if key in self.index:
            return self.index[key]
        im = img.copy()
        if self.fit == 'cover':  # crop to aspect from the top (portraits: keep heads)
            tw, th = self.cw, self.ch
            s = max(tw / im.width, th / im.height)
            im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
            left = (im.width - tw) // 2
            im = im.crop((left, 0, left + tw, th))
        else:
            im.thumbnail((self.cw, self.ch), Image.LANCZOS)
        self.index[key] = len(self.imgs)
        self.imgs.append(im)
        return self.index[key]
    def save(self):
        n = len(self.imgs)
        rows = max(1, math.ceil(n / self.cols))
        sheet = Image.new('RGBA', (self.cols * self.cw, rows * self.ch), (0, 0, 0, 0))
        for i, im in enumerate(self.imgs):
            cx, cy = (i % self.cols) * self.cw, (i // self.cols) * self.ch
            sheet.paste(im, (cx + (self.cw - im.width) // 2, cy + (self.ch - im.height) // 2), im)
        sheet.save(f'{OUT}/{self.name}.webp', 'WEBP', quality=82, method=6)
        return dict(file=f'{self.name}.webp', cw=self.cw, ch=self.ch, cols=self.cols, rows=rows)

A_ICON = Atlas('icons', 64, 64, 32)
A_HERO = Atlas('portraits', 96, 120, 20, fit='cover')
A_FOE = Atlas('foes', 80, 80, 20)

F_ITEM, F_RES, F_HERO, F_FOE = frames('物品图标'), frames('资源图标'), frames('角色形象'), frames('敌人形象')
F_CLASS, F_SKILL, F_BUFF, F_LOC = frames('职业图标'), frames('技能图标'), frames('buff图标'), frames('地点图标')
F_BLD = frames('地图建筑')

def icon(fr_map, key, atlas=A_ICON):
    fr = fr_map.get(key) if key not in (None, '') else None
    if not fr:
        return None
    try:
        return atlas.add(f'{id(fr_map)}:{key}', crop(fr))
    except Exception:
        return None

# ---------- items ----------
def craft_mats(r):
    t, slot = r[3], r[6]
    if slot in (1, 2):
        ids = [1 + t // 2, 11 + (t + 1) // 2 - 1]
    else:
        ids = [11 + t // 2, 21 + (t + 1) // 2 - 1]
    return [i for i in ids if 0 < i < len(cl)]

lw_by_tier_type = {(r[5], r[3]): r[0] for r in lw[1:]}

items = []
for r in wp[1:]:
    cat = r[4]
    it = dict(id=r[0], n=en(r[1]), cn=r[1], tier=r[3], cat=CAT.get(cat, cat), kind=en(r[5]),
              slot=SLOT.get(r[6], '') if r[6] else '', sub=en(r[7]),
              stats=[[r[8 + k], r[11 + k]] for k in range(3) if r[8 + k]],
              affix=en(r[23]) if r[23] else '', sl=r[6] or 0)
    it['icon'] = icon(F_ITEM, r[2])
    src = {}
    if cat == '普通':
        src['bp'] = dict(city=r[18], kind='Forge' if r[6] in (1, 2) else 'Craft')
        src['mats'] = craft_mats(r)
        if r[15]:
            src['shop'] = r[15]
    elif cat == '套装':
        it['set'], it['piece'] = r[16], r[17]
        src['bp'] = dict(city=r[18], lvl=r[19], kind='Merge')
        src['merge'] = dict(base=r[20], beast=lw_by_tier_type.get((r[3], r[21])))
    elif cat == '内丹':
        src['bp'] = dict(city=r[18], lvl=r[19], kind='Refine')
        src['refine'] = dict(base=r[20], beast=lw_by_tier_type.get((r[3], r[21])))
    elif cat == '宝物':
        it['rarity'] = r[14]
        src['tower'] = r[19]
    elif cat == '普通丹药':
        src['brew'] = True
    it['src'] = src
    items.append(it)
ITEM = {i['id']: i for i in items}

# sets
sets = []
for r in tz[1:]:
    if not r[1]:
        continue
    bon = [[pcs, r[k], r[k + 1]] for pcs, k in ((2, 3), (4, 5), (6, 7)) if r[k]]
    pieces = [i['id'] for i in items if i.get('set') == r[0]]
    pieces.sort(key=lambda x: ITEM[x]['piece'])
    tiers = sorted({ITEM[p]['tier'] for p in pieces})
    sets.append(dict(id=r[0], n=en(r[1]), cn=r[1], bonus=bon, pieces=pieces, tiers=tiers,
                     icon=ITEM[pieces[0]]['icon'] if pieces else None))

# materials
mats = []
for r in cl[1:]:
    if not r[1]:
        continue
    key = r[4]
    ic = icon(F_RES, key) or icon(F_ITEM, key)
    mats.append(dict(id=r[0], n=en(r[1]), cn=r[1], tier=r[2], type=en(r[3]), rarity=en(r[5]),
                     grade=r[6], node=en(r[7]) if r[7] else '', gather=en(r[8]) if r[8] else '', icon=ic))

beasts = []
for r in lw[1:]:
    beasts.append(dict(id=r[0], n=en(r[1]), cn=r[1], type=en(r[3]), boss=r[4], tier=r[5],
                       weights=r[6:11], price=r[11], kind=en(r[12]), icon=icon(F_ITEM, r[2])))

# ---------- heroes ----------
heroes = []
for r in js[1:]:
    if not r[1] or r[1] == '测试':
        continue
    h = dict(id=r[0], n=en(r[1]), cn=r[1], cls=r[6], rarity=r[49], rarityN=HERO_RARITY.get(r[49], ''),
             apt=[(r[10] + r[13]) / 10, (r[11] + r[14]) / 10, (r[12] + r[15]) / 10],
             growth=[r[10] / 10, r[11] / 10, r[12] / 10], elix=[r[13] / 10, r[14] / 10, r[15] / 10],
             skills=[[r[31 + k], r[22 + k]] for k in range(9)],
             talents=[[r[51 + k], r[54 + k]] for k in range(3) if r[51 + k]],
             sex='F' if r[57] == '女' else 'M',
             tavern=[r[58], r[59]] if r[58] else None)
    h['icon'] = icon(F_HERO, r[5], A_HERO)
    heroes.append(h)

# classes
classes = []
for r in zy[1:]:
    if not r[1]:
        continue
    classes.append(dict(id=r[0], n=en(r[1]), cn=r[1], tier=r[3], type=CLASSTYPE.get(r[4], ''),
                        desc=r[27] or en(r[5]), pre=[x for x in r[10:13] if x], coef=r[13:17],
                        skills=[x for x in r[19:22] if x], dmg=DMG.get(r[26], ''), tid=r[4], did=r[26],
                        icon=icon(F_CLASS, r[1]) or icon(F_CLASS, r[2])))

# buffs
buffs = [dict(id=r[0], n=en(r[1]).strip('<>'), cn=r[1], stat=r[3], val=r[4], dur=r[6], icon=icon(F_BUFF, str(r[0])))
         for r in buff[1:] if r[1]]
BUFF = {b['id']: b for b in buffs}
DEBUFF = {r[0]: en(r[1]).strip('<>') for r in debuff[1:] if r[1]}

# skills
skills = []
for r in jn[1:]:
    if not r[1]:
        continue
    d = r[34] if isinstance(r[34], str) and r[34] not in ('', 'None') else ''
    b = BUFF.get(r[19])
    rep = {'<伤害类型>': DMG.get(r[8], ''), '<buff名>': b['n'] if b else '', '<buff时间>': f"{b['dur']}s" if b else '',
           '<buff系数>': f"{b['val']}%" if b else '', '<技能系数>': f'{r[10]}%', '<buff几率>': f'{r[20] / 10:g}%',
           '<伤害范围>': str(r[14]), '<debuff名>': DEBUFF.get(r[19], ''), '<伤害次数>': str(r[9]), '<持续时间>': str(r[36])}
    for k, v in rep.items():
        d = d.replace(k, v)
    sk = dict(id=r[0], n=en(r[1]), cn=r[1], type=SKILL_TYPE.get(r[3], r[3]), elem=ELEM.get(r[6], ''),
              q=r[7], qN=SKILL_QUALITY.get(r[7], ''), dmg=DMG.get(r[8], '') if r[3] != '被动' else '',
              coef=r[10], sp=r[16], cd=r[17], desc=rich(d), icon=icon(F_SKILL, r[2]) or icon(F_SKILL, r[1]))
    sk['calc'] = dict(kind={'普攻': 1, '技能': 2, '被动': 3}.get(r[3], 0), dl=r[5], el=r[6], dt=r[8], hits=r[9],
                      k=r[10], aoe=r[14], aoe2=r[15], sp=r[16], cd=r[17], side=r[18], buff=r[19], prod=r[32])
    if r[3] == '被动':
        sk['passive'] = [[r[11 + k], r[37 + k]] for k in range(3) if r[11 + k]]
    if b and r[3] != '被动':
        sk['buff'] = b['id']
    skills.append(sk)

# talents
def talent_val(s, c, L):
    if 1 <= s <= 3 or 104 <= s <= 107:
        return L * c / 10
    if s in (12, 51, 34):
        return c + 2 * L
    if s in (13, 52, 11):
        return c * L
    if s == 10:
        return round(100 * L * c) / 10000
    if stats.get(s, {}).get('fmt') == 'mult':
        return math.floor(c * 1.79 ** (L - 1)) / 100
    return math.floor(c * 1.8 ** (L - 1))

talents = []
for r in tf[1:]:
    if not r[1]:
        continue
    eff = [[r[7 + k], [round(talent_val(r[7 + k], r[10 + k], L), 3) for L in range(1, 6)]] for k in range(3) if r[7 + k]]
    talents.append(dict(id=r[0], n=en(r[1]), cn=r[1], scope=en(r[4]), rarity=en(r[5]), eff=eff))

# ---------- world ----------
foes = []
RANK = {'普通': 'Normal', '精英': 'Elite', '首领': 'Boss'}
for r in dr[1:]:
    if not r[1] or r[1] == '测试':
        continue
    foes.append(dict(id=r[0], n=en(r[1]), cn=r[1], fac=en(r[3]), rank=RANK.get(r[4], r[4]), hp=r[7], spd=r[8],
                     elem=ELEM.get(r[9], ''),
                     icon=next((i for k in (r[2] + 'A', r[1] + 'A', r[1] + '1', r[2], r[1])
                                if (i := icon(F_FOE, k, A_FOE)) is not None), None)))

LOC_TYPE = {'城市': 'City', '野外': 'Wilds', '特殊': 'Special'}
locs = []
for r in zddt[1:]:
    if not r[1] or r[2] == '测试':
        continue
    L = dict(id=r[0], n=en(r[1]), cn=r[1], type=LOC_TYPE.get(r[2], en(r[2])), region=REGION.get(r[4], ''),
             diff=r[6], realm=M(14, math.ceil((r[6] + 1) / 150)) if r[6] else '',
             unlock=[r[8], r[9]] if r[8] else None, prod=[x for x in r[11:13] if x],
             desc=en(r[17]) if r[17] else '', icon=icon(F_LOC, r[1]) or icon(F_LOC, LOC_TYPE.get(r[2]) and r[2]))
    if r[2] == '野外':
        L['foes'] = [x for x in r[13:16] if x]
        L['beast'] = r[16]
    if r[2] == '城市':
        L['gov'] = r[18]
        L['govFoe'] = r[19]
    locs.append(L)

# ---------- base ----------
buildings = []
for r in jz[1:]:
    if not r[1] or r[3] not in ('功能', '装饰', '城市'):
        continue
    buildings.append(dict(id=r[0], n=en(r[1]), cn=r[1], cat=en(r[3]), sub=en(r[4]), size=f'{r[8]}×{r[9]}',
                          desc=rich(en(r[17])) if r[17] else '', tech=r[34] if isinstance(r[34], int) else 0,
                          icon=icon(F_BLD, r[2]) or icon(F_BLD, r[1])))

facilities = []
for r in ss[1:]:
    if not r[1]:
        continue
    f = dict(id=r[0], n=en(r[1]), cn=r[1], cat=en(r[3]), work=en(r[4]), tier=r[5],
             icon=icon(F_BLD, r[2]) or icon(F_BLD, r[1]))
    if r[31]:
        v = r[33]
        f['p1'] = [en(r[31]), en(cl[v][1]) if r[3] == '资源' and isinstance(v, int) and 0 < v < len(cl) else v]
    if r[32]:
        f['p2'] = [en(r[32]), f'{r[34]}%']
    facilities.append(f)

techs = []
for r in kj[1:]:
    if not r[1] or r[1] == '空白':
        continue
    techs.append(dict(id=r[0], n=en(r[1]), cn=r[1], branch=en(r[2]), eff=en(r[12]) if r[12] and r[12] != '无' else '',
                      bld=r[13] if r[12] == '解锁建筑' else 0, target=en(r[15]) if r[15] else '',
                      desc=en(r[16]) if r[16] and r[16] != '无' else ''))

quests = [dict(id=r[0], n=en(r[1]), cn=r[1], type=en(r[2]), goal=en(r[3]), desc=rich(r[10] or en(r[6])))
          for r in rw[1:] if r[1] and r[1] != '空白']

achievements = [dict(id=r[0], n=en(r[1]), cn=r[1], group=en(r[2]), metric=en(r[3]), target=r[4])
                for r in cj[1:] if r[1]]

data = dict(
    meta=dict(game='塔防山贼模拟器', tiers=TIER, slots=SLOT, skills9=SKILLS9, quality=ITEM_QUALITY,
              kz=[r[:6] for r in T('kz')], yx=[r[1:7] for r in T('yx')]),
    stats=list(stats.values()), items=items, sets=sets, mats=mats, beasts=beasts, heroes=heroes,
    classes=classes, skills=skills, talents=talents, buffs=buffs, foes=foes, locs=locs,
    buildings=buildings, facilities=facilities, techs=techs, quests=quests, achievements=achievements,
)
data['atlas'] = dict(icon=A_ICON.save(), hero=A_HERO.save(), foe=A_FOE.save())
json.dump(data, open(f'{OUT}/compendium.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

for k, v in data.items():
    if isinstance(v, list):
        miss = sum(1 for x in v if 'icon' in x and x['icon'] is None)
        print(f'{k:13s} {len(v):4d}  no-icon={miss}')
print('size', os.path.getsize(f'{OUT}/compendium.json'), {k: os.path.getsize(f"{OUT}/{v['file']}") for k, v in data['atlas'].items()})
