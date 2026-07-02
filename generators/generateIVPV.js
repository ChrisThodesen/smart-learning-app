  
(function (root) {
    'use strict';

    const METERS = {
        U6:  { ivm: 0.008,  label: 'U6 (G4)', family: 'small', art: 'a'  },
        E6:  { ivm: 0.0024, label: 'E6',      family: 'small', art: 'an' },
        U16: { ivm: 0.025,  label: 'U16',     family: 'large', art: 'a'  }
    };

    const PIPES = [
        { material: 'copper', size: 15, vol: 0.00014, over28: false },
        { material: 'copper', size: 22, vol: 0.00032, over28: false },
        { material: 'copper', size: 28, vol: 0.00054, over28: false },
        { material: 'copper', size: 35, vol: 0.00084, over28: true  },
        { material: 'steel',  size: 15, vol: 0.00024, over28: false },
        { material: 'steel',  size: 20, vol: 0.00046, over28: false },
        { material: 'steel',  size: 25, vol: 0.00064, over28: false },
        { material: 'steel',  size: 32, vol: 0.0011,  over28: true  },
        { material: 'PE SDR 11', size: 20, vol: 0.00019, over28: false },
        { material: 'PE SDR 11', size: 25, vol: 0.00033, over28: false },
        { material: 'PE SDR 11', size: 32, vol: 0.00053, over28: true  }
    ];

    /** Small RNG function to allow for the deterministic generation of quizzes via a SEED value */
    function makeRng(seed) {
        if (seed === undefined || seed === null) return Math.random;
        var s = seed >>> 0;
        return function () {
        // mulberry32
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        var t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function pick(rng, arr) { 
        return arr[Math.floor(rng() * arr.length)]; 
    }

    function randInt(rng, lo, hi) { 
        return lo + Math.floor(rng() * (hi - lo + 1)); 
    }

    function round5(x) { 
        return Math.round(x * 1e5) / 1e5; 
    }

    function fmt(x) { 
        return round5(x).toFixed(5) + ' m\u00B3'; 
    }

    function buildInstallation(rng) {
        var meterKey = pick(rng, ['U6', 'E6', 'U16']);
        var meter = METERS[meterKey];
    
        var sections = rng() < 0.35 ? 2 : 1; // mostly single-section
        var pipes = [];
        for (var i = 0; i < sections; i++) {
            pipes.push({ spec: pick(rng, PIPES), length: randInt(rng, 3, 18) });
        }
    
        // fittings: 'unknown' -> add 10% of IVp ; 'none' -> 0
        var fittings = rng() < 0.6 ? 'unknown' : 'none';
    
        // IVp (sum of pipe sections)
        var ivp = 0;
        pipes.forEach(function (p) { ivp += p.length * p.spec.vol; });
    
        var ivf = fittings === 'unknown' ? 0.1 * ivp : 0;
        var ivt = meter.ivm + ivp + ivf;
    
        var anyOver28 = pipes.some(function (p) { return p.spec.over28; });
        var isLargeMeter = meter.family === 'large';
    
        // PV rule (Table 2)
        var pv, pvRule;
        if (isLargeMeter || anyOver28) {
            pv = 1.5 * ivt;
            pvRule = '1.5IV';
        } else {
            pv = 0.01;
            pvRule = 'flat';
        }
    
        return {
            meterKey: meterKey, meter: meter, pipes: pipes, fittings: fittings,
            ivp: ivp, ivf: ivf, ivt: ivt, pv: pv, pvRule: pvRule,
            anyOver28: anyOver28, isLargeMeter: isLargeMeter
        };
    }

    function describePipes(inst) {
        return inst.pipes.map(function (p) {
            return p.length + ' m of ' + p.spec.size + ' mm ' + p.spec.material;
        }).join(' + ');
    }

      // Turn a list of candidate numbers into 4 unique options incl. the answer.
    function buildOptions(rng, correct, candidates) {
        var seen = {};
        var opts = [];
        function add(v) {
            if (v < 0) return;
            var key = round5(v).toFixed(5);
            if (seen[key]) return;
            seen[key] = true;
            opts.push(round5(v));
        }
        add(correct);
        candidates.forEach(add);
        // pad with small perturbations if we still need more distractors
        var guard = 0;
        while (opts.length < 4 && guard++ < 50) {
            var base = correct * (1 + (rng() * 0.5 - 0.25));
            add(base);
        }
        opts = opts.slice(0, 4);
        // shuffle
        for (var i = opts.length - 1; i > 0; i--) {
            var j = Math.floor(rng() * (i + 1));
            var t = opts[i]; opts[i] = opts[j]; opts[j] = t;
        }
        return {
            answers: opts.map(fmt),
            correct: opts.indexOf(round5(correct))
        };
    }


    function purgeFromIv(rng) {
        var inst = buildInstallation(rng);
        var iv = round5(inst.ivt);
        var pv = inst.pvRule === 'flat' ? 0.01 : round5(1.5 * iv);
    
        var cands;
        var explain;
        if (inst.pvRule === 'flat') {
        cands = [round5(1.5 * iv), round5(iv), round5(2 * iv)];
        explain = 'With ' + inst.meter.art + ' ' + inst.meter.label + ' meter and all pipework \u2264 28 mm, ' +
            'Table 2 gives a fixed purge volume of 0.01 m\u00B3 \u2014 the installation volume is not used to scale it.';
        } else {
        cands = [round5(iv), round5(0.01), round5(2 * iv)];
        var reason = inst.isLargeMeter
            ? inst.meter.art + ' ' + inst.meter.label + ' meter is fitted'
            : 'the pipework exceeds 28 mm';
        explain = 'Because ' + reason + ', Table 2 requires PV = 1.5 \u00D7 IV. ' +
            '1.5 \u00D7 ' + fmt(iv) + ' = ' + fmt(pv) + '.';
        }
    
        var o = buildOptions(rng, pv, cands);
        return {
        question: 'What is the purge volume of the installation specified below?\n\n' +
            'IV is ' + fmt(iv) + ', ' + inst.meter.label + ' gas meter and ' +
            (inst.pipes[0].spec.size) + ' mm pipework.',
        answers: o.answers,
        correct: o.correct,
        explanation: explain,
        source: 'S2-19'
        };
    }
 
    // Type B: PV from a full installation spec (compute IV, then PV).
    function purgeFromSpec(rng) {
        var inst = buildInstallation(rng);
        var iv = round5(inst.ivt);
        var pv = inst.pvRule === 'flat' ? 0.01 : round5(1.5 * iv);
        var ivNoFit = round5(inst.meter.ivm + inst.ivp);
    
        var cands, explain;
        var working = 'IV = IVm + IVp + IVf = ' + fmt(inst.meter.ivm) + ' + ' +
        fmt(inst.ivp) + ' + ' + fmt(inst.ivf) + ' = ' + fmt(iv) + '. ';
        if (inst.pvRule === 'flat') {
            cands = [round5(1.5 * iv), round5(iv), round5(ivNoFit)];
            explain = working + 'With ' + inst.meter.art + ' ' + inst.meter.label +
                ' meter and all pipework \u2264 28 mm, the purge volume is a fixed 0.01 m\u00B3 (Table 2).';
        } else {
            cands = [round5(iv), round5(1.5 * ivNoFit), round5(0.01)];
            var reason = inst.isLargeMeter
                ? inst.meter.art + ' ' + inst.meter.label + ' meter is fitted'
                : 'pipework exceeds 28 mm';
            explain = working + 'Because ' + reason +
                ', PV = 1.5 \u00D7 IV = 1.5 \u00D7 ' + fmt(iv) + ' = ' + fmt(pv) + ' (Table 2).';
        }
    
        var fitText = inst.fittings === 'unknown'
            ? 'fittings volume unknown (add 10% of pipe volume)'
            : 'no additional fittings volume';
    
        var o = buildOptions(rng, pv, cands);
        return {
            question: 'An installation has ' + inst.meter.art + ' ' + inst.meter.label + ' meter, ' +
                describePipes(inst) + ', and ' + fitText + '.\n\nWhat is the purge volume (PV)?',
            answers: o.answers,
            correct: o.correct,
            explanation: explain,
            source: 'S2-23'
        };
    }
 
  // Type C: IV from a full installation spec.
  function ivFromSpec(rng) {
    var inst = buildInstallation(rng);
    var iv = round5(inst.ivt);
    var ivNoFit = round5(inst.meter.ivm + inst.ivp);
    var pipeOnly = round5(inst.ivp + inst.ivf);
 
    var working = 'IVt = IVm + IVp + IVf. IVm (' + inst.meter.label + ') = ' +
      fmt(inst.meter.ivm) + '; IVp = ' + fmt(inst.ivp) + '; IVf = ' + fmt(inst.ivf) +
      '. Total = ' + fmt(iv) + '.';
 
    var cands = [ivNoFit, pipeOnly, round5(inst.meter.ivm + inst.ivp + 2 * inst.ivf)];
    var o = buildOptions(rng, iv, cands);
    return {
        question: 'Calculate the installation volume (IV) for: ' + inst.meter.art + ' ' + inst.meter.label +
            ' meter, ' + describePipes(inst) + ', and ' +
            (inst.fittings === 'unknown'
            ? 'fittings volume unknown.'
            : 'no additional fittings.'),
        answers: o.answers,
        correct: o.correct,
        explanation: working,
        source: 'S2-23'
    };
  }
 
  var BUILDERS = [purgeFromIv, purgeFromSpec, purgeFromSpec, ivFromSpec];
 
  function generateQuestion(opts) {
    opts = opts || {};
    var rng = makeRng(opts.seed);
    var builder = opts.type === 'iv' ? ivFromSpec
        : opts.type === 'pv' ? purgeFromSpec
        : opts.type === 'pv-from-iv' ? purgeFromIv
        : pick(rng, BUILDERS);
    return builder(rng);
  }
 
    function generateQuiz(n, opts) {
        n = n || 10;
        opts = opts || {};
        var out = [];
        for (var i = 0; i < n; i++) {
            // derive a per-question seed when a base seed is given (reproducible)
            var qOpts = { type: opts.type };
            if (opts.seed !== undefined && opts.seed !== null) qOpts.seed = (opts.seed + i * 2654435761) >>> 0;
            out.push(generateQuestion(qOpts));
        }
        return out;
    }
 
    var API = {
        generateQuestion: generateQuestion,
        generateQuiz: generateQuiz,
        _internal: { buildInstallation: buildInstallation, METERS: METERS, PIPES: PIPES, makeRng: makeRng, round5: round5 }
    };
 
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    root.PurgeVolumeGenerator = API;

})(typeof window !== 'undefined' ? window : this);