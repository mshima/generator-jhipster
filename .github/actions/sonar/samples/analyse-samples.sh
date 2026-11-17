#!/usr/bin/env bash
#
# Copyright 2013-2026 the original author or authors from the JHipster project.
#
# This file is part of the JHipster project, see https://www.jhipster.tech/
# for more information.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Analyses each sample the collect action uploaded, as it is, as a SonarQube project of its own, with the parts of it
# the sample job tested (its .sonar-parts: backend, client), and writes the results of every sample to one report.
#
# Usage: analyse-samples.sh <samples dir> <report file>
# The samples dir has a sonar-<sample> folder for each sample, its application.
# Environment: SONAR_HOST_URL, SONAR_TOKEN. Writes ISSUES, the unresolved issues of every sample, and FAILED_SAMPLES,
# the samples whose analysis failed, to GITHUB_ENV.

set -uo pipefail

samples_dir=$1
report=$2

: "${SONAR_HOST_URL:?}" "${SONAR_TOKEN:?}"

# The scanner runs as the runner user, for it to write into the sample; its cache is shared by the samples.
scanner_home="${RUNNER_TEMP:-/tmp}/sonar-scanner-home"
mkdir -p "$scanner_home" "$HOME/.m2" "$HOME/.gradle"

# The dependencies of the Java code are not in the sample: the scanner reads the ones of the maven and gradle caches.
scan() {
  docker run --rm --net=host --user "$(id -u):$(id -g)" \
    -v "$(pwd):/usr/src" \
    -v "$scanner_home:/opt/sonar-scanner/.sonar" \
    -v "$HOME/.m2:/libs/m2:ro" \
    -v "$HOME/.gradle:/libs/gradle:ro" \
    sonarsource/sonar-scanner-cli \
    -Dsonar.host.url="$SONAR_HOST_URL" \
    -Dsonar.token="$SONAR_TOKEN" \
    -Dsonar.java.libraries='/libs/m2/repository/**/*.jar,/libs/gradle/caches/modules-2/files-2.1/**/*.jar' \
    "$@"
}

wait_for_tasks() {
  local project=$1
  timeout 300s bash -c "while :; do
    response=\$(curl -s -u $SONAR_TOKEN: '$SONAR_HOST_URL/api/ce/component?component=$project')
    queue_status=\$(echo \"\$response\" | jq -r '.queue[]?.status')
    current_status=\$(echo \"\$response\" | jq -r '.current.status')
    if [[ -z \"\$queue_status\" && \"\$current_status\" != 'IN_PROGRESS' ]]; then
      break
    fi
    sleep 10
  done"
}

measure() {
  local response=$1 metric=$2 value
  value=$(echo "$response" | jq -r ".component.measures[]? | select(.metric == \"$metric\") | .value")
  if [ -z "$value" ] || [ "$value" == "null" ]; then
    value="N/A"
  fi
  echo "$value"
}

percent() {
  local value
  value=$(measure "$1" "$2")
  [ "$value" == "N/A" ] && echo "$value" || echo "$value%"
}

# The folder of the compiled classes of the backend, by its build tool.
classes_dir() {
  if [ -d target/classes ]; then
    echo target/classes
  elif [ -d build/classes/java/main ]; then
    echo build/classes/java/main
  fi
}

# Analyses a sample, and appends its row to rows and its issues to issues. Returns 2 when it has no part to analyse.
analyse_sample() {
  local sample_dir=$1 project=$2 backend=false client=false parts=() options=() classes
  # shellcheck disable=SC1091
  [ -f "$sample_dir/.sonar-parts" ] && source "$sample_dir/.sonar-parts"
  [ -d "$sample_dir/src/main/webapp" ] || client=false
  classes=$(cd "$sample_dir" && classes_dir)
  [ -n "$classes" ] || backend=false

  if [ "$backend" == true ]; then
    parts+=(backend)
    options+=(-Dsonar.java.binaries="$classes")
    # The client is left out: its sources, its tests and its coverage report.
    [ "$client" == true ] || options+=(-Dsonar.sources=src/main/java,src/main/resources -Dsonar.tests=src/test -Dsonar.javascript.lcov.reportPaths=)
  fi
  if [ "$client" == true ]; then
    parts+=(client)
    # The backend is left out: its sources, which the Java analysis cannot read without their compiled classes.
    [ "$backend" == true ] || options+=(-Dsonar.sources=src/main/webapp -Dsonar.tests=src/main/webapp)
  fi
  [ ${#parts[@]} -gt 0 ] || return 2

  curl -sf -u "$SONAR_TOKEN:" -X POST "$SONAR_HOST_URL/api/projects/create?name=$project&project=$project" > /dev/null || return 1

  echo "::group::Scanning $project (${parts[*]})"
  (cd "$sample_dir" && scan -Dsonar.projectKey="$project" -Dsonar.projectName="$project" ${options[@]+"${options[@]}"}) || return 1
  echo "::endgroup::"

  wait_for_tasks "$project" || return 1

  local measures sample_issues
  measures=$(curl -s -u "$SONAR_TOKEN:" \
    "$SONAR_HOST_URL/api/measures/component?component=$project&metricKeys=violations,bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density")
  sample_issues=$(measure "$measures" violations)

  rows+="| $project | ${parts[*]} | $sample_issues | $(measure "$measures" bugs) | $(measure "$measures" vulnerabilities) | $(measure "$measures" code_smells) | $(percent "$measures" coverage) | $(percent "$measures" duplicated_lines_density) |"$'\n'

  if [[ "$sample_issues" != "N/A" && "$sample_issues" != "0" ]]; then
    issues_total=$((issues_total + sample_issues))
    issues+="<details><summary>$project: $sample_issues unresolved issues (click to expand, the first 100)</summary>"$'\n\n'
    issues+=$(curl -s -u "$SONAR_TOKEN:" \
      "$SONAR_HOST_URL/api/issues/search?componentKeys=$project&resolved=false&ps=100" |
      jq -r '.issues[] | "File: \(.component) Line: \(.line)\n  [\(.rule)] \(.message)\n"')
    issues+=$'\n'"</details>"$'\n'
  fi
}

rows=""
issues=""
failed=()
skipped=()
issues_total=0

for sample_dir in "$samples_dir"/sonar-*/; do
  sample_dir=${sample_dir%/}
  project=$(basename "$sample_dir")
  project=${project#sonar-}
  analyse_sample "$sample_dir" "$project"
  case $? in
    0) ;;
    2) skipped+=("$project") ;;
    *)
      echo "::endgroup::"
      echo "::error::SonarQube analysis of $project failed"
      failed+=("$project")
      ;;
  esac
done

{
  echo "## :bar_chart: SonarQube Analysis of the samples"
  echo ""
  echo "| Sample | Analysed | Violations | Bugs | Vulnerabilities | Code Smells | Coverage | Duplication |"
  echo "|--------|----------|------------|------|-----------------|-------------|----------|-------------|"
  echo -n "$rows"
  if [ ${#skipped[@]} -gt 0 ]; then
    echo ""
    echo "Not analysed, their jobs tested neither the backend nor the client: ${skipped[*]}."
  fi
  if [ ${#failed[@]} -gt 0 ]; then
    echo ""
    echo "The analysis failed for: ${failed[*]}."
  fi
  if [ -n "$issues" ]; then
    echo ""
    echo "$issues"
  fi
} > "$report"

echo "ISSUES=$issues_total" >> "$GITHUB_ENV"
echo "FAILED_SAMPLES=${failed[*]-}" >> "$GITHUB_ENV"
