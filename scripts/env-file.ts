/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";

const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;
const COMMENTED_ASSIGNMENT = /^\s*#\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/**
 * Sets `vars` in an env file's text and leaves every other line alone: comments, blank lines,
 * ordering and unrelated keys survive. A key that is already set is updated in place. A key
 * that only appears commented out (as in .env.example, `# KEY=0x...`) replaces that line.
 * Anything else is appended.
 */
export function updateEnvText(existing: string, vars: Record<string, string>): string {
  const lines = existing === "" ? [] : existing.replace(/\r?\n$/, "").split(/\r?\n/);
  const pending = new Map(Object.entries(vars));

  for (const pattern of [ASSIGNMENT, COMMENTED_ASSIGNMENT]) {
    for (let i = 0; i < lines.length; i++) {
      const key = lines[i].match(pattern)?.[1];
      if (key !== undefined && pending.has(key)) {
        lines[i] = `${key}=${pending.get(key)}`;
        pending.delete(key);
      }
    }
  }

  for (const [key, value] of pending) lines.push(`${key}=${value}`);
  return lines.join("\n") + "\n";
}

export function writeEnvFile(envPath: string, vars: Record<string, string>) {
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  fs.writeFileSync(envPath, updateEnvText(existing, vars));
}
