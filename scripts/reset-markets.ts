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

import { rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Same location as lib/server/markets-store.ts: MARKETS_FILE, or the gitignored runtime file.
const __dirname = dirname(fileURLToPath(import.meta.url));
const marketsPath = process.env.MARKETS_FILE ?? resolve(__dirname, "../data/markets.local.json");

rmSync(marketsPath, { force: true });
console.log("All custom prediction markets have been wiped. The Bitcoin market is unaffected.");
