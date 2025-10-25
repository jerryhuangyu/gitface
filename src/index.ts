#!/usr/bin/env node

import { runCLI } from "@/cli";
import { version } from "../package.json";

runCLI(version);
