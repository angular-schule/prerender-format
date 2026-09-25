#!/usr/bin/env bash
# End-to-end test with a fresh Angular app.
#
# Usage: test-angular-app.sh <ng-new-command> <package-tgz> <angular-version-range>
#   ng-new-command:        command that runs `ng new`, e.g. "npx @angular/cli@22"
#   package-tgz:           packed @angular-schule/prerender-format
#   angular-version-range: version range for all @angular/* packages, e.g. "^22.0.0" or "~22.0.0"
#
# Checks: ng add refuses outputMode "server", ng add + ng build write foo.html files
# (also for a second locale), and a route "index" fails with a clear message.
set -euo pipefail

NG_NEW="$1"
TGZ="$2"
RANGE="$3"
APP=test-app

export NG_CLI_ANALYTICS=false

$NG_NEW new "$APP" --defaults --ssr --skip-git --skip-install
cd "$APP"

# Pin all @angular/* packages to the requested range
node -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  for (const deps of [pkg.dependencies, pkg.devDependencies]) {
    for (const name of Object.keys(deps ?? {})) {
      if (name.startsWith("@angular/")) deps[name] = process.argv[1];
    }
  }
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
' "$RANGE"
npm install --no-audit --no-fund
npm install --save-dev --no-audit --no-fund "$TGZ"
NG=./node_modules/.bin/ng
echo "@angular/build $(node -p 'require("@angular/build/package.json").version')"

set_build_option() {
  node -e '
    const fs = require("fs");
    const a = JSON.parse(fs.readFileSync("angular.json", "utf8"));
    a.projects["'"$APP"'"].architect.build.options[process.argv[1]] = JSON.parse(process.argv[2]);
    fs.writeFileSync("angular.json", JSON.stringify(a, null, 2));
  ' "$1" "$2"
}

expect_failure() {
  local expected="$1"
  shift
  if "$@" > output.log 2>&1; then
    cat output.log
    echo "Expected '$*' to fail"
    exit 1
  fi
  if ! grep -q "$expected" output.log; then
    cat output.log
    echo "Expected output to contain: $expected"
    exit 1
  fi
  echo "Failed as expected: $expected"
}

# ng new --ssr uses outputMode "server", which the "file" format refuses
expect_failure "ships an Angular SSR server" $NG add @angular-schule/prerender-format --skip-confirmation

set_build_option outputMode '"static"'
$NG add @angular-schule/prerender-format --skip-confirmation

cat > src/app/app.routes.ts <<'EOF'
import { Routes } from '@angular/router';
import { App } from './app';

export const routes: Routes = [
  { path: '', component: App },
  { path: 'about', component: App },
  { path: 'blog', component: App },
  { path: 'blog/article', component: App }
];
EOF

$NG build
(cd "dist/$APP/browser" && find . -name '*.html' | sort)
for file in index.html about.html blog.html blog/article.html; do
  test -f "dist/$APP/browser/$file" || { echo "Missing $file"; exit 1; }
done
for dir in about blog/article; do
  test ! -e "dist/$APP/browser/$dir/index.html" || { echo "Unexpected $dir/index.html"; exit 1; }
done

# Second locale: each locale keeps its start page as index.html
npm install --save-dev --no-audit --no-fund "@angular/localize@$RANGE"
$NG add @angular/localize --skip-confirmation
mkdir -p src/locale
cat > src/locale/messages.de.xlf <<'EOF'
<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en-US" target-language="de" datatype="plaintext" original="ng2.template">
    <body></body>
  </file>
</xliff>
EOF
node -e '
  const fs = require("fs");
  const a = JSON.parse(fs.readFileSync("angular.json", "utf8"));
  const project = a.projects["'"$APP"'"];
  project.i18n = { sourceLocale: "en-US", locales: { de: { translation: "src/locale/messages.de.xlf" } } };
  project.architect.build.options.localize = true;
  fs.writeFileSync("angular.json", JSON.stringify(a, null, 2));
'
$NG build
(cd "dist/$APP/browser" && find . -name '*.html' | sort)
for locale in en-US de; do
  for file in index.html about.html blog.html blog/article.html; do
    test -f "dist/$APP/browser/$locale/$file" || { echo "Missing $locale/$file"; exit 1; }
  done
  test ! -e "dist/$APP/browser/$locale/about/index.html" || { echo "Unexpected $locale/about/index.html"; exit 1; }
done

# A route "index" would overwrite the start page
node -e '
  const fs = require("fs");
  const file = "src/app/app.routes.ts";
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("];", ",\n  { path: \"index\", component: App }\n];"));
'
expect_failure "Route '/index' cannot be prerendered" $NG build

echo "Angular $RANGE: prerender format 'file' successful"
