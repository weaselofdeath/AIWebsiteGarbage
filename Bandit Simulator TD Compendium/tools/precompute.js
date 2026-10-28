// Precomputes the optimizer's best build for every hero × tier × task into site/builds.json.
// usage: node precompute.js [workers]      (runs itself as workers with --part i/n)
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SITE = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(SITE, 'compendium.json'), 'utf8'));
const Calc = require(path.join(SITE, 'calc.js'));
const TIERS = 9;

function run(part, parts) {
	const C = Calc.make(D);
	const out = {};
	const heroes = D.heroes.filter((h, i) => i % parts === part);
	for (const h of heroes) {
		const rows = [];
		for (let tier = 0; tier < TIERS; tier++)
			for (const task of C.TASKS) {
				const r = C.optimize(h.id, tier, task.id);
				const g = r.build.gear;
				rows.push([r.build.cls, ...C.SLOTS.map(s => (g[s] ? g[s].id : 0)), +r.v.toPrecision(4)]);
			}
		out[h.id] = rows;
		process.send({ progress: 1 });
	}
	process.send({ done: out });
}

if (process.argv[2] === '--part') {
	const [i, n] = process.argv[3].split('/').map(Number);
	run(i, n);
}
else {
	const n = +process.argv[2] || Math.max(1, os.cpus().length - 1);
	const t0 = Date.now();
	let done = 0, finished = 0;
	const heroes = {};
	for (let i = 0; i < n; i++) {
		const w = fork(__filename, ['--part', `${i}/${n}`]);
		w.on('message', m => {
			if (m.progress) {
				done++;
				if (done % 20 === 0) console.log(`${done}/${D.heroes.length} heroes, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
			}
			if (m.done) {
				Object.assign(heroes, m.done);
				if (++finished === n) {
					const C = Calc.make(D);
					const res = {
						v: 1, tiers: TIERS, tasks: C.TASKS.map(t => t.id),
						assumptions: [...Array(TIERS)].map((_, t) => Calc.tierDefaults(t)),
						heroes,
					};
					fs.writeFileSync(path.join(SITE, 'builds.json'), JSON.stringify(res));
					console.log(`wrote builds.json (${Object.keys(heroes).length} heroes) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
				}
			}
		});
	}
}
