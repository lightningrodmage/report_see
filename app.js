/* Prototype-only: simulated realtime dashboard data (no backend). */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const PROJECTS = ["PT122", "PT228", "PC122", "PC228", "MRD", "CNS", "HE180", "L218"];
  /** 提取中心：样本类型口径 */
  const EXT_SAMPLE_TYPES = ["蜡块", "蜡卷", "胸腹水", "脑脊液", "全血"];
  const NON_NGS_METHODS = ["qPCR", "一代", "IHC", "病理", "毛细管电泳", "其他"];
  const NON_NGS_CANCEL_REASONS = ["样本量不足", "污染风险", "指标失败", "重复送检", "临床退单"];
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
  /** SLA 超期自动指派：按环节对应模块人员池 */
  const LAB_MODULE_PEOPLE = ["实验员1", "实验员2", "实验员3", "实验员4"];
  const ANALYSIS_MODULE_PEOPLE = ["分析-陈烁", "分析-刘洋", "分析-魏齐", "分析-丁睿"];
  const TASK_ASSIGNEE_OPTIONS = [...BIO_PEOPLE, ...REPORT_PEOPLE, "实验室-管理员"];
  /** 数据统计 · 异常工单处理时长：覆盖实验室/分析/生信/报告等可指派角色 */
  const ABNORMAL_TASK_PEOPLE = [
    ...LAB_MODULE_PEOPLE,
    ...ANALYSIS_MODULE_PEOPLE,
    ...BIO_PEOPLE,
    ...REPORT_PEOPLE,
    "实验室-管理员",
  ];

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

  const TASKS_STORAGE_KEY = "smartLab.tasks.v1";
  const TASK_STATUSES = {
    todo: "todo",
    doing: "doing",
    done: "done",
    rework: "rework",
    rejected: "rejected",
  };

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
      selectedHeatKey: null,
      qcToLabId: new Map(),
      qcPushPending: { taskTitle: "", labIds: [], subtitle: "" },
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
      statsAbnTaskMonth: null, // YYYY-MM，数据统计 · 异常工单处理时长
    },
    plotService: {
      selectedTemplateId: "volcano",
      uploadedFile: null,
      imageDataUrl: null,
    },
    labAlpha: {
      samples: [],
      pageSize: 10,
      filters: {
        barcode: "",
        detectNo: "",
        batchNo: "",
        dueDateLte: "",
      },
    },
    sampleCenter: {
      page: 1,
    },
    ngs: {
      tab: "monitor",
      selectedBatchId: "",
      selectedProjects: new Set(["PT122", "PT228"]),
      statsScope: "batch",
      statsBatchNo: "",
      statsMonth: "",
      qcControlAddedByBatch: {},
      activePoolBatchId: "",
      activePoolId: "",
      activePoolProject: "",
    },
    extraction: {
      tab: "monitor",
      monitorDate: "",
      statsScope: "day",
      statsDay: "",
      statsMonth: "",
    },
    nonNgs: {
      tab: "monitor",
      statsMonth: "",
    },
    // 异常闭环任务：告警 -> 任务 -> 处理/返工/拒绝 -> 回填样本与指标
    tasks: [],
    tasksUI: {
      filterStatus: "",
      filterAssignee: "",
      filterStageKey: "",
      selectedTaskId: null,
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

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function normalizeTask(t) {
    if (!t || typeof t !== "object") return null;
    // 升级版演示口径：仅保留三个状态（待分配/处理中/已完成）
    const rawStatus = Object.values(TASK_STATUSES).includes(t.status) ? t.status : TASK_STATUSES.todo;
    const status = rawStatus === TASK_STATUSES.done ? TASK_STATUSES.done : rawStatus === TASK_STATUSES.doing ? TASK_STATUSES.doing : TASK_STATUSES.todo;
    return {
      id: String(t.id || ""),
      sourceSampleId: String(t.sourceSampleId || ""),
      stageKey: String(t.stageKey || ""),
      status,
      assignee: String(t.assignee || ""),
      priority: String(t.priority || ""),
      description: String(t.description || ""),
      qcOrigin: !!t.qcOrigin,
      qcBaseDescription: String(t.qcBaseDescription || ""),
      createdAt: Number.isFinite(Number(t.createdAt)) ? Number(t.createdAt) : Date.now(),
      dueAt: Number.isFinite(Number(t.dueAt)) ? Number(t.dueAt) : null,
      completedAt: Number.isFinite(Number(t.completedAt)) ? Number(t.completedAt) : null,
      comments: Array.isArray(t.comments) ? t.comments : [],
      history: Array.isArray(t.history) ? t.history : [],
    };
  }

  function loadTasksFromStorage() {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = safeJsonParse(raw, null);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTask).filter(Boolean);
  }

  function saveTasksToStorage() {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(state.tasks));
    } catch {
      // ignore write failure (e.g. storage disabled)
    }
  }

  function getTaskById(taskId) {
    return state.tasks.find((t) => t.id === taskId) ?? null;
  }

  function updateTaskAndPersist(taskId, patch) {
    const task = getTaskById(taskId);
    if (!task) return null;
    Object.assign(task, patch);
    saveTasksToStorage();
    return task;
  }

  function addTaskComment(taskId, author, content) {
    if (!String(content || "").trim()) return null;
    const task = getTaskById(taskId);
    if (!task) return null;
    const comment = {
      id: `C_${taskId}_${Date.now()}`,
      author: String(author || ""),
      content: String(content),
      createdAt: Date.now(),
    };
    task.comments.push(comment);
    saveTasksToStorage();
    return task;
  }

  function appendTaskHistory(taskId, entry) {
    const task = getTaskById(taskId);
    if (!task) return null;
    const historyEntry = {
      id: entry?.id ?? `H_${taskId}_${Date.now()}`,
      status: entry?.status ?? task.status,
      actor: String(entry?.actor || ""),
      note: String(entry?.note || ""),
      createdAt: Number.isFinite(Number(entry?.createdAt)) ? Number(entry.createdAt) : Date.now(),
    };
    task.history.push(historyEntry);
    saveTasksToStorage();
    return task;
  }

  function transitionTaskStatus(taskId, nextStatus, actor, note) {
    const task = getTaskById(taskId);
    if (!task) return null;
    // 仅保留：待分配/处理中/已完成
    const ns = nextStatus === TASK_STATUSES.done ? TASK_STATUSES.done : nextStatus === TASK_STATUSES.doing ? TASK_STATUSES.doing : TASK_STATUSES.todo;
    task.status = ns;
    const now = Date.now();
    if (ns === TASK_STATUSES.done) task.completedAt = now;
    else task.completedAt = null;
    appendTaskHistory(taskId, { status: ns, actor, note, createdAt: now });
    return task;
  }

  function resetAllTasksToTodo() {
    if (!Array.isArray(state.tasks)) return;
    let changed = false;
    state.tasks.forEach((t) => {
      if (!t) return;
      if (t.status !== TASK_STATUSES.todo) {
        t.status = TASK_STATUSES.todo;
        t.completedAt = null;
        changed = true;
      } else if (t.completedAt) {
        t.completedAt = null;
        changed = true;
      }
    });
    if (changed) saveTasksToStorage();
  }

  function taskIdForSample(sampleId) {
    return `T_${String(sampleId || "")}`;
  }

  function stageKeyFromLabStatus(status) {
    const st = String(status || "");
    if (st.includes("异常处理")) return "bio";
    if (st.includes("报告审核")) return "rep";
    if (st.includes("生信审核")) return "bio";
    if (st.includes("下机质控") || st.includes("生信分析")) return "ana";
    if (st.includes("测序") || st.includes("待上机")) return "rep";
    if (st.includes("杂交") || st.includes("建库")) return "ana";
    if (st === "实验中") return "exp";
    if (st.includes("提取") || st.includes("已接收") || st.includes("暂存")) return "exp";
    if (st.includes("已发布") || st.includes("已退单")) return "pub";
    return "exp";
  }

  function getAbnormalCount() {
    return (state.labAlpha.samples || []).filter((s) => !!s.isAbnormal).length;
  }

  function getAbnormalCountByStage() {
    const out = { exp: 0, ana: 0, bio: 0, rep: 0, pub: 0 };
    (state.labAlpha.samples || []).forEach((s) => {
      if (!s.isAbnormal) return;
      const k = stageKeyFromLabStatus(s.status);
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  /** 超期：停留超过节点 SLA；SLA 异常：剩余周期过短或停留明显超标 */
  function shouldAutoCaptureSla(sample) {
    const s = sample;
    if (!s || s.status === "已发布" || s.status === "暂存中" || s.status === "已退单") return false;
    const sla = Number(s.slaHours) || 0;
    if (sla <= 0) return false;
    const stay = Number(s.stayHours) || 0;
    const rem = Number(s.remainingHours) || 0;
    if (stay > sla) return true;
    if (rem <= 2 && rem >= 0) return true;
    if (stay > sla * 1.25) return true;
    return false;
  }

  function slaStageLabelForSample(sample) {
    const st = String(sample?.status || "");
    if (st.includes("异常处理")) return "异常处理";
    if (st.includes("报告审核")) return "报告审核";
    if (st.includes("生信审核")) return "生信审核";
    if (st.includes("下机质控")) return "下机质控";
    if (st.includes("生信分析")) return "生信分析";
    if (st.includes("测序")) return "测序";
    if (st.includes("待上机")) return "待上机";
    if (st.includes("杂交")) return "杂交";
    if (st.includes("建库")) return "建库";
    if (st === "实验中") return "实验中";
    if (st.includes("提取")) return "提取";
    if (st.includes("已接收")) return "已接收";
    if (st.includes("暂存")) return "暂存";
    const sk = stageKeyFromLabStatus(st);
    const hit = STAGES.find((x) => x.key === sk);
    return hit ? hit.name : "当前流程";
  }

  function slaDescriptionForSample(sample) {
    return `对应流程SLA超期（${slaStageLabelForSample(sample)}）`;
  }

  function applySlaAutoCapture() {
    const samples = state.labAlpha.samples || [];
    samples.forEach((s) => {
      if (s.status === "已发布" || s.status === "暂存中" || s.status === "已退单") return;
      if (s.status === "异常处理中") return;
      if (!shouldAutoCaptureSla(s)) return;
      s.isAbnormal = true;
      const sla = Number(s.slaHours) || 0;
      const stay = Number(s.stayHours) || 0;
      if (sla > 0 && stay > sla) s.alertLevel = "高";
      else if (s.alertLevel === "无") s.alertLevel = "中";
    });
  }

  function inferQcTaskMeta(task) {
    if (task.qcOrigin && task.qcBaseDescription) return;
    const QC_TITLES = ["数据产出量异常", "质控品失控", "下机质控不通过"];
    const d = String(task.description || "");
    const hit = QC_TITLES.find((t) => d === t || d.startsWith(`${t}；`) || d.startsWith(`${t}；对应流程`));
    if (hit) {
      task.qcOrigin = true;
      task.qcBaseDescription = hit;
    }
  }

  function refreshAbnormalTaskDescriptions() {
    let changed = false;
    state.tasks.forEach((task) => {
      if (task.status === TASK_STATUSES.done) return;
      const sample = getLabSampleById(task.sourceSampleId);
      if (!sample || !sample.isAbnormal) return;
      inferQcTaskMeta(task);
      const hasSla = shouldAutoCaptureSla(sample);
      const slaLine = slaDescriptionForSample(sample);
      if (task.qcOrigin && task.qcBaseDescription) {
        const next = hasSla ? `${task.qcBaseDescription}；${slaLine}` : String(task.qcBaseDescription);
        if (task.description !== next) {
          task.description = next;
          changed = true;
        }
      } else if (hasSla) {
        if (task.description !== slaLine) {
          task.description = slaLine;
          changed = true;
        }
      }
    });
    if (changed) saveTasksToStorage();
  }

  function syncAbnormalTasksPipeline() {
    applySlaAutoCapture();
    syncTasksWithAbnormalSamples();
    refreshAbnormalTaskDescriptions();
  }

  /** SLA 自动指派：下机质控「之前」环节一律实验室；从下机质控起再按分析/生信/报告模块 */
  function assigneeForSlaModule(sample) {
    const sampleId = sample.id;
    const st = String(sample.status || "");
    const seed = `${String(sampleId || "")}_${st}`;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const pick = (arr) => arr[Math.abs(h >>> 0) % arr.length];
    if (st.includes("报告审核")) return pick(REPORT_PEOPLE);
    if (st.includes("生信审核")) return pick(BIO_PEOPLE);
    if (st.includes("下机质控")) return pick(ANALYSIS_MODULE_PEOPLE);
    return pick(LAB_MODULE_PEOPLE);
  }

  function slaAutoAssignModuleLabel(sample) {
    const st = String(sample.status || "");
    if (st.includes("报告审核")) return "报告";
    if (st.includes("生信审核")) return "生信审核";
    if (st.includes("下机质控")) return "下机质控";
    return "实验室";
  }

  function resolveDesiredAssigneeForAbnormalTask(task, s) {
    if (task && task.qcOrigin) {
      return String(task.assignee || s.owner || "").trim() || TASK_ASSIGNEE_OPTIONS[0];
    }
    if (shouldAutoCaptureSla(s)) {
      return assigneeForSlaModule(s);
    }
    return String(s.owner || "");
  }

  function syncTasksWithAbnormalSamples() {
    if (!Array.isArray(state.labAlpha.samples)) return;
    const now = Date.now();
    const abnormalSamples = state.labAlpha.samples.filter((s) => !!s.isAbnormal && s.status !== "已退单");
    const abnormalById = new Set(abnormalSamples.map((s) => s.id));

    let changed = false;
    // Ensure tasks exist for each abnormal sample
    abnormalSamples.forEach((s) => {
      const sampleId = s.id;
      const taskId = taskIdForSample(sampleId);
      const desiredStageKey = stageKeyFromLabStatus(s.status);
      const desiredPriority = String(s.alertLevel || "低");
      const desiredDueAt =
        Number.isFinite(Number(s.remainingHours)) && Number(s.remainingHours) > 0 ? now + Number(s.remainingHours) * 3600 * 1000 : null;

      let task = getTaskById(taskId);
      if (!task) {
        const isSla = shouldAutoCaptureSla(s);
        const desiredAssignee = resolveDesiredAssigneeForAbnormalTask(null, s);
        const initialStatus = isSla ? TASK_STATUSES.doing : TASK_STATUSES.todo;
        if (isSla) {
          s.owner = desiredAssignee;
        }
        task = {
          id: taskId,
          sourceSampleId: String(sampleId),
          stageKey: desiredStageKey,
          status: initialStatus,
          assignee: desiredAssignee,
          priority: desiredPriority,
          description: "",
          qcOrigin: false,
          qcBaseDescription: "",
          createdAt: now,
          dueAt: desiredDueAt,
          completedAt: null,
          comments: [],
          history: [],
        };
        task.history.push({
          id: `H_${taskId}_${now}`,
          status: initialStatus,
          actor: "系统",
          note: isSla
            ? `SLA 超期：已自动指派至${slaAutoAssignModuleLabel(s)}（${desiredAssignee}）并进入处理中`
            : "检测到异常样本，生成闭环任务（管理员已分配）",
          createdAt: now,
        });
        state.tasks.push(task);
        changed = true;
        return;
      }

      const desiredAssignee = resolveDesiredAssigneeForAbnormalTask(task, s);

      if (task.status === TASK_STATUSES.done && abnormalById.has(sampleId)) {
        const reopenSla = shouldAutoCaptureSla(s);
        const reopenAssignee = task.qcOrigin
          ? String(task.assignee || s.owner || "").trim() || TASK_ASSIGNEE_OPTIONS[0]
          : reopenSla
            ? assigneeForSlaModule(s)
            : desiredAssignee;
        if (reopenSla && !task.qcOrigin) {
          s.owner = reopenAssignee;
        }
        task.status = task.qcOrigin ? TASK_STATUSES.todo : reopenSla ? TASK_STATUSES.doing : TASK_STATUSES.todo;
        if (!task.qcOrigin) task.assignee = reopenAssignee;
        task.stageKey = desiredStageKey;
        task.priority = desiredPriority;
        task.dueAt = desiredDueAt;
        task.completedAt = null;
        task.history.push({
          id: `H_${taskId}_${now}_reopen`,
          status: task.status,
          actor: "系统",
          note: reopenSla
            ? `样本重新进入异常：SLA 超期，已指派 ${reopenAssignee} 并进入处理中`
            : "样本重新进入异常流程，任务重新打开",
          createdAt: now,
        });
        changed = true;
        return;
      }

      if (shouldAutoCaptureSla(s) && !task.qcOrigin) {
        s.owner = desiredAssignee;
      }

      let desiredStatus = task.status;
      if (!task.qcOrigin && shouldAutoCaptureSla(s)) {
        desiredStatus = TASK_STATUSES.doing;
      }

      const patches = {
        stageKey: desiredStageKey,
        assignee: desiredAssignee,
        priority: desiredPriority,
        dueAt: desiredDueAt,
        status: desiredStatus,
      };
      Object.keys(patches).forEach((k) => {
        if (task[k] !== patches[k]) {
          task[k] = patches[k];
          changed = true;
        }
      });
    });

    if (changed) saveTasksToStorage();
  }

  const LAB_STATUS_REWORK_MAP = {
    exp: "提取中",
    ana: "建库中",
    bio: "生信审核中",
    rep: "报告审核中",
  };

  function getLabSampleById(sampleId) {
    return state.labAlpha.samples.find((s) => s.id === sampleId) ?? null;
  }

  function backfillSampleForTask(task, sample, action, actor) {
    if (!task || !sample) return;

    if (action === TASK_STATUSES.done) {
      sample.isAbnormal = false;
      sample.alertLevel = "无";
      sample.remainingHours = 0;
      sample.slaHours = 0;
      if (sample.resumeStatusAfterException) {
        sample.status = sample.resumeStatusAfterException;
        sample.resumeStatusAfterException = null;
        sample.statusBeforeException = null;
      } else {
        sample.status = "生信审核中";
      }
      if (actor) sample.owner = actor;
      return;
    }

    if (action === TASK_STATUSES.rework) {
      sample.isAbnormal = true;
      sample.alertLevel = "高";
      sample.slaHours = Number.isFinite(sample.slaHours) && sample.slaHours > 0 ? sample.slaHours : 24;
      // 返工后短时再次预警：把剩余周期重置为 1~2 小时区间
      const newRemaining = 1 + (Math.random() < 0.5 ? 0 : 1);
      sample.remainingHours = newRemaining;
      sample.stayHours = Math.max(1, Math.round(sample.slaHours - newRemaining));
      sample.status = LAB_STATUS_REWORK_MAP[task.stageKey] ?? "提取中";
      if (actor) sample.owner = actor;
      sample.remark = "返工/补做中";
      return;
    }

    if (action === TASK_STATUSES.rejected) {
      sample.isAbnormal = true;
      sample.alertLevel = "中";
      sample.slaHours = Number.isFinite(sample.slaHours) && sample.slaHours > 0 ? sample.slaHours : 24;
      const newRemaining = 2;
      sample.remainingHours = newRemaining;
      sample.stayHours = Math.max(1, Math.round(sample.slaHours - newRemaining));
      sample.status = LAB_STATUS_REWORK_MAP[task.stageKey] ?? "提取中";
      if (actor) sample.owner = actor;
      sample.remark = "已拒绝：需补充/复测";
    }
  }

  function applyTaskAction(taskId, action, { actor = "", note = "", comment = "" } = {}) {
    const task = getTaskById(taskId);
    if (!task) return;
    const sample = getLabSampleById(task.sourceSampleId);
    const now = Date.now();

    // 升级版演示口径：只允许待分配->处理中、处理中->已完成
    if (action !== TASK_STATUSES.done && action !== TASK_STATUSES.doing) return;

    // 待分配->处理中：管理员分配后进入处理中
    if (action === TASK_STATUSES.doing) {
      if (actor) {
        task.assignee = actor;
        if (sample) sample.owner = actor;
      }
      transitionTaskStatus(taskId, TASK_STATUSES.doing, actor || "系统", note || "开始处理");
      if (comment) addTaskComment(taskId, actor || "系统", comment);
      renderAll();
      return;
    }

    // 完成(解决)
    if (action === TASK_STATUSES.done) {
      transitionTaskStatus(taskId, TASK_STATUSES.done, actor || "系统", note || "任务完成（解决）");
      if (comment) addTaskComment(taskId, actor || "系统", comment);
      backfillSampleForTask(task, sample, TASK_STATUSES.done, actor || "");
      renderAll();
      return;
    }

    // 返工
    if (action === TASK_STATUSES.rework) {
      transitionTaskStatus(taskId, TASK_STATUSES.rework, actor || "系统", note || "任务返工");
      if (comment) addTaskComment(taskId, actor || "系统", comment);
      backfillSampleForTask(task, sample, TASK_STATUSES.rework, actor || "");
      renderAll();
      return;
    }

    // 拒绝
    if (action === TASK_STATUSES.rejected) {
      transitionTaskStatus(taskId, TASK_STATUSES.rejected, actor || "系统", note || "任务拒绝/退回");
      if (comment) addTaskComment(taskId, actor || "系统", comment);
      backfillSampleForTask(task, sample, TASK_STATUSES.rejected, actor || "");
      renderAll();
      return;
    }
  }

  function terminateTaskAsCancelled(taskId) {
    const task = getTaskById(taskId);
    if (!task || task.status === TASK_STATUSES.done) return;
    const sample = getLabSampleById(task.sourceSampleId);
    const actorEl = $("#taskActorInput");
    const actor = (actorEl && actorEl.value) || task.assignee || "系统";
    transitionTaskStatus(taskId, TASK_STATUSES.done, actor, "退单终止：样本归档为已退单，工单关闭");
    if (sample) {
      sample.status = "已退单";
      sample.isAbnormal = false;
      sample.alertLevel = "无";
      sample.slaHours = 0;
      sample.remainingHours = 0;
      sample.stayHours = 0;
      sample.resumeStatusAfterException = null;
      sample.statusBeforeException = null;
      const tail = "退单归档";
      sample.remark = sample.remark && String(sample.remark).trim() ? `${sample.remark}；${tail}` : tail;
    }
    saveTasksToStorage();
    renderAll();
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
    const abnormalTaskHandleHours = {};
    ABNORMAL_TASK_PEOPLE.forEach((name) => {
      const n = 8 + Math.floor(rnd() * 8);
      const values = [];
      for (let i = 0; i < n; i++) {
        const base = 1.5 + rnd() * 28 + Math.abs(normalRand(rnd)) * 10;
        values.push(Math.round(base * 10) / 10);
      }
      abnormalTaskHandleHours[name] = values;
    });
    return { tat, people, intervene, abnormal, abnormalTaskHandleHours };
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
    const root = $("#view-analysis");
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

  /** 主状态口径（全站统一） */
  const SAMPLE_STATUSES = [
    "暂存中",
    "已接收",
    "提取中",
    "实验中",
    "待建库",
    "建库中",
    "待杂交",
    "杂交中",
    "待上机",
    "测序中",
    "生信分析中",
    "下机质控中",
    "生信审核中",
    "报告审核中",
    "异常处理中",
    "已发布",
    "已退单",
  ];
  const EXPERIMENT_SUB_STATUSES = ["待建库", "建库中", "待杂交", "杂交中", "待上机", "测序中"];
  const SAMPLE_STATUSES_FOR_RANDOM = SAMPLE_STATUSES.filter(
    (s) => s !== "异常处理中" && s !== "暂存中" && s !== "已退单"
  );

  function genLabAlphaSamples() {
    const now = new Date();
    const seed = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`) + 32001;
    const rnd = seededRand(seed);
    const list = [];
    const projects = PROJECTS;
    const diag = ["肺腺癌", "肺鳞癌", "结直肠癌", "乳腺癌", "胃癌", "淋巴瘤"];
    const orgs = ["协和医院", "省肿瘤医院", "市人民医院", "肿瘤医院东区", "胸科医院"];
    const sampleTypes = ["组织", "血浆", "蜡块", "穿刺组织"];
    const qaGrades = ["A", "B", "C"];
    const owners = LAB_MODULE_PEOPLE;
    const dueBase = now.getTime() + 2 * 24 * 60 * 60 * 1000;
    // 结合质控中心批次数量，模拟每批约 150 例样本体量
    const n = 780;
    for (let i = 0; i < n; i++) {
      const idx = i + 1;
      const statusIdx = Math.floor(rnd() * SAMPLE_STATUSES_FOR_RANDOM.length);
      let status = SAMPLE_STATUSES_FOR_RANDOM[statusIdx];
      if (rnd() < 0.07) status = "暂存中";
      else if (status === "提取中" && rnd() < 0.32) status = "实验中";
      const barcode = `BC${String(2303000 + idx).padStart(7, "0")}`;
      const detectNo = `D${String(202503000 + idx).padStart(8, "0")}`;
      const batchNo = `B${String(250300 + Math.floor(idx / 8)).padStart(6, "0")}`;
      const dueOffsetDays = Math.round(-2 + rnd() * 10);
      const dueDate = new Date(dueBase + dueOffsetDays * 24 * 60 * 60 * 1000);
      const dueStr = dueDate.toISOString().slice(0, 10);
      const tumorPct = Math.round(20 + rnd() * 70);
      const isMain = rnd() > 0.25;
      const isExperiment = rnd() > 0.7;
      const dna = (40 + rnd() * 140).toFixed(1);
      const rna = (20 + rnd() * 80).toFixed(1);
      const libPre = (8 + rnd() * 40).toFixed(2);
      const libPost = (12 + rnd() * 60).toFixed(2);
      const stayHours = Math.round(2 + rnd() * 120);
      const slaHours = status === "已发布" || status === "暂存中" ? 0 : [24, 36, 48, 60][Math.floor(rnd() * 4)];
      const remainingHours = Math.max(0, slaHours - stayHours);
      // 控制异常比例：仅对在实验流程中的样本，且“剩余周期很短”或“明显超时”时，按一定概率标记为异常
      const isFlowStage =
        status !== "已发布" && status !== "暂存中" && status !== "测序中";
      const isTightSla = slaHours > 0 && (remainingHours <= 2 || stayHours > slaHours * 1.25);
      const isAbnormal = isFlowStage && isTightSla && rnd() > 0.45;
      const alertLevel =
        !isAbnormal || slaHours === 0
          ? "无"
          : remainingHours <= 1 || stayHours > slaHours * 1.4
          ? "高"
          : remainingHours <= 4 || stayHours > slaHours * 1.1
          ? "中"
          : "低";
      list.push({
        id: `${barcode}`,
        barcode,
        detectNo,
        batchNo,
        dueDate: dueStr,
        diagnosis: diag[Math.floor(rnd() * diag.length)],
        org: orgs[Math.floor(rnd() * orgs.length)],
        project: projects[Math.floor(rnd() * projects.length)],
        isMain,
        dnaTotal: dna,
        rnaTotal: rna,
        qa: qaGrades[Math.floor(rnd() * qaGrades.length)],
        libPre,
        libPost,
        sampleType: sampleTypes[Math.floor(rnd() * sampleTypes.length)],
        tumorPct,
        isExperiment,
        status,
        remark:
          status === "实验中"
            ? rnd() > 0.4
              ? "免建库/杂交/上机测序，直连实验中"
              : ""
            : rnd() > 0.7
              ? "补体积/重提中"
              : rnd() > 0.8
                ? "等待补充临床信息"
                : "",
        stayHours,
        slaHours,
        remainingHours,
        owner: owners[Math.floor(rnd() * owners.length)],
        alertLevel,
        isAbnormal,
        resumeStatusAfterException: null,
        statusBeforeException: null,
      });
    }
    return list;
  }

  function initLabAlphaSim() {
    state.labAlpha.samples = genLabAlphaSamples();
    state.sampleCenter.page = 1;
  }

  function getLabFilteredSamples() {
    const { samples, filters } = state.labAlpha;
    return samples.filter((s) => {
      if (s.status === "已发布" || s.status === "已退单") return false;
      if (filters.barcode && !s.barcode.includes(filters.barcode.trim())) return false;
      if (filters.detectNo && !s.detectNo.includes(filters.detectNo.trim())) return false;
      if (filters.batchNo && !s.batchNo.includes(filters.batchNo.trim())) return false;
      if (filters.dueDateLte && s.dueDate > filters.dueDateLte) return false;
      return true;
    });
  }

  function computeSampleDashboardCounts(samples) {
    const c = {};
    SAMPLE_STATUSES.forEach((s) => {
      c[s] = 0;
    });
    samples.forEach((s) => {
      const st = s.status || "";
      if (c[st] !== undefined) c[st] += 1;
      else c[st] = (c[st] || 0) + 1;
    });
    const total = samples.length;
    const inFlow = samples.filter(
      (s) => s.status !== "已发布" && s.status !== "暂存中" && s.status !== "已退单"
    ).length;
    const inExperiment =
      EXPERIMENT_SUB_STATUSES.reduce((sum, s) => sum + (c[s] || 0), 0) + (c["实验中"] || 0);
    const published = c["已发布"] || 0;
    const abnormal = samples.filter((s) => !!s.isAbnormal).length;
    return { c, total, inFlow, inExperiment, published, abnormal };
  }

  function buildSampleOverviewHtml(samples) {
    const { c, total, inFlow, inExperiment, published, abnormal } = computeSampleDashboardCounts(samples);
    const subHint = EXPERIMENT_SUB_STATUSES.map((s) => `${s.replace("中", "")} ${fmtInt(c[s] || 0)}`).join(" · ");
    const shortcut = c["实验中"] || 0;
    const expHint = shortcut > 0 ? `${subHint} · 直连 ${fmtInt(shortcut)}` : subHint;
    const statusHtml = SAMPLE_STATUSES.map((st, idx) => {
      const v = c[st] || 0;
      return `
        <div class="lab-overview__item lab-overview__item--stat lab-overview__item--status-${idx}">
          <div class="lab-overview__label">${st}</div>
          <div class="lab-overview__value">${fmtInt(v)}</div>
          <div class="lab-overview__hint">占比 ${total ? ((v / total) * 100).toFixed(1) : "--"}%</div>
        </div>
      `;
    }).join("");
    return `
      <div class="lab-overview__item lab-overview__item--total">
        <div class="lab-overview__label">样本总数</div>
        <div class="lab-overview__value">${fmtInt(total)}</div>
        <div class="lab-overview__hint">全流程样本</div>
      </div>
      <div class="lab-overview__item lab-overview__item--running">
        <div class="lab-overview__label">流转中</div>
        <div class="lab-overview__value">${fmtInt(inFlow)}</div>
        <div class="lab-overview__hint">不含已发布与暂存</div>
      </div>
      <div class="lab-overview__item lab-overview__item--done">
        <div class="lab-overview__label">已发布</div>
        <div class="lab-overview__value">${fmtInt(published)}</div>
        <div class="lab-overview__hint">终态</div>
      </div>
      <div class="lab-overview__item lab-overview__item--abn">
        <div class="lab-overview__label">异常/预警</div>
        <div class="lab-overview__value">${fmtInt(abnormal)}</div>
        <div class="lab-overview__hint">含 SLA 与质控推送</div>
      </div>
      <div class="lab-overview__item lab-overview__item--exp">
        <div class="lab-overview__label">实验中</div>
        <div class="lab-overview__value">${fmtInt(inExperiment)}</div>
        <div class="lab-overview__hint">${expHint}</div>
      </div>
      ${statusHtml}
    `;
  }

  function syncLabFilterInputsFromState() {
    const f = state.labAlpha.filters;
    const map = [
      ["scFilterBarcode", "barcode"],
      ["scFilterDetectNo", "detectNo"],
      ["scFilterBatchNo", "batchNo"],
      ["scFilterDueDate", "dueDateLte"],
    ];
    map.forEach(([id, key]) => {
      const v = f[key] || "";
      const el = document.getElementById(id);
      if (el) el.value = v;
    });
  }

  function renderSampleCenterOverview() {
    const root = $("#scOverview");
    if (!root) return;
    const samples = state.labAlpha.samples || [];
    root.innerHTML = buildSampleOverviewHtml(samples);
    const meta = $("#scOverviewMeta");
    if (meta) {
      const { total, inFlow, abnormal } = computeSampleDashboardCounts(samples);
      meta.textContent = `主状态合计 ${fmtInt(total)} · 流转中 ${fmtInt(inFlow)} · 异常 ${fmtInt(abnormal)} · 含直连实验中`;
    }
  }

  function labStatusBadge(status) {
    const lower = String(status || "");
    let cls = "";
    if (lower.includes("已发布")) cls = "lab-badge-status--done";
    else if (lower.includes("已退单")) cls = "lab-badge-status--bad";
    else if (lower.includes("异常处理")) cls = "lab-badge-status--bad";
    else if (lower.includes("暂存")) cls = "lab-badge-status--warn";
    else if (lower.includes("报告审核") || lower.includes("生信审核")) cls = "lab-badge-status--warn";
    else if (lower.includes("下机质控") || lower.includes("生信分析")) cls = "";
    else if (lower.includes("测序") || lower.includes("待上机")) cls = "lab-badge-status--warn";
    else if (lower.includes("杂交") || lower.includes("建库")) cls = "";
    else if (lower === "实验中") cls = "";
    else if (lower.includes("提取") || lower.includes("已接收")) cls = "";
    return `<span class="lab-badge-status ${cls}">${status}</span>`;
  }

  function labAlertPill(level) {
    if (!level || level === "无") return `<span class="lab-alert-pill">无</span>`;
    const cls =
      level === "高" ? "lab-alert-pill--high" : level === "中" ? "lab-alert-pill--mid" : "lab-alert-pill--low";
    return `<span class="lab-alert-pill ${cls}">${level}</span>`;
  }

  function fmtHours(h) {
    if (!Number.isFinite(h)) return "--";
    if (h <= 0) return "0 h";
    if (h < 24) return `${Math.round(h)} h`;
    const d = Math.floor(h / 24);
    const rh = Math.round(h % 24);
    return `${d} d ${rh} h`;
  }

  function renderSampleCenterStatusTable() {
    renderSampleStatusTable({
      tableBodyId: "scStatusTable",
      metaElId: "scStatusMeta",
      wrapId: "scStatusTableWrap",
      scrollbarId: "scStatusScrollbar",
      prevBtnId: "scPrevPage",
      nextBtnId: "scNextPage",
    });
  }

  function renderSampleStatusTable(cfg) {
    const body = $(`#${cfg.tableBodyId}`);
    const metaEl = $(`#${cfg.metaElId}`);
    if (!body) return;
    const list = getLabFilteredSamples();
    const pageSize = state.labAlpha.pageSize || 10;
    const total = list.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const pageStore = state.sampleCenter;
    const page = clamp(pageStore.page, 1, maxPage);
    pageStore.page = page;
    const start = (page - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);
    body.innerHTML = pageItems
      .map((s) => {
        return `
          <div class="table__row lab-row-status">
            <div>${s.barcode}</div>
            <div>${s.detectNo}</div>
            <div>${s.batchNo}</div>
            <div>${s.dueDate}</div>
            <div>${s.diagnosis}</div>
            <div>${s.org}</div>
            <div>${s.project}</div>
            <div>${s.isMain ? "是" : "否"}</div>
            <div>${s.dnaTotal} ng</div>
            <div>${s.rnaTotal} ng</div>
            <div>${s.qa}</div>
            <div>${s.libPre} ng/µL</div>
            <div>${s.libPost} ng/µL</div>
            <div>${s.sampleType}</div>
            <div>${s.tumorPct}%</div>
            <div>${s.isExperiment ? "是" : "否"}</div>
            <div>${labStatusBadge(s.status)}</div>
            <div>${s.remark || "--"}</div>
          </div>
        `;
      })
      .join("");
    if (metaEl) {
      metaEl.textContent = total
        ? `共 ${fmtInt(total)} 条记录，当前第 ${page} / ${maxPage} 页，每页 ${pageSize} 条（可左右滚动查看全部字段）`
        : "暂无符合条件的样本（可调整筛选条件或左右滚动查看）";
    }
    const wrap = $(`#${cfg.wrapId}`);
    const scrollbar = $(`#${cfg.scrollbarId}`);
    if (wrap && scrollbar) {
      const inner = scrollbar.querySelector(".lab-scrollbar__inner");
      if (inner) {
        const targetWidth = Math.max(wrap.scrollWidth, wrap.clientWidth);
        inner.style.width = `${targetWidth}px`;
      }
    }
    const prevBtn = $(`#${cfg.prevBtnId}`);
    const nextBtn = $(`#${cfg.nextBtnId}`);
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= maxPage;
  }

  function renderSampleCenterAbnormalTable() {
    renderSampleAbnormalTable("scAbnormalTable");
  }

  function renderSampleAbnormalTable(bodyId) {
    const body = $(`#${bodyId}`);
    if (!body) return;
    const samples = state.labAlpha.samples || [];
    const list = samples.filter(
      (s) =>
        s.isAbnormal &&
        s.status !== "已发布" &&
        s.status !== "已退单"
    );
    const rowCls = "table__row lab-row-abn lab-row-abn--sc";
    body.innerHTML = list
      .map(
        (s) => `
          <div class="${rowCls}">
            <div>${s.barcode}</div>
            <div>${s.detectNo}</div>
            <div>${s.batchNo}</div>
            <div>${s.sampleType}</div>
            <div>${s.org}</div>
            <div>${labStatusBadge(s.status)}</div>
            <div>${fmtHours(s.stayHours)}</div>
            <div>${s.slaHours ? `${fmtHours(s.slaHours)}` : "--"}</div>
            <div>${s.owner}</div>
            <div>${labAlertPill(s.alertLevel)}</div>
          </div>
        `
      )
      .join("");
  }

  function todayYMD() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentMonthYM() {
    return new Date().toISOString().slice(0, 7);
  }

  function extGenMonitorData(dayStr) {
    const seed = Number(String(dayStr || "").replaceAll("-", "")) || 20260324;
    const rnd = seededRand(seed + 88001);
    const typeDist = Object.fromEntries(
      EXT_SAMPLE_TYPES.map((t) => [t, Math.floor(5 + rnd() * 48)])
    );
    return {
      kpi: {
        pending: Math.floor(12 + rnd() * 38),
        extracting: Math.floor(6 + rnd() * 26),
        qc: Math.floor(9 + rnd() * 28),
        handover: Math.floor(5 + rnd() * 22),
        fail: Math.floor(1 + rnd() * 14),
        staging: Math.floor(3 + rnd() * 16),
      },
      typeDist,
      handover: {
        ngs: Math.floor(3 + rnd() * 17),
        nonNgs: Math.floor(3 + rnd() * 15),
        handedNoExp: Math.floor(1 + rnd() * 11),
        timeout: Math.floor(0 + rnd() * 9),
      },
    };
  }

  function drawExtTypeDistBars(canvas, typeDist) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const entries = EXT_SAMPLE_TYPES.map((t) => [t, typeDist[t] ?? 0]);
    const max = Math.max(1, ...entries.map((e) => e[1]));
    const labelW = 72;
    const left = 12;
    const barH = 26;
    const gap = 10;
    const barMaxW = w - left - labelW - 56;
    ctx.font = "12px Inter, system-ui, -apple-system";
    entries.forEach(([lb, v], i) => {
      const y = 18 + i * (barH + gap);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(lb, left + labelW, y + barH / 2);
      const bw = (barMaxW * v) / max;
      const grad = ctx.createLinearGradient(left + labelW + 8, 0, left + labelW + 8 + bw, 0);
      grad.addColorStop(0, "rgba(124,92,255,0.55)");
      grad.addColorStop(1, "rgba(34,211,238,0.32)");
      ctx.fillStyle = grad;
      ctx.fillRect(left + labelW + 8, y, bw, barH);
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.textAlign = "left";
      ctx.fillText(String(v), left + labelW + 14 + bw, y + barH / 2);
    });
  }

  function extGenBoxItemsByType(seedBase, genVal) {
    return EXT_SAMPLE_TYPES.map((t, i) => {
      const rnd = seededRand(seedBase + i * 131);
      const n = 14 + Math.floor(rnd() * 18);
      const vals = [];
      for (let k = 0; k < n; k++) vals.push(genVal(t, rnd, k));
      return { label: t, values: vals };
    });
  }

  function extGenStatsBundle(scopeKey) {
    const seed = Number(String(scopeKey || "").replace(/-/g, "")) || 202603;
    const dnaYield = extGenBoxItemsByType(seed + 100, (t, rnd) =>
      clamp(40 + normalRand(rnd) * 35 + (t === "全血" ? 20 : 0), 5, 220)
    );
    const rnaYield = extGenBoxItemsByType(seed + 200, (t, rnd) =>
      clamp(20 + normalRand(rnd) * 25 + (t === "胸腹水" ? 15 : 0), 2, 120)
    );
    const dnaConc = extGenBoxItemsByType(seed + 300, (t, rnd) =>
      clamp(25 + normalRand(rnd) * 18, 4, 120)
    );
    const rnaConc = extGenBoxItemsByType(seed + 400, (t, rnd) =>
      clamp(18 + normalRand(rnd) * 24, 2, 95)
    );
    const dnaPur = extGenBoxItemsByType(seed + 500, (t, rnd) =>
      clamp(1.8 + normalRand(rnd) * 0.12, 1.4, 2.2)
    );
    const rnaPur = extGenBoxItemsByType(seed + 600, (t, rnd) =>
      clamp(1.95 + normalRand(rnd) * 0.1, 1.6, 2.2)
    );
    return { dnaYield, rnaYield, dnaConc, rnaConc, dnaPur, rnaPur };
  }

  function buildExtractionRiskRows(dayStr) {
    const RISK_TYPES = [
      "待提取超时",
      "提取停留过长",
      "提取完成未质检",
      "质控失败未补提",
      "质检通过未交接下游",
    ];
    const tasks = (state.tasks || []).filter((t) => t.status !== TASK_STATUSES.done);
    const samples = state.labAlpha.samples || [];
    const rows = [];
    tasks.forEach((t, i) => {
      const s = samples.find((x) => String(x.id) === String(t.sourceSampleId));
      if (!s) return;
      rows.push({
        barcode: s.barcode,
        riskType: RISK_TYPES[i % RISK_TYPES.length],
        sampleType: s.sampleType || "组织",
        status: s.status,
        stay: fmtHours(s.stayHours),
        owner: s.owner || t.assignee || "--",
        taskId: t.id,
      });
    });
    const rnd = seededRand(Number(String(dayStr).replace(/-/g, "")) + 777);
    let k = 0;
    while (rows.length < 8) {
      rows.push({
        barcode: `RK${String(1000 + k).slice(1)}`,
        riskType: RISK_TYPES[k % RISK_TYPES.length],
        sampleType: EXT_SAMPLE_TYPES[k % EXT_SAMPLE_TYPES.length],
        status: "待提取",
        stay: fmtMin(40 + rnd() * 120),
        owner: LAB_MODULE_PEOPLE[k % LAB_MODULE_PEOPLE.length],
        taskId: `T-EXT-${k}`,
      });
      k++;
    }
    return rows.slice(0, 14);
  }

  function extHandoverModalRows(kind, dayStr) {
    const seed = Number(String(dayStr).replace(/-/g, "")) + kind.length * 997;
    const rnd = seededRand(seed);
    const n = 5 + Math.floor(rnd() * 7);
    const rows = [];
    for (let i = 0; i < n; i++) {
      rows.push({
        barcode: `HB${String(10000 + i)}`,
        detectNo: `D${20260300 + i}`,
        sampleType: EXT_SAMPLE_TYPES[i % EXT_SAMPLE_TYPES.length],
        project: PROJECTS[i % PROJECTS.length],
        stay: fmtMin(20 + rnd() * 400),
        owner: LAB_MODULE_PEOPLE[i % LAB_MODULE_PEOPLE.length],
      });
    }
    return rows;
  }

  const EXT_HANDOVER_TITLES = {
    ngs: "待交接二代组 · 样本明细",
    "non-ngs": "待交接非二代组 · 样本明细",
    "handed-no-exp": "已交接但未实验 · 样本明细",
    timeout: "超时未交接 · 样本明细",
  };

  function openExtHandoverModal(kind) {
    const modal = $("#extHandoverModal");
    const title = $("#extHandoverModalTitle");
    const body = $("#extHandoverModalBody");
    if (!modal || !title || !body) return;
    const day = state.extraction.monitorDate || todayYMD();
    title.textContent = EXT_HANDOVER_TITLES[kind] || "样本明细";
    const rows = extHandoverModalRows(kind, day);
    body.innerHTML = rows
      .map(
        (r) => `
      <div class="table__row ext-row-handover-modal">
        <div>${r.barcode}</div>
        <div>${r.detectNo}</div>
        <div>${r.sampleType}</div>
        <div>${r.project}</div>
        <div>${r.stay}</div>
        <div>${r.owner}</div>
      </div>`
      )
      .join("");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeExtHandoverModal() {
    const modal = $("#extHandoverModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function applyExtractionTabUI(tab) {
    const root = $("#view-lab-extraction");
    if (!root) return;
    $$(".ext-tab", root).forEach((b) => {
      const on = b.getAttribute("data-ext-tab") === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".ext-panel", root).forEach((p) => {
      const on = p.getAttribute("data-ext-panel") === tab;
      if (on) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
      p.classList.toggle("is-active", on);
    });
  }

  function setExtractionTab(tab) {
    state.extraction.tab = tab;
    applyExtractionTabUI(tab);
    if (tab === "monitor") renderExtractionMonitor();
    if (tab === "stats") renderExtractionStats();
    if (tab === "transfer") renderExtractionTransfer();
  }

  function ensureExtractionDefaults() {
    const ex = state.extraction;
    if (!ex.monitorDate) ex.monitorDate = todayYMD();
    if (!ex.statsDay) ex.statsDay = todayYMD();
    if (!ex.statsMonth) ex.statsMonth = currentMonthYM();
  }

  function renderExtractionStatsSeg() {
    const seg = $("#extStatsScopeSeg");
    if (!seg) return;
    const scope = state.extraction.statsScope || "day";
    if (seg.dataset.extScope === scope && seg.innerHTML.trim()) return;
    seg.dataset.extScope = scope;
    seg.innerHTML = ["day", "month"]
      .map((k) => {
        const active = scope === k;
        const label = k === "day" ? "按日" : "按月";
        return `
          <label class="seg__item ${active ? "is-active" : ""}">
            <input type="radio" name="extStatsScope" value="${k}" ${active ? "checked" : ""}/>
            <span>${label}</span>
          </label>
        `;
      })
      .join("");
  }

  function renderExtractionMonitor() {
    ensureExtractionDefaults();
    const day = state.extraction.monitorDate || todayYMD();
    const md = $("#extMonitorDate");
    if (md) md.value = day;
    setText("extMonitorDateHint", `统计日 ${day} · 当批次样本类型分布`);

    const data = extGenMonitorData(day);
    setText("extKpiPending", fmtInt(data.kpi.pending));
    setText("extKpiExtracting", fmtInt(data.kpi.extracting));
    setText("extKpiQc", fmtInt(data.kpi.qc));
    setText("extKpiHandover", fmtInt(data.kpi.handover));
    setText("extKpiFail", fmtInt(data.kpi.fail));
    setText("extKpiStaging", fmtInt(data.kpi.staging));

    const total = EXT_SAMPLE_TYPES.reduce((s, t) => s + (data.typeDist[t] || 0), 0);
    setText("extTypeDistMeta", `合计 ${fmtInt(total)} 例样本 · 按类型`);

    const c = $("#extCanvasTypeDist");
    if (c) drawExtTypeDistBars(c, data.typeDist);

    setText("extHandoverNgs", fmtInt(data.handover.ngs));
    setText("extHandoverNonNgs", fmtInt(data.handover.nonNgs));
    setText("extHandoverHanded", fmtInt(data.handover.handedNoExp));
    setText("extHandoverTimeout", fmtInt(data.handover.timeout));

    const riskBody = $("#extRiskTable");
    if (riskBody) {
      const risks = buildExtractionRiskRows(day);
      riskBody.innerHTML = risks
        .map(
          (r) => `
        <div class="table__row ext-row-risk">
          <div>${r.barcode}</div>
          <div>${r.riskType}</div>
          <div>${r.sampleType}</div>
          <div>${r.status}</div>
          <div>${r.stay}</div>
          <div>${r.owner}</div>
          <div>${r.taskId}</div>
        </div>`
        )
        .join("");
    }
  }

  function renderExtractionStats() {
    ensureExtractionDefaults();
    renderExtractionStatsSeg();
    const scope = state.extraction.statsScope || "day";
    const dayField = $("#extStatsDayField");
    const monthField = $("#extStatsMonthField");
    if (dayField) dayField.style.display = scope === "day" ? "" : "none";
    if (monthField) monthField.style.display = scope === "month" ? "" : "none";

    const dayEl = $("#extStatsDay");
    const monthEl = $("#extStatsMonth");
    if (dayEl && dayEl.value !== state.extraction.statsDay) dayEl.value = state.extraction.statsDay;
    if (monthEl && monthEl.value !== state.extraction.statsMonth) monthEl.value = state.extraction.statsMonth;

    const statsKey = scope === "month" ? state.extraction.statsMonth : state.extraction.statsDay;
    setText(
      "extStatsHint",
      scope === "month" ? `统计月 ${statsKey} · 箱型图聚合该月数据` : `统计日 ${statsKey} · 箱型图聚合该日数据`
    );

    const bundle = extGenStatsBundle(statsKey);

    const drawOpts = { rotateLabels: true, padB: 52, yFmt: (v) => fmtNum(v, 1) };
    const c1 = $("#extCanvasDnaYield");
    if (c1) drawCategoryBoxWithOutliers(c1, bundle.dnaYield, { ...drawOpts, yFmt: (v) => `${fmtNum(v, 1)} ng` });
    const c2 = $("#extCanvasRnaYield");
    if (c2) drawCategoryBoxWithOutliers(c2, bundle.rnaYield, { ...drawOpts, yFmt: (v) => `${fmtNum(v, 1)} ng` });
    const c3 = $("#extCanvasDnaConc");
    if (c3) drawCategoryBoxWithOutliers(c3, bundle.dnaConc, { ...drawOpts, yFmt: (v) => `${fmtNum(v, 1)}` });
    const c4 = $("#extCanvasRnaConc");
    if (c4) drawCategoryBoxWithOutliers(c4, bundle.rnaConc, { ...drawOpts, yFmt: (v) => `${fmtNum(v, 1)}` });
    const c5 = $("#extCanvasDnaPur");
    if (c5) drawCategoryBoxWithOutliers(c5, bundle.dnaPur, { ...drawOpts, yFmt: (v) => `${fmtNum(v, 2)}` });
    const c6 = $("#extCanvasRnaPur");
    if (c6) drawCategoryBoxWithOutliers(c6, bundle.rnaPur, { ...drawOpts, yFmt: (v) => `${fmtNum(v, 2)}` });

    const lowBody = $("#extLowQualityTable");
    if (lowBody) {
      const rnd = seededRand(Number(String(statsKey).replace(/-/g, "")) + 888);
      const n = 6 + Math.floor(rnd() * 5);
      const reasons = ["DNA 浓度偏低", "RNA 降解风险", "A260/A280 异常", "总量不足"];
      lowBody.innerHTML = Array.from({ length: n }, (_, i) => {
        const st = EXT_SAMPLE_TYPES[i % EXT_SAMPLE_TYPES.length];
        const p = PROJECTS[i % PROJECTS.length];
        return `
        <div class="table__row ext-row-low">
          <div>LQ${8000 + i}</div>
          <div>${st}</div>
          <div>${p}</div>
          <div class="ta-r">${fmtNum(8 + rnd() * 6, 1)}</div>
          <div class="ta-r">${fmtNum(4 + rnd() * 5, 1)}</div>
          <div>${reasons[i % reasons.length]}</div>
        </div>`;
      }).join("");
    }

    const head = $("#extPassRateHead");
    const passBody = $("#extPassRateBody");
    if (head && passBody) {
      const rnd = seededRand(Number(String(statsKey).replace(/-/g, "")) + 999);
      const projs = PROJECTS.slice(0, 6);
      head.innerHTML = `<div>项目</div>${EXT_SAMPLE_TYPES.map((t) => `<div class="ta-r">${t}</div>`).join("")}<div class="ta-r">综合</div>`;
      passBody.innerHTML = projs
        .map((p) => {
          const cells = EXT_SAMPLE_TYPES.map(() => {
            const v = 62 + rnd() * 35;
            return `<div class="ta-r">${fmtNum(v, 1)}%</div>`;
          }).join("");
          const avg = 68 + rnd() * 28;
          return `<div class="table__row ext-row-pass"><div>${p}</div>${cells}<div class="ta-r">${fmtNum(avg, 1)}%</div></div>`;
        })
        .join("");
    }
  }

  function renderExtractionTransfer() {
    const day = state.extraction.monitorDate || todayYMD();
    setText("extTransferMeta", `展示日 ${day} · 与监控台交接口径一致`);
    const rnd = seededRand(Number(day.replace(/-/g, "")) + 1200);
    const body = $("#extTransferTable");
    if (!body) return;
    const n = 6 + Math.floor(rnd() * 8);
    const dirs = ["转出", "接收确认"];
    const targets = ["二代实验室", "非二代实验室"];
    const statuses = ["待签收", "已签收", "运输中"];
    const ops = ["实验员A", "实验员B", "交接班"];
    body.innerHTML = Array.from({ length: n }, (_, i) => {
      const ts = `${day} ${String(8 + Math.floor(rnd() * 10)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}`;
      return `
      <div class="table__row ext-row-transfer">
        <div>${ts}</div>
        <div>TR${9000 + i}</div>
        <div>${dirs[i % dirs.length]}</div>
        <div>${targets[i % targets.length]}</div>
        <div>${statuses[i % statuses.length]}</div>
        <div>${ops[i % ops.length]}</div>
      </div>`;
    }).join("");
  }

  function renderExtractionCenter() {
    const root = $("#view-lab-extraction");
    if (!root || !root.classList.contains("is-active")) return;
    if (!state.labAlpha.samples.length) initLabAlphaSim();
    syncAbnormalTasksPipeline();
    ensureExtractionDefaults();
    applyExtractionTabUI(state.extraction.tab || "monitor");
    const tab = state.extraction.tab || "monitor";
    if (tab === "monitor") renderExtractionMonitor();
    if (tab === "stats") renderExtractionStats();
    if (tab === "transfer") renderExtractionTransfer();
  }

  function getNgsStatuses() {
    return ["待建库", "建库中", "待杂交", "杂交中", "待上机", "测序中", "实验室流转完成"];
  }

  function toNgsFlowStatus(sample) {
    const st = String(sample?.status || "");
    if (st === "待建库" || st === "建库中" || st === "待杂交" || st === "杂交中" || st === "待上机" || st === "测序中") return st;
    if (st === "实验中") return "待建库";
    if (st.includes("生信") || st.includes("报告") || st.includes("下机") || st === "已发布") return "实验室流转完成";
    return null;
  }

  function ngsFlowSamples() {
    return (state.labAlpha.samples || [])
      .map((s) => ({ ...s, ngsFlowStatus: toNgsFlowStatus(s) }))
      .filter((s) => !!s.ngsFlowStatus);
  }

  function ngsBatchOptionsFromQc() {
    const batches = state.qcSeq?.batches || [];
    return batches.map((b) => ({
      id: b.id,
      label: `${b.id} · ${b.runName || "--"}`,
      runName: b.runName || "--",
      flowcell: b.flowcell || "--",
    }));
  }

  function ngsSampleBatchId(sample) {
    const opts = ngsBatchOptionsFromQc();
    if (!opts.length) return sample.batchNo || "--";
    const idx = stableHash(sample.batchNo || sample.id || "") % opts.length;
    return opts[idx].id;
  }

  function getNgsQcControlAdded(batchId, project) {
    const k = String(batchId || "");
    const p = String(project || "");
    const byBatch = state.ngs.qcControlAddedByBatch[k] || {};
    return byBatch[p] || { pos: false, neg: false };
  }

  function setNgsQcControlAdded(batchId, project, kind) {
    const k = String(batchId || "");
    const p = String(project || "");
    if (!k || !p) return;
    const byBatch = state.ngs.qcControlAddedByBatch[k] || {};
    const cur = byBatch[p] || { pos: false, neg: false };
    const next = { ...cur };
    if (kind === "pos") next.pos = true;
    if (kind === "neg") next.neg = true;
    state.ngs.qcControlAddedByBatch[k] = { ...byBatch, [p]: next };
  }

  function ensureNgsDefaults() {
    const batches = ngsBatchOptionsFromQc();
    if (!state.ngs.selectedBatchId && batches.length) state.ngs.selectedBatchId = batches[0].id;
    if (!state.ngs.statsBatchNo && batches.length) state.ngs.statsBatchNo = batches[0].id;
    if (!state.ngs.statsMonth) state.ngs.statsMonth = currentMonthYM();
  }

  function applyNgsTabUI(tab) {
    const root = $("#view-lab-ngs");
    if (!root) return;
    $$(".ngs-tab", root).forEach((b) => {
      const on = b.getAttribute("data-ngs-tab") === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".ngs-panel", root).forEach((p) => {
      const on = p.getAttribute("data-ngs-panel") === tab;
      if (on) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
      p.classList.toggle("is-active", on);
    });
  }

  function renderNgsBatchSeg(samples) {
    const seg = $("#ngsBatchSeg");
    if (!seg) return;
    const batches = ngsBatchOptionsFromQc().slice(0, 10);
    seg.innerHTML = batches
      .map((b) => {
        const active = state.ngs.selectedBatchId === b.id;
        return `<label class="seg__item ${active ? "is-active" : ""}"><input type="radio" name="ngsBatch" value="${b.id}" ${active ? "checked" : ""}/><span>${b.id}</span></label>`;
      })
      .join("");
  }

  function renderNgsProjectChips(samples) {
    const root = $("#ngsProjectChips");
    if (!root) return;
    const projs = Array.from(new Set(samples.map((s) => s.project))).slice(0, 8);
    root.innerHTML = projs
      .map((p) => {
        const active = state.ngs.selectedProjects.has(p);
        return `<label class="chip ${active ? "is-active" : ""}"><input type="checkbox" name="ngsProject" value="${p}" ${active ? "checked" : ""}/><span>${p}</span></label>`;
      })
      .join("");
  }

  function renderNgsMonitor() {
    const samples = ngsFlowSamples();
    ensureNgsDefaults();
    const samplesWithQcBatch = samples.map((s) => ({ ...s, ngsBatchId: ngsSampleBatchId(s) }));
    const statuses = getNgsStatuses();
    const counts = Object.fromEntries(statuses.map((s) => [s, 0]));
    samplesWithQcBatch.forEach((s) => {
      counts[s.ngsFlowStatus] = (counts[s.ngsFlowStatus] || 0) + 1;
    });
    setText("ngsKpiPendingLib", fmtInt(counts["待建库"] || 0));
    setText("ngsKpiLibDoing", fmtInt(counts["建库中"] || 0));
    setText("ngsKpiPendingHyb", fmtInt(counts["待杂交"] || 0));
    setText("ngsKpiHybDoing", fmtInt(counts["杂交中"] || 0));
    setText("ngsKpiPendingRun", fmtInt(counts["待上机"] || 0));
    setText("ngsKpiSeqDoing", fmtInt(counts["测序中"] || 0));
    setText("ngsKpiDone", fmtInt(counts["实验室流转完成"] || 0));

    const riskRows = samplesWithQcBatch
      .filter((s) => s.isAbnormal || (s.remainingHours || 0) <= 2)
      .slice(0, 16)
      .map((s) => {
        const riskType =
          s.ngsFlowStatus === "待建库" || s.ngsFlowStatus === "建库中"
            ? "建库环节超时"
            : s.ngsFlowStatus === "待杂交" || s.ngsFlowStatus === "杂交中"
            ? "杂交环节停留过长"
            : s.ngsFlowStatus === "待上机"
            ? "待上机超时"
            : s.ngsFlowStatus === "测序中"
            ? "测序进度滞后"
            : "流转异常";
        return `<div class="table__row ngs-row-risk"><div>${s.barcode}</div><div>${riskType}</div><div>${s.project}</div><div>${s.ngsFlowStatus}</div><div>${fmtHours(s.stayHours)}</div><div>${s.owner}</div><div>${s.alertLevel || "中"}</div></div>`;
      })
      .join("");
    const riskBody = $("#ngsRiskTable");
    if (riskBody) riskBody.innerHTML = riskRows || `<div class="muted">暂无风险样本</div>`;

    renderNgsBatchSeg(samplesWithQcBatch);
    renderNgsProjectChips(samplesWithQcBatch);

    const selectedBatchId = state.ngs.selectedBatchId;
    const batchSamples = samplesWithQcBatch.filter((s) => s.ngsBatchId === selectedBatchId);
    const projMap = {};
    batchSamples.forEach((s) => {
      projMap[s.project] = (projMap[s.project] || 0) + 1;
    });
    const summary = $("#ngsBatchSummary");
    if (summary) {
      const txt = Object.entries(projMap)
        .slice(0, 8)
        .map(([p, n]) => `${p}：${fmtInt(n)}`)
        .join(" · ");
      summary.innerHTML = `<div><b>选中批次：</b>${selectedBatchId || "--"}</div><div><b>样本数：</b>${fmtInt(batchSamples.length)}</div><div><b>项目组成：</b>${txt || "--"}</div>`;
    }

    const selectedProjects = Array.from(state.ngs.selectedProjects);
    const libRows = batchSamples
      .filter((s) => selectedProjects.includes(s.project))
      .filter((s) => ["待建库", "建库中", "待杂交"].includes(s.ngsFlowStatus))
      .slice(0, 40)
      .map((s) => {
        const conc = s.ngsFlowStatus === "待杂交" ? `${fmtNum(Number(s.libPost), 2)} ng/µL` : "--";
        return `<div class="table__row ngs-row-lib"><div>${s.barcode}</div><div>${s.ngsBatchId}</div><div>${s.project}</div><div>${s.ngsFlowStatus}</div><div>${conc}</div><div>${s.owner}</div></div>`;
      })
      .join("");
    const libBody = $("#ngsLibTable");
    if (libBody) libBody.innerHTML = libRows || `<div class="muted">暂无建库样本</div>`;

    const poolMap = new Map();
    batchSamples
      .filter((s) => s.ngsFlowStatus === "待杂交" || s.ngsFlowStatus === "待上机")
      .forEach((s) => {
      const proj = s.project;
      if (!poolMap.has(proj)) poolMap.set(proj, []);
      const pools = poolMap.get(proj);
      const poolNo = `POOL-${proj}-${(stableHash(s.barcode) % 3) + 1}`;
      if (!pools.includes(poolNo)) pools.push(poolNo);
      });
    const poolBody = $("#ngsPoolTable");
    if (poolBody) {
      poolBody.innerHTML = Array.from(poolMap.entries())
        .map(([proj, pools]) => {
          const btns = pools
            .map((p) => `<button type="button" class="btn btn--ghost ngs-pool-btn" data-ngs-pool="${p}" data-ngs-proj="${proj}">${p}</button>`)
            .join("");
          return `<div class="table__row ngs-row-pool"><div>${proj}</div><div>${fmtInt(pools.length)}</div><div>${btns}</div></div>`;
        })
        .join("");
    }

    const runMap = new Map();
    const qcBatchById = new Map((state.qcSeq?.batches || []).map((b) => [b.id, b]));
    batchSamples.forEach((s) => {
      const qb = qcBatchById.get(s.ngsBatchId);
      if (!qb) return;
      const run = qb.runName || qb.id;
      if (!runMap.has(run)) runMap.set(run, { batchNo: qb.id, pools: new Set(), count: 0, status: s.ngsFlowStatus === "测序中" ? "测序中" : "待上机" });
      const item = runMap.get(run);
      item.pools.add(`POOL-${s.project}-${(stableHash(s.barcode) % 3) + 1}`);
      item.count += 1;
    });
    const runBody = $("#ngsRunTable");
    if (runBody) {
      runBody.innerHTML = Array.from(runMap.entries())
        .slice(0, 18)
        .map(([run, v]) => `<div class="table__row ngs-row-run"><div>${run}</div><div>${v.batchNo}</div><div>${v.status}</div><div class="ta-r">${fmtInt(v.pools.size)}</div><div class="ta-r">${fmtInt(v.count)}</div></div>`)
        .join("");
    }
  }

  function ngsStatItemsByProject(seedBase, gen) {
    return PROJECTS.slice(0, 8).map((p, i) => {
      const rnd = seededRand(seedBase + i * 97);
      const values = Array.from({ length: 20 + Math.floor(rnd() * 12) }, () => gen(rnd, p));
      return { label: p, values };
    });
  }

  function renderNgsStatsScopeSeg() {
    const seg = $("#ngsStatsScopeSeg");
    if (!seg) return;
    const scope = state.ngs.statsScope || "batch";
    seg.innerHTML = ["batch", "month"]
      .map((k) => `<label class="seg__item ${scope === k ? "is-active" : ""}"><input type="radio" name="ngsStatsScope" value="${k}" ${scope === k ? "checked" : ""}/><span>${k === "batch" ? "按批次" : "按月份"}</span></label>`)
      .join("");
  }

  function renderNgsStats() {
    const samples = ngsFlowSamples();
    ensureNgsDefaults();
    renderNgsStatsScopeSeg();
    const batchField = $("#ngsStatsBatchField");
    const monthField = $("#ngsStatsMonthField");
    const scope = state.ngs.statsScope || "batch";
    if (batchField) batchField.style.display = scope === "batch" ? "" : "none";
    if (monthField) monthField.style.display = scope === "month" ? "" : "none";
    const batchSel = $("#ngsStatsBatchSelect");
    if (batchSel) {
      const batches = ngsBatchOptionsFromQc();
      upsertOptions(
        batchSel,
        batches.map((b) => ({ value: b.id, label: `${b.id} · ${b.runName}` })),
        state.ngs.statsBatchNo || batches[0]?.id || ""
      );
      state.ngs.statsBatchNo = batchSel.value;
    }
    const monthInput = $("#ngsStatsMonthInput");
    if (monthInput && monthInput.value !== state.ngs.statsMonth) monthInput.value = state.ngs.statsMonth;
    const key = scope === "month" ? state.ngs.statsMonth : state.ngs.statsBatchNo;
    setText("ngsStatsMeta", scope === "month" ? `按月份 ${key} 统计` : `按批次 ${key} 统计`);
    const seed = Number(String(key || "").replaceAll("-", "")) || 202603;
    const preConc = ngsStatItemsByProject(seed + 11, (r) => clamp(12 + normalRand(r) * 6, 2, 40));
    const preYield = ngsStatItemsByProject(seed + 22, (r) => clamp(180 + normalRand(r) * 60, 40, 420));
    const finalConc = ngsStatItemsByProject(seed + 33, (r) => clamp(20 + normalRand(r) * 7, 3, 55));
    const finalYield = ngsStatItemsByProject(seed + 44, (r) => clamp(140 + normalRand(r) * 45, 20, 360));
    const failRate = ngsStatItemsByProject(seed + 55, (r) => clamp(3 + Math.abs(normalRand(r)) * 4.5, 0.2, 22));
    const opts = { rotateLabels: true, padB: 56 };
    const c1 = $("#ngsCanvasPreConc");
    if (c1) drawCategoryBoxWithOutliers(c1, preConc, { ...opts, yFmt: (v) => `${fmtNum(v, 1)} ng/µL` });
    const c2 = $("#ngsCanvasPreYield");
    if (c2) drawCategoryBoxWithOutliers(c2, preYield, { ...opts, yFmt: (v) => `${fmtNum(v, 0)} ng` });
    const c3 = $("#ngsCanvasFinalConc");
    if (c3) drawCategoryBoxWithOutliers(c3, finalConc, { ...opts, yFmt: (v) => `${fmtNum(v, 1)} ng/µL` });
    const c4 = $("#ngsCanvasFinalYield");
    if (c4) drawCategoryBoxWithOutliers(c4, finalYield, { ...opts, yFmt: (v) => `${fmtNum(v, 0)} ng` });
    const c5 = $("#ngsCanvasFailRate");
    if (c5) drawCategoryBoxWithOutliers(c5, failRate, { ...opts, yFmt: (v) => `${fmtNum(v, 1)}%` });

    const rnd = seededRand(seed + 1001);
    const cancelBody = $("#ngsCancelTable");
    if (cancelBody) {
      const reasons = ["样本量不足", "污染风险", "文库构建失败", "重复送检", "临床退单"];
      cancelBody.innerHTML = Array.from({ length: 8 }, (_, i) => {
        const p = PROJECTS[i % PROJECTS.length];
        const st = ["蜡块", "蜡卷", "胸腹水", "脑脊液", "全血"][i % 5];
        return `<div class="table__row ngs-row-cancel"><div>CX${9000 + i}</div><div>B${260100 + i}</div><div>${p}</div><div>${st}</div><div>${reasons[Math.floor(rnd() * reasons.length)]}</div></div>`;
      }).join("");
    }

    const successHead = $("#ngsSuccessHead");
    const successBody = $("#ngsSuccessBody");
    const types = ["蜡块", "蜡卷", "胸腹水", "脑脊液", "全血"];
    if (successHead && successBody) {
      successHead.innerHTML = `<div>项目</div>${types.map((t) => `<div class="ta-r">${t}</div>`).join("")}`;
      successBody.innerHTML = PROJECTS.slice(0, 8)
        .map((p, i) => {
          const r = seededRand(seed + i * 113);
          const cells = types.map(() => `<div class="ta-r">${fmtNum(72 + r() * 26, 1)}%</div>`).join("");
          return `<div class="table__row ngs-row-success"><div>${p}</div>${cells}</div>`;
        })
        .join("");
    }

    const probeBody = $("#ngsProbeTable");
    if (probeBody) {
      probeBody.innerHTML = PROJECTS.slice(0, 8)
        .map((p, i) => {
          const poolN = 4 + (seededRand(seed + i * 9)() * 12) | 0;
          return `<div class="table__row ngs-row-probe"><div>${p}</div><div class="ta-r">${fmtInt(poolN)}</div><div class="ta-r">${fmtInt(poolN)}</div></div>`;
        })
        .join("");
    }
  }

  function openNgsPoolModal(poolId, project) {
    const modal = $("#ngsPoolModal");
    const title = $("#ngsPoolModalTitle");
    const body = $("#ngsPoolModalBody");
    if (!modal || !title || !body) return;
    title.textContent = `${poolId} · ${project} · 文库明细`;
    const libs = ngsFlowSamples()
      .filter((s) => s.project === project)
      .filter((s) => s.ngsFlowStatus === "待杂交" || s.ngsFlowStatus === "待上机")
      .filter((s) => `POOL-${s.project}-${(stableHash(s.barcode) % 3) + 1}` === poolId)
      .slice(0, 24);
    const batchId = libs[0] ? ngsSampleBatchId(libs[0]) : state.ngs.selectedBatchId;
    state.ngs.activePoolBatchId = batchId || "";
    state.ngs.activePoolId = poolId || "";
    state.ngs.activePoolProject = project || "";
    const st = getNgsQcControlAdded(batchId, project);
    const qcHint = $("#ngsPoolQcHint");
    if (qcHint) {
      qcHint.textContent = `当前批次 ${batchId || "--"} · 项目 ${project || "--"} · 阳控：${st.pos ? "已增加" : "未增加"} · 阴控：${st.neg ? "已增加" : "未增加"}`;
    }
    const ctrlLibs = [];
    if (st.pos) {
      ctrlLibs.push({ libId: `${project}-PC`, barcode: "--", project, conc: "--", status: "阳控文库" });
    }
    if (st.neg) {
      ctrlLibs.push({ libId: `${project}-NC`, barcode: "--", project, conc: "--", status: "阴控文库" });
    }
    body.innerHTML = [
      ...ctrlLibs.map((x) => `<div class="table__row ngs-row-pool-lib"><div>${x.libId}</div><div>${x.barcode}</div><div>${x.project}</div><div>${x.conc}</div><div>${x.status}</div></div>`),
      ...libs.map((s, i) => `<div class="table__row ngs-row-pool-lib"><div>LIB-${s.project}-${String(i + 1).padStart(3, "0")}</div><div>${s.barcode}</div><div>${s.project}</div><div>${fmtNum(Number(s.libPost), 2)} ng/µL</div><div>${s.ngsFlowStatus}</div></div>`),
    ]
      .join("");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeNgsPoolModal() {
    const modal = $("#ngsPoolModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    state.ngs.activePoolBatchId = "";
    state.ngs.activePoolId = "";
    state.ngs.activePoolProject = "";
  }

  function setNgsTab(tab) {
    state.ngs.tab = tab;
    applyNgsTabUI(tab);
    if (tab === "monitor") renderNgsMonitor();
    if (tab === "stats") renderNgsStats();
  }

  function nonNgsMethodForSample(s) {
    if (!s) return "其他";
    const src = `${s.project || ""}|${s.sampleType || ""}`;
    const idx = stableHash(src) % NON_NGS_METHODS.length;
    return NON_NGS_METHODS[idx] || "其他";
  }

  function mapNonNgsBizStatus(limsStatus) {
    const st = String(limsStatus || "");
    if (!st) return "待处理";
    if (st.includes("已发布") || st.includes("已退单")) return "已完成";
    if (st.includes("待") && (st.includes("上机") || st.includes("建库") || st.includes("杂交") || st.includes("提取"))) return "待处理";
    if (st.includes("中") && (st.includes("实验") || st.includes("建库") || st.includes("杂交") || st.includes("测序") || st.includes("提取"))) return "执行中";
    if (st.includes("生信分析") || st.includes("下机质控")) return "待判读";
    if (st.includes("生信审核") || st.includes("报告审核")) return "待复核";
    if (st.includes("异常处理")) return "待复检";
    return "待处理";
  }

  function nonNgsCurrentStep(sample, method) {
    const biz = mapNonNgsBizStatus(sample?.status);
    if (biz === "待处理") return `${method}准备`;
    if (biz === "执行中") return `${method}执行`;
    if (biz === "待判读") return `${method}判读`;
    if (biz === "待复核") return `${method}复核`;
    if (biz === "待复检") return `${method}复检`;
    return `${method}完成`;
  }

  function applyNonNgsTabUI(tab) {
    const root = $("#view-lab-non-ngs");
    if (!root) return;
    $$(".nonngs-tab", root).forEach((b) => {
      const on = b.getAttribute("data-nonngs-tab") === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".nonngs-panel", root).forEach((p) => {
      const on = p.getAttribute("data-nonngs-panel") === tab;
      if (on) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
      p.classList.toggle("is-active", on);
    });
  }

  function renderNonNgsMonitor() {
    const samples = (state.labAlpha.samples || [])
      .filter((s) => s.status !== "已发布" && s.status !== "暂存中")
      .map((s) => ({ ...s, nonNgsMethod: nonNgsMethodForSample(s) }));
    const cards = NON_NGS_METHODS.map((method) => {
      const list = samples.filter((s) => s.nonNgsMethod === method);
      const pending = list.filter((s) => !String(s.status || "").includes("实验中")).length;
      const running = list.filter((s) => String(s.status || "").includes("实验中")).length;
      const avgTurnHours = list.length ? list.reduce((sum, s) => sum + (Number(s.stayHours) || 0), 0) / list.length : 0;
      const abnormal = list.filter((s) => !!s.isAbnormal && s.status !== "已退单").length;
      return { method, pending, running, avgTurnHours, abnormal };
    });
    const grid = $("#nonngsMonitorGrid");
    if (grid) {
      grid.innerHTML = cards
        .map(
          (x) => `
            <div class="nonngs-method">
              <div class="nonngs-method__head">
                <div class="nonngs-method__title">${x.method}</div>
                <div class="pill pill--muted">模块</div>
              </div>
              <div class="nonngs-method__grid">
                <div class="nonngs-method__kpi"><div class="nonngs-method__label">待处理样本量</div><div class="nonngs-method__value">${fmtInt(x.pending)}</div></div>
                <div class="nonngs-method__kpi"><div class="nonngs-method__label">实验中样本量</div><div class="nonngs-method__value">${fmtInt(x.running)}</div></div>
                <div class="nonngs-method__kpi"><div class="nonngs-method__label">平均流转时长</div><div class="nonngs-method__value">${fmtNum(x.avgTurnHours, 1)} h</div></div>
                <div class="nonngs-method__kpi"><div class="nonngs-method__label">异常样本数</div><div class="nonngs-method__value">${fmtInt(x.abnormal)}</div></div>
              </div>
            </div>
          `
        )
        .join("");
    }

    const abnormalBody = $("#nonngsAbnormalTable");
    if (abnormalBody) {
      const rows = samples
        .filter((s) => s.isAbnormal && s.status !== "已退单")
        .sort((a, b) => Number(b.stayHours || 0) - Number(a.stayHours || 0))
        .slice(0, 24);
      abnormalBody.innerHTML = rows
        .map(
          (s) => `
            <div class="table__row nonngs-row-abn">
              <div>WO-${String(stableHash(s.id)).slice(0, 6)}</div>
              <div>${s.barcode}</div>
              <div>${s.nonNgsMethod}</div>
              <div>${s.project}</div>
              <div>${s.status}</div>
              <div>${mapNonNgsBizStatus(s.status)}</div>
              <div>${nonNgsCurrentStep(s, s.nonNgsMethod)}</div>
              <div>${s.owner || "--"}</div>
              <div>${fmtHours(s.stayHours)}</div>
              <div>${stableHash(s.id) % 5 === 0 ? "是" : "否"}</div>
              <div>${s.isAbnormal ? "是" : "否"}</div>
              <div>${s.alertLevel || "低"}</div>
            </div>
          `
        )
        .join("");
    }
  }

  function buildNonNgsStatItems(seedBase, genVal) {
    return NON_NGS_METHODS.map((method, i) => {
      const rnd = seededRand(seedBase + i * 127);
      const n = 16 + Math.floor(rnd() * 18);
      const values = Array.from({ length: n }, () => genVal(rnd, method));
      return { label: method, values };
    });
  }

  function renderNonNgsStats() {
    if (!state.nonNgs.statsMonth) state.nonNgs.statsMonth = currentMonthYM();
    const monthInput = $("#nonngsStatsMonthInput");
    if (monthInput && monthInput.value !== state.nonNgs.statsMonth) monthInput.value = state.nonNgs.statsMonth;
    setText("nonngsStatsMeta", `按月份 ${state.nonNgs.statsMonth} 统计`);
    const seed = Number(String(state.nonNgs.statsMonth || "").replaceAll("-", "")) || 202603;
    const tatItems = buildNonNgsStatItems(seed + 101, (r) => clamp(20 + Math.abs(normalRand(r)) * 14, 4, 96));
    const volItems = buildNonNgsStatItems(seed + 202, (r) => clamp(18 + Math.abs(normalRand(r)) * 11, 3, 92));
    const cancelRateItems = buildNonNgsStatItems(seed + 303, (r) => clamp(1.2 + Math.abs(normalRand(r)) * 2.1, 0.1, 16));
    const tatCanvas = $("#nonngsCanvasTat");
    if (tatCanvas) drawCategoryBoxWithOutliers(tatCanvas, tatItems, { yFmt: (v) => `${fmtNum(v, 1)} h` });
    const volCanvas = $("#nonngsCanvasVolume");
    if (volCanvas) drawCategoryBoxWithOutliers(volCanvas, volItems, { yFmt: (v) => fmtNum(v, 0) });
    const cancelRateCanvas = $("#nonngsCanvasCancelRate");
    if (cancelRateCanvas) drawCategoryBoxWithOutliers(cancelRateCanvas, cancelRateItems, { yFmt: (v) => `${fmtNum(v, 1)}%` });

    const samples = (state.labAlpha.samples || []).map((s) => ({ ...s, nonNgsMethod: nonNgsMethodForSample(s) }));
    const canceled = samples.filter((s) => s.status === "已退单");
    const rnd = seededRand(seed + 404);
    const cancelRows =
      canceled.length > 0
        ? canceled.slice(0, 16)
        : Array.from({ length: 10 }, (_, i) => ({
            id: `CN_${9300 + i}`,
            barcode: `CN${9300 + i}`,
            nonNgsMethod: NON_NGS_METHODS[i % NON_NGS_METHODS.length],
            project: PROJECTS[i % PROJECTS.length],
            sampleType: EXT_SAMPLE_TYPES[i % EXT_SAMPLE_TYPES.length],
            status: "已退单",
          }));
    const cancelBody = $("#nonngsCancelTable");
    if (cancelBody) {
      cancelBody.innerHTML = cancelRows
        .map(
          (s) => `
            <div class="table__row nonngs-row-cancel">
              <div>WO-${String(stableHash(s.id || s.barcode)).slice(0, 6)}</div>
              <div>${s.barcode}</div>
              <div>${s.nonNgsMethod || nonNgsMethodForSample(s)}</div>
              <div>${s.project}</div>
              <div>${s.sampleType || "--"}</div>
              <div>${s.status || "已退单"}</div>
              <div>${mapNonNgsBizStatus(s.status || "已退单")}</div>
              <div>${NON_NGS_CANCEL_REASONS[Math.floor(rnd() * NON_NGS_CANCEL_REASONS.length)]}</div>
            </div>
          `
        )
        .join("");
    }
  }

  function setNonNgsTab(tab) {
    state.nonNgs.tab = tab;
    applyNonNgsTabUI(tab);
    if (tab === "monitor") renderNonNgsMonitor();
    if (tab === "stats") renderNonNgsStats();
  }

  function renderNonNgsCenter() {
    const root = $("#view-lab-non-ngs");
    if (!root || !root.classList.contains("is-active")) return;
    if (!state.labAlpha.samples.length) initLabAlphaSim();
    applyNonNgsTabUI(state.nonNgs.tab || "monitor");
    if ((state.nonNgs.tab || "monitor") === "monitor") renderNonNgsMonitor();
    else renderNonNgsStats();
  }

  function renderLabAlpha() {
    const root = $("#view-lab-ngs");
    if (!root || !root.classList.contains("is-active")) return;
    if (!state.labAlpha.samples.length) initLabAlphaSim();
    applyNgsTabUI(state.ngs.tab || "monitor");
    if ((state.ngs.tab || "monitor") === "monitor") renderNgsMonitor();
    else renderNgsStats();
  }

  function renderSampleCenter() {
    const root = $("#view-sample-center");
    if (!root) return;
    if (!state.labAlpha.samples.length) {
      initLabAlphaSim();
    }
    syncLabFilterInputsFromState();
    renderSampleCenterOverview();
    renderSampleCenterStatusTable();
    renderSampleCenterAbnormalTable();
  }

  function taskStatusText(status) {
    if (status === TASK_STATUSES.todo) return "待分配";
    if (status === TASK_STATUSES.doing) return "处理中";
    if (status === TASK_STATUSES.done) return "已完成";
    return "--";
  }

  function fmtTs(ts) {
    if (!Number.isFinite(Number(ts))) return "--";
    const d = new Date(Number(ts));
    // 只展示到分钟，避免视觉过长
    return d.toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  const TASK_DESCRIPTION_POOL = [
    "下机数据量不足，质控不合格",
    "提取浓度低",
    "阴控失控",
    "拆分无数据",
  ];

  function stableHash(str) {
    const s = String(str || "");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function taskDescriptionForSample(sample, stageKey) {
    const seedStr = sample?.id || sample?.barcode || stageKey || "";
    const idx = stableHash(seedStr) % TASK_DESCRIPTION_POOL.length;
    return TASK_DESCRIPTION_POOL[idx];
  }

  function renderAbnormalCenter() {
    const root = $("#view-abnormal-center");
    if (!root) return;

    const listRoot = $("#taskList");
    const metaRoot = $("#tasksMeta");
    if (!listRoot || !metaRoot) return;

    const filterStatus = state.tasksUI.filterStatus || "";
    const filterStageKey = state.tasksUI.filterStageKey || "";
    const filterAssigneeNeedle = (state.tasksUI.filterAssignee || "").trim().toLowerCase();

    const tasksWithSample = (state.tasks || [])
      .map((t) => {
        const sample = getLabSampleById(t.sourceSampleId);
        return { t, sample };
      })
      .filter((x) => !!x.sample);

    const filtered = tasksWithSample.filter(({ t, sample }) => {
      if (filterStatus && t.status !== filterStatus) return false;
      const stageKey = t.stageKey || stageKeyFromLabStatus(sample.status);
      if (filterStageKey && stageKey !== filterStageKey) return false;
      if (filterAssigneeNeedle) {
        const a = String(t.assignee || "").toLowerCase();
        if (!a.includes(filterAssigneeNeedle)) return false;
      }
      return true;
    });

    const todoCount = filtered.filter((x) => x.t.status === TASK_STATUSES.todo).length;
    const doingCount = filtered.filter((x) => x.t.status === TASK_STATUSES.doing).length;
    const doneCount = filtered.filter((x) => x.t.status === TASK_STATUSES.done).length;

    metaRoot.textContent = `共 ${fmtInt(filtered.length)} 条 · 待分配 ${fmtInt(todoCount)} · 处理中 ${fmtInt(doingCount)} · 已完成 ${fmtInt(doneCount)}`;

    const rows = filtered
      .slice()
      .sort((a, b) => (b.t.createdAt || 0) - (a.t.createdAt || 0))
      .map(({ t, sample }) => {
        const stageKey = t.stageKey || stageKeyFromLabStatus(sample.status);
        const priority = t.priority || sample.alertLevel || "低";
        const taskDesc = t.description || taskDescriptionForSample(sample, stageKey);
        const remaining = sample.remainingHours != null ? fmtHours(sample.remainingHours) : "--";
        return `
          <div class="table__row task-row">
            <div>${t.id}</div>
            <div>${sample.barcode}</div>
            <div>${priority}</div>
            <div>${taskDesc}</div>
            <div>${taskStatusText(t.status)}</div>
            <div>${t.assignee || sample.owner || "--"}</div>
            <div>${fmtTs(t.createdAt)}</div>
            <div>${remaining}</div>
            <div>
              <button type="button" class="btn btn--ghost task-open-btn" data-task-id="${t.id}">详情</button>
            </div>
          </div>
        `;
      })
      .join("");

    listRoot.innerHTML = rows || `<div class="muted" style="padding: 10px 0;">暂无符合条件的任务</div>`;
  }

  function renderTaskDetail(taskId) {
    const task = getTaskById(taskId);
    const body = $("#taskDetailBody");
    if (!task || !body) return;

    const sample = getLabSampleById(task.sourceSampleId);
    const actorDefault = task.assignee || sample?.owner || "系统";
    const history = (task.history || []).slice(-10).reverse();
    const comments = (task.comments || []).slice(-8).reverse();

    const actionButtons = (() => {
      // 升级版演示口径：仅保留三态闭环
      const cancelBtn = `<button type="button" class="btn btn--ghost task-cancel-order-btn" data-task-id="${task.id}">退单</button>`;
      if (task.status === TASK_STATUSES.todo) {
        return `<button type="button" class="btn task-action-btn" data-task-action="${TASK_STATUSES.doing}" data-task-id="${task.id}">开始处理</button>${cancelBtn}`;
      }
      if (task.status === TASK_STATUSES.doing) {
        return `
          <button type="button" class="btn btn--ghost task-action-btn" data-task-action="${TASK_STATUSES.doing}" data-task-kind="handoff" data-task-id="${task.id}">继续流转</button>
          <button type="button" class="btn task-action-btn" data-task-action="${TASK_STATUSES.done}" data-task-id="${task.id}">完成（解决）</button>
          ${cancelBtn}
        `;
      }
      return `<div class="pill pill--muted" style="margin-right: 8px;">当前状态：${taskStatusText(task.status)}</div>`;
    })();

    body.innerHTML = `
      <div class="grid grid--two">
        <div class="card" style="box-shadow:none; border-color: rgba(255,255,255,0.08);">
          <div class="card__head">
            <div class="card__title">任务信息</div>
          </div>
          <div class="card__body">
            <div class="qc-h">任务ID：${task.id}</div>
            <div class="qc-h">状态：${taskStatusText(task.status)}</div>
            <div class="qc-h">环节：${task.stageKey || "--"}</div>
            <div class="qc-h">优先级：${task.priority || "--"}</div>
            <div class="qc-h">当前处理人：${actorDefault}</div>
            <div class="qr-note">创建时间：${fmtTs(task.createdAt)}</div>
          </div>
        </div>
        <div class="card" style="box-shadow:none; border-color: rgba(255,255,255,0.08);">
          <div class="card__head">
            <div class="card__title">关联样本</div>
          </div>
          <div class="card__body">
            <div class="qc-h">条码：${sample?.barcode || "--"}</div>
            <div class="qc-h">检测编号：${sample?.detectNo || "--"}</div>
            <div class="qc-h">批次号：${sample?.batchNo || "--"}</div>
            <div class="qc-h">诊断：${sample?.diagnosis || "--"}</div>
            <div class="qc-h">样本状态：${sample?.status || "--"}</div>
            <div class="qc-h">告警级别：${sample?.alertLevel || "--"}</div>
            <div class="qr-note">剩余周期：${sample?.remainingHours != null ? fmtHours(sample.remainingHours) : "--"}</div>
            <div class="qr-note">备注：${sample?.remark || "--"}</div>
          </div>
        </div>
      </div>

      <div style="height: 14px;"></div>

      <div class="card" style="box-shadow:none; border-color: rgba(255,255,255,0.08);">
        <div class="card__head">
          <div class="card__title">处理操作</div>
        </div>
        <div class="card__body">
          <div class="field field--inline">
            <div class="field__label">处理人</div>
            <input class="lab-input" id="taskActorInput" value="${actorDefault}" />
          </div>
          <div class="field">
            <div class="field__label">评论（留痕）</div>
            <textarea class="lab-input" id="taskCommentText" rows="3" placeholder="输入处理意见/原因..."></textarea>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top: 10px;">
            ${actionButtons}
            <button type="button" class="btn btn--ghost task-comment-add-btn" data-task-id="${task.id}" id="taskCommentAddBtn">添加评论</button>
          </div>
        </div>
      </div>

      <div style="height: 14px;"></div>

      <div class="card" style="box-shadow:none; border-color: rgba(255,255,255,0.08);">
        <div class="card__head">
          <div class="card__title">处理留痕与评论记录（最近）</div>
        </div>
        <div class="card__body">
          <div class="qr-note">评论记录：</div>
          <div style="max-height: 180px; overflow:auto; padding-right: 8px;">
            ${
              comments.length
                ? comments
                    .map(
                      (c) => `<div style="padding: 8px 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; margin-bottom: 8px;">
                        <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom: 4px;">
                          <div><b>${c.author || "系统"}</b></div>
                          <div style="color: rgba(255,255,255,0.62); font-size: 12px;">${fmtTs(c.createdAt)}</div>
                        </div>
                        <div style="color: rgba(255,255,255,0.9);">${c.content || ""}</div>
                      </div>`
                    )
                    .join("")
                : `<div style="color: rgba(255,255,255,0.6); padding: 6px 2px;">暂无评论</div>`
            }
          </div>

          <div style="height: 12px;"></div>

          <div class="table table--wide">
            <div class="table__row table__row--head">
              <div>时间</div>
              <div>状态</div>
              <div>操作人</div>
              <div>备注</div>
            </div>
            ${(history.length
              ? history
                  .map((h) => `<div class="table__row">
                    <div>${fmtTs(h.createdAt)}</div>
                    <div>${taskStatusText(h.status)}</div>
                    <div>${h.actor || "--"}</div>
                    <div>${h.note || "--"}</div>
                  </div>`)
                  .join("")
              : `<div class="table__row"><div colspan="4" style="grid-column: span 4;">暂无历史留痕</div></div>`)}
          </div>
        </div>
      </div>
    `;
  }

  function openTaskDetailModal(taskId) {
    const modal = $("#taskDetailModal");
    if (!modal) return;
    state.tasksUI.selectedTaskId = taskId;
    renderTaskDetail(taskId);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeTaskDetailModal() {
    const modal = $("#taskDetailModal");
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
    state.tasksUI.selectedTaskId = null;
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

    if (!state.productivity.statsAbnTaskMonth && list.length) {
      state.productivity.statsAbnTaskMonth = list[list.length - 1].month;
    }
    const abnTaskMonth = state.productivity.statsAbnTaskMonth;
    const abnTaskMonthChips = $("#peStatsAbnTaskMonthChips");
    if (abnTaskMonthChips) {
      abnTaskMonthChips.innerHTML = list.map(
        ({ month }) => `
        <label class="chip ${abnTaskMonth === month ? "is-active" : ""}">
          <input type="radio" name="peStatsAbnTaskMonth" value="${month}" ${abnTaskMonth === month ? "checked" : ""}/>
          <span>${month}</span>
        </label>`
      ).join("");
    }
    const abnTaskCanvas = $("#peStatsAbnTaskCanvas");
    if (abnTaskCanvas && abnTaskMonth) {
      const monthRow = list.find((x) => x.month === abnTaskMonth);
      const byPerson = monthRow?.data?.abnormalTaskHandleHours || {};
      const items = ABNORMAL_TASK_PEOPLE.map((name) => ({
        label: name,
        values: byPerson[name] || [],
      }));
      drawCategoryBoxWithOutliers(abnTaskCanvas, items, {
        yFmt: (v) => fmtNum(v, 1),
        labelFmt: shortPersonLabelForStats,
        rotateLabels: true,
      });
    }
  }

  function buildAlerts() {
    const alerts = [];
    const abnormalByStage = getAbnormalCountByStage();
    const abnormalTotal = getAbnormalCount();
    const stageRank = ["rep", "bio", "ana", "exp"];
    stageRank.forEach((k) => {
      const s = STAGES.find((x) => x.key === k);
      const f = state.flow[k];
      const abnInStage = abnormalByStage[k] ?? 0;
      // 闭环逻辑：只有当该环节确实存在异常样本时，SLA 告警才可见。
      if (abnInStage <= 0) return;
      const lvl = riskLevel(s, f.avgMin, f.p95Min);
      if (lvl === "ok") return;
      const over = Math.max(0, Math.round(f.p95Min - s.slaMin));
      alerts.push({
        stage: s.name,
        stageKey: k,
        level: lvl,
        title: `${s.name}环节 SLA 风险`,
        sub: `P95 滞留 ${fmtMin(f.p95Min)}，异常样本 ${fmtInt(abnInStage)}，相对 SLA ${s.slaMin} 分钟${
          over ? `（超出约 ${over} 分钟）` : ""
        }`,
      });
    });

    // Add abnormal alert
    if (abnormalTotal >= 18) {
      alerts.unshift({
        stage: "质量控制",
        stageKey: "",
        level: "bad",
        title: "异常样本上升",
        sub: `当前异常样本 ${fmtInt(abnormalTotal)}，建议优先排查 Top 原因并复核关键样本。`,
      });
    } else if (abnormalTotal >= 12) {
      alerts.unshift({
        stage: "质量控制",
        stageKey: "",
        level: "warn",
        title: "异常样本偏高",
        sub: `当前异常样本 ${fmtInt(abnormalTotal)}，建议关注测序/比对指标分布与退回原因。`,
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

    // 异常数量由样本闭环状态实时决定，避免随机漂移覆盖回填结果
    state.kpi.abnormal = getAbnormalCount();

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
    setText("kpiAbnormal", fmtInt(getAbnormalCount()));

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
    // 告警必须随“样本异常闭环”实时刷新，避免随机状态漂移覆盖处理结果
    state.alerts = buildAlerts();
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
        <div class="alert" data-alert-stage-key="${a.stageKey ?? ""}">
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
      { label: "异常样本", value: fmtInt(getAbnormalCount()), hint: "需复核/退回/补充" },
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

  function rebuildQcLabMapping() {
    const map = new Map();
    const labsByProj = {};
    PROJECTS.forEach((p) => {
      labsByProj[p] = (state.labAlpha.samples || []).filter((s) => s.project === p).sort((a, b) => a.id.localeCompare(b.id));
    });
    const idx = {};
    PROJECTS.forEach((p) => {
      idx[p] = 0;
    });
    (state.qcSeq.batches || []).forEach((batch) => {
      batch.samples.forEach((qs) => {
        const p = qs.project;
        const list = labsByProj[p];
        if (!list || !list.length) return;
        const i = idx[p] % list.length;
        map.set(qs.id, list[i].id);
        idx[p] += 1;
      });
    });
    state.qcSeq.qcToLabId = map;
  }

  function getLabIdsForHeatKey(batch, heatKey) {
    if (!batch || !heatKey) return [];
    const keyOf = (i7, i5) => `${i7}__${i5}`;
    const labs = new Set();
    batch.samples.forEach((qs) => {
      if (keyOf(qs.i7, qs.i5) !== heatKey) return;
      const lid = state.qcSeq.qcToLabId.get(qs.id);
      if (lid) labs.add(lid);
    });
    return Array.from(labs);
  }

  function getLabIdsForProjectInBatch(batch, project) {
    if (!batch || !project) return [];
    const labs = new Set();
    batch.samples
      .filter((s) => s.project === project)
      .forEach((qs) => {
        const lid = state.qcSeq.qcToLabId.get(qs.id);
        if (lid) labs.add(lid);
      });
    return Array.from(labs);
  }

  function applyQcExceptionToLabs(labIds, taskTitle, detail, assigneeName) {
    if (!Array.isArray(labIds) || !labIds.length) return false;
    const note = String(detail || "").trim();
    const assignee = String(assigneeName || "").trim() || TASK_ASSIGNEE_OPTIONS[0];
    const now = Date.now();
    let touched = false;
    labIds.forEach((lid) => {
      const lab = getLabSampleById(lid);
      if (!lab) return;
      if (lab.status !== "异常处理中") {
        lab.statusBeforeException = lab.status;
      }
      lab.resumeStatusAfterException = "生信审核中";
      lab.status = "异常处理中";
      lab.isAbnormal = true;
      lab.alertLevel = "高";
      lab.remark = note || lab.remark || "质控异常待处理";
      lab.slaHours = Number.isFinite(lab.slaHours) && lab.slaHours > 0 ? lab.slaHours : 48;
      lab.remainingHours = Math.max(1, Math.min(Number(lab.remainingHours) || 4, lab.slaHours));
      lab.stayHours = Math.max(1, Math.round(lab.slaHours - lab.remainingHours));
      lab.owner = assignee;
      touched = true;
    });
    if (!touched) return false;
    applySlaAutoCapture();
    syncTasksWithAbnormalSamples();
    labIds.forEach((lid) => {
      const lab = getLabSampleById(lid);
      if (!lab) return;
      const taskId = taskIdForSample(lid);
      const task = getTaskById(taskId);
      if (!task) return;
      task.qcOrigin = true;
      task.qcBaseDescription = taskTitle;
      task.assignee = assignee;
      task.status = TASK_STATUSES.doing;
      task.completedAt = null;
      appendTaskHistory(taskId, {
        status: TASK_STATUSES.doing,
        actor: "质控中心",
        note: `创建工单：${taskTitle}；指派 ${assignee}，进入处理中${note ? `（${note}）` : ""}`,
        createdAt: now,
      });
      if (note) addTaskComment(taskId, "质控中心", note);
    });
    refreshAbnormalTaskDescriptions();
    saveTasksToStorage();
    return true;
  }

  function openQcPushExceptionModal(payload) {
    const modal = $("#qcPushExceptionModal");
    const titleEl = $("#qcPushExceptionModalTitle");
    const subEl = $("#qcPushExceptionModalSub");
    const ta = $("#qcPushExceptionText");
    const asg = $("#qcPushAssignee");
    if (!modal || !titleEl || !subEl || !ta) return;
    state.qcSeq.qcPushPending = {
      taskTitle: payload.taskTitle,
      labIds: payload.labIds || [],
      subtitle: payload.subtitle || "",
    };
    titleEl.textContent = payload.taskTitle;
    subEl.textContent = payload.subtitle || "—";
    ta.value = "";
    if (asg) {
      asg.innerHTML = TASK_ASSIGNEE_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join("");
      asg.value = TASK_ASSIGNEE_OPTIONS[0];
    }
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeQcPushExceptionModal() {
    const modal = $("#qcPushExceptionModal");
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
    state.qcSeq.qcPushPending = { taskTitle: "", labIds: [], subtitle: "" };
  }

  function confirmQcPushExceptionFromModal() {
    const ta = $("#qcPushExceptionText");
    const asg = $("#qcPushAssignee");
    const detail = ta ? String(ta.value || "").trim() : "";
    const assignee = asg ? String(asg.value || "").trim() : "";
    const { taskTitle, labIds } = state.qcSeq.qcPushPending;
    if (!taskTitle || !labIds.length) {
      closeQcPushExceptionModal();
      return;
    }
    const ok = applyQcExceptionToLabs(labIds, taskTitle, detail, assignee);
    closeQcPushExceptionModal();
    if (!ok) {
      window.alert("未能关联到实验室样本，请确认项目与映射数据。");
      return;
    }
    renderAll();
  }

  function renderQcSeq() {
    const root = $("#view-qc-center");
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
        const heatKey = keyOf(i7, i5);
        const sel = state.qcSeq.selectedHeatKey === heatKey && c.abnormal ? " hm-cell--selected" : "";
        const dataHeat = c.abnormal ? ` data-heat-key="${heatKey}"` : "";
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
          `<div class="hm-cell hm-cell--data ${bad}${sel}" style="background:${bg}"${dataHeat}>
            ${fmtNum(c.yieldGb, 1)}
            ${tip}
          </div>`
        );
      });
    });
    hm.innerHTML = parts.join("");

    hm.onclick = (e) => {
      const cell = e.target && e.target.closest ? e.target.closest(".hm-cell--data.hm-cell--bad") : null;
      if (!cell || !hm.contains(cell)) return;
      const key = cell.getAttribute("data-heat-key");
      if (!key) return;
      state.qcSeq.selectedHeatKey = key;
      renderQcSeq();
    };

    const heatSelEl = $("#qcHeatSelection");
    if (heatSelEl) {
      if (state.qcSeq.selectedHeatKey) {
        const partsK = state.qcSeq.selectedHeatKey.split("__");
        heatSelEl.textContent = `已选：${partsK[0] || ""} × ${partsK[1] || ""}（异常）`;
      } else {
        heatSelEl.textContent = "点击红色单元格选择";
      }
    }
    const btnHeat = $("#qcBtnPushHeat");
    if (btnHeat) {
      btnHeat.disabled = !state.qcSeq.selectedHeatKey;
      btnHeat.onclick = () => {
        if (!state.qcSeq.selectedHeatKey) return;
        const labIds = getLabIdsForHeatKey(batch, state.qcSeq.selectedHeatKey);
        if (!labIds.length) {
          window.alert("未关联到实验室中心样本（原型映射），请使用「重置模拟」后重试。");
          return;
        }
        const hk = state.qcSeq.selectedHeatKey.split("__");
        openQcPushExceptionModal({
          taskTitle: "数据产出量异常",
          labIds,
          subtitle: `批次 ${batch.date} · ${batch.runName} · Index ${hk[0] || ""} × ${hk[1] || ""} · 关联样本 ${labIds.length} 个`,
        });
      };
    }

    // Controls
    const controlsRoot = $("#qcControls");
    controlsRoot.innerHTML = PROJECTS.map((p) => {
      const ctrlAdded = getNgsQcControlAdded(batch.id, p);
      const ctrl = batch.controls[p];
      const pos = ctrl?.pos;
      const neg = ctrl?.neg;
      const posCls = pos?.ok ? "badge--ok" : "badge--bad";
      const negCls = neg?.ok ? "badge--ok" : "badge--bad";
      const ooc = !!(pos && !pos.ok) || !!(neg && !neg.ok);
      return `
        <div class="qc-control">
          <div>
            <div class="qc-control__proj">${p}</div>
            <div class="qc-control__meta">该批次质控品结果汇总</div>
          </div>
          <div class="qc-control__right">
            <div class="qc-pair">
              <span class="badge ${ctrlAdded.pos && pos ? posCls : "badge--muted"}">${
                ctrlAdded.pos
                  ? `阳控：${pos ? (pos.ok ? "在控" : "失控") : "—"} · ${pos ? fmtNum(pos.value, 3) : "--"}`
                  : "该批次未上阳控"
              }</span>
              <span class="badge ${ctrlAdded.neg && neg ? negCls : "badge--muted"}">${
                ctrlAdded.neg
                  ? `阴控：${neg ? (neg.ok ? "在控" : "失控") : "—"} · ${neg ? fmtNum(neg.value, 3) : "--"}`
                  : "该批次未上阴控"
              }</span>
            </div>
            ${
              ooc && ctrlAdded.pos && ctrlAdded.neg
                ? `<button type="button" class="btn btn--ghost qc-btn-push-ooc" data-qc-proj="${p}">推送异常</button>`
                : ""
            }
          </div>
        </div>
      `;
    }).join("");

    $$(".qc-btn-push-ooc", controlsRoot).forEach((btn) => {
      btn.addEventListener("click", () => {
        const proj = btn.getAttribute("data-qc-proj");
        const labIds = getLabIdsForProjectInBatch(batch, proj);
        if (!labIds.length) {
          window.alert("未关联到实验室中心样本（原型映射），请使用「重置模拟」后重试。");
          return;
        }
        openQcPushExceptionModal({
          taskTitle: "质控品失控",
          labIds,
          subtitle: `批次 ${batch.date} · 项目 ${proj} · 该批次内该项目样本 ${labIds.length} 个`,
        });
      });
    });

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

    const btnSamplePush = $("#qcBtnPushSampleDetail");
    if (btnSamplePush) {
      btnSamplePush.onclick = () => {
        const sid = state.qcSeq.selectedSampleId;
        if (!sid) return;
        const labId = state.qcSeq.qcToLabId.get(sid);
        if (!labId) {
          window.alert("未关联到实验室中心样本（原型映射），请使用「重置模拟」后重试。");
          return;
        }
        openQcPushExceptionModal({
          taskTitle: "下机质控不通过",
          labIds: [labId],
          subtitle: `批次 ${batch.date} · 测序样本 ${sid}`,
        });
      };
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
    const root = $("#view-result-center");
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

  /** items: { label, values }[] — 箱型图 + Tukey 离群值红点 */
  function drawCategoryBoxWithOutliers(canvas, items, opts) {
    opts = opts || {};
    const yFmt = opts.yFmt || ((v) => fmtNum(v, 0));
    const labelFmt = opts.labelFmt || ((l) => String(l));
    const rotateLabels = !!opts.rotateLabels;
    const padB = typeof opts.padB === "number" ? opts.padB : rotateLabels ? 56 : 32;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const padL = 44;
    const padR = 12;
    const padT = 18;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    if (!items || !items.length) return;

    const allVals = items.flatMap((m) => m.values || []);
    const globalMin = allVals.length ? Math.min(...allVals, 0) : 0;
    const globalMax = allVals.length ? Math.max(...allVals, 1) : 1;
    const scale = { min: globalMin, max: globalMax, digits: 0 };
    const yOf = (v) => {
      if (scale.max === scale.min) return padT + innerH / 2;
      return padT + (scale.max - v) * (innerH / (scale.max - scale.min));
    };
    const n = items.length;
    const slotW = innerW / n;
    const boxW = Math.min(n > 12 ? 20 : 28, slotW * (n > 12 ? 0.62 : 0.7));
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

    items.forEach((m, i) => {
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
    ctx.font = rotateLabels ? "9px Inter, system-ui, -apple-system" : "10px Inter, system-ui, -apple-system";
    ctx.textBaseline = "top";
    items.forEach((m, i) => {
      const label = labelFmt(m.label);
      const cx = cxOf(i);
      if (rotateLabels) {
        ctx.save();
        ctx.translate(cx, h - padB + 6);
        ctx.rotate(-Math.PI / 3.2);
        ctx.textAlign = "right";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      } else {
        ctx.textAlign = "center";
        ctx.fillText(label, cx, h - padB + 6);
      }
    });
  }

  function drawMonthlyBoxWithOutliers(canvas, monthlyData, opts) {
    const items = (monthlyData || []).map((m) => ({
      label: m.month.slice(2),
      values: m.values,
    }));
    drawCategoryBoxWithOutliers(canvas, items, opts);
  }

  function shortPersonLabelForStats(name) {
    const m = String(name).match(/(?:生信|报告|分析)-(.+)/);
    if (m) return m[1];
    return name;
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
    const root = $("#view-tool-service");
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
    syncAbnormalTasksPipeline();
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
    renderLabAlpha();
    renderExtractionCenter();
    renderNonNgsCenter();
    renderSampleCenter();
    renderAbnormalCenter();
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

  const LAB_SUB_ROUTES = new Set(["lab-extraction", "lab-ngs", "lab-non-ngs"]);

  function setLabNavOpen(open) {
    const grp = $("#navLabGroup");
    const btn = $("#navLabToggle");
    const sub = $("#navLabSub");
    if (!grp || !btn || !sub) return;
    grp.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) sub.removeAttribute("hidden");
    else sub.setAttribute("hidden", "");
  }

  function syncLabNavFromRoute(view) {
    if (LAB_SUB_ROUTES.has(view)) setLabNavOpen(true);
  }

  function applyRoute() {
    let hash = location.hash || "#/home";
    if (hash === "#/module/lab-center") {
      location.hash = "#/module/lab-ngs";
      return;
    }
    const route = hash.replace("#/", "").split("/").filter(Boolean);
    const view = route[0] === "module" ? route[1] : "home";

    // Activate nav（含子链接；父级按钮无 data-route，由下方单独处理）
    $$(".nav__item").forEach((a) => {
      const r = a.getAttribute("data-route");
      if (r == null) return;
      a.classList.toggle("is-active", r === view);
    });
    const navLabParent = $("#navLabToggle");
    if (navLabParent) navLabParent.classList.toggle("is-active", LAB_SUB_ROUTES.has(view));
    syncLabNavFromRoute(view);

    // Activate view
    $$(".view").forEach((v) => v.classList.remove("is-active"));
    const el = $(`#view-${view}`);
    if (el) el.classList.add("is-active");

    // Titles
    const titleMap = {
      home: ["实验室总览", "样本总览与流程滞留实时监控"],
      "sample-center": ["样本中心", "统一主状态口径 · 概览与查询"],
      "lab-extraction": ["提取中心", "实验室中心 · 提取等环节"],
      "lab-ngs": ["二代实验室", "监控台与数据统计（批次、项目、Pool、Run）"],
      "lab-non-ngs": ["非二代实验室", "监控台与数据统计（按方法学）"],
      "qc-center": ["质控中心", "测序下机批次质控与异常定位"],
      "result-center": ["结果中心", "规则命中、审核与复测闭环"],
      "abnormal-center": ["异常中心", "告警落到任务、任务闭环处理"],
      analysis: ["管理分析", "TAT 流转时间、人员效能、异常统计"],
      "tool-service": ["工具服务", "模板化出图、任务队列与交付管理"],
    };
    const [t, s] = titleMap[view] ?? ["智慧化实验室管理系统", "原型页面"];
    setText("pageTitle", t);
    setText("pageSub", s);

    if (view === "result-center") renderQcResult();
    if (view === "abnormal-center") renderAbnormalCenter();
    if (view === "sample-center") renderSampleCenter();
    if (view === "lab-ngs") renderLabAlpha();
    if (view === "lab-extraction") renderExtractionCenter();
    if (view === "lab-non-ngs") renderNonNgsCenter();
  }

  function wireEvents() {
    window.addEventListener("hashchange", applyRoute);
    const navLabToggle = $("#navLabToggle");
    if (navLabToggle) {
      navLabToggle.addEventListener("click", () => {
        const sub = $("#navLabSub");
        if (!sub) return;
        const opened = !sub.hasAttribute("hidden");
        setLabNavOpen(!opened);
      });
    }
    $("#btnPause").addEventListener("click", () => setPaused(!state.paused));
    $("#btnReset").addEventListener("click", () => {
      initSim();
      initQcSeqSim();
      initQcResultSim();
      initProductivitySim();
      initLabAlphaSim();
      state.ngs.qcControlAddedByBatch = {};
      state.ngs.activePoolBatchId = "";
      state.ngs.activePoolId = "";
      state.ngs.activePoolProject = "";
      state.nonNgs.statsMonth = "";
      rebuildQcLabMapping();
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
          state.qcSeq.selectedHeatKey = null;
          renderQcSeq();
        }
      }

      if (t.matches("#qcBatchSelect")) {
        const val = t.value;
        state.qcSeq.selectedBatchId = val;
        const b = getSelectedBatch();
        state.qcSeq.selectedSampleId = b?.samples?.[0]?.id ?? null;
        state.qcSeq.selectedHeatKey = null;
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
      if (t.matches("#scFilterBarcode")) {
        state.labAlpha.filters.barcode = t.value || "";
        state.sampleCenter.page = 1;
        renderSampleCenter();
      }
      if (t.matches("#scFilterDetectNo")) {
        state.labAlpha.filters.detectNo = t.value || "";
        state.sampleCenter.page = 1;
        renderSampleCenter();
      }
      if (t.matches("#scFilterBatchNo")) {
        state.labAlpha.filters.batchNo = t.value || "";
        state.sampleCenter.page = 1;
        renderSampleCenter();
      }
      if (t.matches("#scFilterDueDate")) {
        state.labAlpha.filters.dueDateLte = t.value || "";
        state.sampleCenter.page = 1;
        renderSampleCenter();
      }

      if (t.matches("#taskFilterStatus")) {
        state.tasksUI.filterStatus = t.value || "";
        renderAbnormalCenter();
      }
      if (t.matches("#taskFilterStageKey")) {
        state.tasksUI.filterStageKey = t.value || "";
        renderAbnormalCenter();
      }
      if (t.matches("#taskFilterAssignee")) {
        state.tasksUI.filterAssignee = t.value || "";
        renderAbnormalCenter();
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
      if (t.matches('input[name="peStatsAbnTaskMonth"]')) {
        state.productivity.statsAbnTaskMonth = t.getAttribute("value");
        renderProductivity();
      }

      if (t.matches('input[name="extStatsScope"]')) {
        state.extraction.statsScope = t.value;
        const dayField = $("#extStatsDayField");
        const monthField = $("#extStatsMonthField");
        if (dayField) dayField.style.display = t.value === "day" ? "" : "none";
        if (monthField) monthField.style.display = t.value === "month" ? "" : "none";
        renderExtractionCenter();
      }
      if (t.matches("#extMonitorDate")) {
        state.extraction.monitorDate = t.value;
        renderExtractionCenter();
      }
      if (t.matches("#extStatsDay")) {
        state.extraction.statsDay = t.value;
        renderExtractionCenter();
      }
      if (t.matches("#extStatsMonth")) {
        state.extraction.statsMonth = t.value;
        renderExtractionCenter();
      }

      if (t.matches('input[name="ngsBatch"]')) {
        const b = t.getAttribute("value") || "";
        if (!b) return;
        state.ngs.selectedBatchId = b;
        renderLabAlpha();
      }
      if (t.matches('input[name="ngsProject"]')) {
        const p = t.getAttribute("value") || "";
        if (!p) return;
        if (t.checked) state.ngs.selectedProjects.add(p);
        else state.ngs.selectedProjects.delete(p);
        if (state.ngs.selectedProjects.size === 0) state.ngs.selectedProjects.add(p);
        renderLabAlpha();
      }
      if (t.matches('input[name="ngsStatsScope"]')) {
        state.ngs.statsScope = t.getAttribute("value") || "batch";
        renderLabAlpha();
      }
      if (t.matches("#ngsStatsBatchSelect")) {
        state.ngs.statsBatchNo = t.value || "";
        renderLabAlpha();
      }
      if (t.matches("#ngsStatsMonthInput")) {
        state.ngs.statsMonth = t.value || currentMonthYM();
        renderLabAlpha();
      }
      if (t.matches("#nonngsStatsMonthInput")) {
        state.nonNgs.statsMonth = t.value || currentMonthYM();
        renderNonNgsCenter();
      }
    });

    const taskFilterAssigneeInput = $("#taskFilterAssignee");
    if (taskFilterAssigneeInput) {
      taskFilterAssigneeInput.addEventListener("input", () => {
        state.tasksUI.filterAssignee = taskFilterAssigneeInput.value || "";
        renderAbnormalCenter();
      });
    }

    const scPrevPage = $("#scPrevPage");
    if (scPrevPage) {
      scPrevPage.addEventListener("click", () => {
        state.sampleCenter.page = Math.max(1, (state.sampleCenter.page || 1) - 1);
        renderSampleCenter();
      });
    }
    const scNextPage = $("#scNextPage");
    if (scNextPage) {
      scNextPage.addEventListener("click", () => {
        state.sampleCenter.page = (state.sampleCenter.page || 1) + 1;
        renderSampleCenter();
      });
    }

    // 水平滚动条与表格联动
    const scStatusWrap = $("#scStatusTableWrap");
    const scStatusScrollbar = $("#scStatusScrollbar");
    if (scStatusWrap && scStatusScrollbar) {
      scStatusScrollbar.addEventListener("scroll", () => {
        scStatusWrap.scrollLeft = scStatusScrollbar.scrollLeft;
      });
      scStatusWrap.addEventListener("scroll", () => {
        scStatusScrollbar.scrollLeft = scStatusWrap.scrollLeft;
      });
    }

    document.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const qcBackdrop = target.closest("#qcBoxModal .qc-box-modal__backdrop");
      if (target.closest("#qcBoxModalClose") || qcBackdrop) {
        closeBoxModal();
        return;
      }
      const qrBackdrop = target.closest("#qrSpecialChartModal .qc-box-modal__backdrop");
      if (target.closest("#qrSpecialChartModalClose") || qrBackdrop) {
        closeSpecialChartModal();
        return;
      }
      const taskBackdrop = target.closest("#taskDetailModal .qc-box-modal__backdrop");
      if (target.closest("#taskDetailModalClose") || taskBackdrop) {
        closeTaskDetailModal();
        return;
      }

      const extHbBackdrop = target.closest("#extHandoverModal .qc-box-modal__backdrop");
      if (target.closest("#extHandoverModalClose") || extHbBackdrop) {
        closeExtHandoverModal();
        return;
      }
      const ngsPoolBackdrop = target.closest("#ngsPoolModal .qc-box-modal__backdrop");
      if (target.closest("#ngsPoolModalClose") || ngsPoolBackdrop) {
        closeNgsPoolModal();
        return;
      }

      const extTabBtn = target.closest("[data-ext-tab]");
      if (extTabBtn && $("#view-lab-extraction")?.contains(extTabBtn)) {
        const tab = extTabBtn.getAttribute("data-ext-tab");
        if (tab) setExtractionTab(tab);
        return;
      }
      const ngsTabBtn = target.closest("[data-ngs-tab]");
      if (ngsTabBtn && $("#view-lab-ngs")?.contains(ngsTabBtn)) {
        const tab = ngsTabBtn.getAttribute("data-ngs-tab");
        if (tab) setNgsTab(tab);
        return;
      }
      const nonNgsTabBtn = target.closest("[data-nonngs-tab]");
      if (nonNgsTabBtn && $("#view-lab-non-ngs")?.contains(nonNgsTabBtn)) {
        const tab = nonNgsTabBtn.getAttribute("data-nonngs-tab");
        if (tab) setNonNgsTab(tab);
        return;
      }
      const ngsPoolBtn = target.closest("[data-ngs-pool][data-ngs-proj]");
      if (ngsPoolBtn && $("#view-lab-ngs")?.contains(ngsPoolBtn)) {
        const pid = ngsPoolBtn.getAttribute("data-ngs-pool");
        const proj = ngsPoolBtn.getAttribute("data-ngs-proj");
        if (pid && proj) openNgsPoolModal(pid, proj);
        return;
      }

      const hbTile = target.closest("[data-ext-handover]");
      if (hbTile && $("#view-lab-extraction")?.contains(hbTile)) {
        const k = hbTile.getAttribute("data-ext-handover");
        if (k) openExtHandoverModal(k);
        return;
      }

      const taskOpenBtn = target.closest(".task-open-btn[data-task-id]");
      if (taskOpenBtn) {
        openTaskDetailModal(taskOpenBtn.getAttribute("data-task-id"));
        return;
      }

      const taskActionBtn = target.closest(".task-action-btn[data-task-id][data-task-action]");
      if (taskActionBtn) {
        const taskId = taskActionBtn.getAttribute("data-task-id");
        const action = taskActionBtn.getAttribute("data-task-action");
        const taskKind = taskActionBtn.getAttribute("data-task-kind") || "";
        const actor = $("#taskActorInput")?.value || "系统";
        const comment = $("#taskCommentText")?.value || "";
        const note =
          taskKind === "handoff"
            ? "继续流转（分配下一人）"
            : action === TASK_STATUSES.doing
              ? "开始处理"
            : action === TASK_STATUSES.done
              ? "完成（解决）"
              : action === TASK_STATUSES.rework
                ? "返工"
                : action === TASK_STATUSES.rejected
                  ? "拒绝（退回）"
                  : "任务状态更新";

        applyTaskAction(taskId, action, { actor, note, comment });
        if (taskKind === "handoff") {
          // 继续流转：不关闭弹窗，便于连续分配下一个人
          renderTaskDetail(taskId);
          return;
        }
        closeTaskDetailModal();
        return;
      }

      const taskCommentBtn = target.closest(".task-comment-add-btn[data-task-id]");
      if (taskCommentBtn) {
        const taskId = taskCommentBtn.getAttribute("data-task-id");
        const actor = $("#taskActorInput")?.value || "系统";
        const comment = $("#taskCommentText")?.value || "";
        addTaskComment(taskId, actor, comment);
        renderTaskDetail(taskId);
        return;
      }

      const taskCancelBtn = target.closest(".task-cancel-order-btn[data-task-id]");
      if (taskCancelBtn) {
        const taskId = taskCancelBtn.getAttribute("data-task-id");
        if (taskId && confirm("确认退单？样本将直接归档为「已退单」，工单关闭。")) {
          terminateTaskAsCancelled(taskId);
          closeTaskDetailModal();
        }
        return;
      }

      const alertItem = target.closest(".alert[data-alert-stage-key]");
      if (alertItem) {
        const stageKey = alertItem.getAttribute("data-alert-stage-key") || "";
        state.tasksUI.filterStageKey = stageKey;
        state.tasksUI.filterStatus = "";
        state.tasksUI.filterAssignee = "";
        location.hash = "#/module/abnormal-center";
        renderAbnormalCenter();
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

    const ngsBtnAddPosCtrl = $("#ngsBtnAddPosCtrl");
    if (ngsBtnAddPosCtrl) {
      ngsBtnAddPosCtrl.addEventListener("click", () => {
        const batchId = state.ngs.activePoolBatchId || state.ngs.selectedBatchId;
        const project = state.ngs.activePoolProject || "";
        if (!batchId) return;
        setNgsQcControlAdded(batchId, project, "pos");
        renderQcSeq();
        openNgsPoolModal(state.ngs.activePoolId, project);
      });
    }
    const ngsBtnAddNegCtrl = $("#ngsBtnAddNegCtrl");
    if (ngsBtnAddNegCtrl) {
      ngsBtnAddNegCtrl.addEventListener("click", () => {
        const batchId = state.ngs.activePoolBatchId || state.ngs.selectedBatchId;
        const project = state.ngs.activePoolProject || "";
        if (!batchId) return;
        setNgsQcControlAdded(batchId, project, "neg");
        renderQcSeq();
        openNgsPoolModal(state.ngs.activePoolId, project);
      });
    }

    const qcPushModal = $("#qcPushExceptionModal");
    if (qcPushModal) {
      const backdrop = qcPushModal.querySelector(".qc-box-modal__backdrop");
      if (backdrop) backdrop.addEventListener("click", closeQcPushExceptionModal);
    }
    const qcPushClose = $("#qcPushExceptionModalClose");
    if (qcPushClose) qcPushClose.addEventListener("click", closeQcPushExceptionModal);
    const qcPushCancel = $("#qcPushExceptionCancel");
    if (qcPushCancel) qcPushCancel.addEventListener("click", closeQcPushExceptionModal);
    const qcPushConfirm = $("#qcPushExceptionConfirm");
    if (qcPushConfirm) qcPushConfirm.addEventListener("click", confirmQcPushExceptionFromModal);
  }

  function main() {
    initSim();
    initQcSeqSim();
    initQcResultSim();
    initProductivitySim();
    initLabAlphaSim();
    rebuildQcLabMapping();
    state.tasks = loadTasksFromStorage();
    syncAbnormalTasksPipeline();
    // 演示口径：将所有任务重置为“待分配”
    resetAllTasksToTodo();
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

