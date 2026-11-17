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

import { describe, expect, it } from "vitest";
import { updateEnvText } from "../../scripts/env-file";

describe("updateEnvText (deploy script .env.local writer)", () => {
  const existing = [
    "# Deployer wallet private key (for contract deployment)",
    "PRIVATE_KEY=abc",
    "",
    "# Arc Testnet RPC URL",
    "NEXT_PUBLIC_ALCHEMY_RPC_URL=https://rpc.testnet.arc.io",
    "",
    "# Contract addresses (auto-written by deploy script)",
    "NEXT_PUBLIC_MARKET_ADDRESS=0xold",
    "# NEXT_PUBLIC_AMM_ADDRESS=0x...",
    "",
  ].join("\n");

  it("keeps comments, blank lines and unrelated keys", () => {
    const out = updateEnvText(existing, { NEXT_PUBLIC_MARKET_ADDRESS: "0xnew" });
    expect(out).toBe(existing.replace("0xold", "0xnew"));
  });

  it("fills a commented-out placeholder in place, as copied from .env.example", () => {
    const out = updateEnvText(existing, { NEXT_PUBLIC_AMM_ADDRESS: "0xamm" });
    expect(out).toContain("NEXT_PUBLIC_MARKET_ADDRESS=0xold\nNEXT_PUBLIC_AMM_ADDRESS=0xamm\n");
    expect(out).not.toContain("# NEXT_PUBLIC_AMM_ADDRESS");
  });

  it("prefers updating a real assignment over a commented one", () => {
    const out = updateEnvText("# KEY=old-example\nKEY=old\n", { KEY: "new" });
    expect(out).toBe("# KEY=old-example\nKEY=new\n");
  });

  it("appends keys it has not seen, and works on an empty or missing file", () => {
    expect(updateEnvText("A=1\n", { B: "2" })).toBe("A=1\nB=2\n");
    expect(updateEnvText("", { B: "2" })).toBe("B=2\n");
  });

  it("does not touch a value that contains '=' or a comment that merely mentions a key", () => {
    const text = "# set PRIVATE_KEY before deploying\nURL=https://x/?a=b\n";
    expect(updateEnvText(text, { NEW: "1" })).toBe(text + "NEW=1\n");
  });
});
