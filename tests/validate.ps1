param([string]$NodePath = "")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$failures = New-Object System.Collections.Generic.List[string]
$required = @(
  "index.html", "assets/styles.css", "assets/app.js", "assets/analysis.mjs",
  "assets/fixtures/balanced-launch.png", "assets/fixtures/blown-highlights.png", "assets/fixtures/flat-export.png",
  "data/fixtures.json", "tests/analysis.test.mjs", "tests/browser-smoke.mjs",
  "tools/generate-fixtures.ps1", "tools/static-server.mjs", "tools/static-server.ps1",
  "README.md", "docs/ARCHITECTURE.md", "docs/CASE_STUDY.md", "docs/RELEASE_NOTES.md", "docs/VALIDATION.md",
  "docs/screenshots/frameforge-inspection-desktop.png", "docs/screenshots/frameforge-inspection-mobile.png",
  "package.json", "LICENSE", ".gitignore", ".env.example", ".nojekyll"
)
foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $file))) { $failures.Add("Missing required file: $file") }
}
try {
  $fixture = Get-Content -Raw -LiteralPath (Join-Path $root "data/fixtures.json") | ConvertFrom-Json
  if ($fixture.fixtures.Count -ne 3) { $failures.Add("Exactly three synthetic fixtures are required.") }
  if ($fixture.notice -notmatch "fictional") { $failures.Add("Synthetic fixture notice missing.") }
} catch { $failures.Add("Fixture manifest is invalid JSON.") }

$html = Get-Content -Raw -LiteralPath (Join-Path $root "index.html")
foreach ($hook in @('<meta name="viewport"', 'class="skip-link"', 'id="workspace"', 'aria-live=', 'type="module"')) {
  if ($html -notmatch [Regex]::Escape($hook)) { $failures.Add("index.html missing $hook") }
}

$files = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object {
  $_.FullName -notmatch "\\.git\\" -and $_.FullName -ne $MyInvocation.MyCommand.Path -and
  $_.Extension -in @(".html", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".example", ".ps1")
}
$text = ($files | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName }) -join "`n"
foreach ($pattern in @("(?i)gmail\.com", "sk-[A-Za-z0-9]{20,}", "gh[opsu]_[A-Za-z0-9]{20,}", "BEGIN (RSA|OPENSSH) PRIVATE KEY")) {
  if ($text -match $pattern) { $failures.Add("Potential private information or secret found: $pattern") }
}
foreach ($phrase in @("synthetic", "deterministic", "human", "No file leaves", "Canvas", "AI-assisted")) {
  if ($text -notmatch [Regex]::Escape($phrase)) { $failures.Add("Disclosure phrase missing: $phrase") }
}

if (-not $NodePath) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) { $NodePath = $node.Source }
}
if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) {
  $failures.Add("Node.js not found; pass -NodePath.")
} else {
  & $NodePath (Join-Path $root "tests/analysis.test.mjs")
  if ($LASTEXITCODE -ne 0) { $failures.Add("Logic tests failed.") }
}

if ($failures.Count) {
  Write-Host "FRAMEFORGE VALIDATION FAILED"
  foreach ($failure in $failures) { Write-Host "- $failure" }
  exit 1
}
Write-Host "FRAMEFORGE VALIDATION PASSED"
Write-Host "Checked files, bitmap fixtures, disclosures, privacy patterns, accessibility hooks, and pixel-analysis logic."
