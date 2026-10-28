# Bandit Simulator TD: stat & output model

Decoded from the event sheets (`decomp2.py game 公式与数值`). Function names are
the game's own. `stat N` = sx row N (see compendium `stats`).

## Hero record (save z=2)
- 3 level, 6 class id, 10–12 aptitude growth ×10 (from js c10–12)
- 13–15 elixir aptitude points ×10, 16–21 equipped item record per slot 1–6
- 22–30 work skill caps (js c22–30), 31–39 work skill levels, 40–48 skill EXP
- 50 breakthrough stage (渡劫). Level cap = (stage+1)·30
- job level per class: save(hero, classId, z=4), 1…30 (职业等级上限 = 30)

## Item record (save z=7/9)
1 item id · 3 tier · 5 quality 1–6 · 6 upgrade level (cap 10+5·(q−1)) ·
8 main-stat roll 品质系数 ∈ [80+30(q−1), 80+30q] · 9–14 affix stat ids (q−1 of them) ·
15–20 affix rolls ∈ [10(q−1), 60+10q] · 23 quality (used for set score)

## Base curves
- 基础攻击基数(L,"等级") = round(15 + (5L + 65·1.036^L − 55)·0.05 + 4L)
- 基础攻击基数(L,"装备") = ceil(5L + 65·1.036^L − 55)
- 基础技艺基数(s) = round(8 + 2·s^1.2)

## Class coefficient (职业实际系数), job level j, cap 30
disp(c) = floor(10·(c + (j−1)·c/150))/10 with c = zy c13 atk / c14 speed / c15 range / c16 work
- attack 0.6 + 2.4·(disp/100)^1.2 · speed 0.25 + 1.2·disp/100
- range 1 + 6·disp/100 · work 0.6 + 1.8·(disp/100)^1.2

## Aptitude
growth G = js apt + talents + cores + gear (stats 104–106)
STR/AGI/INT = G + elixir points; elixir points ≤ G·(1.5 + Σ core c15 over stages) − ...
(cap multiplier 1.5 at stage 0)

## Panel stats (属性计算)
- 4–6 attack = floor((基础攻击(level) + gear) · atkCoef · (100+apt)/100) · (100+stat28)/100
  (4 Physical uses STR, 5 Pierce AGI, 6 Spell INT; 7 Holy no aptitude).
  Hero's attack type = zy c26 + 3.
- 8 attack interval = max(0.2, floor(100/(speedCoef·(100+stat29+AGI/10)/100))/100)
- 9 range = floor(100·rangeCoef·(100+stat30)/100) + gear
- 10 SP regen = 1 + floor(INT)/100 + gear + talents + passive; 11 max SP = 100 + …
- 12 crit 5+…, 13 crit dmg 150+…, 51 work crit 5+…, 52 work crit dmg 150+…
- 40–48 work power = floor((0.6·基础技艺(skillLv) + gear) · workCoef · (100+apt)/100),
  apt: Chop/Forge/Build STR · Mine/Craft/Drill AGI · Farm/Brew/Tech INT
- 49 work interval = max(0.2, floor(100/((100+stat70)/100))/100)
- 50 work range = floor(150·(100+stat68)/100) + gear
- 77–80, 90–103 multipliers start at 1; 34 cooldown clamp 0–70
- everything else = gear + talents + cores + class passive (+ global tech bonus)

## Gear main stat (装备主属性), tier t, level l, roll r, item coef k (wp c11–13)
- 4–7: floor(基础攻击((t−1)·30+1,"装备")·(1+0.04l)·r/100·k/100 + l·quality)
- 1–3: floor(0.3·t^1.6·(1+0.04l)·r·k/100)/100
- 10: floor((0.2t+0.01l)·r)/100 · 11: floor(20·(0.2t+0.01l)·r/100)
- 12,34,51,29,70: floor((2+0.75t+0.01l)·r)/100 · 13,52: floor((8+3t+0.4l)·r)/100
- 40–48: floor(0.4·基础技艺(10(t−1)+1)·(1+0.04l)·r/100·k/100 + l)
- 71,72: floor((2+0.75t+0.1l)·r)/100 · 倍率 stats: floor((t+0.1l)·r)/10000
- other %: floor((4+1.5t+0.2l)·r)/100
Affixes use the same formula with l=0, k=100, r = affix roll.

## Sets (套装属性), score S = Σ quality of distinct pieces, clamped ≥ 4
- % stat: coef/10/4·S · 倍率: coef/1000/4·S · int: coef/5·S
- 2-pc bonus tz c3/c4, 4-pc c5/c6, 6-pc c7/c8

## Talents (天赋属性), level 1–5, coef k
1–3,104–107: lv·k/10 · 12,51,34: k+2lv · 13,52,11: k·lv · 10: round(100·lv·k)/10000
倍率: floor(k·1.79^(lv−1))/100 · else floor(k·1.8^(lv−1))

## Class passive (被动属性): class skill zy c21 if jn c3 = 被动
stat jn c11–13, value jn c37–39 (paired c(10+n) ↔ c(36+n), n=1..3): 倍率 v/1000·(1+stat15/100), else v/10·(1+stat15/100)

## Damage (战斗伤害计算)
dmg = floor(panelAtk · skillCoef · crit · (1 + basicOrSkill + typeBonus + elemBonus + foeRankBonus + armorBonus)
      · (1 − def) · kz[dmgType][armor]/100 · kz[elem+10][foeElem]/100 · (1+stat71/100) · jobTypeRate · elemSkillRate)
- skillCoef = floor(jn c10 + (jobLv−1)·c10/60)/100
- basic attack bonus = stat17/100 + STR/1000; skills use stat18/100
- def = 0.06d/(1+0.06|d|), d = foe defense (dr c6)
- typeBonus stat 19–22 by jn c8; armor counter stat 110–113; foe rank 31–33; element 23–27
- jobTypeRate = max(1, stat 77/78/79) for class type 1/2/3

## Skill use
Every attack: if active skill (zy c20) off cooldown and SP ≥ jn c16 → cast it, else basic (zy c19).
Cooldown = jn c17·(100−stat34)/100. SP +stat10 per second, cap stat11.
Skills with jn c32 = 1 are work skills, cast during production instead.
Extra targets stat14; splash radius stat16 (>0 makes hits AoE).

## Work output per action (采集量计算)
out = ceil(rate · power · crit · (1 + catBonus + typeBonus) · (1+aura) · jobRate · typeRate · tech · finalOut) + extraFlat
- rate = 0.1^(difficulty−1) for gathering, else 1
- catBonus stat 53/54/55, typeBonus 56–64, typeRate 90–98, finalOut (100+stat72)/100
- jobRate = max(1, stat80) for craft-type classes (zy c4 = 4)
- extraFlat stat 65/66/67
Per second = out / interval (stat 49). Crit expectation = 1 + crit%·(critDmg/100 − 1).
