import { run } from './vitest-shim';
import '../src/engine/__tests__/rules.test';
import '../src/engine/__tests__/knowledge.test';
import '../src/engine/__tests__/engine.test';
import '../src/engine/__tests__/projections.test';
import '../src/server/__tests__/rooms.test';
import '../src/lib/__tests__/guide.test';
void run();
