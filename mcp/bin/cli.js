#!/usr/bin/env node
// The published entrypoint. It does exactly one thing -- start the server --
// so there is no environment-dependent condition that can decide not to.
import { startStdioServer } from '../src/stdio.js';

await startStdioServer();
