/* ─── KitOps MLOps Suite Demo App Logic ─── */

/* ══ Navbar Scroll Effect ══ */
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

/* ══ Smooth Entry Animations ══ */
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -60px 0px',
};
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

document.querySelectorAll('.step-card, .tool-card, .guide-card').forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease, border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease';
  observer.observe(el);
});

/* ══ Mini Pipeline Hover Effect ══ */
document.querySelectorAll('.mini-node').forEach((node) => {
  node.addEventListener('mouseenter', () => {
    node.style.borderColor = '#6366f1';
  });
  node.addEventListener('mouseleave', () => {
    node.style.borderColor = '';
  });
});

/* ══ Demo Terminal Pipeline ══ */

const PIPELINE_STEPS = [
  {
    id: 1,
    name: '🧠 Training Model',
    done: '✅ Training complete',
    statusText: 'Running',
    doneText: 'Complete',
    lines: [
      { type: 'section', text: '═══ Phase 1: Model Training ═══' },
      { type: 'cmd', text: 'python scripts/train_fraud_model.py' },
      { type: 'output', text: '📊 Generating fraud detection dataset...' },
      { type: 'output', text: '   Rows: 10,000  |  Fraud cases: 198 (1.98%)' },
      { type: 'dim',    text: '' },
      { type: 'output', text: '🤖 Training XGBoost classifier...' },
      { type: 'output', text: '   n_estimators=100, max_depth=6' },
      { type: 'dim',    text: '' },
      { type: 'output', text: '📈 Model Performance:' },
      { type: 'output', text: '   Accuracy : 0.9835' },
      { type: 'output', text: '   F1 Score : 0.7143' },
      { type: 'dim',    text: '' },
      { type: 'output', text: '💾 Model saved → model/fraud_xgb.json' },
      { type: 'success', text: '✅ Training complete!' },
    ],
    delay: 80,
    metaUpdate: {
      name: 'fraud-detection-model',
      framework: 'xgboost',
      accuracy: '0.9835',
      f1: '0.7143',
    },
  },
  {
    id: 2,
    name: '📦 Packaging ModelKit',
    done: '✅ ModelKit pushed',
    statusText: 'Building',
    doneText: 'Pushed',
    lines: [
      { type: 'section', text: '═══ Phase 2: KitOps Packaging ═══' },
      { type: 'cmd', text: 'kit build . -t ghcr.io/myorg/fraud:v1.0.0 -f kitfiles/fraud-detection.kitfile.yaml' },
      { type: 'output', text: '[+] Building ModelKit...' },
      { type: 'output', text: '[+] Adding model layer      → ./model/' },
      { type: 'output', text: '[+] Adding dataset layer    → ./data/train.csv' },
      { type: 'output', text: '[+] Adding code layer       → ./scripts/' },
      { type: 'output', text: '[+] Writing manifest...' },
      { type: 'success', text: 'Successfully built ghcr.io/myorg/fraud:v1.0.0' },
      { type: 'dim',    text: '' },
      { type: 'cmd',   text: 'kit push ghcr.io/myorg/fraud:v1.0.0' },
      { type: 'output', text: 'Pushing layer: model        ████████████████ 100%' },
      { type: 'output', text: 'Pushing layer: dataset      ████████████████ 100%' },
      { type: 'output', text: 'Pushing layer: code         ████████████████ 100%' },
      { type: 'output', text: 'Digest: sha256:7a8b9c0d...' },
      { type: 'success', text: '✅ ModelKit pushed: ghcr.io/myorg/fraud:v1.0.0' },
    ],
    delay: 90,
    metaUpdate: {
      version: 'v1.0.0',
      uri: 'oci://ghcr.io/myorg/fraud:v1.0.0',
      registry: 'ghcr.io/myorg',
    },
  },
  {
    id: 3,
    name: '📋 Registering in Kubeflow',
    done: '✅ Registered (LIVE)',
    statusText: 'Registering',
    doneText: 'Registered',
    lines: [
      { type: 'section', text: '═══ Phase 3: Kubeflow Model Registry ═══' },
      { type: 'cmd',    text: 'python scripts/register_model.py --model-name fraud-detection --version 1.0.0 ...' },
      { type: 'output', text: '🔗 Connecting to Kubeflow Model Registry at http://localhost:8080...' },
      { type: 'output', text: '📦 Registering model: fraud-detection v1.0.0' },
      { type: 'output', text: '   URI: oci://ghcr.io/myorg/fraud:v1.0.0' },
      { type: 'output', text: '   Framework: xgboost | Accuracy: 0.9835' },
      { type: 'dim',    text: '' },
      { type: 'output', text: '✅ Registration successful!' },
      { type: 'output', text: '   RegisteredModel ID : 1' },
      { type: 'output', text: '   ModelVersion ID   : 1' },
      { type: 'output', text: '   State              : LIVE' },
      { type: 'success', text: '✅ Model tracked in Kubeflow Model Registry' },
    ],
    delay: 100,
    metaUpdate: {
      state: 'LIVE',
    },
  },
  {
    id: 4,
    name: '⚙️ Running Argo Workflow',
    done: '✅ Workflow succeeded',
    statusText: 'Orchestrating',
    doneText: 'Succeeded',
    lines: [
      { type: 'section', text: '═══ Phase 4: Argo Workflows ═══' },
      { type: 'cmd',    text: 'argo submit workflows/ml-training-pipeline.yaml --namespace argo --watch' },
      { type: 'dim',    text: '' },
      { type: 'output', text: 'Name:                ml-training-pipeline-x8k9p' },
      { type: 'output', text: 'Namespace:           argo' },
      { type: 'output', text: 'Status:              Running' },
      { type: 'dim',    text: '' },
      { type: 'output', text: 'STEP             PODNAME              STATUS' },
      { type: 'output', text: '✔ preprocess    pipeline-x8k9p-aaa   Succeeded   12s' },
      { type: 'output', text: '✔ train         pipeline-x8k9p-bbb   Succeeded   47s' },
      { type: 'output', text: '✔ evaluate      pipeline-x8k9p-ccc   Succeeded   3s' },
      { type: 'output', text: '✔ package       pipeline-x8k9p-ddd   Succeeded   21s' },
      { type: 'output', text: '✔ register      pipeline-x8k9p-eee   Succeeded   4s' },
      { type: 'dim',    text: '' },
      { type: 'success', text: '✅ Workflow ml-training-pipeline-x8k9p Succeeded!' },
    ],
    delay: 95,
    metaUpdate: {},
  },
  {
    id: 5,
    name: '🛡️ Kyverno Policy Check',
    done: '✅ Governance enforced',
    statusText: 'Validating',
    doneText: 'Enforced',
    lines: [
      { type: 'section', text: '═══ Phase 5: Kyverno Policy Enforcement ═══' },
      { type: 'cmd',    text: 'kubectl apply -f policies/' },
      { type: 'output', text: 'clusterPolicy.kyverno.io/restrict-model-registry created' },
      { type: 'output', text: 'clusterPolicy.kyverno.io/require-model-labels created' },
      { type: 'output', text: 'clusterPolicy.kyverno.io/disallow-latest-model-tag created' },
      { type: 'output', text: 'clusterPolicy.kyverno.io/inject-model-metadata created' },
      { type: 'dim',    text: '' },
      { type: 'cmd',    text: 'kubectl run model-server --image=ghcr.io/myorg/fraud:v1.0.0 --labels "model-name=fraud-detection,model-version=1.0.0,team=ml-eng" -n ml-production --dry-run=server' },
      { type: 'success', text: 'pod/model-server created (server dry run) ✅' },
      { type: 'dim',    text: '' },
      { type: 'output', text: '🛡️  Policy summary:' },
      { type: 'output', text: '   restrict-model-registry  → PASSED (approved source)' },
      { type: 'output', text: '   require-model-labels     → PASSED (all labels present)' },
      { type: 'output', text: '   disallow-latest-tag      → PASSED (versioned tag used)' },
      { type: 'output', text: '   inject-model-metadata    → APPLIED (annotations added)' },
      { type: 'dim',    text: '' },
      { type: 'success', text: '🎉 ML Artifact Lifecycle complete!' },
    ],
    delay: 110,
    metaUpdate: {},
  },
];

let pipelineRunning = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addTerminalLine(type, text) {
  const body = document.getElementById('terminal-body');
  const line = document.createElement('div');
  line.className = 'terminal-line';

  const typeToClass = {
    cmd:     ['term-prompt', '$', 'term-cmd'],
    output:  [null, null, 'term-output'],
    success: [null, null, 'term-success'],
    error:   [null, null, 'term-error'],
    warning: [null, null, 'term-warning'],
    dim:     [null, null, 'term-dim'],
    section: [null, null, 'term-section'],
  };

  const config = typeToClass[type] || typeToClass.output;

  if (config[0]) {
    const prompt = document.createElement('span');
    prompt.className = config[0];
    prompt.textContent = config[1];
    line.appendChild(prompt);
  }

  const content = document.createElement('span');
  content.className = config[2];
  content.textContent = text;
  line.appendChild(content);

  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

function setStepStatus(stepId, status, text) {
  const statusEl = document.getElementById(`sstatus-${stepId}`);
  const indicatorEl = document.getElementById(`ssindicator-${stepId}`);

  if (statusEl) {
    statusEl.className = `sstep-status status-${status}`;
    statusEl.textContent = text;
  }

  if (indicatorEl) {
    if (status === 'running') {
      indicatorEl.textContent = '◌';
      indicatorEl.className = 'sstep-indicator running';
    } else if (status === 'done') {
      indicatorEl.textContent = '✓';
      indicatorEl.className = 'sstep-indicator done';
      // Animate connector below
      const connectors = document.querySelectorAll('.status-step-connector');
      if (connectors[stepId - 1]) {
        connectors[stepId - 1].classList.add('active');
      }
    } else {
      indicatorEl.textContent = '○';
      indicatorEl.className = 'sstep-indicator';
    }
  }
}

function updateMetaCard(updates) {
  const fields = {
    name: 'meta-name',
    version: 'meta-version',
    framework: 'meta-framework',
    accuracy: 'meta-accuracy',
    f1: 'meta-f1',
    state: 'meta-state',
    uri: 'meta-uri',
    registry: 'meta-registry',
  };

  for (const [key, value] of Object.entries(updates)) {
    const el = document.getElementById(fields[key]);
    if (el) {
      el.textContent = value;
      el.style.animation = 'none';
      el.offsetHeight; // force reflow
      el.style.animation = 'fadeInLeft 0.3s ease';
      el.style.color = '#7dd3fc';
      setTimeout(() => { el.style.color = ''; }, 600);
    }
  }
}

async function runPipeline() {
  if (pipelineRunning) return;
  pipelineRunning = true;

  const runBtn = document.getElementById('run-pipeline-btn');
  const runBtnText = document.getElementById('run-btn-text');
  const resetBtn = document.getElementById('reset-btn');
  const terminalStatus = document.getElementById('terminal-status');

  runBtn.disabled = true;
  runBtnText.textContent = '⏳ Running...';
  terminalStatus.textContent = 'Running';
  terminalStatus.className = 'terminal-badge running';

  // Clear and restart terminal
  const body = document.getElementById('terminal-body');
  body.innerHTML = '';

  addTerminalLine('dim', '');
  addTerminalLine('section', '╔══════════════════════════════════════════════╗');
  addTerminalLine('section', '║   KitOps MLOps Integration — Pipeline Run    ║');
  addTerminalLine('section', '╚══════════════════════════════════════════════╝');
  addTerminalLine('dim', '');

  await sleep(400);

  for (const step of PIPELINE_STEPS) {
    addTerminalLine('dim', '');
    setStepStatus(step.id, 'running', step.statusText);

    for (const line of step.lines) {
      addTerminalLine(line.type, line.text);
      await sleep(step.delay + Math.random() * 40);
    }

    await sleep(300);
    setStepStatus(step.id, 'done', step.doneText);
    updateMetaCard(step.metaUpdate);
    await sleep(200);
  }

  await sleep(400);
  addTerminalLine('dim', '');
  addTerminalLine('success', '🎉 End-to-End Pipeline Complete!');
  addTerminalLine('output', '   KitOps + Kubeflow + Argo + Kyverno');
  addTerminalLine('output', '   All stages executed successfully.');
  addTerminalLine('dim', '');

  terminalStatus.textContent = 'Done ✓';
  terminalStatus.className = 'terminal-badge done';

  runBtn.style.display = 'none';
  resetBtn.style.display = 'block';
  pipelineRunning = false;
}

function resetDemo() {
  const runBtn = document.getElementById('run-pipeline-btn');
  const runBtnText = document.getElementById('run-btn-text');
  const resetBtn = document.getElementById('reset-btn');
  const terminalStatus = document.getElementById('terminal-status');
  const body = document.getElementById('terminal-body');

  // Reset terminal
  body.innerHTML = `
    <div class="terminal-line terminal-welcome">
      <span class="term-prompt">$</span>
      <span class="term-cmd"> # KitOps MLOps Integration Suite — Interactive Demo</span>
    </div>
    <div class="terminal-line">
      <span class="term-prompt">$</span>
      <span class="term-cmd"> # Click "Run Pipeline" to begin...</span>
    </div>
  `;

  // Reset status steps
  for (let i = 1; i <= 5; i++) {
    setStepStatus(i, 'idle', 'Waiting');
  }
  document.querySelectorAll('.status-step-connector').forEach((c) => {
    c.classList.remove('active');
  });

  // Reset meta card
  const metaIds = ['meta-name','meta-version','meta-framework','meta-accuracy','meta-f1','meta-state','meta-uri','meta-registry'];
  metaIds.forEach((id) => {
    document.getElementById(id).textContent = '—';
    document.getElementById(id).style.color = '';
  });

  // Reset buttons
  runBtn.style.display = '';
  runBtn.disabled = false;
  runBtnText.textContent = '▶ Run Pipeline';
  resetBtn.style.display = 'none';
  terminalStatus.textContent = 'Idle';
  terminalStatus.className = 'terminal-badge';

  pipelineRunning = false;
}

/* ══ Policy Demo ══ */

const POLICY_RESULTS = {
  approved: {
    badge: 'ALLOWED',
    badgeClass: 'allowed',
    lines: [
      { cls: 'policy-comment', text: '# kubectl dry-run with approved image + labels' },
      { cls: 'policy-line',    text: '' },
      { cls: 'policy-key',    text: 'Request:' },
      { cls: 'policy-line',   text: '  image: ghcr.io/myorg/fraud-detection:v1.0.0' },
      { cls: 'policy-line',   text: '  labels:' },
      { cls: 'policy-line',   text: '    model-name: fraud-detection' },
      { cls: 'policy-line',   text: '    model-version: "1.0.0"' },
      { cls: 'policy-line',   text: '    team: ml-engineering' },
      { cls: 'policy-line',   text: '  namespace: ml-production' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-key',    text: 'Kyverno Evaluation:' },
      { cls: 'policy-success', text: '  ✓ restrict-model-registry   PASS' },
      { cls: 'policy-success', text: '  ✓ require-model-labels      PASS' },
      { cls: 'policy-success', text: '  ✓ disallow-latest-tag       PASS' },
      { cls: 'policy-success', text: '  ✓ inject-model-metadata     MUTATED' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-success', text: 'Result: pod/model-server created (server dry run)' },
    ],
  },
  'wrong-registry': {
    badge: 'DENIED',
    badgeClass: 'denied',
    lines: [
      { cls: 'policy-comment', text: '# kubectl dry-run with unauthorized registry' },
      { cls: 'policy-line',    text: '' },
      { cls: 'policy-key',    text: 'Request:' },
      { cls: 'policy-line',   text: '  image: docker.io/random/model:latest' },
      { cls: 'policy-line',   text: '  namespace: ml-production' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-key',    text: 'Kyverno Evaluation:' },
      { cls: 'policy-error',  text: '  ✗ restrict-model-registry   FAIL' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-key',    text: 'Admission Webhook Response:' },
      { cls: 'policy-error',  text: 'Error from server: admission webhook' },
      { cls: 'policy-error',  text: '"validate.kyverno.svc" denied the request:' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-error',  text: '❌ Policy violation: Model images must come' },
      { cls: 'policy-error',  text: '   from approved registries.' },
      { cls: 'policy-error',  text: '   Allowed: ghcr.io/myorg/*' },
      { cls: 'policy-error',  text: '   Got: docker.io/random/model:latest' },
    ],
  },
  'missing-labels': {
    badge: 'DENIED',
    badgeClass: 'denied',
    lines: [
      { cls: 'policy-comment', text: '# kubectl dry-run with missing required labels' },
      { cls: 'policy-line',    text: '' },
      { cls: 'policy-key',    text: 'Request:' },
      { cls: 'policy-line',   text: '  image: ghcr.io/myorg/fraud-detection:v1.0.0' },
      { cls: 'policy-line',   text: '  labels: {}  # no labels' },
      { cls: 'policy-line',   text: '  namespace: ml-production' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-key',    text: 'Kyverno Evaluation:' },
      { cls: 'policy-success', text: '  ✓ restrict-model-registry   PASS' },
      { cls: 'policy-error',  text: '  ✗ require-model-labels      FAIL' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-key',    text: 'Admission Webhook Response:' },
      { cls: 'policy-error',  text: 'Error from server: admission webhook denied:' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-error',  text: '❌ ModelKit pods must have required labels:' },
      { cls: 'policy-error',  text: "   'model-name', 'model-version', 'team'" },
      { cls: 'policy-error',  text: '   None were found on this pod spec.' },
    ],
  },
  'latest-tag': {
    badge: 'DENIED',
    badgeClass: 'denied',
    lines: [
      { cls: 'policy-comment', text: '# kubectl dry-run with :latest tag in production' },
      { cls: 'policy-line',    text: '' },
      { cls: 'policy-key',    text: 'Request:' },
      { cls: 'policy-line',   text: '  image: ghcr.io/myorg/fraud-detection:latest' },
      { cls: 'policy-line',   text: '  namespace: ml-production' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-key',    text: 'Kyverno Evaluation:' },
      { cls: 'policy-success', text: '  ✓ restrict-model-registry   PASS' },
      { cls: 'policy-error',  text: '  ✗ disallow-latest-model-tag FAIL' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-key',    text: 'Admission Webhook Response:' },
      { cls: 'policy-error',  text: 'Error from server: admission webhook denied:' },
      { cls: 'policy-line',   text: '' },
      { cls: 'policy-error',  text: '❌ Production model images must NOT use :latest' },
      { cls: 'policy-error',  text: '   Use semver (v1.0.0) or digest (sha256:...)' },
      { cls: 'policy-error',  text: '   Got: ghcr.io/myorg/fraud-detection:latest' },
    ],
  },
};

async function testPolicy(scenario) {
  // Update active button
  document.querySelectorAll('.scenario-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`scenario-${['approved','wrong-registry','missing-labels','latest-tag'].indexOf(scenario)+1}`).classList.add('active');

  const result = POLICY_RESULTS[scenario];
  const badge = document.getElementById('policy-badge');
  const body = document.getElementById('policy-result');

  badge.textContent = result.badge;
  badge.className = `policy-result-badge ${result.badgeClass}`;

  body.innerHTML = '';
  for (let i = 0; i < result.lines.length; i++) {
    await sleep(40);
    const line = document.createElement('div');
    line.className = result.lines[i].cls;
    line.textContent = result.lines[i].text || '\u00A0';
    line.style.animation = 'fadeInLeft 0.2s ease';
    body.appendChild(line);
  }
}

/* ══ Scroll-activated pipeline step highlights ══ */
const pipelineObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const delay = (parseInt(entry.target.dataset.step) - 1) * 100;
      setTimeout(() => {
        entry.target.querySelector('.step-card').style.opacity = '1';
        entry.target.querySelector('.step-card').style.transform = 'translateY(0)';
      }, delay);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.pipeline-step').forEach((step) => {
  step.querySelector('.step-card').style.opacity = '0';
  step.querySelector('.step-card').style.transform = 'translateY(24px)';
  pipelineObserver.observe(step);
});
