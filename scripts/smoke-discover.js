const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const scenarios = [
  { name: 'White mug', message: 'white mug', expectResults: true },
  { name: 'Black hoodie under 100', message: 'black hoodie under 100 euros', expectResults: true },
  { name: 'Eco tote natural', message: 'natural eco tote', expectResults: true },
  { name: 'Premium tee navy', message: 'navy premium tee', expectResults: true },
  { name: 'Impossible color', message: 'white hoodie', expectResults: false }
];

async function run() {
  let failures = 0;

  for (const scenario of scenarios) {
    const body = {
      userMessage: scenario.message,
      stream: false,
      state: { stage: 'welcome', constraints: {} }
    };

    const res = await fetch(`${BASE_URL}/api/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    const results = data?.results || [];
    const ok = scenario.expectResults ? results.length > 0 : results.length === 0;

    if (!ok) {
      failures += 1;
      console.error(`[FAIL] ${scenario.name}`);
      console.error(`  message: ${scenario.message}`);
      console.error(`  results: ${results.length}`);
      console.error(`  assistant: ${data?.assistantMessage || ''}`);
    } else {
      console.log(`[PASS] ${scenario.name}`);
    }
  }

  if (failures > 0) {
    console.error(`\nSmoke tests failed: ${failures}`);
    process.exit(1);
  }

  console.log('\nSmoke tests passed.');
}

run().catch((err) => {
  console.error('[ERROR] Smoke tests crashed:', err);
  process.exit(1);
});
