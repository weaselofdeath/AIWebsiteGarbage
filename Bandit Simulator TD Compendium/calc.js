// Bandit Simulator TD stat model, build scoring and build optimizer.
// Formulas are transcribed from the game's event sheets; see tools/MODEL.md.
// Works in the browser (window.BSTDCalc) and in Node (module.exports).
(function (root, factory) {
	if (typeof module === 'object' && module.exports) module.exports = factory();
	else root.BSTDCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	const JOB_CAP = 30;
	const SLOTS = [1, 2, 3, 4, 5, 6];	// Main, Off, Armor, Accessory, Core, Relic
	// Work tasks 1–9 (Chop … Drill): power stat 39+k, aptitude used, category.
	const WORK = [null,
		{ apt: 1, cat: 0 }, { apt: 2, cat: 0 }, { apt: 3, cat: 0 },
		{ apt: 1, cat: 1 }, { apt: 2, cat: 1 }, { apt: 3, cat: 1 },
		{ apt: 1, cat: 2 }, { apt: 3, cat: 2 }, { apt: 2, cat: 2 }];
	const ARMOR_BONUS = [0, 110, 111, 112, 113];	// vs Leather, Heavy, Cloth, Divine
	const ELEM_RATE = [0, 99, 102, 100, 101, 103];
	// Rough enemy packing for crowd estimates: about one enemy per 4,000 px².
	const DENSITY = 1 / 4000, MAX_TARGETS = 10;

	const TASKS = [
		{ id: 'chop', n: 'Chop', cn: '伐木', work: 1 }, { id: 'mine', n: 'Mine', cn: '采矿', work: 2 },
		{ id: 'farm', n: 'Farm', cn: '种植', work: 3 }, { id: 'forge', n: 'Forge', cn: '锻造', work: 4 },
		{ id: 'craft', n: 'Craft', cn: '工艺', work: 5 }, { id: 'brew', n: 'Alchemy', cn: '炼丹', work: 6 },
		{ id: 'build', n: 'Build', cn: '建造', work: 7 }, { id: 'tech', n: 'Research', cn: '研究', work: 8 },
		{ id: 'drill', n: 'Drill', cn: '操练', work: 9 },
		{ id: 'single', n: 'Single target', cn: '单体', combat: { armor: 0, crowd: false } },
		{ id: 'crowd', n: 'Crowd clear', cn: '群攻', combat: { armor: 0, crowd: true } },
		{ id: 'leather', n: 'Vs Leather', cn: '对皮甲', combat: { armor: 1, crowd: false } },
		{ id: 'heavy', n: 'Vs Heavy', cn: '对重甲', combat: { armor: 2, crowd: false } },
		{ id: 'cloth', n: 'Vs Cloth', cn: '对布甲', combat: { armor: 3, crowd: false } },
		{ id: 'divine', n: 'Vs Divine', cn: '对圣甲', combat: { armor: 4, crowd: false } },
	];

	// Default assumptions for a tier; every field can be overridden in the builder.
	function tierDefaults(tier) {
		return {
			tier, level: 30 * (tier + 1), gearTier: tier + 1, quality: 5, job: JOB_CAP,
			coreGrade: 1, maxRank: Math.min(6, tier + 3), elixirs: true,
		};
	}

	function make(D) {
		const STAT = new Map(D.stats.map(s => [s.id, s]));
		const ITEM = new Map(D.items.map(i => [i.id, i]));
		const SET = new Map(D.sets.map(s => [s.id, s]));
		const CLASS = new Map(D.classes.map(c => [c.id, c]));
		const SKILL = new Map(D.skills.map(s => [s.id, s]));
		const TALENT = new Map(D.talents.map(t => [t.id, t]));
		const BUFF = new Map(D.buffs.map(b => [b.id, b]));
		const HERO = new Map(D.heroes.map(h => [h.id, h]));
		const KZ = D.meta.kz, YX = D.meta.yx;
		const fmt = s => (STAT.get(s) || {}).fmt || 'int';

		// ---- base curves -------------------------------------------------------
		const atkBase = L => Math.round(15 + (5 * L + 65 * 1.036 ** L - 55) * 0.05 + 4 * L);
		const atkGear = L => Math.ceil(5 * L + 65 * 1.036 ** L - 55);
		const workBase = s => Math.round(8 + 2 * s ** 1.2);

		function classCoef(cls, job, kind) {
			const c = cls.coef[{ atk: 0, spd: 1, rng: 2, work: 3 }[kind]];
			job = Math.max(1, job);
			const disp = Math.floor((c + (job - 1) * c / (5 * JOB_CAP)) * 10) / 10 / 100;
			if (kind === 'atk') return 0.6 + 2.4 * disp ** 1.2;
			if (kind === 'spd') return 0.25 + 1.2 * disp;
			if (kind === 'rng') return 1 + 6 * disp;
			return 0.6 + 1.8 * disp ** 1.2;
		}

		// 装备主属性: value of one stat line on a gear piece.
		function gearStat(stat, tier, lvl, roll, k, quality) {
			const r = roll / 100;
			if (stat >= 4 && stat <= 7)
				return Math.floor(atkGear((tier - 1) * 30 + 1) * (1 + 0.04 * lvl) * r * k / 100 + lvl * quality);
			if (stat >= 1 && stat <= 3)
				return Math.floor(0.3 * tier ** 1.6 * (1 + 0.04 * lvl) * 100 * r * k / 100) / 100;
			if (stat === 10) return Math.floor((tier * 0.2 + lvl * 0.01) * r * 100) / 100;
			if (stat === 11) return Math.floor(20 * (tier * 0.2 + lvl * 0.01) * r);
			if ([12, 34, 51, 29, 70].includes(stat)) return Math.floor((2 + tier * 0.75 + lvl * 0.01) * r * 100) / 100;
			if (stat === 13 || stat === 52) return Math.floor((8 + 3 * tier + lvl * 0.4) * r * 100) / 100;
			if (stat >= 40 && stat <= 48)
				return Math.floor(0.4 * workBase((tier - 1) * 10 + 1) * (1 + 0.04 * lvl) * r * k / 100 + lvl);
			if (stat === 71 || stat === 72) return Math.floor((2 + tier * 0.75 + lvl * 0.1) * r * 100) / 100;
			if (fmt(stat) === 'mult') return Math.floor((tier + lvl * 0.1) * r * 100) / 10000;
			return Math.floor((4 + 1.5 * tier + lvl * 0.2) * r * 100) / 100;
		}

		function setBonus(stat, coef, score) {
			score = Math.max(4, score);
			const f = fmt(stat);
			if (f === 'pct') return coef / 10 / 4 * score;
			if (f === 'mult') return Math.round(1000 * (coef / 1000 / 4) * score) / 1000;
			if (f === 'int') return coef / 5 * score;
			return 0;
		}

		const coreBoost = (stage, grade) =>
			Math.round(100 * (1.2 ** (stage - 1) * (0.4 + (stage + grade - 2) * 0.2))) / 100;

		// ---- build → stat sources ---------------------------------------------
		// A build: { hero, cls, level, job, stage, skills[9], talents[[id,lv]], elixirs (bool | [s,a,i]),
		//            coreGrade, gear: { slot: { id, q, lv, roll, affix: [[stat, roll]] } }, buffs: Map }
		function sources(b) {
			const G = new Map(), T = new Map(), P = new Map();
			const add = (m, s, v) => { if (s && v) m.set(s, (m.get(s) || 0) + v); };
			const sets = new Map();	// set id -> Map(piece -> quality)
			for (const slot of SLOTS) {
				const g = b.gear && b.gear[slot];
				const it = g && ITEM.get(g.id);
				if (!it) continue;
				const q = g.q, lv = g.lv, roll = g.roll, tier = g.tier || it.tier;
				for (const [s, k] of it.stats) add(G, s, gearStat(s, tier, lv, roll, k, q));
				for (const [s, r] of g.affix || []) add(G, s, gearStat(s, tier, 0, r, 100, q));
				if (it.set) {
					if (!sets.has(it.set)) sets.set(it.set, new Map());
					const pm = sets.get(it.set);
					pm.set(it.piece, Math.max(pm.get(it.piece) || 0, q));
				}
			}
			for (const [sid, pm] of sets) {
				const st = SET.get(sid);
				if (!st) continue;
				const n = pm.size;
				let score = 0;
				for (const q of pm.values()) score += q;
				for (const [pcs, s, c] of st.bonus)
					if (n >= pcs) add(G, s, setBonus(s, c, score));
			}
			for (const [id, lv] of b.talents || []) {
				const t = TALENT.get(id);
				if (!t || lv <= 0) continue;
				for (const [s, vals] of t.eff) add(T, s, vals[Math.min(5, lv) - 1]);
			}
			const cls = CLASS.get(b.cls);
			const passive = cls && SKILL.get(cls.skills[2]);
			if (passive && passive.passive)
				for (const [s, v] of passive.passive) add(P, s, v);	// scaled by stat 15 in panel()
			return { G, T, P, buffs: b.buffs || new Map(), sets };
		}

		// ---- panel (属性计算) ---------------------------------------------------
		function panel(b) {
			const hero = HERO.get(b.hero), cls = CLASS.get(b.cls);
			const src = sources(b);
			const g = s => src.G.get(s) || 0, t = s => src.T.get(s) || 0, bf = s => src.buffs.get(s) || 0;
			const stat15 = g(15) + t(15) + bf(15);
			const p = s => {
				const v = src.P.get(s) || 0;
				if (!v) return 0;
				const m = fmt(s) === 'mult' ? v / 1000 : v / 10;
				return Math.round(100 * m * (100 + stat15) / 100) / 100;
			};
			const plain = s => bf(s) + g(s) + t(s) + p(s);
			const S = new Map();
			const job = b.job || 1;

			// aptitude growth (104–106) and aptitude (1–3)
			let mult = 1.5;
			for (let k = 1; k <= (b.stage || 0); k++) mult += coreBoost(k, b.coreGrade || 1);
			const yx = YX[Math.min(9, (b.gearTier || (b.stage || 0) + 1))] || [];
			for (let a = 1; a <= 3; a++) {
				const base = hero.growth[a - 1];
				const growth = base + t(103 + a) + g(103 + a);
				S.set(103 + a, growth);
				let elix = hero.elix[a - 1];
				if (b.elixirs === true) {
					const capByMult = growth * mult - base;
					const capByPill = (+yx[5] || Infinity) - growth;
					elix = Math.max(elix, Math.min(capByMult, capByPill));
				}
				else if (Array.isArray(b.elixirs)) elix = b.elixirs[a - 1];
				S.set(a, Math.round(100 * (growth + elix)) / 100 + bf(a) + g(a));
			}
			const STR = S.get(1), AGI = S.get(2), INT = S.get(3);
			const aptFor = s => (s === 4 ? STR : s === 5 ? AGI : s === 6 ? INT : 0);

			for (const s of STAT.keys()) {
				if (s <= 3 || (s >= 104 && s <= 106)) continue;
				if (s >= 4 && s <= 11) continue;
				if (s >= 40 && s <= 50) continue;
				let v;
				if (s === 13 || s === 52) v = 150 + plain(s);
				else if (s === 12 || s === 51) v = 5 + plain(s);
				else if (s >= 77 && s <= 80) v = 1 + t(s) + g(s);
				else if (s >= 90 && s <= 103) v = 1 + plain(s);
				else if (s === 34) v = Math.max(0, Math.min(70, plain(s)));
				else v = plain(s);
				S.set(s, v);
			}
			const atkC = classCoef(cls, job, 'atk');
			for (let s = 4; s <= 7; s++) {
				const raw = Math.floor((atkBase(Math.trunc(b.level)) + g(s)) * atkC * (s === 7 ? 1 : (100 + aptFor(s)) / 100));
				S.set(s, Math.round(raw * (100 + S.get(28)) / 100 + bf(s)));
			}
			S.set(8, Math.max(0.2, Math.floor(100 / (classCoef(cls, job, 'spd') * ((100 + S.get(29) + AGI / 10) / 100))) / 100));
			S.set(9, Math.floor(100 * classCoef(cls, job, 'rng') * (100 + S.get(30)) / 100) + bf(9) + g(9));
			S.set(10, 1 + Math.floor(INT) / 100 + plain(10));
			S.set(11, 100 + plain(11));
			const workC = classCoef(cls, job, 'work');
			for (let k = 1; k <= 9; k++) {
				const s = 39 + k, lvl = (b.skills && b.skills[k - 1]) || 1;
				const apt = [0, STR, AGI, INT][WORK[k].apt];
				S.set(s, Math.floor((0.6 * workBase(lvl) + g(s)) * workC * (100 + apt) / 100) + bf(s));
			}
			S.set(49, Math.max(0.2, Math.floor(100 / ((100 + S.get(70)) / 100)) / 100));
			S.set(50, Math.floor(150 * (100 + S.get(68)) / 100) + bf(50) + g(50));
			return S;
		}

		// ---- combat --------------------------------------------------------------
		const critAvg = (rate, dmg) => 1 + Math.max(0, Math.min(100, rate)) / 100 * (dmg / 100 - 1);

		function hitDamage(S, cls, sk, job, scen) {
			const c = sk.calc;
			const atk = S.get(cls.did + 3);
			const coef = Math.floor(c.k + (job - 1) * c.k / 60) / 100;
			let bonus = c.kind === 1 ? S.get(17) / 100 + S.get(1) / 1000 : S.get(18) / 100;
			if (c.dt >= 1 && c.dt <= 4) bonus += S.get(18 + c.dt) / 100;
			if (scen.armor) bonus += S.get(ARMOR_BONUS[scen.armor]) / 100;
			const counter = ((KZ[c.dt] || [])[scen.armor] || 100) / 100;
			const elemRate = c.el ? S.get(ELEM_RATE[c.el]) : 1;
			const jobRate = cls.tid >= 1 && cls.tid <= 3 ? Math.max(1, S.get(76 + cls.tid)) : 1;
			return atk * coef * critAvg(S.get(12), S.get(13)) * (1 + bonus) * counter
				* (1 + S.get(71) / 100) * jobRate * elemRate;
		}

		// Hits on the main target and estimated targets per hit.
		function shape(S, sk) {
			const c = sk.calc, range = S.get(9), area = a => Math.min(MAX_TARGETS, 1 + a * DENSITY);
			switch (c.dl) {
				case 1: return { hits: 1, targets: S.get(16) > 0 ? area(Math.PI * S.get(16) ** 2) : 1 };
				case 3: return { hits: 1, targets: area(Math.PI * (c.aoe / 2) ** 2) };
				case 6: return { hits: c.hits, targets: area(Math.PI * range ** 2) };
				case 7: return { hits: 1, targets: area(range * range / 2) };
				case 8: return { hits: c.hits, targets: area(range * range / 2) };
				case 9: return { hits: 1, targets: Math.min(MAX_TARGETS, c.hits) };
				case 11: return { hits: c.hits, targets: area(Math.PI * c.aoe * (c.aoe2 || c.aoe)) };
				default: return { hits: 1, targets: 1 };
			}
		}

		// Casts per second of a cooldown/SP skill given an action rate.
		function castRate(S, sk, actRate) {
			const c = sk.calc;
			const cd = c.cd * (100 - S.get(34)) / 100;
			let r = actRate;
			if (cd > 0) r = Math.min(r, 1 / cd);
			if (c.sp > 0) r = Math.min(r, S.get(10) / c.sp);
			return r;
		}

		// Buff granted by a skill: {stat, value, uptime}.
		function skillBuff(sk, rate) {
			const c = sk.calc, b = BUFF.get(c.buff);
			if (!b || c.side !== '我方' || !b.stat) return null;
			const v = fmt(b.stat) === 'mult' ? b.val / 100 : Math.floor(100 * b.val) / 100;
			return { stat: b.stat, value: v * Math.min(1, b.dur * rate) };
		}

		function combat(b, scen) {
			const cls = CLASS.get(b.cls);
			const basic = SKILL.get(cls.skills[0]), active = SKILL.get(cls.skills[1]);
			let S = panel(b), rate = 0;
			// One refinement pass so a self-buff from the active skill feeds back into the panel.
			if (active && active.calc.prod !== 1) {
				rate = castRate(S, active, 1 / S.get(8));
				const bu = skillBuff(active, rate);
				if (bu) {
					const buffs = new Map(b.buffs || []);
					buffs.set(bu.stat, (buffs.get(bu.stat) || 0) + bu.value);
					S = panel(Object.assign({}, b, { buffs }));
					rate = castRate(S, active, 1 / S.get(8));
				}
			}
			const actRate = 1 / S.get(8);
			const job = b.job || 1;
			const per = sk => {
				const sh = shape(S, sk);
				return hitDamage(S, cls, sk, job, scen) * sh.hits * (scen.crowd ? sh.targets : 1);
			};
			let dps = 0;
			const parts = [];
			if (active && active.calc.prod !== 1 && active.calc.k > 0 && [1, 2, 3, 6, 7, 8, 9, 10, 11].includes(active.calc.dl)) {
				const d = rate * per(active);
				dps += d;
				parts.push({ skill: active.id, rate, dps: d });
			}
			else if (!(active && active.calc.prod !== 1)) rate = 0;
			if (basic) {
				const r = Math.max(0, actRate - rate), d = r * per(basic);
				dps += d;
				parts.push({ skill: basic.id, rate: r, dps: d });
			}
			return { score: dps, S, parts };
		}

		// ---- work (采集量计算) --------------------------------------------------
		function work(b, k) {
			const cls = CLASS.get(b.cls);
			const active = SKILL.get(cls.skills[1]);
			let S = panel(b);
			if (active && active.calc.prod === 1) {
				const bu = skillBuff(active, castRate(S, active, 1 / S.get(49)));
				if (bu) {
					const buffs = new Map(b.buffs || []);
					buffs.set(bu.stat, (buffs.get(bu.stat) || 0) + bu.value);
					S = panel(Object.assign({}, b, { buffs }));
				}
			}
			const cat = WORK[k].cat;
			const power = S.get(39 + k);
			const crit = critAvg(S.get(51), S.get(52));
			const bonus = 1 + S.get(53 + cat) / 100 + S.get(55 + k) / 100;
			const jobRate = cls.tid === 4 ? Math.max(1, S.get(80)) : 1;
			const out = power * crit * bonus * jobRate * S.get(89 + k) * (100 + S.get(72)) / 100 + Math.floor(S.get(65 + cat));
			return { score: out / S.get(49), perAction: out, S };
		}

		function score(b, task) {
			return task.work ? work(b, task.work) : combat(b, task.combat);
		}

		// ---- optimizer -----------------------------------------------------------
		const ITEMS_BY = new Map();	// `${slot}:${tier}` -> { plain: [], set: [] }
		for (const it of D.items) {
			if (!it.sl || !['Equipment', 'Set piece', 'Core', 'Treasure'].includes(it.cat)) continue;
			const key = `${it.sl}:${it.tier}`;
			if (!ITEMS_BY.has(key)) ITEMS_BY.set(key, { plain: [], set: [] });
			ITEMS_BY.get(key)[it.set ? 'set' : 'plain'].push(it);
		}
		// Items for a slot at the highest tier ≤ tier that has any (treasures stop below tier 9).
		function pool(slot, tier) {
			const out = { plain: [], set: [] };
			for (const kind of ['plain', 'set'])
				for (let t = tier; t >= 1; t--) {
					const p = ITEMS_BY.get(`${slot}:${t}`);
					if (p && p[kind].length) { out[kind] = p[kind]; break; }
				}
			return out;
		}

		function gearPiece(id, a) {
			const q = a.quality;
			return { id, q, lv: 10 + 5 * (q - 1), roll: 65 + 30 * q };
		}

		// Class path from Vagrant to cls (the tree is single-parent).
		function classPath(id) {
			const path = [];
			for (let c = CLASS.get(id); c; c = CLASS.get(c.pre[0])) path.unshift(c.id);
			return path;
		}

		function baseBuild(hero, cls, a) {
			const h = HERO.get(hero);
			return {
				hero, cls, level: a.level, job: a.job, stage: a.tier, gearTier: a.gearTier, coreGrade: a.coreGrade,
				elixirs: a.elixirs, skills: h.skills.map(s => s[1]), talents: h.talents, gear: {},
			};
		}

		// Best gear for one class: set plans × greedy free slots.
		function bestGear(b, task, a) {
			const tier = a.gearTier;
			const evalGear = gear => score(Object.assign({}, b, { gear }), task).score;
			const free = {};
			// best non-set item per slot, evaluated alone
			for (const slot of SLOTS) {
				let best = null, bestV = -1;
				for (const it of pool(slot, tier).plain) {
					const v = evalGear({ [slot]: gearPiece(it.id, a) });
					if (v > bestV) { bestV = v; best = it.id; }
				}
				free[slot] = best;
			}
			const setsAt = new Map();
			for (const slot of [1, 2, 3, 4])
				for (const it of pool(slot, tier).set) {
					if (!setsAt.has(it.set)) setsAt.set(it.set, {});
					setsAt.get(it.set)[slot] = it.id;
				}
			const plans = [{}];
			const pairs = [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];
			const full = [...setsAt].filter(([, s]) => Object.keys(s).length === 4);
			for (const [, s] of full) {
				plans.push({ ...s });
				for (const [x, y] of pairs) plans.push({ [x]: s[x], [y]: s[y] });
			}
			// 2+2 between the best two-piece options
			const rank2 = full.map(([sid, s]) => {
				let best = -1;
				for (const [x, y] of pairs) best = Math.max(best, evalGear({ ...free, [x]: gearPiece(s[x], a), [y]: gearPiece(s[y], a) }));
				return [best, s];
			}).sort((p, q) => q[0] - p[0]).slice(0, 3);
			for (let i = 0; i < rank2.length; i++)
				for (let j = 0; j < rank2.length; j++) {
					if (i === j) continue;
					const A = rank2[i][1], B = rank2[j][1];
					for (const [x, y] of [[1, 2], [1, 3], [1, 4]]) {
						const rest = [1, 2, 3, 4].filter(z => z !== x && z !== y);
						plans.push({ [x]: A[x], [y]: A[y], [rest[0]]: B[rest[0]], [rest[1]]: B[rest[1]] });
					}
				}
			let best = null;
			for (const plan of plans) {
				const gear = {};
				for (const slot of SLOTS) {
					const id = plan[slot] || free[slot];
					if (id) gear[slot] = gearPiece(id, a);
				}
				const v = evalGear(gear);
				if (!best || v > best.v) best = { v, gear };
			}
			return best;
		}

		// Stat lines worth chasing as random affixes on this build, best first.
		function affixPriority(b, task, n = 4) {
			const base = score(b, task).score;
			const q = (b.gear[1] && b.gear[1].q) || 5, roll = 35 + 10 * q, tier = b.gearTier;
			const cand = D.stats.filter(s => s.id > 3 && s.id !== 14 && !(s.id >= 104 && s.id <= 109));
			const gains = [];
			for (const s of cand) {
				const slot = SLOTS.find(sl => b.gear[sl]);
				if (!slot) break;
				const gear = Object.assign({}, b.gear);
				gear[slot] = Object.assign({}, gear[slot], { affix: [...(gear[slot].affix || []), [s.id, roll]], tier });
				const v = score(Object.assign({}, b, { gear }), task).score;
				if (v > base * 1.0005) gains.push([s.id, v / base - 1]);
			}
			return gains.sort((x, y) => y[1] - x[1]).slice(0, n);
		}

		function optimize(heroId, tier, taskId, over) {
			const a = Object.assign(tierDefaults(tier), over || {});
			const task = TASKS.find(t => t.id === taskId);
			let best = null;
			for (const cls of D.classes) {
				if (cls.tier > a.maxRank) continue;
				const b = baseBuild(heroId, cls.id, a);
				const g = bestGear(b, task, a);
				if (!best || g.v > best.v) best = { v: g.v, build: Object.assign(b, { gear: g.gear }) };
			}
			return best && Object.assign(best, { path: classPath(best.build.cls), assumptions: a, task });
		}

		return {
			TASKS, SLOTS, JOB_CAP, tierDefaults, panel, combat, work, score, optimize, bestGear, baseBuild,
			gearPiece, classPath, affixPriority, gearStat, classCoef, pool,
		};
	}

	return { make, TASKS, tierDefaults };
});
