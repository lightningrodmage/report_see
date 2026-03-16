/* Prototype-only: simulated realtime dashboard data (no backend). */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const PROJECTS = ["PT122", "PT228", "PC122", "PC228", "MRD", "CNS", "HE180", "L218"];
  const QC_METRICS = [
    { key: "mapRate", name: "比对率", unit: "%", fmt: (v) => `${v.toFixed(2)}%` },
    { key: "onTargetRate", name: "Reads On Target Rate", unit: "%", fmt: (v) => `${v.toFixed(2)}%` },
    { key: "dupRate", name: "Duplicate Rate", unit: "%", fmt: (v) => `${v.toFixed(2)}%` },
    { key: "libComplexity", name: "Library Complexity", unit: "", fmt: (v) => v.toFixed(3) },
    { key: "fold80", name: "Fold80", unit: "", fmt: (v) => v.toFixed(2) },
    { key: "medianInsert", name: "Median Insert Size", unit: "bp", fmt: (v) => `${Math.round(v)}` },
  ];
  const CANCERS = ["肺癌", "乳腺癌", "结直肠癌", "胃癌", "肝癌", "卵巢癌", "前列腺癌"];
  const VAR_TYPES = [
    { key: "snv", name: "SNV" },
    { key: "indel", name: "INDEL" },
    { key: "fusion", name: "Fusion" },
    { key: "cnv", name: "CNV" },
  ];
  const HOT_VARIANTS = [
    { id: "EGFR_L858R", type: "snv", label: "EGFR L858R" },
    { id: "EGFR_T790M", type: "snv", label: "EGFR T790M" },
    { id: "EGFR_G719S", type: "snv", label: "EGFR G719S" },
    { id: "EGFR_19DEL", type: "indel", label: "EGFR 19DEL" },
    { id: "EGFR_20ins", type: "indel", label: "EGFR 20ins" },
    { id: "EML4_ALK_E6A20", type: "fusion", label: "EML4-ALK(E6:A20)" },
    { id: "CCDC6_RET_C4R10", type: "fusion", label: "CCDC6-RET(C4:R10)" },
    { id: "KIF5B_RET_K5R32", type: "fusion", label: "KIF5B-RET(K5:R32)" },
    { id: "ERBB2_Amp", type: "cnv", label: "ERBB2 Amp" },
    { id: "MET_Amp", type: "cnv", label: "MET Amp" },
  ];
  const SPECIAL_METRICS = ["MSI", "TMB", "HRD", "LOH"];
  const BIO_PEOPLE = ["生信-林泽", "生信-周晴", "生信-韩烁", "生信-许然"];
  const REPORT_PEOPLE = ["报告-张宁", "报告-李珂", "报告-王然", "报告-陈琪"];

  const PLOT_TEMPLATES = [
    { id: "volcano", name: "火山图", sub: "差异基因" },
    { id: "heatmap", name: "热图", sub: "基因×样本" },
    { id: "survival", name: "生存曲线", sub: "Kaplan-Meier" },
    { id: "scatter", name: "散点图", sub: "二维分布" },
    { id: "bar", name: "柱状图", sub: "分组比较" },
    { id: "box", name: "箱线图", sub: "分布比较" },
    { id: "line", name: "折线图", sub: "趋势" },
    { id: "venn", name: "韦恩图", sub: "集合" },
    { id: "pca", name: "PCA 图", sub: "降维" },
    { id: "corr", name: "相关性热图", sub: "相关系数" },
    { id: "forest", name: "森林图", sub: "Meta" },
    { id: "bubble", name: "气泡图", sub: "三维" },
  ];

  const STAGES = [
    { key: "exp", name: "实验中", slaMin: 180, color: ["#7c5cff", "#22d3ee"] },
    { key: "ana", name: "分析中", slaMin: 240, color: ["#22d3ee", "#2de38b"] },
    { key: "bio", name: "生信审核中", slaMin: 360, color: ["#2de38b", "#ffcc66"] },
    { key: "rep", name: "报告审核中", slaMin: 480, color: ["#ffcc66", "#ff5c7a"] },
    { key: "pub", name: "已发布", slaMin: 0, color: ["#2de38b", "#22d3ee"] },
  ];

  const state = {
    paused: false,
    minuteSeries: [], // last 60 minutes net samples in pipeline
    lastTotal: null,
    kpi: {
      totalToday: 0,
      publishedToday: 0,
      abnormal: 0,
      running: 0,
    },
    flow: Object.fromEntries(STAGES.map((s) => [s.key, { count: 0, avgMin: 0, p95Min: 0 }])),
    abnormalTop: [],
    alerts: [],
    qcSeq: {
      batches: [],
      selectedBatchId: null,
      selectedMetricKey: "mapRate",
      selectedSampleId: null,
    },
    qcResult: {
      byBatch: new Map(), // batchId -> qc result data
      selectedBatchId: null,
      selectedCancers: new Set(["肺癌", "乳腺癌"]),
      selectedVarTypes: new Set(["snv", "indel"]),
      selectedVariants: new Set(["EGFR_L858R", "EGFR_19DEL"]),
      trendRangeDays: 30,
      selectedProject: "PT122",
      monthlySiteByProject: {},
      monthlyVafByProject: {},
      selectedMonthlySiteProject: "PT122",
      selectedMonthlyVafProject: "PT122",
    },
    productivity: {
      scope: "batch", // batch | month | stats
      selectedBatchId: null,
      selectedMonth: null, // YYYY-MM
      byBatch: new Map(),
      byMonth: new Map(),
      statsMonthly: [], // 2025-06 至今模拟数据，供数据统计
      statsTatProject: "PT122",
      statsPerson: null, // 第一个人员，init 时设
      statsInterveneProject: "PT122",
      statsAbnProject: "PT122",
    },
    plotService: {
      selectedTemplateId: "volcano",
      uploadedFile: null,
      imageDataUrl: null,
    },
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function fmtInt(n) {
    return new Intl.NumberFormat("zh-CN").format(Math.round(n));
  }

  function fmtNum(n, digits = 2) {
    if (!Number.isFinite(n)) return "--";
    return Number(n).toFixed(digits);
  }

  function fmtMin(min) {
    if (!Number.isFinite(min)) return "--";
    const m = Math.max(0, Math.round(min));
    if (m < 60) return `${m} 分钟`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h < 24) return `${h} 小时 ${r} 分`;
    const d = Math.floor(h / 24);
    const hh = h % 24;
    return `${d} 天 ${hh} 小时`;
  }

  function riskLevel(stage, avgMin, p95Min) {
    if (stage.key === "pub") return "ok";
    const sla = stage.slaMin || 1;
    const score = Math.max(avgMin / sla, p95Min / sla);
    if (score >= 1.2) return "bad";
    if (score >= 0.85) return "warn";
    return "ok";
  }

  function seededRand(seed) {
    // Simple LCG for stable-ish demo randomness per refresh cycle.
    let x = seed % 2147483647;
    if (x <= 0) x += 2147483646;
    return () => (x = (x * 16807) % 2147483647) / 2147483647;
  }

  function initSim() {
    const now = new Date();
    const base = now.getHours() * 60 + now.getMinutes();
    const rnd = seededRand(base + 42);

    state.kpi.totalToday = Math.round(820 + rnd() * 260);
    state.kpi.publishedToday = Math.round(420 + rnd() * 220);
    state.kpi.abnormal = Math.round(8 + rnd() * 18);

    // Flow counts roughly sum to running
    const exp = Math.round(120 + rnd() * 60);
    const ana = Math.round(90 + rnd() * 50);
    const bio = Math.round(70 + rnd() * 40);
    const rep = Math.round(55 + rnd() * 35);
    const pub = Math.round(state.kpi.publishedToday);
    state.flow.exp.count = exp;
    state.flow.ana.count = ana;
    state.flow.bio.count = bio;
    state.flow.rep.count = rep;
    state.flow.pub.count = pub;
    state.kpi.running = exp + ana + bio + rep;

    // Times
    STAGES.forEach((s) => {
      const f = state.flow[s.key];
      if (s.key === "pub") {
        f.avgMin = 0;
        f.p95Min = 0;
        return;
      }
      const jitter = (rnd() - 0.5) * 0.25;
      const avg = s.slaMin * (0.55 + jitter + rnd() * 0.55);
      const p95 = avg * (1.25 + rnd() * 0.85);
      f.avgMin = clamp(avg, 20, 3000);
      f.p95Min = clamp(p95, f.avgMin + 10, 4200);
    });

    // Series (net in running pipeline)
    state.minuteSeries = [];
    let v = state.kpi.running;
    for (let i = 0; i < 60; i++) {
      v += Math.round((rnd() - 0.55) * 10);
      v = clamp(v, 120, 460);
      state.minuteSeries.push(v);
    }

    state.abnormalTop = [
      { name: "样本信息不全", count: Math.round(2 + rnd() * 9) },
      { name: "测序质量偏低(Q30)", count: Math.round(2 + rnd() * 8) },
      { name: "比对率异常", count: Math.round(1 + rnd() * 7) },
      { name: "疑似污染/混样", count: Math.round(1 + rnd() * 6) },
      { name: "报告退回补充", count: Math.round(1 + rnd() * 6) },
    ];

    state.alerts = buildAlerts();
  }

  function normalRand(rnd) {
    // Box-Muller transform
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] === undefined) return sorted[base];
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  function summarizeBox(values) {
    const arr = values.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
    if (!arr.length) return null;
    const q1 = quantile(arr, 0.25);
    const q2 = quantile(arr, 0.5);
    const q3 = quantile(arr, 0.75);
    const iqr = q3 - q1;
    const lowFence = q1 - 1.5 * iqr;
    const highFence = q3 + 1.5 * iqr;
    const whiskerLow = arr.find((x) => x >= lowFence) ?? arr[0];
    const whiskerHigh = arr.slice().reverse().find((x) => x <= highFence) ?? arr[arr.length - 1];
    return {
      min: arr[0],
      max: arr[arr.length - 1],
      q1,
      median: q2,
      q3,
      whiskerLow,
      whiskerHigh,
      lowFence,
      highFence,
      n: arr.length,
    };
  }

  function genQcSeqBatches() {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const batches = [];

    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getTime() - i * dayMs);
      const dateStr = d.toISOString().slice(0, 10);
      const rnd = seededRand(Number(dateStr.replaceAll("-", "")) + 9007);

      const batchId = `BATCH-${dateStr.replaceAll("-", "")}-${Math.floor(rnd() * 900 + 100)}`;

      const clusterDensity = 1400 + rnd() * 700; // K/mm^2
      const yieldGb = 900 + rnd() * 520; // Gb

      // project sample counts
      const projCounts = Object.fromEntries(
        PROJECTS.map((p) => {
          const baseN = p.startsWith("P") ? 18 : 10;
          const n = Math.round(baseN + rnd() * 18);
          return [p, n];
        })
      );

      const samples = [];
      PROJECTS.forEach((p) => {
        const n = projCounts[p];
        for (let j = 0; j < n; j++) {
          const sampleId = `${p}-${dateStr.slice(5).replace("-", "")}-${String(j + 1).padStart(3, "0")}`;
          const laneYield = Math.max(0.4, 2.2 + normalRand(rnd) * 0.55 + (rnd() - 0.5) * 0.4); // Gb per sample

          // metric baselines vary by project a bit
          const projBias = (PROJECTS.indexOf(p) - 3.5) / 20;
          const mapRate = clamp(93 + projBias * 3 + normalRand(rnd) * 1.8, 78, 99.8);
          const onTargetRate = clamp(62 + projBias * 6 + normalRand(rnd) * 6.2, 25, 92);
          const dupRate = clamp(12 - projBias * 2 + normalRand(rnd) * 5.5, 1, 55);
          const libComplexity = clamp(0.86 + projBias * 0.04 + normalRand(rnd) * 0.06, 0.35, 1.15);
          const fold80 = clamp(1.45 - projBias * 0.04 + Math.abs(normalRand(rnd)) * 0.18, 1.05, 3.6);
          const medianInsert = clamp(210 + projBias * 18 + normalRand(rnd) * 24, 120, 420);

          // Simulated dual-index: I7 (row) and I5 (column)
          // Keep within a practical grid size for prototype.
          const i7 = `I7-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}`;
          const i5 = `I5-${String(1 + Math.floor(rnd() * 16)).padStart(2, "0")}`;

          samples.push({
            id: sampleId,
            project: p,
            yieldGb: Number(laneYield.toFixed(2)),
            yieldAbnormal: false,
            i7,
            i5,
            metrics: { mapRate, onTargetRate, dupRate, libComplexity, fold80, medianInsert },
          });
        }
      });

      // Mark yield abnormal samples (low yield outliers) for red highlight.
      // Rule (prototype): below max(1.0Gb, Q1 - 1.5*IQR) is abnormal.
      const yieldsSorted = samples.map((s) => s.yieldGb).slice().sort((a, b) => a - b);
      const yQ1 = quantile(yieldsSorted, 0.25);
      const yQ3 = quantile(yieldsSorted, 0.75);
      const yIqr = yQ3 - yQ1;
      const lowFence = yQ1 - 1.5 * yIqr;
      const threshold = Math.max(1.0, lowFence);
      samples.forEach((s) => {
        s.yieldAbnormal = s.yieldGb < threshold;
      });

      // Controls: pos/neg per project
      const controls = Object.fromEntries(
        PROJECTS.map((p) => {
          const rnd2 = seededRand(Number(dateStr.replaceAll("-", "")) + 1000 + PROJECTS.indexOf(p) * 17);
          const posOk = rnd2() > 0.12;
          const negOk = rnd2() > 0.10;
          const posVal = clamp(0.90 + normalRand(rnd2) * 0.05, 0.60, 1.10);
          const negVal = clamp(0.06 + Math.abs(normalRand(rnd2)) * 0.05, 0.00, 0.25);
          return [
            p,
            {
              pos: { ok: posOk, value: posVal, note: "阳控（相对值）" },
              neg: { ok: negOk, value: negVal, note: "阴控（相对值）" },
            },
          ];
        })
      );

      batches.push({
        id: batchId,
        date: dateStr,
        runName: `Run-${dateStr.slice(5).replace("-", "")}-${Math.floor(rnd() * 90 + 10)}`,
        flowcell: `FC${Math.floor(rnd() * 900000 + 100000)}`,
        clusterDensity,
        yieldGb,
        samples,
        controls,
      });
    }

    return batches;
  }

  function initQcSeqSim() {
    const batches = genQcSeqBatches();
    state.qcSeq.batches = batches;
    state.qcSeq.selectedBatchId = batches[0]?.id ?? null;
    state.qcSeq.selectedMetricKey = state.qcSeq.selectedMetricKey || "mapRate";
    const firstSample = batches[0]?.samples?.[0]?.id ?? null;
    state.qcSeq.selectedSampleId = firstSample;
  }

  function genQcResultForBatch(batch, seedBase) {
    const rnd = seededRand(seedBase);

    // Per-cancer tested counts (for the day/batch)
    const testedByCancer = Object.fromEntries(
      CANCERS.map((c) => {
        const base = 40 + Math.floor(rnd() * 120);
        return [c, base];
      })
    );

    // Positive rates by (cancer x vartype)
    const posRate = {};
    CANCERS.forEach((c) => {
      posRate[c] = {};
      VAR_TYPES.forEach((v) => {
        // make SNV/INDEL higher, Fusion/CNV lower-ish
        const vtBias = v.key === "snv" ? 0.18 : v.key === "indel" ? 0.12 : v.key === "fusion" ? 0.06 : 0.08;
        const caBias = (CANCERS.indexOf(c) - 3) * 0.008;
        const r = clamp(vtBias + caBias + normalRand(rnd) * 0.03 + rnd() * 0.06, 0.01, 0.55);
        posRate[c][v.key] = r;
      });
    });

    // Special metrics positivity rates
    const special = {
      MSI: clamp(0.05 + rnd() * 0.06 + normalRand(rnd) * 0.01, 0.0, 0.25),
      TMB: clamp(0.12 + rnd() * 0.10 + normalRand(rnd) * 0.02, 0.0, 0.45),
      HRD: clamp(0.08 + rnd() * 0.08 + normalRand(rnd) * 0.02, 0.0, 0.35),
      LOH: clamp(0.10 + rnd() * 0.08 + normalRand(rnd) * 0.02, 0.0, 0.35),
    };

    // Class I/II/III stats for batch
    const classStats = {
      I: {
        siteCount: Math.round(180 + rnd() * 220),
        posSamples: Math.round(28 + rnd() * 65),
        tested: Math.round(220 + rnd() * 160),
      },
      II: {
        siteCount: Math.round(260 + rnd() * 320),
        posSamples: Math.round(40 + rnd() * 90),
        tested: Math.round(220 + rnd() * 160),
      },
      III: {
        siteCount: Math.round(110 + rnd() * 180),
        posSamples: Math.round(18 + rnd() * 48),
        tested: Math.round(220 + rnd() * 160),
      },
    };

    // Per-project per-sample site counts + class composition + VAF points
    const projects = {};
    PROJECTS.forEach((p) => {
      const samples = batch.samples.filter((s) => s.project === p);
      const rows = [];
      const vafPoints = []; // {klass, vaf}
      samples.forEach((s) => {
        const base = p.startsWith("P") ? 16 : 10;
        const site = clamp(Math.round(base + rnd() * 26 + Math.abs(normalRand(rnd)) * 6), 0, 120);
        const iCnt = clamp(Math.round(site * (0.25 + rnd() * 0.20)), 0, 120);
        const iiCnt = clamp(Math.round(site * (0.45 + rnd() * 0.20)), 0, 120);
        const iiiCnt = clamp(site - iCnt - iiCnt, 0, 120);

        // VAF per site (a few points per class for scatter)
        const pushVaf = (klass, n, mu, sigma) => {
          for (let k = 0; k < n; k++) {
            const v = clamp(mu + Math.abs(normalRand(rnd)) * sigma + (rnd() - 0.5) * sigma, 0.001, 0.85);
            vafPoints.push({ klass, vaf: v, sampleProject: p });
          }
        };
        pushVaf("I", clamp(Math.round(iCnt / 6), 1, 8), 0.20, 0.08);
        pushVaf("II", clamp(Math.round(iiCnt / 7), 1, 10), 0.12, 0.07);
        pushVaf("III", clamp(Math.round(iiiCnt / 6), 1, 8), 0.06, 0.05);

        rows.push({
          sampleId: s.id,
          siteCount: site,
          class: { I: iCnt, II: iiCnt, III: iiiCnt },
        });
      });

      const counts = rows.map((r) => r.siteCount).slice().sort((a, b) => a - b);
      const avg = rows.length ? rows.reduce((a, r) => a + r.siteCount, 0) / rows.length : 0;
      const p95 = rows.length ? quantile(counts, 0.95) : 0;
      projects[p] = { sampleN: rows.length, avgSite: avg, p95Site: p95, rows, vafPoints };
    });

    // Trend series for 60 days (aggregate positive rate)
    const trendDays = 60;
    const trend = [];
    let baseRate = clamp(0.22 + normalRand(rnd) * 0.03 + rnd() * 0.05, 0.05, 0.55);
    const specialScoreTrend = { MSI: [], TMB: [], HRD: [], LOH: [] };
    let msiBase = 18 + rnd() * 14, tmbBase = 5 + rnd() * 8, hrdBase = 32 + rnd() * 18, lohBase = 2 + rnd() * 4;
    for (let i = trendDays - 1; i >= 0; i--) {
      baseRate = clamp(baseRate + (normalRand(rnd) * 0.004 + (rnd() - 0.5) * 0.006), 0.03, 0.65);
      const d = new Date(new Date(batch.date).getTime() - i * 24 * 60 * 60 * 1000);
      const date = d.toISOString().slice(0, 10);
      trend.push({ date, posRate: baseRate });
      msiBase = clamp(msiBase + normalRand(rnd) * 1.2 + (rnd() - 0.5) * 0.8, 8, 38);
      tmbBase = clamp(tmbBase + normalRand(rnd) * 0.8 + (rnd() - 0.5) * 0.5, 1, 22);
      hrdBase = clamp(hrdBase + normalRand(rnd) * 1.5 + (rnd() - 0.5) * 1, 18, 58);
      lohBase = clamp(lohBase + normalRand(rnd) * 0.4 + (rnd() - 0.5) * 0.3, 0, 9);
      const nPerDay = 4 + Math.floor(rnd() * 6);
      for (let k = 0; k < nPerDay; k++) {
        specialScoreTrend.MSI.push({ date, score: clamp(msiBase + normalRand(rnd) * 3 + (rnd() - 0.5) * 4, 5, 42) });
        specialScoreTrend.TMB.push({ date, score: clamp(tmbBase + normalRand(rnd) * 1.5 + (rnd() - 0.5) * 2, 0.5, 25) });
        specialScoreTrend.HRD.push({ date, score: clamp(hrdBase + normalRand(rnd) * 4 + (rnd() - 0.5) * 3, 15, 62) });
        specialScoreTrend.LOH.push({ date, score: clamp(lohBase + normalRand(rnd) * 0.8 + (rnd() - 0.5) * 0.6, 0, 10) });
      }
    }

    // Hot variant positivity by (cancer x variant)
    // We keep this independent from type-level rates (prototype).
    const variantRate = {};
    CANCERS.forEach((c) => {
      variantRate[c] = {};
      HOT_VARIANTS.forEach((v) => {
        const vt = v.type;
        const base = posRate[c]?.[vt] ?? 0.1;
        const vBias =
          v.id.includes("EGFR") ? 0.10 :
          v.id.includes("ALK") ? 0.04 :
          v.id.includes("RET") ? 0.03 :
          v.id.includes("Amp") ? 0.05 : 0.02;
        const r = clamp(base * (0.35 + rnd() * 0.55) + vBias + normalRand(rnd) * 0.02, 0.0, 0.65);
        variantRate[c][v.id] = r;
      });
    });

    return { testedByCancer, posRate, variantRate, special, classStats, projects, trend, specialScoreTrend };
  }

  function initQcResultSim() {
    state.qcResult.byBatch = new Map();
    const batches = state.qcSeq.batches;
    batches.forEach((b) => {
      const seed = Number(b.date.replaceAll("-", "")) + 42001;
      state.qcResult.byBatch.set(b.id, genQcResultForBatch(b, seed));
    });
    state.qcResult.selectedBatchId = batches[0]?.id ?? null;
    state.qcResult.selectedProject = PROJECTS[0];
    genMonthlyQcResult();
  }

  function genMonthlyQcResult() {
    const rnd = seededRand(33001);
    const now = new Date();
    const monthlySite = {};
    const monthlyVaf = {};
    PROJECTS.forEach((p) => {
      monthlySite[p] = [];
      monthlyVaf[p] = [];
      for (let m = 11; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const month = d.toISOString().slice(0, 7);
        const n = 15 + Math.floor(rnd() * 35);
        const values = [];
        const base = p.startsWith("P") ? 16 : 10;
        for (let i = 0; i < n; i++) {
          values.push(clamp(Math.round(base + rnd() * 26 + normalRand(rnd) * 5), 0, 100));
        }
        monthlySite[p].push({ month, values });
        const points = [];
        ["I", "II", "III"].forEach((klass, ki) => {
          const mu = [0.22, 0.12, 0.06][ki];
          const sigma = 0.06 + rnd() * 0.04;
          for (let k = 0; k < 8 + Math.floor(rnd() * 12); k++) {
            points.push({ klass, vaf: clamp(mu + normalRand(rnd) * sigma, 0.01, 0.85) });
          }
        });
        monthlyVaf[p].push({ month, points });
      }
    });
    state.qcResult.monthlySiteByProject = monthlySite;
    state.qcResult.monthlyVafByProject = monthlyVaf;
  }

  function monthKey(dateStr) {
    return dateStr.slice(0, 7);
  }

  function genProductivityForBatch(batch, seedBase) {
    const rnd = seededRand(seedBase);

    // TAT (hours) by project: lab / bio / report / total
    const tat = {};
    PROJECTS.forEach((p) => {
      const lab = clamp(10 + rnd() * 14 + Math.abs(normalRand(rnd)) * 4, 3, 60);
      const bio = clamp(6 + rnd() * 12 + Math.abs(normalRand(rnd)) * 3, 2, 48);
      const rep = clamp(5 + rnd() * 10 + Math.abs(normalRand(rnd)) * 3, 1, 36);
      const total = lab + bio + rep + clamp(rnd() * 6, 0, 12);
      tat[p] = { lab, bio, rep, total };
    });

    // People throughput
    const people = {};
    [...BIO_PEOPLE, ...REPORT_PEOPLE].forEach((name) => {
      const isBio = name.startsWith("生信");
      const isRep = name.startsWith("报告");
      const bioSites = isBio ? Math.round(2200 + rnd() * 4200) : 0;
      const bioSamples = isBio ? Math.round(22 + rnd() * 55) : 0;
      const repSites = isRep ? Math.round(1800 + rnd() * 3600) : 0;
      const repSamples = isRep ? Math.round(18 + rnd() * 48) : 0;
      people[name] = { bioSites, bioSamples, repSites, repSamples };
    });

    // Avg handle time (hours) by project x person (for all people, but bio people focus on bio step and report people on report step)
    const projPerson = {};
    PROJECTS.forEach((p) => {
      projPerson[p] = {};
      [...BIO_PEOPLE, ...REPORT_PEOPLE].forEach((name) => {
        const base = name.startsWith("生信") ? 1.8 : 1.5;
        const projBias = (PROJECTS.indexOf(p) - 3.5) * 0.06;
        const personBias = (name.charCodeAt(name.length - 1) % 7) * 0.03;
        const v = clamp(base + projBias + personBias + Math.abs(normalRand(rnd)) * 0.55 + rnd() * 0.35, 0.4, 8.5);
        projPerson[p][name] = v;
      });
    });

    // Interventions by project
    const intervene = {};
    PROJECTS.forEach((p) => {
      const delSites = Math.round(rnd() * 240 + Math.abs(normalRand(rnd)) * 30);
      const igvSamples = Math.round(rnd() * 26 + Math.abs(normalRand(rnd)) * 6);
      intervene[p] = { delSites, igvSamples };
    });

    // Abnormal samples by project
    const abnormal = {};
    PROJECTS.forEach((p) => {
      const ooc = Math.round(rnd() * 10 + Math.abs(normalRand(rnd)) * 2);
      const reSeq = Math.round(rnd() * 6 + Math.abs(normalRand(rnd)) * 2);
      const reExp = Math.round(rnd() * 5 + Math.abs(normalRand(rnd)) * 2);
      const cancel = Math.round(rnd() * 4 + Math.abs(normalRand(rnd)) * 1.5);
      abnormal[p] = { ooc, reSeq, reExp, cancel };
    });

    return { tat, people, projPerson, intervene, abnormal };
  }

  function mergeProductivity(a, b) {
    // Merge by summing counts and averaging durations (simple weighted proxy)
    const out = JSON.parse(JSON.stringify(a));
    // tat: average across batches
    PROJECTS.forEach((p) => {
      const x = out.tat[p];
      const y = b.tat[p];
      x.lab = (x.lab + y.lab) / 2;
      x.bio = (x.bio + y.bio) / 2;
      x.rep = (x.rep + y.rep) / 2;
      x.total = (x.total + y.total) / 2;
    });
    // people: sum
    Object.keys(out.people).forEach((k) => {
      out.people[k].bioSites += b.people[k].bioSites;
      out.people[k].bioSamples += b.people[k].bioSamples;
      out.people[k].repSites += b.people[k].repSites;
      out.people[k].repSamples += b.people[k].repSamples;
    });
    // projPerson: average
    PROJECTS.forEach((p) => {
      Object.keys(out.projPerson[p]).forEach((name) => {
        out.projPerson[p][name] = (out.projPerson[p][name] + b.projPerson[p][name]) / 2;
      });
    });
    // intervene/abnormal: sum
    PROJECTS.forEach((p) => {
      out.intervene[p].delSites += b.intervene[p].delSites;
      out.intervene[p].igvSamples += b.intervene[p].igvSamples;
      out.abnormal[p].ooc += b.abnormal[p].ooc;
      out.abnormal[p].reSeq += b.abnormal[p].reSeq;
      out.abnormal[p].reExp += b.abnormal[p].reExp;
      out.abnormal[p].cancel += b.abnormal[p].cancel;
    });
    return out;
  }

  function genProductivityStatsMonth(monthStr, seedBase) {
    const rnd = seededRand(seedBase);
    const tat = {};
    PROJECTS.forEach((p) => {
      const n = 6 + Math.floor(rnd() * 5);
      const totalValues = [];
      for (let i = 0; i < n; i++) {
        const lab = clamp(10 + rnd() * 14 + Math.abs(normalRand(rnd)) * 4, 3, 60);
        const bio = clamp(6 + rnd() * 12 + Math.abs(normalRand(rnd)) * 3, 2, 48);
        const rep = clamp(5 + rnd() * 10 + Math.abs(normalRand(rnd)) * 3, 1, 36);
        totalValues.push(lab + bio + rep + clamp(rnd() * 6, 0, 12));
      }
      tat[p] = { totalValues };
    });
    const people = {};
    const allPeople = [...BIO_PEOPLE, ...REPORT_PEOPLE];
    allPeople.forEach((name) => {
      const isBio = name.startsWith("生信");
      const n = 6 + Math.floor(rnd() * 5);
      const siteValues = [];
      const sampleValues = [];
      for (let i = 0; i < n; i++) {
        if (isBio) {
          siteValues.push(Math.round(350 + rnd() * 700 + normalRand(rnd) * 80));
          sampleValues.push(Math.round(4 + rnd() * 10 + normalRand(rnd) * 2));
        } else {
          siteValues.push(Math.round(300 + rnd() * 600 + normalRand(rnd) * 70));
          sampleValues.push(Math.round(3 + rnd() * 8 + normalRand(rnd) * 1.5));
        }
      }
      people[name] = { siteValues, sampleValues };
    });
    const intervene = {};
    PROJECTS.forEach((p) => {
      const n = 6 + Math.floor(rnd() * 5);
      const delSitesValues = [];
      for (let i = 0; i < n; i++) {
        delSitesValues.push(Math.round(rnd() * 240 + Math.abs(normalRand(rnd)) * 30));
      }
      intervene[p] = { delSitesValues };
    });
    const abnormal = {};
    PROJECTS.forEach((p) => {
      const n = 6 + Math.floor(rnd() * 5);
      const oocValues = [];
      const reSeqValues = [];
      const reExpValues = [];
      const cancelValues = [];
      for (let i = 0; i < n; i++) {
        oocValues.push(Math.round(rnd() * 10 + Math.abs(normalRand(rnd)) * 2));
        reSeqValues.push(Math.round(rnd() * 6 + Math.abs(normalRand(rnd)) * 2));
        reExpValues.push(Math.round(rnd() * 5 + Math.abs(normalRand(rnd)) * 2));
        cancelValues.push(Math.round(rnd() * 4 + Math.abs(normalRand(rnd)) * 1.5));
      }
      abnormal[p] = { oocValues, reSeqValues, reExpValues, cancelValues };
    });
    return { tat, people, intervene, abnormal };
  }

  function genProductivityStatsMonthly() {
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;
    const list = [];
    for (let y = 2025; y <= endYear; y++) {
      const startM = y === 2025 ? 6 : 1;
      const endM = y === endYear ? endMonth : 12;
      for (let m = startM; m <= endM; m++) {
        const monthStr = `${y}-${String(m).padStart(2, "0")}`;
        const seed = Number(monthStr.replace("-", "")) + 88001;
        list.push({ month: monthStr, data: genProductivityStatsMonth(monthStr, seed) });
      }
    }
    state.productivity.statsMonthly = list;
    if (!state.productivity.statsPerson && (BIO_PEOPLE.length || REPORT_PEOPLE.length)) {
      state.productivity.statsPerson = BIO_PEOPLE[0] || REPORT_PEOPLE[0];
    }
  }

  function initProductivitySim() {
    state.productivity.byBatch = new Map();
    state.productivity.byMonth = new Map();
    const batches = state.qcSeq.batches;
    batches.forEach((b) => {
      const seed = Number(b.date.replaceAll("-", "")) + 91011;
      const pd = genProductivityForBatch(b, seed);
      state.productivity.byBatch.set(b.id, pd);
      const mk = monthKey(b.date);
      const prev = state.productivity.byMonth.get(mk);
      state.productivity.byMonth.set(mk, prev ? mergeProductivity(prev, pd) : pd);
    });
    state.productivity.selectedBatchId = batches[0]?.id ?? null;
    const months = Array.from(state.productivity.byMonth.keys()).sort().reverse();
    state.productivity.selectedMonth = months[0] ?? monthKey(batches[0]?.date ?? new Date().toISOString().slice(0, 10));
    state.productivity.scope = "batch";
    genProductivityStatsMonthly();
  }

  function getProductivityData() {
    if (state.productivity.scope === "month") {
      return state.productivity.byMonth.get(state.productivity.selectedMonth) ?? null;
    }
    return state.productivity.byBatch.get(state.productivity.selectedBatchId) ?? null;
  }

  function renderProductivity() {
    const root = $("#view-productivity");
    if (!root) return;
    const batches = state.qcSeq.batches;
    if (!batches.length) return;

    const scope = state.productivity.scope || "batch";

    const seg = $("#peScopeSeg");
    seg.innerHTML = ["batch", "month", "stats"]
      .map((k) => {
        const active = scope === k;
        const label = k === "batch" ? "按批次" : k === "month" ? "按月份" : "数据统计";
        return `
          <label class="seg__item ${active ? "is-active" : ""}">
            <input type="radio" name="peScope" value="${k}" ${active ? "checked" : ""}/>
            <span>${label}</span>
          </label>
        `;
      })
      .join("");

    const batchField = $("#peBatchField");
    const monthField = $("#peMonthField");
    const tableView = $("#peTableView");
    const statsView = $("#peStatsView");
    batchField.style.display = scope === "batch" ? "" : "none";
    monthField.style.display = scope === "month" ? "" : "none";
    if (tableView) tableView.style.display = scope === "stats" ? "none" : "";
    if (statsView) statsView.style.display = scope === "stats" ? "" : "none";

    if (scope === "stats") {
      renderProductivityStatsView();
      return;
    }

    const batchSel = $("#peBatchSelect");
    upsertOptions(
      batchSel,
      batches.map((b) => ({ value: b.id, label: `${b.date} · ${b.runName} · ${b.flowcell}` })),
      state.productivity.selectedBatchId ?? batches[0].id
    );
    if (!state.productivity.selectedBatchId) state.productivity.selectedBatchId = batchSel.value;

    const monthSel = $("#peMonthSelect");
    const months = Array.from(state.productivity.byMonth.keys()).sort().reverse();
    upsertOptions(
      monthSel,
      months.map((m) => ({ value: m, label: m })),
      state.productivity.selectedMonth ?? months[0]
    );

    const data = getProductivityData();
    if (!data) return;

    const scopeText =
      state.productivity.scope === "batch"
        ? `批次：${batches.find((b) => b.id === state.productivity.selectedBatchId)?.date ?? "—"}`
        : `月份：${state.productivity.selectedMonth}`;

    // ① TAT
    setText("peTatMeta", `${scopeText} · 平均流转时间（小时）`);
    $("#peTatTable").innerHTML = PROJECTS.map((p) => {
      const x = data.tat[p];
      return `
        <div class="table__row pe-row-tat">
          <div><b>${p}</b></div>
          <div class="ta-r">${fmtNum(x.lab, 1)}</div>
          <div class="ta-r">${fmtNum(x.bio, 1)}</div>
          <div class="ta-r">${fmtNum(x.rep, 1)}</div>
          <div class="ta-r"><b>${fmtNum(x.total, 1)}</b></div>
        </div>
      `;
    }).join("");

    // ② People throughput table
    setText("peEffMeta", `${scopeText} · 人员吞吐/时长/干预统计`);
    const peopleRows = Object.entries(data.people)
      .map(([name, x]) => ({ name, ...x }))
      .sort((a, b) => (b.bioSites + b.repSites) - (a.bioSites + a.repSites));
    $("#pePersonTable").innerHTML = peopleRows.map((x) => `
      <div class="table__row pe-row-person">
        <div><b>${x.name}</b></div>
        <div class="ta-r">${fmtInt(x.bioSites)}</div>
        <div class="ta-r">${fmtInt(x.bioSamples)}</div>
        <div class="ta-r">${fmtInt(x.repSites)}</div>
        <div class="ta-r">${fmtInt(x.repSamples)}</div>
      </div>
    `).join("");

    // Project x person avg hours matrix
    const allPeopleTime = [...BIO_PEOPLE, ...REPORT_PEOPLE];
    const headTime = $("#peProjPersonHead");
    const bodyTime = $("#peProjPersonBody");
    const gridTemplateTime = `1fr repeat(${allPeopleTime.length}, 120px)`;
    headTime.innerHTML = [
      `<div>项目 \\ 人员</div>`,
      ...allPeopleTime.map((n) => `<div class="ta-r">${n.split("-")[1]}</div>`),
    ].join("");
    headTime.setAttribute("style", `grid-template-columns:${gridTemplateTime};`);

    const makeRowTime = (html) => `<div class="table__row" style="grid-template-columns:${gridTemplateTime};">${html}</div>`;
    // compute per project min/max to highlight
    bodyTime.innerHTML = PROJECTS.map((p) => {
      const row = data.projPerson[p];
      const vals = allPeopleTime.map((n) => row[n]);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const left = `<div><b>${p}</b></div>`;
      const cells = allPeopleTime
        .map((n) => {
          const v = row[n];
          const cls = v >= max - 0.001 ? "pe-pill pe-pill--hi" : v <= min + 0.001 ? "pe-pill pe-pill--lo" : "pe-pill";
          return `<div class="${cls}">${fmtNum(v, 2)}</div>`;
        })
        .join("");
      return makeRowTime(left + cells);
    }).join("");

    // Intervene table (by project)
    $("#peInterveneTable").innerHTML = PROJECTS.map((p) => {
      const x = data.intervene[p];
      return `
        <div class="table__row pe-row-intervene">
          <div><b>${p}</b></div>
          <div class="ta-r">${fmtInt(x.delSites)}</div>
          <div class="ta-r">${fmtInt(x.igvSamples)}</div>
        </div>
      `;
    }).join("");

    // Efficiency summary cards
    const totalBioSites = BIO_PEOPLE.reduce((a, n) => a + (data.people[n]?.bioSites ?? 0), 0);
    const totalRepSites = REPORT_PEOPLE.reduce((a, n) => a + (data.people[n]?.repSites ?? 0), 0);
    const maxDel = Math.max(...PROJECTS.map((p) => data.intervene[p].delSites));
    const maxDelProj = PROJECTS.find((p) => data.intervene[p].delSites === maxDel) ?? "—";
    const maxTat = Math.max(...PROJECTS.map((p) => data.tat[p].total));
    const maxTatProj = PROJECTS.find((p) => data.tat[p].total === maxTat) ?? "—";
    $("#peEffSummary").innerHTML = [
      { label: "生信审核位点", value: fmtInt(totalBioSites), hint: "合计（生信人员）" },
      { label: "报告解读位点", value: fmtInt(totalRepSites), hint: "合计（报告人员）" },
      { label: "TAT 最高项目", value: maxTatProj, hint: `总流转约 ${fmtNum(maxTat, 1)} h` },
      { label: "干预最多项目", value: maxDelProj, hint: `人工删除位点 ${fmtInt(maxDel)}` },
    ].map((x) => `
      <div class="sum">
        <div class="sum__label">${x.label}</div>
        <div class="sum__value">${x.value}</div>
        <div class="sum__hint">${x.hint}</div>
      </div>
    `).join("");

    // ③ Abnormal
    setText("peAbnMeta", `${scopeText} · 异常类型统计`);
    $("#peAbnTable").innerHTML = PROJECTS.map((p) => {
      const x = data.abnormal[p];
      return `
        <div class="table__row pe-row-abn">
          <div><b>${p}</b></div>
          <div class="ta-r">${fmtInt(x.ooc)}</div>
          <div class="ta-r">${fmtInt(x.reSeq)}</div>
          <div class="ta-r">${fmtInt(x.reExp)}</div>
          <div class="ta-r">${fmtInt(x.cancel)}</div>
        </div>
      `;
    }).join("");
  }

  function renderProductivityStatsView() {
    const list = state.productivity.statsMonthly || [];
    if (!list.length) return;

    const allPeople = [...BIO_PEOPLE, ...REPORT_PEOPLE];

    const tatProj = state.productivity.statsTatProject || PROJECTS[0];
    const tatChips = $("#peStatsTatChips");
    if (tatChips) {
      tatChips.innerHTML = PROJECTS.map(
        (p) => `
        <label class="chip ${tatProj === p ? "is-active" : ""}">
          <input type="radio" name="peStatsTat" value="${p}" ${tatProj === p ? "checked" : ""}/>
          <span>${p}</span>
        </label>`
      ).join("");
    }
    const tatCanvas = $("#peStatsTatCanvas");
    if (tatCanvas) {
      const monthlyData = list.map(({ month, data }) => ({
        month,
        values: (data.tat[tatProj] && data.tat[tatProj].totalValues) ? data.tat[tatProj].totalValues : [],
      }));
      drawMonthlyBoxWithOutliers(tatCanvas, monthlyData, { yFmt: (v) => fmtNum(v, 1) });
    }

    const personSel = state.productivity.statsPerson || allPeople[0];
    const personChips = $("#peStatsPersonChips");
    if (personChips) {
      personChips.innerHTML = allPeople.map(
        (name) => `
        <label class="chip ${personSel === name ? "is-active" : ""}">
          <input type="radio" name="peStatsPerson" value="${name}" ${personSel === name ? "checked" : ""}/>
          <span>${name}</span>
        </label>`
      ).join("");
    }
    const sitesCanvas = $("#peStatsPersonSitesCanvas");
    const samplesCanvas = $("#peStatsPersonSamplesCanvas");
    if (personSel) {
      if (sitesCanvas) {
        const monthlySites = list.map(({ month, data }) => {
          const p = data.people[personSel];
          return { month, values: (p && p.siteValues) ? p.siteValues : [] };
        });
        drawMonthlySiteBoxChart(sitesCanvas, monthlySites);
      }
      if (samplesCanvas) {
        const monthlySamples = list.map(({ month, data }) => {
          const p = data.people[personSel];
          return { month, values: (p && p.sampleValues) ? p.sampleValues : [] };
        });
        drawMonthlySiteBoxChart(samplesCanvas, monthlySamples);
      }
    }

    const intervProj = state.productivity.statsInterveneProject || PROJECTS[0];
    const intervChips = $("#peStatsInterveneChips");
    if (intervChips) {
      intervChips.innerHTML = PROJECTS.map(
        (p) => `
        <label class="chip ${intervProj === p ? "is-active" : ""}">
          <input type="radio" name="peStatsIntervene" value="${p}" ${intervProj === p ? "checked" : ""}/>
          <span>${p}</span>
        </label>`
      ).join("");
    }
    const intervCanvas = $("#peStatsInterveneCanvas");
    if (intervCanvas) {
      const monthlyData = list.map(({ month, data }) => ({
        month,
        values: (data.intervene[intervProj] && data.intervene[intervProj].delSitesValues) ? data.intervene[intervProj].delSitesValues : [],
      }));
      drawMonthlyBoxWithOutliers(intervCanvas, monthlyData);
    }

    const abnProj = state.productivity.statsAbnProject || PROJECTS[0];
    const abnChips = $("#peStatsAbnChips");
    if (abnChips) {
      abnChips.innerHTML = PROJECTS.map(
        (p) => `
        <label class="chip ${abnProj === p ? "is-active" : ""}">
          <input type="radio" name="peStatsAbn" value="${p}" ${abnProj === p ? "checked" : ""}/>
          <span>${p}</span>
        </label>`
      ).join("");
    }
    const oocCanvas = $("#peStatsAbnOocCanvas");
    const reSeqCanvas = $("#peStatsAbnReSeqCanvas");
    const reExpCanvas = $("#peStatsAbnReExpCanvas");
    const cancelCanvas = $("#peStatsAbnCancelCanvas");
    const abnKeys = ["oocValues", "reSeqValues", "reExpValues", "cancelValues"];
    const abnCanvases = [oocCanvas, reSeqCanvas, reExpCanvas, cancelCanvas];
    abnKeys.forEach((key, idx) => {
      const canvas = abnCanvases[idx];
      if (canvas) {
        const monthlyData = list.map(({ month, data }) => ({
          month,
          values: (data.abnormal[abnProj] && data.abnormal[abnProj][key]) ? data.abnormal[abnProj][key] : [],
        }));
        drawMonthlyBoxWithOutliers(canvas, monthlyData);
      }
    });
  }

  function buildAlerts() {
    const alerts = [];
    const stageRank = ["rep", "bio", "ana", "exp"];
    stageRank.forEach((k) => {
      const s = STAGES.find((x) => x.key === k);
      const f = state.flow[k];
      const lvl = riskLevel(s, f.avgMin, f.p95Min);
      if (lvl === "ok") return;
      const over = Math.max(0, Math.round(f.p95Min - s.slaMin));
      alerts.push({
        stage: s.name,
        level: lvl,
        title: `${s.name}环节 SLA 风险`,
        sub: `P95 滞留 ${fmtMin(f.p95Min)}，相对 SLA ${s.slaMin} 分钟${over ? `（超出约 ${over} 分钟）` : ""}`,
      });
    });

    // Add abnormal alert
    if (state.kpi.abnormal >= 18) {
      alerts.unshift({
        stage: "质量控制",
        level: "bad",
        title: "异常样本上升",
        sub: `当前异常样本 ${fmtInt(state.kpi.abnormal)}，建议优先排查 Top 原因并复核关键样本。`,
      });
    } else if (state.kpi.abnormal >= 12) {
      alerts.unshift({
        stage: "质量控制",
        level: "warn",
        title: "异常样本偏高",
        sub: `当前异常样本 ${fmtInt(state.kpi.abnormal)}，建议关注测序/比对指标分布与退回原因。`,
      });
    }

    return alerts.slice(0, 4);
  }

  function tickSim() {
    const seed = Math.floor(Date.now() / 1000);
    const rnd = seededRand(seed);

    // KPIs drift
    const incTotal = rnd() < 0.55 ? 1 : 0;
    state.kpi.totalToday += incTotal;
    const incPub = rnd() < 0.40 ? 1 : 0;
    state.kpi.publishedToday += incPub;

    // Abnormal fluctuates slightly
    state.kpi.abnormal = clamp(
      state.kpi.abnormal + (rnd() < 0.25 ? 1 : rnd() < 0.50 ? -1 : 0),
      2,
      28
    );

    // Flow counts shift
    const shift = (from, to, max) => {
      const move = clamp(Math.round(rnd() * max - max / 2), -max, max);
      state.flow[from].count = clamp(state.flow[from].count - Math.max(0, move), 0, 9999);
      state.flow[to].count = clamp(state.flow[to].count + Math.max(0, move), 0, 9999);
    };

    // Noise per stage
    ["exp", "ana", "bio", "rep"].forEach((k) => {
      const delta = Math.round((rnd() - 0.5) * 6);
      state.flow[k].count = clamp(state.flow[k].count + delta, 0, 9999);
    });
    // Progression bias
    shift("exp", "ana", 6);
    shift("ana", "bio", 5);
    shift("bio", "rep", 4);
    shift("rep", "pub", 7);

    // Update running
    state.kpi.running = ["exp", "ana", "bio", "rep"].reduce((a, k) => a + state.flow[k].count, 0);
    state.flow.pub.count = state.kpi.publishedToday;

    // Times drift
    STAGES.forEach((s) => {
      const f = state.flow[s.key];
      if (s.key === "pub") return;
      const base = s.slaMin;
      const drift = (rnd() - 0.48) * base * 0.02; // small drift
      f.avgMin = clamp(f.avgMin + drift, 20, 4200);
      f.p95Min = clamp(f.p95Min + drift * (1.6 + rnd()), f.avgMin + 10, 4800);
    });

    // Series update
    const last = state.minuteSeries[state.minuteSeries.length - 1] ?? state.kpi.running;
    const next = clamp(last + Math.round((rnd() - 0.48) * 16), 120, 520);
    state.minuteSeries.push(next);
    if (state.minuteSeries.length > 60) state.minuteSeries.shift();

    // Abnormal top shuffle slightly
    state.abnormalTop.forEach((x) => {
      x.count = clamp(x.count + Math.round((rnd() - 0.5) * 2), 0, 20);
    });
    state.abnormalTop.sort((a, b) => b.count - a.count);

    state.alerts = buildAlerts();
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function upsertOptions(selectEl, options, selectedValue) {
    const existing = new Set(Array.from(selectEl.options).map((o) => o.value));
    const desired = new Set(options.map((o) => o.value));
    // rebuild if mismatch
    if (existing.size !== desired.size || options.some((o) => !existing.has(o.value))) {
      selectEl.innerHTML = options
        .map((o) => `<option value="${o.value}">${o.label}</option>`)
        .join("");
    }
    if (selectedValue != null) selectEl.value = selectedValue;
  }

  function drawBars(canvas, items, opts) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const padL = 42, padR = 10, padT = 16, padB = 42;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    ctx.clearRect(0, 0, w, h);

    const values = items.map((x) => x.value);
    const max = Math.max(1e-6, ...values);
    const min = 0;

    // grid
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    // axis labels (y)
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "12px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = max - (max / 4) * i;
      const yy = padT + (innerH / 4) * i;
      ctx.fillText(opts.yFmt ? opts.yFmt(v) : `${v.toFixed(0)}`, padL - 8, yy);
    }

    const barCount = items.length;
    const gap = 6;
    const bw = Math.max(10, (innerW - gap * (barCount - 1)) / barCount);
    const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
    grad.addColorStop(0, "rgba(124,92,255,0.95)");
    grad.addColorStop(1, "rgba(34,211,238,0.45)");

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    items.forEach((it, i) => {
      const x = padL + i * (bw + gap);
      const val = it.value;
      const bh = ((val - min) / (max - min)) * innerH;
      const y = padT + innerH - bh;
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = "rgba(255,255,255,0.64)";
      ctx.font = "11px Inter, system-ui, -apple-system";
      const label = it.label.length > 10 ? `${it.label.slice(0, 8)}…` : it.label;
      ctx.save();
      ctx.translate(x + bw / 2, padT + innerH + 8);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });

    // title
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "12px Inter, system-ui, -apple-system";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (opts.title) ctx.fillText(opts.title, padL, 6);
  }

  function drawBoxPlot(canvas, box, scale, opts) {
    opts = opts || {};
    const outliers = opts.outliers || [];
    const onOutlierClick = opts.onOutlierClick;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const pad = 14;
    const innerH = h - pad * 2;
    const cx = Math.round(w / 2);

    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = pad + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(10, yy);
      ctx.lineTo(w - 10, yy);
      ctx.stroke();
    }
    ctx.restore();

    if (!box) {
      ctx.fillStyle = "rgba(255,255,255,0.52)";
      ctx.font = "12px Inter, system-ui, -apple-system";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("暂无数据", w / 2, h / 2);
      return;
    }

    const yOf = (v) => {
      if (scale.max === scale.min) return pad + innerH / 2;
      return pad + (scale.max - v) * (innerH / (scale.max - scale.min));
    };

    const yWhLow = yOf(box.whiskerLow);
    const yWhHigh = yOf(box.whiskerHigh);
    const yQ1 = yOf(box.q1);
    const yQ3 = yOf(box.q3);
    const yMed = yOf(box.median);

    // whisker line
    ctx.strokeStyle = "rgba(255,255,255,0.70)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, yWhHigh);
    ctx.lineTo(cx, yWhLow);
    ctx.stroke();

    // whisker caps
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 16, yWhHigh);
    ctx.lineTo(cx + 16, yWhHigh);
    ctx.moveTo(cx - 16, yWhLow);
    ctx.lineTo(cx + 16, yWhLow);
    ctx.stroke();

    // box
    const boxW = 44;
    const grad = ctx.createLinearGradient(cx - boxW / 2, 0, cx + boxW / 2, 0);
    grad.addColorStop(0, "rgba(124,92,255,0.55)");
    grad.addColorStop(1, "rgba(34,211,238,0.35)");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(cx - boxW / 2, yQ3, boxW, Math.max(1, yQ1 - yQ3));
    ctx.fill();
    ctx.stroke();

    // median
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - boxW / 2, yMed);
    ctx.lineTo(cx + boxW / 2, yMed);
    ctx.stroke();

    // outlier scatter points (with slight x jitter to avoid overlap)
    const hitAreas = [];
    const dotR = 4;
    outliers.forEach((o, i) => {
      const y = yOf(o.value);
      const jitter = (i % 2 === 0 ? -1 : 1) * (6 + (i % 4) * 3);
      const x = cx + jitter;
      ctx.fillStyle = "rgba(255,92,122,0.85)";
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      hitAreas.push({ x, y, r: dotR + 4, sampleId: o.sampleId });
    });

    // scale labels
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "11px Inter, system-ui, -apple-system";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(fmtNum(scale.max, scale.digits), 8, pad - 2);
    ctx.textBaseline = "bottom";
    ctx.fillText(fmtNum(scale.min, scale.digits), 8, h - pad + 2);

    // Click handler for outlier points
    if (onOutlierClick && hitAreas.length) {
      canvas._boxPlotHitAreas = hitAreas;
      canvas._boxPlotOnClick = onOutlierClick;
      canvas.style.cursor = "pointer";
    } else {
      canvas._boxPlotHitAreas = null;
      canvas._boxPlotOnClick = null;
      canvas.style.cursor = "";
    }
  }

  function handleBoxPlotClick(e, canvas) {
    const hitAreas = canvas._boxPlotHitAreas;
    const onOutlierClick = canvas._boxPlotOnClick;
    if (!hitAreas || !onOutlierClick) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    for (const area of hitAreas) {
      const dx = x - area.x;
      const dy = y - area.y;
      if (dx * dx + dy * dy <= area.r * area.r) {
        onOutlierClick(area.sampleId);
        return;
      }
    }
  }

  function closeBoxModal() {
    const modal = $("#qcBoxModal");
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function closeSpecialChartModal() {
    const modal = $("#qrSpecialChartModal");
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function openPlotPreviewModal() {
    const modal = $("#plotPreviewModal");
    const modalImg = $("#plotPreviewModalImage");
    const url = state.plotService.imageDataUrl;
    if (!modal || !modalImg || !url) return;
    modalImg.src = url;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePlotPreviewModal() {
    const modal = $("#plotPreviewModal");
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function openSpecialChartModal(metricKey, points, cutoff) {
    const modal = $("#qrSpecialChartModal");
    const modalCanvas = $("#qrSpecialChartModalCanvas");
    if (!modal || !modalCanvas) return;
    setText("qrSpecialChartModalTitle", `${metricKey} 分值分布`);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    modalCanvas.width = 920;
    modalCanvas.height = 260;
    drawSpecialScoreChart(modalCanvas, points, metricKey, cutoff);
  }

  function renderKpis() {
    setText("kpiTotal", fmtInt(state.kpi.totalToday));
    setText("kpiRunning", fmtInt(state.kpi.running));
    setText("kpiPublished", fmtInt(state.kpi.publishedToday));
    setText("kpiAbnormal", fmtInt(state.kpi.abnormal));

    const trendEl = $("#kpiTotalTrend");
    const last = state.lastTotal ?? state.kpi.totalToday;
    const diff = state.kpi.totalToday - last;
    state.lastTotal = state.kpi.totalToday;
    const sign = diff > 0 ? "+" : diff < 0 ? "" : "±";
    trendEl.textContent = `${sign}${fmtInt(diff)}`;
    trendEl.style.borderColor =
      diff > 0 ? "rgba(45,227,139,0.22)" : diff < 0 ? "rgba(255,92,122,0.22)" : "rgba(255,255,255,0.12)";
    trendEl.style.background =
      diff > 0 ? "rgba(45,227,139,0.10)" : diff < 0 ? "rgba(255,92,122,0.10)" : "rgba(255,255,255,0.06)";
  }

  function renderPipeline() {
    const maxCount = Math.max(1, ...STAGES.map((s) => state.flow[s.key].count));
    $$(".pipe", $("#pipeline")).forEach((row) => {
      const key = row.getAttribute("data-stage");
      const stage = STAGES.find((s) => s.key === key);
      const f = state.flow[key];
      const pct = clamp((f.count / maxCount) * 100, 4, 100);
      const fill = $(".pipe__fill", row);
      fill.style.width = `${pct}%`;
      if (stage) {
        fill.style.background = `linear-gradient(90deg, ${stage.color[0]}, ${stage.color[1]})`;
      }
      $(".pipe__count", row).textContent = `${fmtInt(f.count)} 个`;
      $(".pipe__time", row).textContent = key === "pub" ? "—" : `平均 ${fmtMin(f.avgMin)}`;
    });

    const table = $("#stageTable");
    const rows = STAGES.map((s) => {
      const f = state.flow[s.key];
      const lvl = riskLevel(s, f.avgMin, f.p95Min);
      const riskText = lvl === "bad" ? "高" : lvl === "warn" ? "中" : "低";
      const cls = lvl === "bad" ? "risk--bad" : lvl === "warn" ? "risk--warn" : "risk--ok";
      return `
        <div class="table__row">
          <div>${s.name}</div>
          <div class="ta-r">${fmtInt(f.count)}</div>
          <div class="ta-r">${s.key === "pub" ? "—" : fmtMin(f.avgMin)}</div>
          <div class="ta-r">${s.key === "pub" ? "—" : fmtMin(f.p95Min)}</div>
          <div class="risk ${cls}">${riskText}</div>
        </div>
      `;
    }).join("");
    table.innerHTML = rows;
  }

  function renderAbnormalBars() {
    const root = $("#abnormalBars");
    const max = Math.max(1, ...state.abnormalTop.map((x) => x.count));
    root.innerHTML = state.abnormalTop.slice(0, 5).map((x) => {
      const pct = clamp((x.count / max) * 100, 6, 100);
      return `
        <div class="bar">
          <div class="bar__label">${x.name}</div>
          <div class="bar__track"><div class="bar__fill" style="width:${pct}%"></div></div>
          <div class="bar__meta">${fmtInt(x.count)}</div>
        </div>
      `;
    }).join("");
  }

  function renderAlerts() {
    const root = $("#alerts");
    const items = state.alerts.length ? state.alerts : [{
      level: "ok",
      title: "暂无重要告警",
      sub: "当前各环节 SLA 风险较低，可持续观察。",
    }];
    root.innerHTML = items.map((a) => {
      const tagCls = a.level === "bad" ? "alert__tag--bad" : a.level === "warn" ? "alert__tag--warn" : "";
      const tagText = a.level === "bad" ? "高风险" : a.level === "warn" ? "中风险" : "正常";
      return `
        <div class="alert">
          <div>
            <div class="alert__title">${a.title}</div>
            <div class="alert__sub">${a.sub}</div>
          </div>
          <div class="alert__tag ${tagCls}">${tagText}</div>
        </div>
      `;
    }).join("");
  }

  function renderSummary() {
    const root = $("#summary");
    const exp = state.flow.exp.count;
    const rep = state.flow.rep.count;
    const riskStages = STAGES.filter((s) => s.key !== "pub")
      .map((s) => ({ s, lvl: riskLevel(s, state.flow[s.key].avgMin, state.flow[s.key].p95Min) }))
      .filter((x) => x.lvl !== "ok")
      .map((x) => x.s.name);

    const items = [
      { label: "在制样本", value: fmtInt(state.kpi.running), hint: "实验→报告审核在途合计" },
      { label: "已发布", value: fmtInt(state.kpi.publishedToday), hint: "今日累计发布" },
      { label: "异常样本", value: fmtInt(state.kpi.abnormal), hint: "需复核/退回/补充" },
      { label: "瓶颈候选", value: riskStages[0] ?? "—", hint: riskStages.length ? `风险环节：${riskStages.join("、")}` : "暂无明显 SLA 风险" },
      { label: "实验中滞留", value: fmtInt(exp), hint: `平均滞留 ${fmtMin(state.flow.exp.avgMin)}` },
      { label: "报告审核滞留", value: fmtInt(rep), hint: `P95 滞留 ${fmtMin(state.flow.rep.p95Min)}` },
    ];
    root.innerHTML = items.map((x) => `
      <div class="sum">
        <div class="sum__label">${x.label}</div>
        <div class="sum__value">${x.value}</div>
        <div class="sum__hint">${x.hint}</div>
      </div>
    `).join("");
  }

  function renderMiniMetrics() {
    const s = state.minuteSeries;
    if (s.length < 2) return;
    const start = s[0];
    const end = s[s.length - 1];
    const delta = end - start;
    // "in/out" are just a heuristic for prototype.
    const inEst = Math.max(0, Math.round(delta + 28 + (Math.random() - 0.5) * 6));
    const outEst = Math.max(0, Math.round(28 + (Math.random() - 0.5) * 6));
    setText("miniIn", fmtInt(inEst));
    setText("miniOut", fmtInt(outEst));
    setText("miniDelta", `${delta >= 0 ? "+" : ""}${fmtInt(delta)}`);
  }

  function drawSparkline() {
    const c = $("#sparkline");
    if (!c) return;
    const ctx = c.getContext("2d");
    const w = c.width;
    const h = c.height;

    const s = state.minuteSeries;
    const min = Math.min(...s);
    const max = Math.max(...s);
    const pad = 18;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const scaleX = innerW / Math.max(1, s.length - 1);
    const scaleY = innerH / Math.max(1, max - min);
    const yOf = (v) => pad + (max - v) * scaleY;

    ctx.clearRect(0, 0, w, h);

    // background grid
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = pad + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad, yy);
      ctx.lineTo(w - pad, yy);
      ctx.stroke();
    }
    ctx.restore();

    // area
    const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
    grad.addColorStop(0, "rgba(124,92,255,0.35)");
    grad.addColorStop(1, "rgba(34,211,238,0.05)");

    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    s.forEach((v, i) => {
      const x = pad + i * scaleX;
      const y = yOf(v);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w - pad, h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    const lineGrad = ctx.createLinearGradient(pad, 0, w - pad, 0);
    lineGrad.addColorStop(0, "#7c5cff");
    lineGrad.addColorStop(1, "#22d3ee");
    ctx.beginPath();
    s.forEach((v, i) => {
      const x = pad + i * scaleX;
      const y = yOf(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // last point
    const lx = pad + (s.length - 1) * scaleX;
    const ly = yOf(s[s.length - 1]);
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#e9e5ff";
    ctx.fill();
    ctx.strokeStyle = "rgba(124,92,255,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // labels
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px Inter, system-ui, -apple-system";
    ctx.fillText(`在制样本（分钟级）`, pad, 16);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(`min ${fmtInt(min)} · max ${fmtInt(max)}`, pad, h - 8);
  }

  function renderTime() {
    const now = new Date();
    setText("nowText", now.toLocaleString("zh-CN", { hour12: false }));
  }

  function getSelectedBatch() {
    const id = state.qcSeq.selectedBatchId;
    return state.qcSeq.batches.find((b) => b.id === id) ?? state.qcSeq.batches[0] ?? null;
  }

  function renderQcSeq() {
    const root = $("#view-qc-seq");
    if (!root) return;

    const batches = state.qcSeq.batches;
    if (!batches.length) return;
    const batch = getSelectedBatch();
    if (!batch) return;

    // Batch selectors
    const seg = $("#qcBatchSeg");
    const select = $("#qcBatchSelect");
    const dates = batches.slice(0, 4).map((b) => b.date);
    const uniqDates = Array.from(new Set(dates));
    seg.innerHTML = uniqDates
      .map((d) => {
        const active = batch.date === d;
        return `
          <label class="seg__item ${active ? "is-active" : ""}">
            <input type="radio" name="qcBatchDate" value="${d}" ${active ? "checked" : ""} />
            <span>${d}</span>
          </label>
        `;
      })
      .join("");

    upsertOptions(
      select,
      batches.map((b) => ({ value: b.id, label: `${b.date} · ${b.runName} · ${b.flowcell}` })),
      batch.id
    );

    // Meta
    setText("qcBatchMeta", `${batch.runName} · ${batch.flowcell} · 样本 ${fmtInt(batch.samples.length)} 个`);
    setText("qcClusterDensity", fmtInt(batch.clusterDensity));
    setText("qcYieldGb", `${fmtInt(batch.yieldGb)} Gb`);
    setText("qcDemuxSamples", fmtInt(batch.samples.length));

    // Yield heatmap by (I5 x I7) index combination
    const hm = $("#qcIndexHeatmap");
    const i5Set = new Set(batch.samples.map((s) => s.i5));
    const i7Set = new Set(batch.samples.map((s) => s.i7));
    const i5List = Array.from(i5Set).sort();
    const i7List = Array.from(i7Set).sort();
    const keyOf = (i7, i5) => `${i7}__${i5}`;
    const cellMap = new Map();

    // Combine if collision happens: sum yield, mark abnormal if any abnormal.
    batch.samples.forEach((s) => {
      const k = keyOf(s.i7, s.i5);
      const prev = cellMap.get(k);
      if (!prev) {
        cellMap.set(k, {
          i7: s.i7,
          i5: s.i5,
          yieldGb: s.yieldGb,
          count: 1,
          abnormal: !!s.yieldAbnormal,
          projects: new Set([s.project]),
        });
      } else {
        prev.yieldGb = Number((prev.yieldGb + s.yieldGb).toFixed(2));
        prev.count += 1;
        prev.abnormal = prev.abnormal || !!s.yieldAbnormal;
        prev.projects.add(s.project);
      }
    });

    const yields = Array.from(cellMap.values()).map((c) => c.yieldGb);
    const yMin = Math.min(...yields);
    const yMax = Math.max(...yields);
    setText("qcHeatMeta", `I7×I5：${fmtInt(i7List.length)}×${fmtInt(i5List.length)} ｜ 已占用组合：${fmtInt(cellMap.size)}`);

    const colorFor = (v) => {
      if (!Number.isFinite(v) || yMax === yMin) return "rgba(255,255,255,0.04)";
      const t = clamp((v - yMin) / (yMax - yMin), 0, 1);
      // Blend between brand -> cyan -> green
      const a = 0.10 + t * 0.34;
      if (t < 0.5) {
        return `rgba(124,92,255,${a})`;
      }
      return `rgba(34,211,238,${a})`;
    };

    // Build grid: (header row + i7 rows) x (axis col + i5 cols)
    hm.style.gridTemplateColumns = `var(--label) repeat(${i5List.length}, var(--cell))`;
    const parts = [];
    parts.push(`<div class="hm-cell hm-cell--header"></div>`);
    i5List.forEach((i5) => {
      parts.push(`<div class="hm-cell hm-cell--header">${i5.replace("I5-","")}</div>`);
    });

    i7List.forEach((i7) => {
      parts.push(`<div class="hm-cell hm-cell--axis">${i7}</div>`);
      i5List.forEach((i5) => {
        const k = keyOf(i7, i5);
        const c = cellMap.get(k);
        if (!c) {
          parts.push(`<div class="hm-cell hm-cell--data" style="opacity:0.55" title="${i7} × ${i5}：空"></div>`);
          return;
        }
        const bg = c.abnormal ? "rgba(255,92,122,0.55)" : colorFor(c.yieldGb);
        const bad = c.abnormal ? "hm-cell--bad" : "";
        const projTxt = Array.from(c.projects).join("、");
        const tip = `
          <div class="hm-tooltip">
            <div><b>${i7}</b> × <b>${i5}</b></div>
            <div>产出：<b>${fmtNum(c.yieldGb, 2)}</b> Gb（${c.count} 个样本）</div>
            <div>项目：${projTxt || "—"}</div>
            <div>状态：<b>${c.abnormal ? "异常" : "正常"}</b></div>
          </div>
        `;
        parts.push(
          `<div class="hm-cell hm-cell--data ${bad}" style="background:${bg}">
            ${fmtNum(c.yieldGb, 1)}
            ${tip}
          </div>`
        );
      });
    });
    hm.innerHTML = parts.join("");

    // Controls
    const controlsRoot = $("#qcControls");
    controlsRoot.innerHTML = PROJECTS.map((p) => {
      const ctrl = batch.controls[p];
      const pos = ctrl?.pos;
      const neg = ctrl?.neg;
      const posCls = pos?.ok ? "badge--ok" : "badge--bad";
      const negCls = neg?.ok ? "badge--ok" : "badge--bad";
      return `
        <div class="qc-control">
          <div>
            <div class="qc-control__proj">${p}</div>
            <div class="qc-control__meta">该批次质控品结果汇总</div>
          </div>
          <div class="qc-pair">
            <span class="badge ${pos ? posCls : "badge--muted"}">阳控：${pos ? (pos.ok ? "在控" : "失控") : "—"} · ${pos ? fmtNum(pos.value, 3) : "--"}</span>
            <span class="badge ${neg ? negCls : "badge--muted"}">阴控：${neg ? (neg.ok ? "在控" : "失控") : "—"} · ${neg ? fmtNum(neg.value, 3) : "--"}</span>
          </div>
        </div>
      `;
    }).join("");

    // Metric chips (single-select)
    const chipRoot = $("#qcMetricChips");
    chipRoot.innerHTML = QC_METRICS.map((m) => {
      const active = state.qcSeq.selectedMetricKey === m.key;
      return `
        <label class="chip ${active ? "is-active" : ""}">
          <input type="radio" name="qcMetric" value="${m.key}" ${active ? "checked" : ""}/>
          <span>${m.name}</span>
        </label>
      `;
    }).join("");

    const metric = QC_METRICS.find((m) => m.key === state.qcSeq.selectedMetricKey) ?? QC_METRICS[0];
    setText("qcBoxTitle", `参数：${metric.name}`);
    setText("qcBoxNote", `展示该批次内各项目所有样本的分布（箱型图），每列为一个项目。`);

    // Box plots per project
    const grid = $("#qcBoxGrid");
    const valuesAll = batch.samples.map((s) => s.metrics[metric.key]).filter((v) => Number.isFinite(v));
    const globalMin = Math.min(...valuesAll);
    const globalMax = Math.max(...valuesAll);
    const digits = metric.unit === "%" ? 1 : metric.key === "medianInsert" ? 0 : 2;
    const scale = { min: globalMin, max: globalMax, digits };

    grid.innerHTML = PROJECTS.map((p) => {
      const projSamples = batch.samples.filter((s) => s.project === p);
      const vals = projSamples.map((s) => s.metrics[metric.key]);
      const box = summarizeBox(vals);
      const n = projSamples.length;
      return `
        <div class="qc-boxcol" data-proj="${p}">
          <div class="qc-boxcol__head">
            <div class="qc-boxcol__title">${p}</div>
            <button type="button" class="qc-boxcol__zoom" title="放大">放大</button>
          </div>
          <div class="qc-boxcol__sub">样本数：${fmtInt(n)}</div>
          <canvas width="180" height="160" aria-label="${p} 箱型图"></canvas>
        </div>
      `;
    }).join("");

    function updateQcSampleDetail(sampleId) {
      state.qcSeq.selectedSampleId = sampleId;
      const sel = $("#qcSampleSelect");
      if (sel) sel.value = sampleId;
      const sample = batch.samples.find((s) => s.id === sampleId);
      if (sample) {
        setText(
          "qcSampleMeta",
          `批次：${batch.date} · ${batch.runName} · ${batch.flowcell} ｜ 项目：${sample.project} ｜ 样本产出：${fmtNum(sample.yieldGb, 2)} Gb`
        );
        const tbody = $("#qcSampleTable");
        tbody.innerHTML = QC_METRICS.map((m) => {
          const v = sample.metrics[m.key];
          const text = Number.isFinite(v) ? m.fmt(v) : "--";
          const unit = m.unit ? m.unit : "—";
          return `
          <div class="table__row table__row--wide">
            <div>${m.name}</div>
            <div class="ta-r">${text}</div>
            <div class="ta-r">${unit}</div>
          </div>`;
        }).join("");
      }
    }

    function openBoxModal(proj, boxData, scaleData, outliersData) {
      const modal = $("#qcBoxModal");
      const modalCanvas = $("#qcBoxModalCanvas");
      if (!modal || !modalCanvas) return;
      setText("qcBoxModalTitle", `${proj} · ${metric.name}`);
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      const cw = 420;
      const ch = 340;
      modalCanvas.width = cw;
      modalCanvas.height = ch;
      const onOutlierClick = (sampleId) => {
        updateQcSampleDetail(sampleId);
        closeBoxModal();
        renderQcSeq();
      };
      drawBoxPlot(modalCanvas, boxData, scaleData, { outliers: outliersData, onOutlierClick });
      modalCanvas.onclick = (e) => handleBoxPlotClick(e, modalCanvas);
    }

    $$(".qc-boxcol", grid).forEach((col) => {
      const p = col.getAttribute("data-proj");
      const projSamples = batch.samples.filter((s) => s.project === p);
      const vals = projSamples.map((s) => s.metrics[metric.key]);
      const box = summarizeBox(vals);
      const outliers = box
        ? projSamples
            .filter((s) => {
              const v = s.metrics[metric.key];
              return Number.isFinite(v) && (v < box.lowFence || v > box.highFence);
            })
            .map((s) => ({ value: s.metrics[metric.key], sampleId: s.id }))
        : [];
      const canvas = $("canvas", col);
      const zoomBtn = $(".qc-boxcol__zoom", col);
      if (zoomBtn) {
        zoomBtn.onclick = () => openBoxModal(p, box, scale, outliers);
      }
      if (canvas) {
        const onOutlierClick = (sampleId) => {
          updateQcSampleDetail(sampleId);
          renderQcSeq();
        };
        drawBoxPlot(canvas, box, scale, { outliers, onOutlierClick });
        canvas.onclick = (e) => handleBoxPlotClick(e, canvas);
      }
    });

    // Sample select + table
    const sampleSel = $("#qcSampleSelect");
    const options = batch.samples.map((s) => ({ value: s.id, label: `${s.id}（${s.project}）` }));
    if (!options.find((o) => o.value === state.qcSeq.selectedSampleId)) {
      state.qcSeq.selectedSampleId = options[0]?.value ?? null;
    }
    upsertOptions(sampleSel, options, state.qcSeq.selectedSampleId);

    const sample = batch.samples.find((s) => s.id === state.qcSeq.selectedSampleId) ?? batch.samples[0];
    if (sample) {
      setText(
        "qcSampleMeta",
        `批次：${batch.date} · ${batch.runName} · ${batch.flowcell} ｜ 项目：${sample.project} ｜ 样本产出：${fmtNum(sample.yieldGb, 2)} Gb`
      );
      const tbody = $("#qcSampleTable");
      tbody.innerHTML = QC_METRICS.map((m) => {
        const v = sample.metrics[m.key];
        const text = Number.isFinite(v) ? m.fmt(v) : "--";
        const unit = m.unit ? m.unit : "—";
        return `
          <div class="table__row table__row--wide">
            <div>${m.name}</div>
            <div class="ta-r">${text}</div>
            <div class="ta-r">${unit}</div>
          </div>
        `;
      }).join("");
    }
  }

  function getQcResult() {
    const id = state.qcResult.selectedBatchId;
    if (!id) return null;
    return state.qcResult.byBatch.get(id) ?? null;
  }

  function pctBadge(rate) {
    const r = Number(rate);
    if (!Number.isFinite(r)) return { cls: "", text: "--" };
    const cls = r >= 0.35 ? "pct--bad" : r >= 0.22 ? "pct--warn" : "pct--ok";
    return { cls, text: `${(r * 100).toFixed(1)}%` };
  }

  function renderQcResult(opts) {
    opts = opts || {};
    const skipMonthly = opts.skipMonthly === true;
    const root = $("#view-qc-result");
    if (!root) return;
    const batches = state.qcSeq.batches;
    if (!batches.length) return;

    const sel = $("#qrBatchSelect");
    upsertOptions(
      sel,
      batches.map((b) => ({ value: b.id, label: `${b.date} · ${b.runName} · ${b.flowcell}` })),
      state.qcResult.selectedBatchId ?? batches[0].id
    );
    if (!state.qcResult.selectedBatchId) state.qcResult.selectedBatchId = sel.value;

    const data = getQcResult();
    const batch = batches.find((b) => b.id === state.qcResult.selectedBatchId) ?? batches[0];
    if (!data || !batch) return;
    setText("qrMeta", `批次日期：${batch.date} · 样本 ${fmtInt(batch.samples.length)} 个`);

    // Cancer chips (multi)
    const cancerRoot = $("#qrCancerChips");
    cancerRoot.innerHTML = CANCERS.map((c) => {
      const active = state.qcResult.selectedCancers.has(c);
      return `
        <label class="chip qr-chip--multi ${active ? "is-active" : ""}">
          <input type="checkbox" name="qrCancer" value="${c}" ${active ? "checked" : ""}/>
          <span>${c}</span>
        </label>
      `;
    }).join("");

    // VarType chips (multi)
    const varRoot = $("#qrVarTypeChips");
    varRoot.innerHTML = VAR_TYPES.map((v) => {
      const active = state.qcResult.selectedVarTypes.has(v.key);
      return `
        <label class="chip qr-chip--multi ${active ? "is-active" : ""}">
          <input type="checkbox" name="qrVarType" value="${v.key}" ${active ? "checked" : ""}/>
          <span>${v.name}</span>
        </label>
      `;
    }).join("");

    // Variant chips filtered by selected var types (multi)
    const variantRoot = $("#qrVariantChips");
    const allowedTypes = state.qcResult.selectedVarTypes;
    const visibleVariants = HOT_VARIANTS.filter((v) => allowedTypes.has(v.type));
    // Ensure selection stays within visible set, but allow empty (then show hint rows)
    const visibleIds = new Set(visibleVariants.map((v) => v.id));
    Array.from(state.qcResult.selectedVariants).forEach((id) => {
      if (!visibleIds.has(id)) state.qcResult.selectedVariants.delete(id);
    });
    if (state.qcResult.selectedVariants.size === 0 && visibleVariants[0]) {
      // pick 1-2 defaults for nicer first render
      state.qcResult.selectedVariants.add(visibleVariants[0].id);
      if (visibleVariants[1]) state.qcResult.selectedVariants.add(visibleVariants[1].id);
    }
    variantRoot.innerHTML = visibleVariants.length
      ? visibleVariants.map((v) => {
          const active = state.qcResult.selectedVariants.has(v.id);
          return `
            <label class="chip qr-chip--multi ${active ? "is-active" : ""}">
              <input type="checkbox" name="qrVariant" value="${v.id}" ${active ? "checked" : ""}/>
              <span>${v.label}</span>
            </label>
          `;
        }).join("")
      : `<div class="qr-note">请先勾选变异类型（SNV/INDEL/Fusion/CNV）以显示可选位点。</div>`;

    // Table 1: Hot variants positivity (aggregate over selected var types)
    const cancers = Array.from(state.qcResult.selectedCancers);
    const vts = Array.from(state.qcResult.selectedVarTypes);
    const hotBody = $("#qrHotTable");
    const rows = cancers.map((c) => {
      const tested = data.testedByCancer[c] ?? 0;
      const r = vts.length
        ? vts.reduce((a, k) => a + (data.posRate[c]?.[k] ?? 0), 0) / vts.length
        : 0;
      const pos = Math.round(tested * r);
      const badge = pctBadge(r);
      return `
        <div class="table__row qr-row-hot">
          <div>${c}</div>
          <div class="ta-r">${fmtInt(tested)}</div>
          <div class="ta-r">${fmtInt(pos)}</div>
          <div class="pct ${badge.cls}">${badge.text}</div>
        </div>
      `;
    });
    const totalTested = cancers.reduce((a, c) => a + (data.testedByCancer[c] ?? 0), 0);
    const totalRate = cancers.length
      ? cancers.reduce((a, c) => {
          const r = vts.length
            ? vts.reduce((x, k) => x + (data.posRate[c]?.[k] ?? 0), 0) / vts.length
            : 0;
          const w = data.testedByCancer[c] ?? 0;
          return a + r * w;
        }, 0) / Math.max(1, totalTested)
      : 0;
    const totalPos = Math.round(totalTested * totalRate);
    const totalBadge = pctBadge(totalRate);
    rows.unshift(`
      <div class="table__row qr-row-hot" style="background: rgba(255,255,255,0.04); border-top:none;">
        <div><b>合计（筛选后）</b></div>
        <div class="ta-r"><b>${fmtInt(totalTested)}</b></div>
        <div class="ta-r"><b>${fmtInt(totalPos)}</b></div>
        <div class="pct ${totalBadge.cls}"><b>${totalBadge.text}</b></div>
      </div>
    `);
    hotBody.innerHTML = rows.join("");

    // Variant x cancer positivity matrix (for selected variants & cancers)
    const matrixHead = $("#qrVariantMatrixHead");
    const matrixBody = $("#qrVariantMatrixBody");
    const selVariants = HOT_VARIANTS.filter((v) => state.qcResult.selectedVariants.has(v.id));
    const selCancers = cancers.length ? cancers : CANCERS.slice(0, 2);
    // head: 2-row grouped header (each cancer => 3 columns: pos / tested / rate)
    const groupCols = selCancers.length * 3;
    const gridTemplate = `1.6fr repeat(${groupCols}, 90px)`;
    const headRow1 = [
      `<div class="th">位点 \\ 癌种</div>`,
      ...selCancers.map((c) => `<div class="th th-group" style="grid-column: span 3;">${c}</div>`),
    ].join("");
    const headRow2 = [
      `<div class="th th-sub"> </div>`,
      ...selCancers
        .map(() => [`<div class="th th-sub">阳性数</div>`, `<div class="th th-sub">检测数</div>`, `<div class="th th-sub">阳性率</div>`].join(""))
        .join(""),
    ].join("");
    matrixHead.innerHTML = `
      <div class="table__row table__row--head" style="grid-template-columns:${gridTemplate}; border-top:none;">${headRow1}</div>
      <div class="table__row table__row--head table__row--subhead" style="grid-template-columns:${gridTemplate};">${headRow2}</div>
    `;

    const makeRow = (cellsHtml) =>
      `<div class="table__row" style="grid-template-columns:${gridTemplate};">${cellsHtml}</div>`;

    if (!selVariants.length) {
      matrixBody.innerHTML = makeRow(
        `<div style="color: rgba(255,255,255,0.62);">未选择位点</div>` +
          selCancers
            .map(() => `<div class="qr-cell qr-cell--muted">—</div><div class="qr-cell qr-cell--muted">—</div><div class="qr-cell qr-cell--muted">—</div>`)
            .join("")
      );
    } else {
      matrixBody.innerHTML = selVariants
        .map((v) => {
          const left =
            `<div><b>${v.label}</b><span style="color: rgba(255,255,255,0.52); font-size:12px;"> · ${v.type.toUpperCase()}</span></div>`;
          const cells = selCancers
            .map((c) => {
              const tested = data.testedByCancer[c] ?? 0;
              const r = data.variantRate[c]?.[v.id];
              if (!Number.isFinite(r) || tested <= 0) {
                return `<div class="qr-cell qr-cell--muted">—</div><div class="qr-cell qr-cell--muted">—</div><div class="qr-cell qr-cell--muted">—</div>`;
              }
              const pos = Math.round(tested * r);
              const badge = pctBadge(r);
              return `
                <div class="qr-cell">${fmtInt(pos)}</div>
                <div class="qr-cell qr-cell--muted">${fmtInt(tested)}</div>
                <div class="pct ${badge.cls}">${badge.text}</div>
              `;
            })
            .join("");
          return makeRow(left + cells);
        })
        .join("");
    }

    // Special metrics table
    const spBody = $("#qrSpecialTable");
    spBody.innerHTML = SPECIAL_METRICS.map((m) => {
      const rate = data.special[m];
      const tested = Math.round(180 + (seededRand(Number(batch.date.replaceAll("-", "")) + m.length)() * 120));
      const pos = Math.round(tested * rate);
      const badge = pctBadge(rate);
      return `
        <div class="table__row qr-row-special">
          <div>${m}</div>
          <div class="ta-r">${fmtInt(pos)}</div>
          <div class="ta-r">${fmtInt(tested)}</div>
          <div class="pct ${badge.cls}">${badge.text}</div>
        </div>
      `;
    }).join("");

    // Class table
    const clsBody = $("#qrClassTable");
    const clsKeys = ["I", "II", "III"];
    clsBody.innerHTML = clsKeys.map((k) => {
      const x = data.classStats[k];
      const rate = (x.posSamples || 0) / Math.max(1, x.tested || 1);
      const badge = pctBadge(rate);
      return `
        <div class="table__row qr-row-class">
          <div>${k} 类位点</div>
          <div class="ta-r">${fmtInt(x.siteCount)}</div>
          <div class="ta-r">${fmtInt(x.posSamples)}</div>
          <div class="pct ${badge.cls}">${badge.text}</div>
        </div>
      `;
    }).join("");

    // Range seg
    const rangeSeg = $("#qrRangeSeg");
    const ranges = [30, 60];
    rangeSeg.innerHTML = ranges
      .map((d) => {
        const active = state.qcResult.trendRangeDays === d;
        return `
          <label class="seg__item ${active ? "is-active" : ""}">
            <input type="radio" name="qrRange" value="${d}" ${active ? "checked" : ""}/>
            <span>近 ${d} 天</span>
          </label>
        `;
      })
      .join("");

    // Trend chart
    const trendCanvas = $("#qrTrend");
    if (trendCanvas) {
      const days = state.qcResult.trendRangeDays;
      const series = data.trend.slice(-days);
      drawTrendLine(trendCanvas, series.map((p) => ({ x: p.date, y: p.posRate })));
      setText("qrTrendNote", `口径：按当前癌种/变异类型筛选的“阳性率”做趋势展示（原型为模拟聚合）。`);
    }

    // MSI / TMB / HRD / LOH 分值趋势（散点 + 趋势线 + cutoff 虚线），每张与趋势图同尺寸，支持放大
    const days = state.qcResult.trendRangeDays;
    const dateSet = new Set(data.trend.slice(-days).map((p) => p.date));
    const specialTrend = data.specialScoreTrend || {};
    ["MSI", "TMB", "HRD", "LOH"].forEach((key) => {
      const el = $(`#qrSpecial${key === "MSI" ? "Msi" : key === "TMB" ? "Tmb" : key === "HRD" ? "Hrd" : "Loh"}`);
      if (el && specialTrend[key]) {
        const series = specialTrend[key].filter((p) => dateSet.has(p.date));
        drawSpecialScoreChart(el, series, key, SPECIAL_CUTOFFS[key]);
        const wrap = el.closest(".qr-special-chart");
        const zoomBtn = wrap ? $(".qr-special-chart__zoom", wrap) : null;
        if (zoomBtn) {
          zoomBtn.onclick = () => openSpecialChartModal(key, series, SPECIAL_CUTOFFS[key]);
        }
      }
    });

    // Project table + select
    const projSel = $("#qrProjectSelect");
    upsertOptions(
      projSel,
      PROJECTS.map((p) => ({ value: p, label: p })),
      state.qcResult.selectedProject
    );
    const projBody = $("#qrProjectTable");
    projBody.innerHTML = PROJECTS.map((p) => {
      const pd = data.projects[p];
      const active = state.qcResult.selectedProject === p;
      return `
        <div class="table__row qr-row-proj row-click ${active ? "row-active" : ""}" data-proj="${p}">
          <div><b>${p}</b></div>
          <div class="ta-r">${fmtInt(pd.sampleN)}</div>
          <div class="ta-r">${fmtNum(pd.avgSite, 1)}</div>
          <div class="ta-r">${fmtNum(pd.p95Site, 0)}</div>
        </div>
      `;
    }).join("");

    const selectedProj = state.qcResult.selectedProject;
    const pd = data.projects[selectedProj];
    setText("qrTopMeta", `${selectedProj} · 样本 ${fmtInt(pd.sampleN)} 个`);

    // Top10 table
    const topBody = $("#qrTop10Table");
    const top10 = pd.rows.slice().sort((a, b) => b.siteCount - a.siteCount).slice(0, 10);
    topBody.innerHTML = top10.map((r) => {
      const total = Math.max(1, r.siteCount);
      const pctI = Math.round((r.class.I / total) * 100);
      const pctII = Math.round((r.class.II / total) * 100);
      const pctIII = Math.max(0, 100 - pctI - pctII);
      return `
        <div class="table__row qr-row-top">
          <div>${r.sampleId}</div>
          <div class="ta-r"><b>${fmtInt(r.siteCount)}</b></div>
          <div class="ta-r">${pctI}% / ${pctII}% / ${pctIII}%</div>
        </div>
      `;
    }).join("");

    // VAF scatter
    const sc = $("#qrVafScatter");
    if (sc) {
      drawVafScatter(sc, pd.vafPoints);
      setText("qrVafNote", `说明：散点为该批次所选项目位点的 VAF 抽样分布（原型模拟），按 I/II/III 类着色。`);
    }

    if (!skipMonthly) {
      const monthlySiteSel = $("#qrMonthlySiteProjectSelect");
      const monthlySiteProject = state.qcResult.selectedMonthlySiteProject || PROJECTS[0];
      if (monthlySiteSel) {
        upsertOptions(monthlySiteSel, PROJECTS.map((p) => ({ value: p, label: p })), monthlySiteProject);
        const monthlySiteData = state.qcResult.monthlySiteByProject?.[monthlySiteProject];
        const monthlySiteCanvas = $("#qrMonthlySiteChart");
        if (monthlySiteCanvas && monthlySiteData) drawMonthlySiteBoxChart(monthlySiteCanvas, monthlySiteData);
      }

      const monthlyVafSel = $("#qrMonthlyVafProjectSelect");
      const monthlyVafProject = state.qcResult.selectedMonthlyVafProject || PROJECTS[0];
      if (monthlyVafSel) {
        upsertOptions(monthlyVafSel, PROJECTS.map((p) => ({ value: p, label: p })), monthlyVafProject);
        const monthlyVafData = state.qcResult.monthlyVafByProject?.[monthlyVafProject];
        const monthlyVafCanvas = $("#qrMonthlyVafChart");
        if (monthlyVafCanvas && monthlyVafData) drawMonthlyVafBoxChart(monthlyVafCanvas, monthlyVafData);
      }
    }
  }

  function drawTrendLine(canvas, points) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const padL = 46, padR = 14, padT = 18, padB = 34;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return;

    const ys = points.map((p) => p.y);
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    yMin = clamp(yMin - 0.03, 0, 1);
    yMax = clamp(yMax + 0.03, 0, 1);
    const xOf = (i) => padL + (i * innerW) / Math.max(1, points.length - 1);
    const yOf = (v) => padT + (yMax - v) * (innerH / Math.max(1e-6, yMax - yMin));

    // grid
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    // y labels
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "12px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = yMax - ((yMax - yMin) / 4) * i;
      const yy = padT + (innerH / 4) * i;
      ctx.fillText(`${(v * 100).toFixed(0)}%`, padL - 8, yy);
    }

    // area
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, "rgba(124,92,255,0.30)");
    grad.addColorStop(1, "rgba(34,211,238,0.06)");
    ctx.beginPath();
    ctx.moveTo(padL, h - padB);
    points.forEach((p, i) => ctx.lineTo(xOf(i), yOf(p.y)));
    ctx.lineTo(w - padR, h - padB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    const lineGrad = ctx.createLinearGradient(padL, 0, w - padR, 0);
    lineGrad.addColorStop(0, "#7c5cff");
    lineGrad.addColorStop(1, "#22d3ee");
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xOf(i), y = yOf(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // x labels (sparse)
    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "11px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const step = points.length > 30 ? 7 : 5;
    points.forEach((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return;
      const x = xOf(i);
      ctx.fillText(p.x.slice(5), x, h - padB + 8);
    });
  }

  function drawMonthlyTrendLine(canvas, points, opts) {
    opts = opts || {};
    const yFmt = opts.yFmt || ((v) => Number(v).toFixed(1));
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const padL = 40;
    const padR = 12;
    const padT = 16;
    const padB = 28;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return;

    const ys = points.map((p) => p.y);
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);
    const pad = (yMax - yMin) * 0.08 || 1;
    yMin = Math.min(yMin, 0) - pad;
    yMax = yMax + pad;
    const xOf = (i) => padL + (i * innerW) / Math.max(1, points.length - 1);
    const yOf = (v) => padT + (yMax - v) * (innerH / Math.max(1e-6, yMax - yMin));

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "11px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = yMax - ((yMax - yMin) / 4) * i;
      const yy = padT + (innerH / 4) * i;
      ctx.fillText(yFmt(v), padL - 6, yy);
    }

    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, "rgba(124,92,255,0.28)");
    grad.addColorStop(1, "rgba(34,211,238,0.06)");
    ctx.beginPath();
    ctx.moveTo(padL, h - padB);
    points.forEach((p, i) => ctx.lineTo(xOf(i), yOf(p.y)));
    ctx.lineTo(w - padR, h - padB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#7c5cff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(xOf(i), yOf(p.y));
      else ctx.lineTo(xOf(i), yOf(p.y));
    });
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "10px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const step = Math.max(1, Math.ceil(points.length / 8));
    points.forEach((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return;
      ctx.fillText(String(p.x).slice(2), xOf(i), h - padB + 6);
    });
  }

  const SPECIAL_CUTOFFS = { MSI: 27, TMB: 10, HRD: 42, LOH: 4 };

  function drawSpecialScoreChart(canvas, points, metricKey, cutoff) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const padL = 40;
    const padR = 10;
    const padT = 16;
    const padB = 28;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return;

    const ys = points.map((p) => p.score);
    let yMin = Math.min(...ys, cutoff);
    let yMax = Math.max(...ys, cutoff);
    const padding = (yMax - yMin) * 0.08 || 1;
    yMin = Math.min(yMin, cutoff) - padding;
    yMax = Math.max(yMax, cutoff) + padding;
    const yOf = (v) => padT + (yMax - v) * (innerH / Math.max(1e-6, yMax - yMin));

    const byDate = new Map();
    points.forEach((p) => {
      if (!byDate.has(p.date)) byDate.set(p.date, []);
      byDate.get(p.date).push(p.score);
    });
    const dates = Array.from(byDate.keys()).sort();
    const xOfDate = (date) => {
      const i = dates.indexOf(date);
      return padL + (i / Math.max(1, dates.length - 1)) * innerW;
    };
    const xOfIndex = (i) => padL + (i / Math.max(1, dates.length - 1)) * innerW;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "11px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = yMax - ((yMax - yMin) / 4) * i;
      const yy = padT + (innerH / 4) * i;
      ctx.fillText(Number(v).toFixed(v >= 10 ? 0 : 1), padL - 6, yy);
    }

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    points.forEach((p) => {
      const x = xOfDate(p.date) + (Math.random() - 0.5) * (innerW / Math.max(dates.length, 1)) * 0.5;
      ctx.beginPath();
      ctx.arc(x, yOf(p.score), 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    const means = dates.map((d) => {
      const arr = byDate.get(d);
      return arr.reduce((a, v) => a + v, 0) / arr.length;
    });
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, "rgba(124,92,255,0.28)");
    grad.addColorStop(1, "rgba(34,211,238,0.06)");
    ctx.beginPath();
    ctx.moveTo(padL, h - padB);
    means.forEach((v, i) => ctx.lineTo(xOfIndex(i), yOf(v)));
    ctx.lineTo(w - padR, h - padB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#7c5cff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    means.forEach((v, i) => {
      if (i === 0) ctx.moveTo(xOfIndex(i), yOf(v));
      else ctx.lineTo(xOfIndex(i), yOf(v));
    });
    ctx.stroke();

    const yCutoff = yOf(cutoff);
    if (yCutoff >= padT && yCutoff <= h - padB) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(255,92,122,0.95)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padL, yCutoff);
      ctx.lineTo(w - padR, yCutoff);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "10px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const step = dates.length > 20 ? Math.ceil(dates.length / 8) : dates.length > 10 ? 2 : 1;
    dates.forEach((date, i) => {
      if (i % step !== 0 && i !== dates.length - 1) return;
      ctx.fillText(date.slice(5), xOfIndex(i), h - padB + 6);
    });
  }

  function drawVafScatter(canvas, pts) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const padL = 46, padR = 14, padT = 18, padB = 34;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!pts.length) return;

    // x: class buckets (I, II, III)
    const classes = ["I", "II", "III"];
    const xPos = (k) => {
      const i = classes.indexOf(k);
      return padL + (innerW * (i + 0.5)) / classes.length;
    };
    const yOf = (v) => padT + (1 - v) * innerH; // vaf 0..1

    // grid
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    // y labels
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "12px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = 1 - i / 4;
      const yy = padT + (innerH / 4) * i;
      ctx.fillText(`${(v * 100).toFixed(0)}%`, padL - 8, yy);
    }

    // x labels
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "12px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    classes.forEach((k) => ctx.fillText(`${k} 类`, xPos(k), h - padB + 8));

    const color = (k) => (k === "I" ? "#7c5cff" : k === "II" ? "#22d3ee" : "#ffcc66");
    ctx.globalAlpha = 0.92;
    pts.slice(0, 420).forEach((p) => {
      const x = xPos(p.klass) + (Math.random() - 0.5) * 36;
      const y = yOf(p.vaf);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = color(p.klass);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawOneBoxAt(ctx, box, scale, cx, boxW, padT, innerH) {
    if (!box) return;
    const yOf = (v) => {
      if (scale.max === scale.min) return padT + innerH / 2;
      return padT + (scale.max - v) * (innerH / (scale.max - scale.min));
    };
    const yWhLow = yOf(box.whiskerLow);
    const yWhHigh = yOf(box.whiskerHigh);
    const yQ1 = yOf(box.q1);
    const yQ3 = yOf(box.q3);
    const yMed = yOf(box.median);
    ctx.strokeStyle = "rgba(255,255,255,0.70)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, yWhHigh);
    ctx.lineTo(cx, yWhLow);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - boxW / 2, yWhHigh);
    ctx.lineTo(cx + boxW / 2, yWhHigh);
    ctx.moveTo(cx - boxW / 2, yWhLow);
    ctx.lineTo(cx + boxW / 2, yWhLow);
    ctx.stroke();
    const grad = ctx.createLinearGradient(cx - boxW / 2, 0, cx + boxW / 2, 0);
    grad.addColorStop(0, "rgba(124,92,255,0.55)");
    grad.addColorStop(1, "rgba(34,211,238,0.35)");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(cx - boxW / 2, yQ3, boxW, Math.max(1, yQ1 - yQ3));
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - boxW / 2, yMed);
    ctx.lineTo(cx + boxW / 2, yMed);
    ctx.stroke();
  }

  function drawMonthlySiteBoxChart(canvas, monthlyData) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const padL = 44;
    const padR = 12;
    const padT = 18;
    const padB = 32;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!monthlyData || !monthlyData.length) return;

    const allVals = monthlyData.flatMap((m) => m.values);
    const globalMin = Math.min(...allVals, 0);
    const globalMax = Math.max(...allVals, 1);
    const scale = { min: globalMin, max: globalMax, digits: 0 };
    const n = monthlyData.length;
    const slotW = innerW / n;
    const boxW = Math.min(28, slotW * 0.7);
    const cxOf = (i) => padL + (i + 0.5) * slotW;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "11px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = globalMax - ((globalMax - globalMin) / 4) * i;
      ctx.fillText(fmtNum(v, 0), padL - 6, padT + (innerH / 4) * i);
    }

    monthlyData.forEach((m, i) => {
      const box = summarizeBox(m.values);
      drawOneBoxAt(ctx, box, scale, cxOf(i), boxW, padT, innerH);
    });

    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "10px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    monthlyData.forEach((m, i) => {
      ctx.fillText(m.month.slice(2), cxOf(i), h - padB + 6);
    });
  }

  function drawMonthlyBoxWithOutliers(canvas, monthlyData, opts) {
    opts = opts || {};
    const yFmt = opts.yFmt || ((v) => fmtNum(v, 0));
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const padL = 44;
    const padR = 12;
    const padT = 18;
    const padB = 32;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!monthlyData || !monthlyData.length) return;

    const allVals = monthlyData.flatMap((m) => m.values || []);
    const globalMin = allVals.length ? Math.min(...allVals, 0) : 0;
    const globalMax = allVals.length ? Math.max(...allVals, 1) : 1;
    const scale = { min: globalMin, max: globalMax, digits: 0 };
    const yOf = (v) => {
      if (scale.max === scale.min) return padT + innerH / 2;
      return padT + (scale.max - v) * (innerH / (scale.max - scale.min));
    };
    const n = monthlyData.length;
    const slotW = innerW / n;
    const boxW = Math.min(28, slotW * 0.7);
    const cxOf = (i) => padL + (i + 0.5) * slotW;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "11px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = globalMax - ((globalMax - globalMin) / 4) * i;
      ctx.fillText(yFmt(v), padL - 6, padT + (innerH / 4) * i);
    }

    monthlyData.forEach((m, i) => {
      const vals = (m.values || []).filter((v) => Number.isFinite(v));
      const box = summarizeBox(vals);
      drawOneBoxAt(ctx, box, scale, cxOf(i), boxW, padT, innerH);
      if (box && vals.length) {
        const outliers = vals.filter((v) => v < box.lowFence || v > box.highFence);
        const dotR = 3;
        ctx.fillStyle = "rgba(255,92,122,0.9)";
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        outliers.forEach((v, k) => {
          const jitter = (k % 2 === 0 ? -1 : 1) * (4 + (k % 3) * 2);
          const x = cxOf(i) + jitter;
          const y = yOf(v);
          ctx.beginPath();
          ctx.arc(x, y, dotR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    });

    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "10px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    monthlyData.forEach((m, i) => {
      ctx.fillText(m.month.slice(2), cxOf(i), h - padB + 6);
    });
  }

  function drawOneBoxAtColored(ctx, box, scale, cx, boxW, padT, innerH, fillStyle) {
    if (!box) return;
    const yOf = (v) => {
      if (scale.max === scale.min) return padT + innerH / 2;
      return padT + (scale.max - v) * (innerH / (scale.max - scale.min));
    };
    const yWhLow = yOf(box.whiskerLow);
    const yWhHigh = yOf(box.whiskerHigh);
    const yQ1 = yOf(box.q1);
    const yQ3 = yOf(box.q3);
    const yMed = yOf(box.median);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, yWhHigh);
    ctx.lineTo(cx, yWhLow);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - boxW / 2, yWhHigh);
    ctx.lineTo(cx + boxW / 2, yWhHigh);
    ctx.moveTo(cx - boxW / 2, yWhLow);
    ctx.lineTo(cx + boxW / 2, yWhLow);
    ctx.stroke();
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(cx - boxW / 2, yQ3, boxW, Math.max(1, yQ1 - yQ3));
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - boxW / 2, yMed);
    ctx.lineTo(cx + boxW / 2, yMed);
    ctx.stroke();
  }

  function drawMonthlyDualBoxChart(canvas, monthlyData) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const padL = 44;
    const padR = 12;
    const padT = 18;
    const padB = 32;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!monthlyData || !monthlyData.length) return;

    const allSites = monthlyData.flatMap((m) => m.siteValues || []);
    const allSamples = monthlyData.flatMap((m) => m.sampleValues || []);
    const yMin = 0;
    const yMax = Math.max(
      allSites.length ? Math.max(...allSites) : 1,
      allSamples.length ? Math.max(...allSamples) : 1,
      1
    );
    const scale = { min: yMin, max: yMax, digits: 0 };
    const n = monthlyData.length;
    const slotW = innerW / n;
    const boxSlotW = slotW / 2;
    const boxW = Math.min(20, boxSlotW * 0.75);
    const cxOf = (monthIdx, slotIdx) => padL + (monthIdx + 0.5) * slotW - slotW / 2 + (slotIdx + 0.5) * boxSlotW;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "11px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = yMax - (yMax / 4) * i;
      ctx.fillText(fmtInt(v), padL - 6, padT + (innerH / 4) * i);
    }

    const colorSites = "rgba(124,92,255,0.55)";
    const colorSamples = "rgba(34,211,238,0.55)";
    monthlyData.forEach((m, monthIdx) => {
      const boxSites = summarizeBox(m.siteValues || []);
      const boxSamples = summarizeBox(m.sampleValues || []);
      drawOneBoxAtColored(ctx, boxSites, scale, cxOf(monthIdx, 0), boxW, padT, innerH, colorSites);
      drawOneBoxAtColored(ctx, boxSamples, scale, cxOf(monthIdx, 1), boxW, padT, innerH, colorSamples);
    });

    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "10px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    monthlyData.forEach((m, i) => {
      ctx.fillText(m.month.slice(2), padL + (i + 0.5) * slotW, h - padB + 6);
    });
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.fillText("位点", padL + slotW / 2 - boxSlotW / 2, h - padB - 10);
    ctx.fillText("样本", padL + slotW / 2 + boxSlotW / 2, h - padB - 10);
  }

  function drawMonthlyVafBoxChart(canvas, monthlyData) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const padL = 44;
    const padR = 12;
    const padT = 18;
    const padB = 36;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!monthlyData || !monthlyData.length) return;

    const classes = ["I", "II", "III"];
    const classColor = { I: "rgba(124,92,255,0.6)", II: "rgba(34,211,238,0.55)", III: "rgba(255,204,102,0.55)" };
    const allVaf = monthlyData.flatMap((m) => (m.points || []).map((p) => p.vaf));
    const globalMin = allVaf.length ? Math.min(...allVaf, 0) : 0;
    const globalMax = allVaf.length ? Math.max(...allVaf, 1) : 1;
    const scale = { min: Math.max(0, globalMin - 0.02), max: Math.min(1, globalMax + 0.02), digits: 2 };
    const nMonths = monthlyData.length;
    const slotW = innerW / nMonths;
    const boxSlotW = slotW / 3;
    const boxW = Math.min(14, boxSlotW * 0.8);
    const cxOf = (monthIdx, classIdx) => padL + (monthIdx + 0.5) * slotW - slotW / 2 + (classIdx + 0.5) * boxSlotW;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "11px Inter, system-ui, -apple-system";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const v = scale.max - ((scale.max - scale.min) / 4) * i;
      ctx.fillText(`${(v * 100).toFixed(0)}%`, padL - 6, padT + (innerH / 4) * i);
    }

    monthlyData.forEach((m, monthIdx) => {
      const byClass = { I: [], II: [], III: [] };
      (m.points || []).forEach((p) => {
        if (byClass[p.klass]) byClass[p.klass].push(p.vaf);
      });
      classes.forEach((klass, classIdx) => {
        const vals = byClass[klass].filter((v) => Number.isFinite(v));
        const box = summarizeBox(vals);
        drawOneBoxAtColored(ctx, box, scale, cxOf(monthIdx, classIdx), boxW, padT, innerH, classColor[klass]);
      });
    });

    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "10px Inter, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    monthlyData.forEach((m, i) => {
      ctx.fillText(m.month.slice(2), padL + (i + 0.5) * slotW, h - padB + 6);
    });
  }

  /** 科研画图示例：生成更真实的模拟数据 */
  function genPlotDemoData(templateId) {
    const seed = Number(templateId.length) + 99;
    const rnd = seededRand(seed);
    const n = (x, s) => x + normalRand(rnd) * s;

    if (templateId === "volcano") {
      const points = [];
      for (let i = 0; i < 180; i++) {
        const log2FC = n(0, 0.8);
        const negLog10P = Math.max(0, n(0.5, 0.6) + rnd() * 2);
        points.push({ log2FC, negLog10P });
      }
      for (let i = 0; i < 25; i++) {
        points.push({ log2FC: n(2, 0.5), negLog10P: 2 + rnd() * 5 + Math.abs(n(0, 1)) });
      }
      for (let i = 0; i < 22; i++) {
        points.push({ log2FC: n(-2, 0.5), negLog10P: 2 + rnd() * 5 + Math.abs(n(0, 1)) });
      }
      return { type: "volcano", points, log2FCRange: [-3.2, 3.2], pRange: [0, 8] };
    }
    if (templateId === "heatmap") {
      const rows = 12, cols = 10;
      const matrix = [];
      for (let i = 0; i < rows; i++) {
        const base = 0.3 + rnd() * 0.5;
        const row = [];
        for (let j = 0; j < cols; j++) {
          row.push(clamp(base + n(0, 0.12) + (rnd() - 0.5) * 0.15, 0, 1));
        }
        matrix.push(row);
      }
      return { type: "heatmap", matrix, rows, cols };
    }
    if (templateId === "corr") {
      const nVar = 8;
      const matrix = [];
      for (let i = 0; i < nVar; i++) {
        const row = [];
        for (let j = 0; j < nVar; j++) {
          if (i === j) row.push(1);
          else if (j < i) row.push(matrix[j][i]);
          else row.push(clamp(n(0.2, 0.35) + (rnd() - 0.5) * 0.4, -0.3, 0.98));
        }
        matrix.push(row);
      }
      return { type: "corr", matrix, nVar };
    }
    if (templateId === "bar") {
      const labels = ["对照", "低剂量", "中剂量", "高剂量", "联合A", "联合B"];
      const values = labels.map((_, i) => Math.round(60 + n(40, 25) + i * 12 + rnd() * 30));
      return { type: "bar", labels, values };
    }
    if (templateId === "box") {
      const groups = ["WT", "Mut-A", "Mut-B", "Mut-C", "Mut-D"];
      const series = groups.map((name, gi) => {
        const mean = 0.35 + gi * 0.12 + (rnd() - 0.5) * 0.1;
        const vals = [];
        for (let k = 0; k < 28 + Math.floor(rnd() * 12); k++) {
          vals.push(clamp(n(mean, 0.08 + rnd() * 0.06), 0.05, 0.95));
        }
        vals.sort((a, b) => a - b);
        return { name, values: vals };
      });
      return { type: "box", series };
    }
    if (templateId === "scatter" || templateId === "pca") {
      const points = [];
      const clusters = templateId === "pca" ? [[-1.2, 0.8], [1.1, -0.7], [0, -1.5]] : [[0.35, 0.4], [0.65, 0.7], [0.5, 0.25]];
      clusters.forEach(([cx, cy], ci) => {
        const npt = ci === 0 ? 45 : ci === 1 ? 38 : 22;
        for (let i = 0; i < npt; i++) {
          points.push({ x: cx + n(0, 0.08), y: cy + n(0, 0.08), cluster: ci });
        }
      });
      return { type: "scatter", points };
    }
    if (templateId === "bubble") {
      const points = [];
      for (let i = 0; i < 55; i++) {
        points.push({
          x: 0.15 + rnd() * 0.7,
          y: 0.2 + rnd() * 0.65,
          size: 0.02 + rnd() * 0.08 + Math.abs(n(0, 0.02))
        });
      }
      return { type: "bubble", points };
    }
    if (templateId === "line") {
      const nPt = 12;
      const s1 = []; let v1 = 0.42 + rnd() * 0.1;
      for (let i = 0; i < nPt; i++) {
        v1 = clamp(v1 + n(0.02, 0.015) + (rnd() - 0.5) * 0.02, 0.2, 0.85);
        s1.push({ x: i, y: v1 });
      }
      const s2 = []; let v2 = 0.58 + rnd() * 0.1;
      for (let i = 0; i < nPt; i++) {
        v2 = clamp(v2 - n(0.015, 0.012) - (rnd() - 0.5) * 0.01, 0.15, 0.9);
        s2.push({ x: i, y: v2 });
      }
      return { type: "line", series: [s1, s2] };
    }
    if (templateId === "survival") {
      const times = [0, 6, 12, 18, 24, 30, 36, 48];
      const s1 = [1, 0.92, 0.85, 0.78, 0.68, 0.58, 0.48, 0.42].map((y, i) => ({ t: times[i], s: y + n(0, 0.02) }));
      const s2 = [1, 0.88, 0.72, 0.58, 0.45, 0.35, 0.28, 0.22].map((y, i) => ({ t: times[i], s: y + n(0, 0.02) }));
      return { type: "survival", series: [s1, s2], timeRange: [0, 48] };
    }
    if (templateId === "venn") {
      return { type: "venn", n1: 128, n2: 95, overlap: 42 };
    }
    if (templateId === "forest") {
      const rows = [
        { label: "Study A", pointEst: 0.92, ciLow: 0.72, ciHigh: 1.18 },
        { label: "Study B", pointEst: 1.15, ciLow: 0.88, ciHigh: 1.52 },
        { label: "Study C", pointEst: 0.78, ciLow: 0.58, ciHigh: 1.05 },
        { label: "Study D", pointEst: 1.32, ciLow: 1.02, ciHigh: 1.71 },
        { label: "Study E", pointEst: 0.95, ciLow: 0.70, ciHigh: 1.28 },
        { label: "Study F", pointEst: 1.08, ciLow: 0.82, ciHigh: 1.42 },
        { label: "Study G", pointEst: 0.88, ciLow: 0.65, ciHigh: 1.18 },
        { label: "Pooled", pointEst: 1.02, ciLow: 0.92, ciHigh: 1.14 }
      ];
      return { type: "forest", rows, xRange: [0.4, 1.9] };
    }
    return { type: "scatter", points: [] };
  }

  function drawPlotChart(canvas, templateId) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const t = PLOT_TEMPLATES.find((x) => x.id === templateId) ?? PLOT_TEMPLATES[0];
    const pad = 40;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, innerW, innerH);

    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.font = "bold 18px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t.name + "（示例）", w / 2, 28);

    const data = genPlotDemoData(templateId);
    const color = (r, g, b, a) => `rgba(${r},${g},${b},${a})`;
    const mapX = (x, xMin, xMax) => pad + ((x - xMin) / (xMax - xMin || 1)) * innerW;
    const mapY = (y, yMin, yMax) => pad + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH;

    function drawAxisLabels(xLabel, yLabel) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.font = "12px Inter, system-ui, sans-serif";
      if (xLabel) {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(xLabel, pad + innerW / 2, pad + innerH + 10);
      }
      if (yLabel) {
        ctx.save();
        ctx.translate(16, pad + innerH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
      }
    }

    if (data.type === "volcano") {
      const { points, log2FCRange, pRange } = data;
      const [xMin, xMax] = log2FCRange;
      const [yMin, yMax] = pRange;
      const cutoffP = 1.3;
      const cutoffFC = 1;
      points.forEach((p) => {
        const px = mapX(p.log2FC, xMin, xMax);
        const py = mapY(p.negLog10P, yMin, yMax);
        const sig = p.negLog10P >= cutoffP && Math.abs(p.log2FC) >= cutoffFC;
        const up = p.log2FC > 0;
        ctx.fillStyle = sig ? (up ? "#ff5c7a" : "#22d3ee") : "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      drawAxisLabels("log₂FC", "-log₁₀(Padj)");
    } else if (data.type === "heatmap") {
      const { matrix, rows, cols } = data;
      const cellW = innerW / cols;
      const cellH = innerH / rows;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const v = (matrix[i][j] - 0) / (1 - 0);
          const g = Math.round(255 * (1 - v));
          ctx.fillStyle = `rgba(124, ${g}, 255, ${0.3 + v * 0.6})`;
          ctx.fillRect(pad + j * cellW, pad + i * cellH, cellW - 1, cellH - 1);
        }
      }
      drawAxisLabels("样本", "基因");
    } else if (data.type === "corr") {
      const { matrix, nVar } = data;
      const cellW = innerW / nVar;
      const cellH = innerH / nVar;
      for (let i = 0; i < nVar; i++) {
        for (let j = 0; j < nVar; j++) {
          const v = (matrix[i][j] + 1) / 2;
          const g = Math.round(255 * (1 - v));
          ctx.fillStyle = `rgba(124, ${g}, 255, ${0.35 + v * 0.5})`;
          ctx.fillRect(pad + j * cellW, pad + i * cellH, cellW - 1, cellH - 1);
        }
      }
      drawAxisLabels("变量", "变量");
    } else if (data.type === "bar") {
      const { values } = data;
      const maxVal = Math.max(...values);
      const n = values.length;
      const barW = innerW / (n + 2);
      for (let i = 0; i < n; i++) {
        const bh = (values[i] / maxVal) * innerH * 0.82;
        const x = pad + (i + 1) * barW;
        const y = pad + innerH - bh;
        const grad = ctx.createLinearGradient(x, y + bh, x, y);
        grad.addColorStop(0, "#22d3ee");
        grad.addColorStop(1, "#7c5cff");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW * 0.72, bh);
      }
      drawAxisLabels("分组", "表达量 / 计数");
    } else if (data.type === "box") {
      const { series } = data;
      const n = series.length;
      const colW = innerW / n;
      const allVals = series.flatMap((s) => s.values);
      const yMin = Math.min(...allVals);
      const yMax = Math.max(...allVals);
      const q = (arr, p) => {
        const sorted = arr.slice().sort((a, b) => a - b);
        const i = (sorted.length - 1) * p;
        return sorted[Math.floor(i)] + (sorted[Math.ceil(i)] - sorted[Math.floor(i)] || 0) * (i % 1);
      };
      series.forEach((s, i) => {
        const vals = s.values;
        const q1 = q(vals, 0.25);
        const q3 = q(vals, 0.75);
        const med = q(vals, 0.5);
        const cx = pad + (i + 0.5) * colW;
        const y1 = mapY(q1, yMin, yMax);
        const y3 = mapY(q3, yMin, yMax);
        const yMed = mapY(med, yMin, yMax);
        const boxH = y1 - y3;
        ctx.strokeStyle = "rgba(124,92,255,0.85)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 16, y3, 32, boxH);
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        ctx.moveTo(cx - 16, yMed);
        ctx.lineTo(cx + 16, yMed);
        ctx.stroke();
        const lo = Math.min(...vals);
        const hi = Math.max(...vals);
        ctx.strokeStyle = "rgba(124,92,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(cx, y3 + boxH);
        ctx.lineTo(cx, mapY(lo, yMin, yMax));
        ctx.moveTo(cx, y3);
        ctx.lineTo(cx, mapY(hi, yMin, yMax));
        ctx.stroke();
      });
      drawAxisLabels("分组", "表达量");
    } else if (data.type === "scatter" && data.points.length) {
      const pts = data.points;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      const padAx = (xMax - xMin) * 0.05 || 0.1;
      const xR = [xMin - padAx, xMax + padAx];
      const yR = [yMin - padAx, yMax + padAx];
      const clusterColor = ["#7c5cff", "#22d3ee", "#ff5c7a"];
      pts.forEach((p) => {
        const px = mapX(p.x, xR[0], xR[1]);
        const py = mapY(p.y, yR[0], yR[1]);
        ctx.fillStyle = clusterColor[p.cluster ?? 0];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      drawAxisLabels(templateId === "pca" ? "PC1" : "变量1", templateId === "pca" ? "PC2" : "变量2");
    } else if (data.type === "bubble") {
      const { points } = data;
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const sizes = points.map((p) => p.size);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      const rMax = Math.max(...sizes);
      points.forEach((p) => {
        const px = mapX(p.x, xMin, xMax);
        const py = mapY(p.y, yMin, yMax);
        const rad = 3 + (p.size / rMax) * 14;
        ctx.fillStyle = color(124, 92, 255, 0.5);
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(124,92,255,0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      drawAxisLabels("变量1", "变量2");
    } else if (data.type === "line") {
      const { series } = data;
      const allX = series.flatMap((s) => s.map((p) => p.x));
      const allY = series.flatMap((s) => s.map((p) => p.y));
      const xMin = Math.min(...allX);
      const xMax = Math.max(...allX);
      const yMin = Math.min(...allY);
      const yMax = Math.max(...allY);
      const colors = ["#7c5cff", "#22d3ee"];
      series.forEach((s, si) => {
        ctx.strokeStyle = colors[si];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        s.forEach((p, i) => {
          const px = mapX(p.x, xMin, xMax);
          const py = mapY(p.y, yMin, yMax);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
      drawAxisLabels("时间 / 处理", "表达量");
    } else if (data.type === "survival") {
      const { series, timeRange } = data;
      const [tMin, tMax] = timeRange;
      const colors = ["#7c5cff", "#ff5c7a"];
      series.forEach((s, si) => {
        ctx.strokeStyle = colors[si];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(mapX(s[0].t, tMin, tMax), mapY(s[0].s, 0, 1));
        for (let i = 1; i < s.length; i++) {
          ctx.lineTo(mapX(s[i].t, tMin, tMax), mapY(s[i].s, 0, 1));
        }
        ctx.stroke();
      });
      drawAxisLabels("时间（月）", "生存概率");
    } else if (data.type === "venn") {
      ctx.fillStyle = "rgba(124,92,255,0.35)";
      ctx.beginPath();
      ctx.arc(pad + innerW * 0.4, pad + innerH * 0.5, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(124,92,255,0.7)";
      ctx.stroke();
      ctx.fillStyle = "rgba(34,211,238,0.35)";
      ctx.beginPath();
      ctx.arc(pad + innerW * 0.6, pad + innerH * 0.5, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawAxisLabels("", "");
    } else if (data.type === "forest") {
      const { rows, xRange } = data;
      const [xMin, xMax] = xRange;
      const n = rows.length;
      const rowH = innerH / n;
      const xRef = mapX(1, xMin, xMax);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xRef, pad);
      ctx.lineTo(xRef, pad + innerH);
      ctx.stroke();
      ctx.setLineDash([]);
      rows.forEach((row, i) => {
        const y = pad + (i + 0.5) * rowH;
        const xL = mapX(row.ciLow, xMin, xMax);
        const xR = mapX(row.ciHigh, xMin, xMax);
        const xP = mapX(row.pointEst, xMin, xMax);
        ctx.strokeStyle = "rgba(124,92,255,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xL, y);
        ctx.lineTo(xR, y);
        ctx.stroke();
        ctx.fillStyle = "#7c5cff";
        ctx.beginPath();
        ctx.arc(xP, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      drawAxisLabels("HR (95% CI)", "研究");
    } else {
      const pts = (data.points || []).length ? data.points : [{ x: 0.5, y: 0.5, cluster: 0 }];
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const xR = [Math.min(...xs) - 0.1, Math.max(...xs) + 0.1];
      const yR = [Math.min(...ys) - 0.1, Math.max(...ys) + 0.1];
      pts.forEach((p) => {
        ctx.fillStyle = color(124, 92, 255, 0.6);
        ctx.beginPath();
        ctx.arc(mapX(p.x, xR[0], xR[1]), mapY(p.y, yR[0], yR[1]), 4, 0, Math.PI * 2);
        ctx.fill();
      });
      drawAxisLabels("变量1", "变量2");
    }
  }

  function renderPlotService() {
    const root = $("#view-plot-service");
    if (!root) return;

    const tid = state.plotService.selectedTemplateId ?? "volcano";
    const t = PLOT_TEMPLATES.find((x) => x.id === tid) ?? PLOT_TEMPLATES[0];
    setText("plotTemplateHint", `已选：${t.name}`);

    const container = $("#plotTemplates");
    container.innerHTML = PLOT_TEMPLATES.map((x) => {
      const active = x.id === tid;
      return `<div class="plot-tpl ${active ? "is-active" : ""}" data-plot-tpl="${x.id}"><div class="plot-tpl__name">${x.name}</div><div class="plot-tpl__sub">${x.sub}</div></div>`;
    }).join("");

    const nameEl = $("#plotFileName");
    if (state.plotService.uploadedFile) {
      nameEl.textContent = `已选：${state.plotService.uploadedFile.name}`;
      nameEl.style.color = "rgba(255,255,255,0.82)";
    } else {
      nameEl.textContent = "";
    }

    const placeholder = $("#plotPreviewPlaceholder");
    const canvas = $("#plotCanvas");
    const img = $("#plotImage");
    const downloadBtn = $("#plotBtnDownload");
    const previewContainer = $("#plotPreview");
    if (state.plotService.imageDataUrl) {
      placeholder.style.display = "none";
      canvas.style.display = "none";
      img.style.display = "block";
      img.src = state.plotService.imageDataUrl;
      if (downloadBtn) downloadBtn.disabled = false;
      if (previewContainer) {
        previewContainer.style.cursor = "pointer";
        previewContainer.title = "点击放大";
      }
    } else {
      placeholder.style.display = "block";
      canvas.style.display = "none";
      img.style.display = "none";
      if (downloadBtn) downloadBtn.disabled = true;
      if (previewContainer) {
        previewContainer.style.cursor = "";
        previewContainer.title = "";
      }
    }
  }

  function renderAll() {
    renderTime();
    renderKpis();
    renderMiniMetrics();
    drawSparkline();
    renderPipeline();
    renderAbnormalBars();
    renderAlerts();
    renderSummary();
    renderQcSeq();
    renderQcResult({ skipMonthly: true });
    renderProductivity();
    renderPlotService();
  }

  function setPaused(paused) {
    state.paused = paused;
    const pill = $("#rtPill");
    const btn = $("#btnPause");
    if (paused) {
      pill.textContent = "实时：已暂停";
      pill.style.background = "rgba(255,204,102,0.12)";
      pill.style.borderColor = "rgba(255,204,102,0.25)";
      btn.textContent = "继续刷新";
    } else {
      pill.textContent = "实时：运行中";
      pill.style.background = "rgba(45,227,139,0.12)";
      pill.style.borderColor = "rgba(45,227,139,0.25)";
      btn.textContent = "暂停刷新";
    }
  }

  function applyRoute() {
    const hash = location.hash || "#/home";
    const route = hash.replace("#/","").split("/").filter(Boolean);
    const view = route[0] === "module" ? route[1] : "home";

    // Activate nav
    $$(".nav__item").forEach((a) => {
      const r = a.getAttribute("data-route");
      a.classList.toggle("is-active", r === view);
    });

    // Activate view
    $$(".view").forEach((v) => v.classList.remove("is-active"));
    const el = $(`#view-${view}`);
    if (el) el.classList.add("is-active");

    // Titles
    const titleMap = {
      home: ["首页全局看板", "样本总览与流程滞留实时监控"],
      "qc-seq": ["测序下机数据质控", "下机批次质量与异常定位"],
      "qc-result": ["检测结果质量控制", "规则命中、审核与复测闭环"],
      productivity: ["人效分析", "吞吐、在制、时长与瓶颈洞察"],
      "plot-service": ["科研画图服务", "模板化出图、任务队列与交付管理"],
    };
    const [t, s] = titleMap[view] ?? ["智慧化实验室管理系统", "原型页面"];
    setText("pageTitle", t);
    setText("pageSub", s);

    if (view === "qc-result") renderQcResult();
  }

  function wireEvents() {
    window.addEventListener("hashchange", applyRoute);
    $("#btnPause").addEventListener("click", () => setPaused(!state.paused));
    $("#btnReset").addEventListener("click", () => {
      initSim();
      initQcSeqSim();
      initQcResultSim();
      initProductivitySim();
      renderAll();
    });

    // QC-seq events (delegate)
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.matches('input[name="qcBatchDate"]')) {
        const date = t.getAttribute("value");
        const found = state.qcSeq.batches.find((b) => b.date === date);
        if (found) {
          state.qcSeq.selectedBatchId = found.id;
          state.qcSeq.selectedSampleId = found.samples[0]?.id ?? null;
          renderQcSeq();
        }
      }

      if (t.matches("#qcBatchSelect")) {
        const val = t.value;
        state.qcSeq.selectedBatchId = val;
        const b = getSelectedBatch();
        state.qcSeq.selectedSampleId = b?.samples?.[0]?.id ?? null;
        renderQcSeq();
      }

      if (t.matches('input[name="qcMetric"]')) {
        state.qcSeq.selectedMetricKey = t.getAttribute("value");
        renderQcSeq();
      }

      if (t.matches("#qcSampleSelect")) {
        state.qcSeq.selectedSampleId = t.value;
        renderQcSeq();
      }

      if (t.matches("#qrBatchSelect")) {
        state.qcResult.selectedBatchId = t.value;
        renderQcResult();
      }
      if (t.matches('input[name="qrCancer"]')) {
        const v = t.getAttribute("value");
        if (t.checked) state.qcResult.selectedCancers.add(v);
        else state.qcResult.selectedCancers.delete(v);
        if (state.qcResult.selectedCancers.size === 0) state.qcResult.selectedCancers.add(CANCERS[0]);
        renderQcResult();
      }
      if (t.matches('input[name="qrVarType"]')) {
        const v = t.getAttribute("value");
        if (t.checked) state.qcResult.selectedVarTypes.add(v);
        else state.qcResult.selectedVarTypes.delete(v);
        if (state.qcResult.selectedVarTypes.size === 0) state.qcResult.selectedVarTypes.add("snv");
        renderQcResult();
      }
      if (t.matches('input[name="qrVariant"]')) {
        const v = t.getAttribute("value");
        if (t.checked) state.qcResult.selectedVariants.add(v);
        else state.qcResult.selectedVariants.delete(v);
        renderQcResult();
      }
      if (t.matches('input[name="qrRange"]')) {
        state.qcResult.trendRangeDays = Number(t.getAttribute("value")) || 30;
        renderQcResult();
      }
      if (t.matches("#qrProjectSelect")) {
        state.qcResult.selectedProject = t.value;
        renderQcResult();
      }
      if (t.matches("#qrMonthlySiteProjectSelect")) {
        state.qcResult.selectedMonthlySiteProject = t.value;
        renderQcResult();
      }
      if (t.matches("#qrMonthlyVafProjectSelect")) {
        state.qcResult.selectedMonthlyVafProject = t.value;
        renderQcResult();
      }

      if (t.matches('input[name="peScope"]')) {
        state.productivity.scope = t.getAttribute("value");
        renderProductivity();
      }
      if (t.matches("#peBatchSelect")) {
        state.productivity.selectedBatchId = t.value;
        renderProductivity();
      }
      if (t.matches("#peMonthSelect")) {
        state.productivity.selectedMonth = t.value;
        renderProductivity();
      }
      if (t.matches('input[name="peStatsTat"]')) {
        state.productivity.statsTatProject = t.getAttribute("value");
        renderProductivity();
      }
      if (t.matches('input[name="peStatsPerson"]')) {
        state.productivity.statsPerson = t.getAttribute("value");
        renderProductivity();
      }
      if (t.matches('input[name="peStatsIntervene"]')) {
        state.productivity.statsInterveneProject = t.getAttribute("value");
        renderProductivity();
      }
      if (t.matches('input[name="peStatsAbn"]')) {
        state.productivity.statsAbnProject = t.getAttribute("value");
        renderProductivity();
      }
    });

    document.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      if (target.closest("#qcBoxModalClose") || target.closest(".qc-box-modal__backdrop")) {
        closeBoxModal();
        return;
      }
      if (target.closest("#qrSpecialChartModalClose") || (target.closest("#qrSpecialChartModal") && target.closest(".qc-box-modal__backdrop"))) {
        closeSpecialChartModal();
        return;
      }

      const projRow = target.closest("[data-proj].qr-row-proj");
      if (projRow) {
        const p = projRow.getAttribute("data-proj");
        if (p) {
          state.qcResult.selectedProject = p;
          const sel = $("#qrProjectSelect");
          if (sel) sel.value = p;
          renderQcResult();
        }
        return;
      }

      const plotTpl = target.closest(".plot-tpl[data-plot-tpl]");
      if (plotTpl) {
        e.preventDefault();
        state.plotService.selectedTemplateId = plotTpl.getAttribute("data-plot-tpl");
        state.plotService.imageDataUrl = null;
        renderPlotService();
        return;
      }
    });

    const plotFileInput = $("#plotFileInput");
    const plotUploadZone = $("#plotUploadZone");
    if (plotFileInput && plotUploadZone) {
      plotUploadZone.addEventListener("click", () => plotFileInput.click());
      plotFileInput.addEventListener("change", () => {
        const file = plotFileInput.files?.[0];
        state.plotService.uploadedFile = file ?? null;
        state.plotService.imageDataUrl = null;
        renderPlotService();
      });
    }

    const plotBtnDraw = $("#plotBtnDraw");
    if (plotBtnDraw) {
      plotBtnDraw.addEventListener("click", () => {
        const canvas = $("#plotCanvas");
        const tid = state.plotService.selectedTemplateId ?? "volcano";
        if (!canvas) return;
        drawPlotChart(canvas, tid);
        state.plotService.imageDataUrl = canvas.toDataURL("image/png");
        renderPlotService();
      });
    }

    const plotBtnDownload = $("#plotBtnDownload");
    if (plotBtnDownload) {
      plotBtnDownload.addEventListener("click", () => {
        const url = state.plotService.imageDataUrl;
        const t = PLOT_TEMPLATES.find((x) => x.id === (state.plotService.selectedTemplateId ?? "volcano")) ?? PLOT_TEMPLATES[0];
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = `图表_${t.name}_${Date.now()}.png`;
        a.click();
      });
    }

    const plotPreview = $("#plotPreview");
    if (plotPreview) {
      plotPreview.addEventListener("click", () => {
        if (state.plotService.imageDataUrl) openPlotPreviewModal();
      });
    }
    const plotPreviewModalClose = $("#plotPreviewModalClose");
    if (plotPreviewModalClose) {
      plotPreviewModalClose.addEventListener("click", closePlotPreviewModal);
    }
    const plotPreviewModal = $("#plotPreviewModal");
    if (plotPreviewModal) {
      const backdrop = plotPreviewModal.querySelector(".qc-box-modal__backdrop");
      if (backdrop) backdrop.addEventListener("click", closePlotPreviewModal);
    }
  }

  function main() {
    initSim();
    initQcSeqSim();
    initQcResultSim();
    initProductivitySim();
    applyRoute();
    renderAll();
    wireEvents();

    setInterval(() => {
      if (state.paused) return;
      tickSim();
      renderAll();
    }, 1500);

    // Render time even when paused
    setInterval(renderTime, 1000);
  }

  main();
})();

